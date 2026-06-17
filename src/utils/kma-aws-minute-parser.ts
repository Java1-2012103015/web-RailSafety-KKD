export interface KmaAwsStationObservation {
  stationCode: string;
  stationName: string;
  rainfall15m: number | null;
  rainfall60m: number | null;
  rainfall3h: number | null;
  rainfall6h: number | null;
  rainfall12h: number | null;
  rainfallDaily: number | null;
}

export interface KmaAwsMinuteSnapshot {
  observedAt: string | null;
  stations: Map<string, KmaAwsStationObservation>;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseRainfallCell(value: string): number | null {
  const text = value.trim();
  if (!text || text === "." || text === "-") return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractTableCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null = cellRegex.exec(rowHtml);
  while (match) {
    cells.push(stripHtml(match[1] ?? ""));
    match = cellRegex.exec(rowHtml);
  }
  return cells;
}

export function parseKmaAwsMinuteHtml(html: string): KmaAwsMinuteSnapshot {
  const observedAt =
    html.match(/\[ 매분관측자료 \]\s*([0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}:[0-9]{2})/)?.[1] ??
    html.match(/tm1\.value\s*=\s*'([0-9]{4}\.[0-9]{2}\.[0-9]{2}\s[0-9]{2}:[0-9]{2})'/)?.[1] ??
    null;

  const stations = new Map<string, KmaAwsStationObservation>();
  const rowRegex = /<tr align=center[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowRegex) ?? [];

  for (const row of rows) {
    if (!row.includes("stn_select(")) continue;

    const code = row.match(/stn_select\((\d+)\)/)?.[1];
    if (!code) continue;

    const cells = extractTableCells(row);
    if (cells.length < 9) continue;

    stations.set(code, {
      stationCode: code,
      stationName: cells[1] ?? "",
      rainfall15m: parseRainfallCell(cells[3] ?? ""),
      rainfall60m: parseRainfallCell(cells[4] ?? ""),
      rainfall3h: parseRainfallCell(cells[5] ?? ""),
      rainfall6h: parseRainfallCell(cells[6] ?? ""),
      rainfall12h: parseRainfallCell(cells[7] ?? ""),
      rainfallDaily: parseRainfallCell(cells[8] ?? ""),
    });
  }

  return { observedAt, stations };
}

export function estimateRainfall30m(
  rainfall15m: number | null,
  rainfall60m: number | null,
): number | null {
  if (rainfall15m != null && rainfall60m != null) {
    return Math.round(((rainfall15m + rainfall60m) / 2) * 10) / 10;
  }
  if (rainfall60m != null) return Math.round((rainfall60m / 2) * 10) / 10;
  if (rainfall15m != null) return Math.round(rainfall15m * 2 * 10) / 10;
  return null;
}
