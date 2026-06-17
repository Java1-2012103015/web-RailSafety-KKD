import { HttpError } from "./http-error";

export interface InvestmentDisclosureInput {
  agencyName: string;
  disclosureYear: number;
  category1: string;
  category2: string;
  category3: string;
  yearLabel: number;
  amountMillion: number;
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

export function parseInvestmentDisclosureCsv(csv?: string): InvestmentDisclosureInput[] {
  if (!csv?.trim()) {
    throw new HttpError(400, "CSV 내용이 비어 있습니다.");
  }

  const rows = parseCsvRows(csv.trim());
  if (rows.length < 2) {
    throw new HttpError(400, "유효한 CSV 데이터 행을 찾을 수 없습니다.");
  }

  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  const agencyIdx = headers.findIndex((h) => h.includes("기관명"));
  const pubYearIdx = headers.findIndex((h) => h.includes("공시년도"));
  const cat1Idx = headers.findIndex((h) => h.includes("구분1"));
  const cat2Idx = headers.findIndex((h) => h.includes("구분2"));
  const cat3Idx = headers.findIndex((h) => h.includes("구분3"));
  const yearColIdx = headers.findIndex((h) => h === "연도구분");
  const amtColIdx = headers.findIndex((h) => h.includes("금액"));

  if (agencyIdx === -1 || cat1Idx === -1 || cat2Idx === -1) {
    throw new HttpError(400, "CSV 규격에 필수 칼럼(기관명, 구분1, 구분2)이 없습니다.");
  }

  const parsed: InvestmentDisclosureInput[] = [];

  if (yearColIdx !== -1 && amtColIdx !== -1) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[agencyIdx]?.trim()) continue;
      const amtRaw = row[amtColIdx]?.trim() ?? "0";
      const amountMillion = parseFloat(amtRaw.replace(/,/g, "")) || 0;
      parsed.push({
        agencyName: row[agencyIdx].trim(),
        disclosureYear: pubYearIdx !== -1 ? parseInt(row[pubYearIdx], 10) || 2026 : 2026,
        category1: row[cat1Idx].trim(),
        category2: row[cat2Idx].trim(),
        category3: cat3Idx !== -1 ? row[cat3Idx].trim() : "1. 소계",
        yearLabel: parseInt(row[yearColIdx], 10) || 2023,
        amountMillion,
      });
    }
  } else {
    const yearCols = ["2023", "2024", "2025", "2026", "2027", "2028"];
    const yearIndices = yearCols
      .map((yr) => ({ yr: parseInt(yr, 10), idx: headers.findIndex((h) => h === yr) }))
      .filter((item) => item.idx !== -1);

    if (yearIndices.length === 0) {
      throw new HttpError(400, "연도구분 또는 개별 연도 칼럼(2023~2028)을 식별할 수 없습니다.");
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[agencyIdx]?.trim()) continue;
      for (const { yr, idx } of yearIndices) {
        const amtRaw = row[idx]?.trim() ?? "0";
        const amountMillion = parseFloat(amtRaw.replace(/,/g, "")) || 0;
        parsed.push({
          agencyName: row[agencyIdx].trim(),
          disclosureYear: pubYearIdx !== -1 ? parseInt(row[pubYearIdx], 10) || 2026 : 2026,
          category1: row[cat1Idx].trim(),
          category2: row[cat2Idx].trim(),
          category3: cat3Idx !== -1 ? row[cat3Idx].trim() : "1. 소계",
          yearLabel: yr,
          amountMillion,
        });
      }
    }
  }

  if (parsed.length === 0) {
    throw new HttpError(400, "가져올 수 있는 유효한 데이터가 없습니다.");
  }

  return parsed;
}

export function buildInvestmentDisclosureExportCsv(
  records: Array<{
    agencyName: string;
    disclosureYear: number;
    category1: string;
    category2: string;
    category3: string;
    yearLabel: number;
    amountMillion: number;
  }>,
): string {
  const header = "기관명,공시년도,구분1,구분2,구분3,연도구분,금액";
  const body = records.map((r) =>
    [
      r.agencyName,
      r.disclosureYear,
      r.category1,
      r.category2,
      r.category3,
      r.yearLabel,
      r.amountMillion,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header, ...body].join("\n");
}
