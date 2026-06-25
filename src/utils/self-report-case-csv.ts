import { HttpError } from "./http-error";

export interface SelfReportCaseCsvInput {
  title: string;
  content: string;
  reporterName?: string;
  reporterPhone?: string;
  location?: string;
}

export const SELF_REPORT_CASE_CSV_HEADER = "제목,내용,신고자명,연락처,위치";

export const SELF_REPORT_CASE_SAMPLE_CSV = [
  SELF_REPORT_CASE_CSV_HEADER,
  "선로 주변 낙석 위험 신고,선로 인근 암반에서 낙석 흔적이 확인되어 신고합니다.,홍길동,010-1234-5678,경북 영주시",
  "건널목 신호등 고장,건널목 신호등이 점멸하지 않습니다.,김철수,010-9876-5432,전북 익산시",
].join("\n");

export const MAX_SELF_REPORT_CASE_CSV_ROWS = 200;

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

  if (titleIdx === -1 || contentIdx === -1) {
    throw new HttpError(400, "CSV 규격에 필수 칼럼(제목, 내용)이 없습니다.");
  }

  const parsed: SelfReportCaseCsvInput[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[titleIdx]?.trim() ?? "";
    const content = row[contentIdx]?.trim() ?? "";
    if (!title && !content && row.every((cell) => !cell?.trim())) continue;
    if (!title || !content) {
      throw new HttpError(400, `${i + 1}행: 제목과 내용은 필수입니다.`);
    }
    parsed.push({
      title,
      content,
      reporterName: reporterIdx !== -1 ? row[reporterIdx]?.trim() || undefined : undefined,
      reporterPhone: phoneIdx !== -1 ? row[phoneIdx]?.trim() || undefined : undefined,
      location: locationIdx !== -1 ? row[locationIdx]?.trim() || undefined : undefined,
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
