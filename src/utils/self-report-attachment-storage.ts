import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { HttpError } from "./http-error";

const ATTACHMENT_ROOT = path.join(process.cwd(), "uploads", "self-report");
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_CASE = 10;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
};

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^\w.\-가-힣]/g, "_");
  return base.slice(0, 120) || "file";
}

export function parseAttachmentDataUrl(data: string, mimeType: string): Buffer {
  const trimmed = data.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  const base64 = match ? match[2] : trimmed;

  try {
    return Buffer.from(base64, "base64");
  } catch {
    throw new HttpError(400, "첨부파일 형식이 올바르지 않습니다.");
  }
}

export async function saveSelfReportAttachment(params: {
  caseId: number;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ storedName: string; url: string; fileSize: number }> {
  const mimeType = params.mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new HttpError(400, "허용되지 않는 파일 형식입니다.");
  }
  if (params.buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new HttpError(400, `첨부파일은 ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB 이하여야 합니다.`);
  }

  const caseDir = path.join(ATTACHMENT_ROOT, String(params.caseId));
  await fs.mkdir(caseDir, { recursive: true });

  const ext = EXT_BY_MIME[mimeType] ?? (path.extname(params.fileName) || "");
  const storedName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  await fs.writeFile(path.join(caseDir, storedName), params.buffer);

  return {
    storedName,
    url: `/uploads/self-report/${params.caseId}/${storedName}`,
    fileSize: params.buffer.length,
  };
}

export async function deleteSelfReportAttachmentFile(url: string): Promise<void> {
  const prefix = "/uploads/self-report/";
  if (!url.startsWith(prefix)) return;
  const relative = url.slice(prefix.length);
  const filePath = path.join(ATTACHMENT_ROOT, relative);
  await fs.unlink(filePath).catch(() => undefined);
}

export async function deleteSelfReportCaseAttachmentDir(caseId: number): Promise<void> {
  const caseDir = path.join(ATTACHMENT_ROOT, String(caseId));
  await fs.rm(caseDir, { recursive: true, force: true }).catch(() => undefined);
}
