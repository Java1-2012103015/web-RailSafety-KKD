import type { AddressGeocodeService } from "../services/address-geocode.service";
import {
  KMA_ASOS_STATION_BY_CODE,
  KMA_ASOS_STATIONS,
  type KmaAsosStation,
} from "../constants/kma-asos-stations";
import type { FloodAlertInput } from "./flood-alert-csv";

export type WeatherStationMappingMethod =
  | "existing"
  | "coordinate"
  | "location_keyword"
  | "geocode"
  | "unresolved";

export interface WeatherStationMappingResult {
  weatherStationCode: string | null;
  weatherStationName: string | null;
  latitude: number | null;
  longitude: number | null;
  method: WeatherStationMappingMethod;
  distanceKm: number | null;
}

export interface FloodAlertEnrichmentStats {
  stationMappedCount: number;
  coordinateFilledCount: number;
  unresolvedStationCount: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeSearchText(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function findNearestStation(latitude: number, longitude: number): {
  station: KmaAsosStation;
  distanceKm: number;
} {
  let nearest = KMA_ASOS_STATIONS[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const station of KMA_ASOS_STATIONS) {
    const distanceKm = haversineKm(latitude, longitude, station.latitude, station.longitude);
    if (distanceKm < minDistance) {
      minDistance = distanceKm;
      nearest = station;
    }
  }

  return { station: nearest, distanceKm: minDistance };
}

function matchStationByKeywords(...parts: Array<string | null | undefined>): KmaAsosStation | null {
  const text = normalizeSearchText(parts.filter(Boolean).join(" "));
  if (!text) return null;

  let best: { station: KmaAsosStation; score: number } | null = null;

  for (const station of KMA_ASOS_STATIONS) {
    const candidates = [station.name, ...(station.aliases ?? [])];
    for (const candidate of candidates) {
      const keyword = normalizeSearchText(candidate);
      if (!keyword || keyword.length < 2) continue;
      if (!text.includes(keyword)) continue;

      const score = keyword.length;
      if (!best || score > best.score) {
        best = { station, score };
      }
    }
  }

  return best?.station ?? null;
}

function buildMappingResult(
  station: KmaAsosStation,
  method: WeatherStationMappingMethod,
  latitude: number | null,
  longitude: number | null,
  distanceKm: number | null = null,
): WeatherStationMappingResult {
  return {
    weatherStationCode: station.code,
    weatherStationName: station.name,
    latitude,
    longitude,
    method,
    distanceKm,
  };
}

export function resolveWeatherStationFromCoordinates(
  latitude: number,
  longitude: number,
): WeatherStationMappingResult {
  const { station, distanceKm } = findNearestStation(latitude, longitude);
  return buildMappingResult(station, "coordinate", latitude, longitude, Math.round(distanceKm * 10) / 10);
}

export function resolveWeatherStationFromText(
  location: string,
  lineName?: string | null,
  siteName?: string | null,
): WeatherStationMappingResult | null {
  const station = matchStationByKeywords(location, lineName, siteName);
  if (!station) return null;

  return buildMappingResult(station, "location_keyword", null, null, null);
}

export async function resolveWeatherStationForFloodRow(
  row: FloodAlertInput,
  geocodeService?: AddressGeocodeService,
): Promise<WeatherStationMappingResult> {
  if (row.weatherStationCode?.trim()) {
    const station = KMA_ASOS_STATION_BY_CODE.get(row.weatherStationCode.trim());
    return {
      weatherStationCode: row.weatherStationCode.trim(),
      weatherStationName: station?.name ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
      method: "existing",
      distanceKm: null,
    };
  }

  if (row.latitude != null && row.longitude != null) {
    return resolveWeatherStationFromCoordinates(row.latitude, row.longitude);
  }

  const keywordMatch = resolveWeatherStationFromText(row.location, row.lineName, row.siteName);
  if (keywordMatch) return keywordMatch;

  if (geocodeService) {
    const geocoded = await geocodeService.geocodeAddress(
      [row.location, row.lineName, row.siteName].filter(Boolean).join(" "),
    );
    if (geocoded) {
      const nearest = resolveWeatherStationFromCoordinates(geocoded.latitude, geocoded.longitude);
      return {
        ...nearest,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        method: "geocode",
      };
    }
  }

  return {
    weatherStationCode: null,
    weatherStationName: null,
    latitude: row.latitude,
    longitude: row.longitude,
    method: "unresolved",
    distanceKm: null,
  };
}

export async function enrichFloodAlertRows(
  rows: FloodAlertInput[],
  geocodeService?: AddressGeocodeService,
): Promise<{ rows: FloodAlertInput[]; stats: FloodAlertEnrichmentStats }> {
  const stats: FloodAlertEnrichmentStats = {
    stationMappedCount: 0,
    coordinateFilledCount: 0,
    unresolvedStationCount: 0,
  };

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const mapping = await resolveWeatherStationForFloodRow(row, geocodeService);
      const next: FloodAlertInput = { ...row };

      if (!next.weatherStationCode && mapping.weatherStationCode) {
        next.weatherStationCode = mapping.weatherStationCode;
        stats.stationMappedCount += 1;
      } else if (mapping.method === "unresolved") {
        stats.unresolvedStationCount += 1;
      }

      if (next.latitude == null && mapping.latitude != null) {
        next.latitude = mapping.latitude;
      }
      if (next.longitude == null && mapping.longitude != null) {
        next.longitude = mapping.longitude;
      }
      if (
        (row.latitude == null && next.latitude != null) ||
        (row.longitude == null && next.longitude != null)
      ) {
        stats.coordinateFilledCount += 1;
      }

      return next;
    }),
  );

  return { rows: enriched, stats };
}
