import { RAINFALL_CACHE_TTL_MS } from "../constants/rainfall-cache";
import {
  estimateRainfall30m,
  parseKmaAwsMinuteHtml,
  type KmaAwsMinuteSnapshot,
} from "../utils/kma-aws-minute-parser";
import type { RainfallWindowResult } from "./weather-api.service";

const KMA_AWS_MINUTE_URL = "https://www.weather.go.kr/cgi-bin/aws/nph-aws_txt_min_cal_test";

interface CachedSnapshot {
  data: KmaAwsMinuteSnapshot;
  fetchedAt: number;
  queryTimestamp: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 기상청 매분관측 페이지 쿼리 시각 (KST, 5분 단위) */
export function buildKmaAwsQueryTimestamp(date = new Date()): string {
  const kstMs = date.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const year = kst.getUTCFullYear();
  const month = pad2(kst.getUTCMonth() + 1);
  const day = pad2(kst.getUTCDate());
  const hour = pad2(kst.getUTCHours());
  const minute = pad2(Math.floor(kst.getUTCMinutes() / 5) * 5);
  return `${year}${month}${day}${hour}${minute}`;
}

export class KmaAwsMinuteService {
  private cache: CachedSnapshot | null = null;
  private inflight: Promise<KmaAwsMinuteSnapshot | null> | null = null;

  constructor(private readonly ttlMs = RAINFALL_CACHE_TTL_MS) {}

  async getRainfallWindowsByStation(stationCode: string): Promise<RainfallWindowResult | null> {
    const code = stationCode.trim();
    if (!code) return null;

    const snapshot = await this.ensureSnapshot();
    const station = snapshot?.stations.get(code);
    if (!station) return null;

    const rainfall15m = station.rainfall15m;
    const rainfall60m = station.rainfall60m;
    const rainfall30m = estimateRainfall30m(rainfall15m, rainfall60m);

    return {
      stationCode: code,
      rainfall15m,
      rainfall30m,
      rainfall60m,
      rainfall1h: rainfall60m,
      rainfall360m: station.rainfall6h,
      observedAt: snapshot?.observedAt ?? this.cache?.queryTimestamp ?? null,
      source: "kma-aws",
    };
  }

  private isFresh(entry: CachedSnapshot): boolean {
    return Date.now() - entry.fetchedAt < this.ttlMs;
  }

  private async ensureSnapshot(): Promise<KmaAwsMinuteSnapshot | null> {
    if (this.cache && this.isFresh(this.cache)) {
      return this.cache.data;
    }

    if (this.inflight) return this.inflight;

    this.inflight = this.fetchSnapshot()
      .then((snapshot) => {
        this.inflight = null;
        return snapshot;
      })
      .catch((error) => {
        this.inflight = null;
        if (this.cache) return this.cache.data;
        console.error("[kma-aws-minute] fetch failed:", error);
        return null;
      });

    return this.inflight;
  }

  private async fetchSnapshot(): Promise<KmaAwsMinuteSnapshot | null> {
    const queryTimestamp = buildKmaAwsQueryTimestamp();
    const endpoint = `${KMA_AWS_MINUTE_URL}?${queryTimestamp}`;

    const response = await fetch(endpoint, {
      headers: {
        Accept: "text/html",
        "User-Agent": "RailSafetyFloodDashboard/1.0",
      },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const data = parseKmaAwsMinuteHtml(html);
    if (!data.stations.size) return null;

    this.cache = {
      data,
      fetchedAt: Date.now(),
      queryTimestamp,
    };
    return data;
  }
}
