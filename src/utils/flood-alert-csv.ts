import { HttpError } from "./http-error";

export interface FloodAlertInput {
  accidentNumber: string;
  agencyName: string;
  lineName: string;
  siteName: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  accidentAt: Date | null;
  accidentAtText: string | null;
  rainfall15mMm: number | null;
  rainfall30mMm: number | null;
  rainfall60mMm: number | null;
  rainfall360mMm: number | null;
  rainfallMm: number | null;
  weatherStationCode: string | null;
  notes: string | null;
}

export const FLOOD_ALERT_CSV_HEADER =
  "사고번호,기관명,노선명,개소명,사고위치,위도,경도,사고일시,강우15분(mm),강우30분(mm),강우60분(mm),강우360분(mm),기상관측소코드,비고";

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

function findHeaderIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

function parseNumber(value?: string): number | null {
  const raw = value?.trim().replace(/,/g, "") ?? "";
  if (!raw) return null;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value?: string): { date: Date | null; text: string | null } {
  const text = value?.trim() ?? "";
  if (!text) return { date: null, text: null };
  const normalized = text.replace(/\./g, "-").replace(/\s+/g, " ");
  const parsed = new Date(normalized);
  return {
    date: Number.isNaN(parsed.getTime()) ? null : parsed,
    text,
  };
}

function normalizeRainfallFields(input: {
  rainfall15mMm: number | null;
  rainfall30mMm: number | null;
  rainfall60mMm: number | null;
  rainfall360mMm: number | null;
  legacyRainfallMm: number | null;
}): Pick<
  FloodAlertInput,
  "rainfall15mMm" | "rainfall30mMm" | "rainfall60mMm" | "rainfall360mMm" | "rainfallMm"
> {
  const rainfall60mMm = input.rainfall60mMm ?? input.legacyRainfallMm;
  return {
    rainfall15mMm: input.rainfall15mMm,
    rainfall30mMm: input.rainfall30mMm,
    rainfall60mMm,
    rainfall360mMm: input.rainfall360mMm,
    rainfallMm: rainfall60mMm,
  };
}

function toRowData(row: FloodAlertInput) {
  const rainfall = normalizeRainfallFields({
    rainfall15mMm: row.rainfall15mMm,
    rainfall30mMm: row.rainfall30mMm,
    rainfall60mMm: row.rainfall60mMm,
    rainfall360mMm: row.rainfall360mMm,
    legacyRainfallMm: row.rainfallMm,
  });

  return {
    accidentNumber: row.accidentNumber,
    agencyName: row.agencyName,
    lineName: row.lineName,
    siteName: row.siteName,
    location: row.location,
    latitude: row.latitude,
    longitude: row.longitude,
    accidentAt: row.accidentAt,
    accidentAtText: row.accidentAtText,
    ...rainfall,
    weatherStationCode: row.weatherStationCode,
    notes: row.notes,
  };
}

export function dedupeFloodAlertRowsByAccidentNumber(rows: FloodAlertInput[]): FloodAlertInput[] {
  const map = new Map<string, FloodAlertInput>();
  for (const row of rows) {
    map.set(row.accidentNumber, row);
  }
  return Array.from(map.values());
}

export function parseFloodAlertCsv(csv?: string): FloodAlertInput[] {
  if (!csv?.trim()) {
    throw new HttpError(400, "CSV 내용이 비어 있습니다.");
  }

  const rows = parseCsvRows(csv.trim());
  if (rows.length < 2) {
    throw new HttpError(400, "유효한 CSV 데이터 행을 찾을 수 없습니다.");
  }

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  const accidentNoIdx = findHeaderIndex(headers, ["사고번호"]);
  const agencyIdx = findHeaderIndex(headers, ["기관명", "운영기관"]);
  const lineIdx = findHeaderIndex(headers, ["노선명", "노선"]);
  const siteIdx = findHeaderIndex(headers, ["개소명", "시설명"]);
  const locationIdx = findHeaderIndex(headers, ["사고위치", "발생위치", "위치"]);
  const latIdx = findHeaderIndex(headers, ["위도"]);
  const lngIdx = findHeaderIndex(headers, ["경도"]);
  const dateIdx = findHeaderIndex(headers, ["사고일시", "발생일시", "일시"]);
  const rain15Idx = findHeaderIndex(headers, ["강우15분", "15분강우"]);
  const rain30Idx = findHeaderIndex(headers, ["강우30분", "30분강우"]);
  const rain60Idx = findHeaderIndex(headers, ["강우60분", "60분강우", "1시간강우"]);
  const rain360Idx = findHeaderIndex(headers, ["강우360분", "360분강우", "6시간강우"]);
  const legacyRainIdx = findHeaderIndex(headers, ["사고당시강우량", "강우량"]);
  const stationIdx = findHeaderIndex(headers, ["기상관측소", "관측소코드", "지점번호"]);
  const notesIdx = findHeaderIndex(headers, ["비고", "메모"]);

  if (accidentNoIdx === -1) {
    throw new HttpError(400, "CSV 규격에 필수 칼럼(사고번호)이 없습니다.");
  }
  if (agencyIdx === -1 || lineIdx === -1 || siteIdx === -1 || locationIdx === -1) {
    throw new HttpError(400, "CSV 규격에 필수 칼럼(기관명, 노선명, 개소명, 사고위치)이 없습니다.");
  }

  const parsed: FloodAlertInput[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const accidentNumber = row[accidentNoIdx]?.trim() ?? "";
    if (!accidentNumber) continue;
    if (!row[agencyIdx]?.trim()) {
      throw new HttpError(400, `${i + 1}행: 기관명이 비어 있습니다. (사고번호 ${accidentNumber})`);
    }
    const { date, text } = parseDate(dateIdx !== -1 ? row[dateIdx] : "");
    const rainfall = normalizeRainfallFields({
      rainfall15mMm: rain15Idx !== -1 ? parseNumber(row[rain15Idx]) : null,
      rainfall30mMm: rain30Idx !== -1 ? parseNumber(row[rain30Idx]) : null,
      rainfall60mMm: rain60Idx !== -1 ? parseNumber(row[rain60Idx]) : null,
      rainfall360mMm: rain360Idx !== -1 ? parseNumber(row[rain360Idx]) : null,
      legacyRainfallMm: legacyRainIdx !== -1 ? parseNumber(row[legacyRainIdx]) : null,
    });

    parsed.push({
      accidentNumber,
      agencyName: row[agencyIdx].trim(),
      lineName: row[lineIdx].trim(),
      siteName: row[siteIdx].trim(),
      location: row[locationIdx].trim(),
      latitude: latIdx !== -1 ? parseNumber(row[latIdx]) : null,
      longitude: lngIdx !== -1 ? parseNumber(row[lngIdx]) : null,
      accidentAt: date,
      accidentAtText: text,
      ...rainfall,
      weatherStationCode: stationIdx !== -1 ? row[stationIdx]?.trim() || null : null,
      notes: notesIdx !== -1 ? row[notesIdx]?.trim() || null : null,
    });
  }

  if (!parsed.length) {
    throw new HttpError(400, "업로드할 유효한 침수경보 데이터가 없습니다.");
  }

  return dedupeFloodAlertRowsByAccidentNumber(parsed);
}

export function buildFloodAlertExportCsv(
  records: Array<{
    accidentNumber: string;
    agencyName: string;
    lineName: string;
    siteName: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    accidentAtText: string | null;
    rainfall15mMm: number | null;
    rainfall30mMm: number | null;
    rainfall60mMm: number | null;
    rainfall360mMm: number | null;
    rainfallMm: number | null;
    weatherStationCode: string | null;
    notes: string | null;
  }>,
): string {
  const lines = records.map((record) => {
    const rainfall60mMm = record.rainfall60mMm ?? record.rainfallMm;
    const cells = [
      record.accidentNumber,
      record.agencyName,
      record.lineName,
      record.siteName,
      record.location,
      record.latitude ?? "",
      record.longitude ?? "",
      record.accidentAtText ?? "",
      record.rainfall15mMm ?? "",
      record.rainfall30mMm ?? "",
      rainfall60mMm ?? "",
      record.rainfall360mMm ?? "",
      record.weatherStationCode ?? "",
      record.notes ?? "",
    ];
    return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
  });
  return [FLOOD_ALERT_CSV_HEADER, ...lines].join("\n");
}

export { toRowData };
