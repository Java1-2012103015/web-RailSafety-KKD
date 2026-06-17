import {
  DEFAULT_FLOOD_ALERT_ROWS,
  DEFAULT_FLOOD_NEWS_KEYWORDS,
  FLOOD_ALERT_SAMPLE_CSV,
} from "../constants/flood-alert-default";
import { RAINFALL_CACHE_TTL_MS, RAINFALL_DASHBOARD_REFRESH_MS } from "../constants/rainfall-cache";
import { ROLES } from "../constants/roles";
import { FloodAlertRepository } from "../repositories/flood-alert.repository";
import { AddressGeocodeService } from "./address-geocode.service";
import { NewsApiService } from "./news-api.service";
import { RainfallCacheService } from "./rainfall-cache.service";
import { RainfallSyncService } from "./rainfall-sync.service";
import {
  buildFloodAlertExportCsv,
  parseFloodAlertCsv,
} from "../utils/flood-alert-csv";
import {
  buildFloodRiskProfile,
  buildSiteFloodRiskAssessment,
  mergeHistoricalFromPeers,
} from "../utils/flood-alert-risk";
import {
  enrichFloodAlertRows,
  resolveWeatherStationForFloodRow,
} from "../utils/weather-station-resolver";
import { HttpError } from "../utils/http-error";

interface FloodSiteKey {
  agencyName: string;
  lineName: string;
  siteName: string;
}

function siteKey(record: FloodSiteKey): string {
  return `${record.agencyName}::${record.lineName}::${record.siteName}`;
}

function minRainfallValue(current: number | null, next: number | null): number | null {
  if (current == null) return next;
  if (next == null) return current;
  return Math.min(current, next);
}

function resolveRecordRainfallWindows(record: {
  rainfall15mMm: number | null;
  rainfall30mMm: number | null;
  rainfall60mMm: number | null;
  rainfall360mMm: number | null;
  rainfallMm: number | null;
}) {
  const rainfall60mMm = record.rainfall60mMm ?? record.rainfallMm;
  return {
    rainfall15mMm: record.rainfall15mMm,
    rainfall30mMm: record.rainfall30mMm,
    rainfall60mMm,
    rainfall360mMm: record.rainfall360mMm,
  };
}

export class FloodAlertService {
  constructor(
    private readonly repository: FloodAlertRepository,
    private readonly rainfallCacheService: RainfallCacheService,
    private readonly newsApiService: NewsApiService,
    private readonly addressGeocodeService: AddressGeocodeService,
    private readonly rainfallSyncService: RainfallSyncService,
  ) {}

  async ensureSeeded(): Promise<void> {
    const { rows } = await enrichFloodAlertRows(
      DEFAULT_FLOOD_ALERT_ROWS,
      this.addressGeocodeService,
    );
    await this.repository.seedDefaultsIfEmpty(rows);
    const settings = await this.repository.getSettings();
    if (!settings) {
      await this.repository.upsertSettings(DEFAULT_FLOOD_NEWS_KEYWORDS);
    }
  }

  private async loadRecords() {
    await this.ensureSeeded();
    return this.repository.findAll();
  }

  async getPortalList(query: { search?: string; page?: string; pageSize?: string }) {
    await this.ensureSeeded();
    const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize ?? "10", 10) || 10));
    const [items, total] = await this.repository.findMany({
      search: query.search?.trim() || undefined,
      page,
      pageSize,
    });

    return {
      records: items,
      pagination: {
        page,
        pageSize,
        totalRecords: total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getDashboard() {
    const records = await this.loadRecords();
    const siteMap = new Map<
      string,
      {
        agencyName: string;
        lineName: string;
        siteName: string;
        location: string;
        latitude: number | null;
        longitude: number | null;
        weatherStationCode: string | null;
        historicalRainfall15mMm: number | null;
        historicalRainfall30mMm: number | null;
        historicalRainfall60mMm: number | null;
        historicalRainfall360mMm: number | null;
        historicalRainfallMm: number | null;
        caseCount: number;
        notesText: string;
      }
    >();

    for (const record of records) {
      const key = siteKey(record);
      const existing = siteMap.get(key);
      const rainfall = resolveRecordRainfallWindows(record);
      const note = record.notes?.trim() ?? "";
      if (!existing) {
        siteMap.set(key, {
          agencyName: record.agencyName,
          lineName: record.lineName,
          siteName: record.siteName,
          location: record.location,
          latitude: record.latitude,
          longitude: record.longitude,
          weatherStationCode: record.weatherStationCode,
          historicalRainfall15mMm: rainfall.rainfall15mMm,
          historicalRainfall30mMm: rainfall.rainfall30mMm,
          historicalRainfall60mMm: rainfall.rainfall60mMm,
          historicalRainfall360mMm: rainfall.rainfall360mMm,
          historicalRainfallMm: rainfall.rainfall60mMm,
          caseCount: 1,
          notesText: note,
        });
        continue;
      }
      existing.caseCount += 1;
      if (note) {
        existing.notesText = existing.notesText ? `${existing.notesText} ${note}` : note;
      }
      existing.historicalRainfall15mMm = minRainfallValue(
        existing.historicalRainfall15mMm,
        rainfall.rainfall15mMm,
      );
      existing.historicalRainfall30mMm = minRainfallValue(
        existing.historicalRainfall30mMm,
        rainfall.rainfall30mMm,
      );
      existing.historicalRainfall60mMm = minRainfallValue(
        existing.historicalRainfall60mMm,
        rainfall.rainfall60mMm,
      );
      existing.historicalRainfall360mMm = minRainfallValue(
        existing.historicalRainfall360mMm,
        rainfall.rainfall360mMm,
      );
      existing.historicalRainfallMm = existing.historicalRainfall60mMm;
      if (!existing.latitude && record.latitude) existing.latitude = record.latitude;
      if (!existing.longitude && record.longitude) existing.longitude = record.longitude;
      if (!existing.weatherStationCode && record.weatherStationCode) {
        existing.weatherStationCode = record.weatherStationCode;
      }
    }

    const siteList = Array.from(siteMap.values());
    const peersByLine = new Map<string, typeof siteList>();
    for (const site of siteList) {
      const peers = peersByLine.get(site.lineName) ?? [];
      peers.push(site);
      peersByLine.set(site.lineName, peers);
    }

    const sites = await Promise.all(
      siteList.map(async (site) => {
        const stationCode = site.weatherStationCode ?? "";
        let resolvedStationCode = stationCode;
        if (!resolvedStationCode) {
          const mapping = await resolveWeatherStationForFloodRow(
            {
              accidentNumber: "",
              agencyName: site.agencyName,
              lineName: site.lineName,
              siteName: site.siteName,
              location: site.location,
              latitude: site.latitude,
              longitude: site.longitude,
              accidentAt: null,
              accidentAtText: null,
              rainfallMm: null,
              rainfall15mMm: null,
              rainfall30mMm: null,
              rainfall60mMm: null,
              rainfall360mMm: null,
              weatherStationCode: null,
              notes: null,
            },
            this.addressGeocodeService,
          );
          resolvedStationCode = mapping.weatherStationCode ?? "";
        }

        let rainfall15m: number | null = null;
        let rainfall30m: number | null = null;
        let rainfall60m: number | null = null;
        let rainfall1h: number | null = null;
        let rainfall360m: number | null = null;
        let rainfallObservedAt: string | null = null;
        let rainfallSource: "kma-aws" | "api" | "unavailable" = "unavailable";

        if (resolvedStationCode) {
          const rainfall = await this.rainfallCacheService.get(resolvedStationCode);
          rainfall15m = rainfall.rainfall15m;
          rainfall30m = rainfall.rainfall30m;
          rainfall60m = rainfall.rainfall60m;
          rainfall1h = rainfall.rainfall1h;
          rainfall360m = rainfall.rainfall360m;
          rainfallObservedAt = rainfall.observedAt;
          rainfallSource = rainfall.source;
        }

        const risk30m = buildFloodRiskProfile(rainfall30m, site.historicalRainfall30mMm);
        const risk1h = buildFloodRiskProfile(rainfall60m, site.historicalRainfall60mMm);

        const linePeers = (peersByLine.get(site.lineName) ?? []).filter(
          (peer) => !(peer.siteName === site.siteName && peer.location === site.location),
        );
        const { historical, usedSimilarSite } = mergeHistoricalFromPeers(
          {
            rainfall15mMm: site.historicalRainfall15mMm,
            rainfall30mMm: site.historicalRainfall30mMm,
            rainfall60mMm: site.historicalRainfall60mMm,
            rainfall360mMm: site.historicalRainfall360mMm,
            caseCount: site.caseCount,
          },
          linePeers.map((peer) => ({
            rainfall15mMm: peer.historicalRainfall15mMm,
            rainfall30mMm: peer.historicalRainfall30mMm,
            rainfall60mMm: peer.historicalRainfall60mMm,
            rainfall360mMm: peer.historicalRainfall360mMm,
            caseCount: peer.caseCount,
          })),
        );

        const assessment = buildSiteFloodRiskAssessment({
          current: {
            rainfall15m,
            rainfall30m,
            rainfall60m,
            rainfall360m,
          },
          historical,
          caseCount: site.caseCount,
          notesText: site.notesText,
          usedSimilarSite,
        });

        return {
          ...site,
          weatherStationCode: resolvedStationCode || site.weatherStationCode,
          rainfall15m,
          rainfall30m,
          rainfall60m,
          rainfall1h,
          rainfall360m,
          rainfallObservedAt,
          rainfallSource,
          risk30mScore: risk30m.riskScore,
          risk30mLevel: risk30m.riskLevel,
          risk30mColor: risk30m.riskColor,
          risk1hScore: risk1h.riskScore,
          risk1hLevel: risk1h.riskLevel,
          risk1hColor: risk1h.riskColor,
          riskScore: assessment.riskScore,
          riskLevel: assessment.riskLevel,
          riskColor: assessment.riskColor,
          dominantFactor: assessment.dominantFactor,
          confidenceLevel: assessment.confidenceLevel,
          confidenceLabel: assessment.confidenceLabel,
          thresholdComparison: assessment.thresholdComparison,
          thresholdRatio: assessment.thresholdRatio,
          drainageVulnerable: assessment.drainageVulnerable,
          usedSimilarSite: assessment.usedSimilarSite,
        };
      }),
    );

    const settings = await this.repository.getSettings();
    const keywords = Array.isArray(settings?.newsKeywords)
      ? (settings!.newsKeywords as string[])
      : DEFAULT_FLOOD_NEWS_KEYWORDS;
    const news = await this.newsApiService.searchNews(keywords, 8);

    return {
      meta: {
        siteCount: sites.length,
        recordCount: records.length,
        updatedAt: new Date().toISOString(),
        rainfallCache: {
          ttlMinutes: Math.round(this.rainfallCacheService.getTtlMs() / 60000),
          lastSyncedAt: this.rainfallCacheService.getLastSyncedAt(),
          dashboardRefreshMinutes: Math.round(RAINFALL_DASHBOARD_REFRESH_MS / 60000),
        },
        riskLegend: [
          { level: "green", label: "안전", min: 0, max: 19 },
          { level: "amber", label: "주의", min: 20, max: 49 },
          { level: "orange", label: "경계", min: 50, max: 79 },
          { level: "red", label: "위험", min: 80, max: 100 },
        ],
      },
      sites,
      news,
      newsKeywords: keywords,
    };
  }

  async uploadCsv(csv: string) {
    const parsed = parseFloodAlertCsv(csv);
    const { rows, stats } = await enrichFloodAlertRows(parsed, this.addressGeocodeService);
    const result = await this.repository.upsertMany(rows);
    void this.rainfallSyncService.syncAll().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[rainfall-sync] post-upload sync failed:", error);
    });
    return {
      ...result,
      ...stats,
    };
  }

  async getAdminInfo() {
    await this.ensureSeeded();
    const [count, settings] = await Promise.all([
      this.repository.count(),
      this.repository.getSettings(),
    ]);
    return {
      recordCount: count,
      newsKeywords: Array.isArray(settings?.newsKeywords)
        ? (settings!.newsKeywords as string[])
        : DEFAULT_FLOOD_NEWS_KEYWORDS,
    };
  }

  getSampleCsv() {
    return FLOOD_ALERT_SAMPLE_CSV;
  }

  async getExportCsv() {
    const records = await this.loadRecords();
    return buildFloodAlertExportCsv(records);
  }

  async getSettings() {
    await this.ensureSeeded();
    const settings = await this.repository.getSettings();
    return {
      newsKeywords: Array.isArray(settings?.newsKeywords)
        ? (settings!.newsKeywords as string[])
        : DEFAULT_FLOOD_NEWS_KEYWORDS,
    };
  }

  async updateSettings(input: { newsKeywords?: string[] }) {
    const keywords = (input.newsKeywords ?? [])
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const saved = await this.repository.upsertSettings(
      keywords.length ? keywords : DEFAULT_FLOOD_NEWS_KEYWORDS,
    );
    return {
      newsKeywords: saved.newsKeywords as string[],
    };
  }

  async deleteRecords(input: { ids?: unknown[] }, auth: { role: string }) {
    if (auth.role !== ROLES.ADMIN) {
      throw new HttpError(403, "Only admin can delete flood alert records.");
    }

    const rawIds = Array.isArray(input.ids) ? input.ids : [];
    if (!rawIds.length) {
      throw new HttpError(400, "ids is required.");
    }

    const ids = rawIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (!ids.length) {
      throw new HttpError(400, "No valid ids provided.");
    }

    if (ids.length > 500) {
      throw new HttpError(400, "Cannot delete more than 500 records at once.");
    }

    const result = await this.repository.deleteByIds(Array.from(new Set(ids)));
    return { deleted: result.count };
  }
}
