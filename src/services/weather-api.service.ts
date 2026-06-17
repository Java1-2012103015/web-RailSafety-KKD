import { EXTERNAL_API_TYPES } from "../constants/external-api-types";
import { ExternalApiRepository } from "../repositories/external-api.repository";
import { KmaAwsMinuteService } from "./kma-aws-minute.service";

export interface RainfallWindowResult {
  stationCode: string;
  rainfall15m: number | null;
  rainfall30m: number | null;
  rainfall60m: number | null;
  rainfall1h: number | null;
  rainfall360m: number | null;
  observedAt: string | null;
  source: "kma-aws" | "api" | "unavailable";
}

interface RainfallObservation {
  observedAt: Date;
  rainfallMm: number;
  tm: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatKmaDate(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

function formatKmaHour(date: Date): string {
  return `${pad2(date.getHours())}00`;
}

function parseObservationTime(value?: string): Date | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;

  if (/^\d{12}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(8, 10));
    const minute = Number(raw.slice(10, 12));
    const parsed = new Date(year, month, day, hour, minute);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = raw.replace(/\./g, "-").replace(/\s+/g, " ");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRainfallValue(value?: string | number): number | null {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function sumRainfallInWindow(observations: RainfallObservation[], windowMinutes: number, now: Date): number | null {
  const cutoff = now.getTime() - windowMinutes * 60 * 1000;
  let sum = 0;
  let hasData = false;

  for (const item of observations) {
    if (item.observedAt.getTime() < cutoff) continue;
    sum += item.rainfallMm;
    hasData = true;
  }

  if (hasData) return Math.round(sum * 10) / 10;

  const latest = observations.length ? observations[observations.length - 1] : null;
  if (!latest) return null;

  const elapsedMinutes = Math.max(0, (now.getTime() - latest.observedAt.getTime()) / (60 * 1000));
  if (elapsedMinutes > windowMinutes) return null;

  const ratio = Math.min(1, windowMinutes / 60);
  return Math.round(latest.rainfallMm * ratio * 10) / 10;
}

function parseObservations(payload: {
  response?: {
    body?: {
      items?: {
        item?: Array<{ rn?: string | number; tm?: string }> | { rn?: string | number; tm?: string };
      };
    };
  };
}): RainfallObservation[] {
  const rawItems = payload.response?.body?.items?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return items
    .map((item) => {
      const observedAt = parseObservationTime(item.tm);
      const rainfallMm = parseRainfallValue(item.rn);
      if (!observedAt || rainfallMm == null) return null;
      return {
        observedAt,
        rainfallMm,
        tm: item.tm ?? "",
      };
    })
    .filter((item): item is RainfallObservation => Boolean(item))
    .sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
}

export class WeatherApiService {
  constructor(
    private readonly externalApiRepository: ExternalApiRepository,
    private readonly kmaAwsMinuteService = new KmaAwsMinuteService(),
  ) {}

  async getRainfallWindowsByStation(stationCode: string): Promise<RainfallWindowResult> {
    const unavailable = {
      stationCode,
      rainfall15m: null,
      rainfall30m: null,
      rainfall60m: null,
      rainfall1h: null,
      rainfall360m: null,
      observedAt: null,
      source: "unavailable" as const,
    };

    const awsResult = await this.kmaAwsMinuteService.getRainfallWindowsByStation(stationCode);
    if (awsResult) return awsResult;

    return this.getRainfallWindowsFromOpenApi(stationCode, unavailable);
  }

  private async getRainfallWindowsFromOpenApi(
    stationCode: string,
    unavailable: RainfallWindowResult,
  ): Promise<RainfallWindowResult> {

    const config = await this.externalApiRepository.findByType(EXTERNAL_API_TYPES.WEATHER);
    if (!config?.enabled || !config.endpointUrl || !config.apiKey) {
      return unavailable;
    }

    const now = new Date();
    const start = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    const endpoint = new URL(config.endpointUrl);
    endpoint.searchParams.set("serviceKey", config.apiKey);
    endpoint.searchParams.set("pageNo", "1");
    endpoint.searchParams.set("numOfRows", "12");
    endpoint.searchParams.set("dataType", "JSON");
    endpoint.searchParams.set("dataCd", "ASOS");
    endpoint.searchParams.set("dateCd", "HR");
    endpoint.searchParams.set("startDt", formatKmaDate(start));
    endpoint.searchParams.set("startHhMm", formatKmaHour(start));
    endpoint.searchParams.set("endDt", formatKmaDate(now));
    endpoint.searchParams.set("endHhMm", formatKmaHour(now));
    endpoint.searchParams.set("stnIds", stationCode);

    try {
      const response = await fetch(endpoint.toString());
      if (!response.ok) return unavailable;

      const payload = (await response.json()) as Parameters<typeof parseObservations>[0];
      const observations = parseObservations(payload);
      if (!observations.length) return unavailable;

      const latest = observations[observations.length - 1];
      const rainfall60m = sumRainfallInWindow(observations, 60, now);
      return {
        stationCode,
        rainfall15m: sumRainfallInWindow(observations, 15, now),
        rainfall30m: sumRainfallInWindow(observations, 30, now),
        rainfall60m,
        rainfall1h: rainfall60m,
        rainfall360m: sumRainfallInWindow(observations, 360, now),
        observedAt: latest.tm || latest.observedAt.toISOString(),
        source: "api",
      };
    } catch {
      return unavailable;
    }
  }

  /** @deprecated use getRainfallWindowsByStation */
  async getCurrentRainfallByStation(stationCode: string) {
    const result = await this.getRainfallWindowsByStation(stationCode);
    return {
      stationCode: result.stationCode,
      rainfallMm: result.rainfall1h,
      observedAt: result.observedAt,
      source: result.source,
    };
  }
}
