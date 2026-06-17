import fs from "fs/promises";
import path from "path";
import { HttpError } from "./http-error";

const LOGO_DIR = path.join(process.cwd(), "uploads", "branding");
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function isPngBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

export async function ensureLogoDir(): Promise<void> {
  await fs.mkdir(LOGO_DIR, { recursive: true });
}

export async function saveBrandingLogo(buffer: Buffer, scopeKey: string): Promise<string> {
  if (!isPngBuffer(buffer)) {
    throw new HttpError(400, "PNG 파일만 업로드할 수 있습니다.");
  }
  if (buffer.length > MAX_LOGO_BYTES) {
    throw new HttpError(400, "로고 파일은 2MB 이하여야 합니다.");
  }

  await ensureLogoDir();
  const safeKey = scopeKey.replace(/[^a-zA-Z0-9_-]/g, "") || "logo";
  const filename = `${safeKey}-${Date.now()}.png`;
  await fs.writeFile(path.join(LOGO_DIR, filename), buffer);
  return `/uploads/branding/${filename}`;
}

export async function deleteBrandingLogo(logoUrl: string | null | undefined): Promise<void> {
  if (!logoUrl?.startsWith("/uploads/branding/")) return;
  const filePath = path.join(process.cwd(), logoUrl.replace(/^\//, ""));
  await fs.unlink(filePath).catch(() => undefined);
}

export function parseLogoDataUrl(logoData: string): Buffer {
  const trimmed = logoData.trim();
  const match = trimmed.match(/^data:image\/png;base64,(.+)$/i);
  const base64 = match ? match[1] : trimmed;

  try {
    return Buffer.from(base64, "base64");
  } catch {
    throw new HttpError(400, "로고 파일 형식이 올바르지 않습니다.");
  }
}
