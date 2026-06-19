export type InvestigationReportLink = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseInvestigationReportLinks(raw: unknown): InvestigationReportLink[] {
  if (raw == null || raw === "") return [];

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(isRecord)
    .map((item, index) => {
      const url = String(item.url ?? "").trim();
      if (!url) return null;
      const title = String(item.title ?? "").trim() || `조사보고서 ${index + 1}`;
      const id = String(item.id ?? "").trim() || `link-${index + 1}`;
      const createdAt = String(item.createdAt ?? "").trim() || new Date(0).toISOString();
      return { id, title, url, createdAt };
    })
    .filter((item): item is InvestigationReportLink => item !== null);
}

export function serializeInvestigationReportLinks(links: InvestigationReportLink[]): string {
  return JSON.stringify(links);
}

export function normalizeInvestigationReportLinksInput(raw: unknown): InvestigationReportLink[] {
  if (!Array.isArray(raw)) {
    throw new Error("links must be an array.");
  }

  const normalized: InvestigationReportLink[] = [];

  for (const [index, item] of raw.entries()) {
    if (!isRecord(item)) {
      throw new Error(`links[${index}] is invalid.`);
    }

    const url = String(item.url ?? "").trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      throw new Error(`links[${index}].url must start with http:// or https://`);
    }

    const title = String(item.title ?? "").trim() || `조사보고서 ${index + 1}`;
    const id = String(item.id ?? "").trim() || `link-${Date.now()}-${index}`;
    const createdAt = String(item.createdAt ?? "").trim() || new Date().toISOString();

    normalized.push({ id, title, url, createdAt });
  }

  return normalized;
}

export function buildInvestigationReportLinksFromUrls(urls: string[]): InvestigationReportLink[] {
  const createdAt = new Date().toISOString();
  const links: InvestigationReportLink[] = [];

  for (const [index, raw] of urls.entries()) {
    const url = String(raw ?? "").trim();
    if (!url) continue;
    if (!/^https?:\/\/.+/i.test(url)) {
      throw new Error(`Attachment ${index + 1} URL must start with http:// or https://`);
    }
    links.push({
      id: `link-${Date.now()}-${index}`,
      title: `조사보고서 ${links.length + 1}`,
      url,
      createdAt,
    });
  }

  return links;
}

export function formatInvestigationReportSavedAtText(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.0`;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "investigation-report";
}

export function inferInvestigationReportFilename(
  url: string,
  title: string,
  contentDisposition: string | null,
): string {
  if (contentDisposition) {
    const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
      try {
        return sanitizeFilename(decodeURIComponent(utfMatch[1]));
      } catch {
        /* fall through */
      }
    }
    const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (plainMatch?.[1]) {
      return sanitizeFilename(plainMatch[1]);
    }
  }

  try {
    const pathname = new URL(url).pathname;
    const base = decodeURIComponent(pathname.split("/").pop() ?? "");
    if (base.includes(".")) {
      return sanitizeFilename(base);
    }
  } catch {
    /* fall through */
  }

  return `${sanitizeFilename(title)}.pdf`;
}
