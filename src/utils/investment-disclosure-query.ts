import type { Request } from "express";

export function parseAgenciesFromQuery(req: Request): string[] | undefined {
  const raw = req.query.agencies;
  if (Array.isArray(raw)) {
    const list = raw.map((v) => String(v).trim()).filter(Boolean);
    return list.length ? list : undefined;
  }
  if (typeof raw === "string" && raw.trim()) {
    const list = raw.split(",").map((v) => v.trim()).filter(Boolean);
    return list.length ? list : undefined;
  }
  const legacy = req.query.agency;
  if (typeof legacy === "string" && legacy.trim() && legacy !== "ALL") {
    return [legacy.trim()];
  }
  return undefined;
}
