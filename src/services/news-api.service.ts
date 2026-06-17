import { EXTERNAL_API_TYPES } from "../constants/external-api-types";
import { ExternalApiRepository } from "../repositories/external-api.repository";

export interface NewsArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  source: string;
}

interface ExternalApiConfig {
  enabled: boolean;
  endpointUrl: string | null;
  apiKey: string | null;
}

const RAIL_KEYWORDS = ["철도", "지하철", "전철", "역사", "철도역", "지하철역"];
const FLOOD_KEYWORDS = ["침수", "호우", "강우", "폭우", "집중호우", "사고", "피해"];

export class NewsApiService {
  constructor(private readonly externalApiRepository: ExternalApiRepository) {}

  async searchNews(keywords: string[], limit = 8): Promise<NewsArticle[]> {
    const config = await this.externalApiRepository.findByType(EXTERNAL_API_TYPES.NEWS);
    const queries = keywords.map((keyword) => keyword.trim()).filter(Boolean).slice(0, 8);
    if (!config?.enabled || !config.endpointUrl || !config.apiKey || !queries.length) {
      return [];
    }

    const perQuery = Math.min(10, Math.max(3, Math.ceil(limit / queries.length) + 2));
    const batches = await Promise.all(
      queries.map((query) => this.fetchNewsQuery(config, query, perQuery)),
    );

    const seen = new Set<string>();
    const articles: NewsArticle[] = [];
    for (const batch of batches) {
      for (const article of batch) {
        const key = normalizeArticleLink(article.link);
        if (seen.has(key)) continue;
        if (!isRelevantRailFloodArticle(article)) continue;
        seen.add(key);
        articles.push(article);
      }
    }

    return articles
      .sort((a, b) => comparePubDate(b.pubDate, a.pubDate))
      .slice(0, limit);
  }

  private async fetchNewsQuery(
    config: ExternalApiConfig,
    query: string,
    limit: number,
  ): Promise<NewsArticle[]> {
    const endpoint = normalizeNaverNewsEndpoint(config.endpointUrl!);
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("display", String(Math.min(limit, 20)));
    endpoint.searchParams.set("start", "1");
    endpoint.searchParams.set("sort", "date");

    if (endpoint.hostname.includes("naver")) {
      return this.fetchNaverNews(endpoint, config.apiKey!);
    }

    endpoint.searchParams.set("apiKey", config.apiKey!);
    return this.fetchGenericNews(endpoint);
  }

  private async fetchNaverNews(endpoint: URL, apiKey: string): Promise<NewsArticle[]> {
    try {
      const response = await fetch(endpoint.toString(), {
        headers: {
          "X-Naver-Client-Id": apiKey.split("|")[0] ?? apiKey,
          "X-Naver-Client-Secret": apiKey.split("|")[1] ?? "",
        },
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        items?: Array<{ title?: string; link?: string; description?: string; pubDate?: string }>;
      };
      return (payload.items ?? []).map((item) => ({
        title: stripHtml(item.title ?? ""),
        link: item.link ?? "#",
        description: stripHtml(item.description ?? ""),
        pubDate: item.pubDate ?? null,
        source: "naver",
      }));
    } catch {
      return [];
    }
  }

  private async fetchGenericNews(endpoint: URL): Promise<NewsArticle[]> {
    try {
      const response = await fetch(endpoint.toString());
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        articles?: Array<{ title?: string; url?: string; description?: string; publishedAt?: string }>;
        items?: Array<{ title?: string; link?: string; description?: string; pubDate?: string }>;
      };
      const items = (payload.articles ?? payload.items ?? []) as Array<Record<string, string | undefined>>;
      return items.map((item) => ({
        title: stripHtml(item.title ?? ""),
        link: item.url ?? item.link ?? "#",
        description: stripHtml(item.description ?? ""),
        pubDate: item.publishedAt ?? item.pubDate ?? null,
        source: "api",
      }));
    } catch {
      return [];
    }
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
}

function normalizeNaverNewsEndpoint(endpointUrl: string): URL {
  const endpoint = new URL(endpointUrl);
  if (endpoint.hostname.includes("naver") && endpoint.pathname.endsWith("/news")) {
    endpoint.pathname = `${endpoint.pathname}.json`;
  }
  return endpoint;
}

function normalizeArticleLink(link: string): string {
  try {
    const url = new URL(link);
    url.hash = "";
    return url.toString();
  } catch {
    return link.trim();
  }
}

function isRelevantRailFloodArticle(article: NewsArticle): boolean {
  const text = `${article.title} ${article.description}`;
  const hasRail = RAIL_KEYWORDS.some((keyword) => text.includes(keyword));
  const hasFlood = FLOOD_KEYWORDS.some((keyword) => text.includes(keyword));
  return hasRail && hasFlood;
}

function comparePubDate(a: string | null, b: string | null): number {
  const timeA = a ? Date.parse(a) : 0;
  const timeB = b ? Date.parse(b) : 0;
  return (Number.isFinite(timeA) ? timeA : 0) - (Number.isFinite(timeB) ? timeB : 0);
}
