import { HttpError } from "./http-error";

export interface SelfReportCaseCsvInput {
  title: string;
  content: string;
  reporterName?: string;
  reporterPhone?: string;
  location?: string;
  /** 접수번호 전체 (SR-YYYYMMDD-0003) */
  receiptNumber?: string;
  /** 접수번호 일련번호 (0003) — 접수번호 미입력 시 당일 접수번호 생성에 사용 */
  serialNo?: string;
}

export const SELF_REPORT_CASE_CSV_HEADER = "일련번호,제목,내용,신고자명,연락처,위치";

export const SELF_REPORT_CASE_SAMPLE_CSV = [
  SELF_REPORT_CASE_CSV_HEADER,
  "0001,선로 주변 낙석 위험 신고,선로 인근 암반에서 낙석 흔적이 확인되어 신고합니다.,홍길동,010-1234-5678,경북 영주시",
  "0002,건널목 신호등 고장,건널목 신호등이 점멸하지 않습니다.,김철수,010-9876-5432,전북 익산시",
].join("\n");

export const MAX_SELF_REPORT_CASE_CSV_ROWS = 200;
export const MAX_SELF_REPORT_SERIAL_DIGITS = 20;

const FULL_RECEIPT_NUMBER_PATTERN = new RegExp(
  `^SR-\\d{8}-\\d{1,${MAX_SELF_REPORT_SERIAL_DIGITS}}$`,
  "i",
);

export function normalizeSelfReportSerialNo(value: string): string {
  const digits = value.trim().replace(/\D/g, "");
  if (!digits) {
    throw new HttpError(400, "일련번호는 숫자여야 합니다.");
  }
  if (digits.length > MAX_SELF_REPORT_SERIAL_DIGITS) {
    throw new HttpError(400, `일련번호는 ${MAX_SELF_REPORT_SERIAL_DIGITS}자리 이하여야 합니다.`);
  }
  return digits;
}

export function normalizeSelfReportReceiptNumber(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!FULL_RECEIPT_NUMBER_PATTERN.test(normalized)) {
    throw new HttpError(
      400,
      `접수번호는 SR-YYYYMMDD-일련번호 형식이어야 합니다. (일련번호 최대 ${MAX_SELF_REPORT_SERIAL_DIGITS}자리)`,
    );
  }
  return normalized;
}

export function buildReceiptNumberFromSerial(serialNo: string, date = new Date()): string {
  const serial = normalizeSelfReportSerialNo(serialNo);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `SR-${y}${m}${d}-${serial}`;
}

function parseCsvRows(text: string): string[][] {
  const lines: string[][] = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      row.push("");
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && next === "\n") i++;
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== "") lines.push(row);
  return lines;
}

function headerIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().replace(/^\uFEFF/, "").toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseSelfReportCaseCsv(csv?: string): SelfReportCaseCsvInput[] {
  if (!csv?.trim()) {
    throw new HttpError(400, "CSV 내용이 비어 있습니다.");
  }

  const rows = parseCsvRows(csv.trim());
  if (rows.length < 2) {
    throw new HttpError(400, "유효한 CSV 데이터 행을 찾을 수 없습니다.");
  }

  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  const titleIdx = headerIndex(headers, ["제목", "title"]);
  const contentIdx = headerIndex(headers, ["내용", "content"]);
  const reporterIdx = headerIndex(headers, ["신고자명", "reportername", "신고자"]);
  const phoneIdx = headerIndex(headers, ["연락처", "reporterphone", "전화번호"]);
  const locationIdx = headerIndex(headers, ["위치", "location"]);
  const receiptIdx = headerIndex(headers, ["접수번호", "receiptnumber"]);
  const serialIdx = headerIndex(headers, [
    "일련번호",
    "접수번호일련번호",
    "serialno",
    "serial",
  ]);

  if (titleIdx === -1 || contentIdx === -1) {
    throw new HttpError(400, "CSV 규격에 필수 칼럼(제목, 내용)이 없습니다.");
  }

  const parsed: SelfReportCaseCsvInput[] = [];
  const receiptNumbersInFile = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[titleIdx]?.trim() ?? "";
    const content = row[contentIdx]?.trim() ?? "";
    if (!title && !content && row.every((cell) => !cell?.trim())) continue;
    if (!title || !content) {
      throw new HttpError(400, `${i + 1}행: 제목과 내용은 필수입니다.`);
    }

    const receiptRaw = receiptIdx !== -1 ? row[receiptIdx]?.trim() ?? "" : "";
    const serialRaw = serialIdx !== -1 ? row[serialIdx]?.trim() ?? "" : "";

    let receiptNumber: string | undefined;
    let serialNo: string | undefined;

    if (receiptRaw) {
      receiptNumber = normalizeSelfReportReceiptNumber(receiptRaw);
    } else if (serialRaw) {
      serialNo = normalizeSelfReportSerialNo(serialRaw);
      receiptNumber = buildReceiptNumberFromSerial(serialNo);
    }

    if (receiptNumber) {
      if (receiptNumbersInFile.has(receiptNumber)) {
        throw new HttpError(400, `${i + 1}행: CSV 내 접수번호(${receiptNumber})가 중복됩니다.`);
      }
      receiptNumbersInFile.add(receiptNumber);
    }

    parsed.push({
      title,
      content,
      reporterName: reporterIdx !== -1 ? row[reporterIdx]?.trim() || undefined : undefined,
      reporterPhone: phoneIdx !== -1 ? row[phoneIdx]?.trim() || undefined : undefined,
      location: locationIdx !== -1 ? row[locationIdx]?.trim() || undefined : undefined,
      receiptNumber,
      serialNo,
    });
  }

  if (!parsed.length) {
    throw new HttpError(400, "등록할 민원 데이터가 없습니다.");
  }
  if (parsed.length > MAX_SELF_REPORT_CASE_CSV_ROWS) {
    throw new HttpError(400, `한 번에 최대 ${MAX_SELF_REPORT_CASE_CSV_ROWS}건까지 등록할 수 있습니다.`);
  }

  return parsed;
}
