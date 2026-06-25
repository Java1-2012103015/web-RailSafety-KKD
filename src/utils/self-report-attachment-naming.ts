import path from "path";

/** 접수번호 SR-YYYYMMDD-0003 → 일련번호 0003 */
export function extractSelfReportSerialKey(receiptNumber: string): string {
  const trimmed = receiptNumber.trim();
  const match = trimmed.match(/-(\d{4})$/);
  if (match) return match[1];
  const segments = trimmed.split("-");
  const last = segments[segments.length - 1];
  return /^\d+$/.test(last) ? last.padStart(4, "0") : trimmed;
}

export type ParsedBulkAttachmentName = {
  serialKey?: string;
  receiptNumber?: string;
  index: number;
  extension: string;
};

/** 파일명 0003_01.jpg 또는 SR-20260624-0003_02.png 파싱 */
export function parseBulkAttachmentFileName(fileName: string): ParsedBulkAttachmentName | null {
  const base = path.basename(fileName);
  const extension = path.extname(base);
  const stem = extension ? base.slice(0, -extension.length) : base;

  const fullMatch = stem.match(/^(SR-\d{8}-\d{4})_(\d{2})$/i);
  if (fullMatch) {
    return {
      receiptNumber: fullMatch[1].toUpperCase(),
      index: Number(fullMatch[2]),
      extension,
    };
  }

  const shortMatch = stem.match(/^(\d{4})_(\d{2})$/);
  if (shortMatch) {
    return {
      serialKey: shortMatch[1],
      index: Number(shortMatch[2]),
      extension,
    };
  }

  return null;
}

export function buildSelfReportAttachmentFileName(
  receiptNumber: string,
  index: number,
  extension: string,
): string {
  const serialKey = extractSelfReportSerialKey(receiptNumber);
  const ext = extension.startsWith(".") || !extension ? extension : `.${extension}`;
  return `${serialKey}_${String(index).padStart(2, "0")}${ext}`;
}

export function maxAttachmentIndexForSerial(existingFileNames: string[], serialKey: string): number {
  const pattern = new RegExp(`^${serialKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(\\d{2})`);
  let max = 0;
  for (const name of existingFileNames) {
    const base = path.basename(name);
    const stem = path.extname(base) ? base.slice(0, -path.extname(base).length) : base;
    const match = stem.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

export function allocateAttachmentSlotIndexes(
  existingFileNames: string[],
  receiptNumber: string,
  count: number,
): number[] {
  const serialKey = extractSelfReportSerialKey(receiptNumber);
  let next = maxAttachmentIndexForSerial(existingFileNames, serialKey);
  return Array.from({ length: count }, () => {
    next += 1;
    return next;
  });
}

export function resolveSelfReportAttachmentFileName(params: {
  receiptNumber: string;
  originalFileName: string;
  existingFileNames: string[];
  slotIndex?: number;
}): string {
  const parsed = parseBulkAttachmentFileName(params.originalFileName);
  const extension =
    parsed?.extension ||
    path.extname(params.originalFileName) ||
    "";

  if (parsed?.index && receiptNumberMatchesParsed(params.receiptNumber, parsed)) {
    return buildSelfReportAttachmentFileName(params.receiptNumber, parsed.index, extension);
  }

  const slot =
    params.slotIndex ??
    allocateAttachmentSlotIndexes(params.existingFileNames, params.receiptNumber, 1)[0];

  return buildSelfReportAttachmentFileName(params.receiptNumber, slot, extension);
}

function receiptNumberMatchesParsed(receiptNumber: string, parsed: ParsedBulkAttachmentName): boolean {
  if (parsed.receiptNumber) {
    return receiptNumber.toUpperCase() === parsed.receiptNumber.toUpperCase();
  }
  if (parsed.serialKey) {
    return extractSelfReportSerialKey(receiptNumber) === parsed.serialKey;
  }
  return false;
}
