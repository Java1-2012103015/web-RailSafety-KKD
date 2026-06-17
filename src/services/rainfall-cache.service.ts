import { RAINFALL_CACHE_TTL_MS } from "../constants/rainfall-cache";
import type { RainfallWindowResult } from "./weather-api.service";
import { WeatherApiService } from "./weather-api.service";

interface CachedRainfallEntry {
  data: RainfallWindowResult;
  fetchedAt: number;
}

export class RainfallCacheService {
  private readonly cache = new Map<string, CachedRainfallEntry>();
  private readonly inflight = new Map<string, Promise<RainfallWindowResult>>();
  private lastSyncedAt: Date | null = null;

  constructor(
    private readonly weatherApiService: WeatherApiService,
    private readonly ttlMs = RAINFALL_CACHE_TTL_MS,
  ) {}

  getTtlMs(): number {
    return this.ttlMs;
  }

  getLastSyncedAt(): string | null {
    return this.lastSyncedAt?.toISOString() ?? null;
  }

  private isFresh(entry: CachedRainfallEntry): boolean {
    return Date.now() - entry.fetchedAt < this.ttlMs;
  }

  async get(stationCode: string): Promise<RainfallWindowResult> {
    const code = stationCode.trim();
    if (!code) {
      return {
        stationCode: "",
        rainfall15m: null,
        rainfall30m: null,
        rainfall60m: null,
        rainfall1h: null,
        rainfall360m: null,
        observedAt: null,
        source: "unavailable",
      };
    }

    const cached = this.cache.get(code);
    if (cached && this.isFresh(cached)) {
      return cached.data;
    }

    if (cached) {
      void this.refreshStation(code).catch(() => undefined);
      return cached.data;
    }

    return this.refreshStation(code);
  }

  async refreshStation(stationCode: string): Promise<RainfallWindowResult> {
    const code = stationCode.trim();
    if (!code) {
      return {
        stationCode: "",
        rainfall15m: null,
        rainfall30m: null,
        rainfall60m: null,
        rainfall1h: null,
        rainfall360m: null,
        observedAt: null,
        source: "unavailable",
      };
    }

    const pending = this.inflight.get(code);
    if (pending) return pending;

    const promise = this.weatherApiService
      .getRainfallWindowsByStation(code)
      .then((data) => {
        this.cache.set(code, { data, fetchedAt: Date.now() });
        this.inflight.delete(code);
        return data;
      })
      .catch((error) => {
        this.inflight.delete(code);
        const stale = this.cache.get(code);
        if (stale) return stale.data;
        throw error;
      });

    this.inflight.set(code, promise);
    return promise;
  }

  async refreshStations(stationCodes: string[]): Promise<{ refreshed: number; failed: number }> {
    const uniqueCodes = [...new Set(stationCodes.map((code) => code.trim()).filter(Boolean))];
    if (!uniqueCodes.length) {
      return { refreshed: 0, failed: 0 };
    }

    const results = await Promise.allSettled(uniqueCodes.map((code) => this.refreshStation(code)));
    const refreshed = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - refreshed;
    if (refreshed > 0) {
      this.lastSyncedAt = new Date();
    }
    return { refreshed, failed };
  }
}
