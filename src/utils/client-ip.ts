import type { Request } from "express";
import { HttpError } from "./http-error";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() ?? "";
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim() ?? "";
  }
  return req.socket.remoteAddress?.replace(/^::ffff:/, "") ?? "";
}

export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (!trimmed) return "";
  if (trimmed === "::1") return "127.0.0.1";
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  return trimmed;
}

export function isValidIp(ip: string): boolean {
  const value = ip.trim();
  if (!value) return false;

  const ipv4Parts = value.split(".");
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => /^\d+$/.test(part))) {
    return ipv4Parts.every((part) => {
      const num = Number(part);
      return num >= 0 && num <= 255;
    });
  }

  return /^[0-9a-fA-F:.]+$/.test(value) && value.includes(":");
}

export function assertIpAllowed(
  user: { ipRestrictionEnabled: boolean; allowedIp: string | null },
  clientIp: string,
): void {
  if (!user.ipRestrictionEnabled) return;

  const allowedIp = user.allowedIp?.trim();
  if (!allowedIp) {
    throw new HttpError(403, "이 계정에 허용 IP가 설정되어 있지 않습니다.");
  }

  if (normalizeIp(clientIp) !== normalizeIp(allowedIp)) {
    throw new HttpError(403, "등록된 IP에서만 접속할 수 있습니다.");
  }
}

export function parseIpRestrictionInput(input: {
  ipRestrictionEnabled?: boolean;
  allowedIp?: string | null;
}): { ipRestrictionEnabled: boolean; allowedIp: string | null } {
  const ipRestrictionEnabled = Boolean(input.ipRestrictionEnabled);
  const allowedIp = input.allowedIp?.trim() || null;

  if (ipRestrictionEnabled) {
    if (!allowedIp) {
      throw new HttpError(400, "IP 고정 사용 시 허용 IP를 입력해야 합니다.");
    }
    if (!isValidIp(allowedIp)) {
      throw new HttpError(400, "허용 IP 형식이 올바르지 않습니다.");
    }
  }

  return {
    ipRestrictionEnabled,
    allowedIp: ipRestrictionEnabled && allowedIp ? normalizeIp(allowedIp) : null,
  };
}
