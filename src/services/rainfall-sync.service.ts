import { FloodAlertRepository } from "../repositories/flood-alert.repository";
import { resolveWeatherStationForFloodRow } from "../utils/weather-station-resolver";
import { AddressGeocodeService } from "./address-geocode.service";
import { RainfallCacheService } from "./rainfall-cache.service";

export class RainfallSyncService {
  constructor(
    private readonly repository: FloodAlertRepository,
    private readonly rainfallCacheService: RainfallCacheService,
    private readonly addressGeocodeService: AddressGeocodeService,
  ) {}

  async collectStationCodes(): Promise<string[]> {
    const records = await this.repository.findAll();
    const codes = new Set<string>();

    for (const record of records) {
      if (record.weatherStationCode?.trim()) {
        codes.add(record.weatherStationCode.trim());
        continue;
      }

      const mapping = await resolveWeatherStationForFloodRow(
        {
          accidentNumber: record.accidentNumber,
          agencyName: record.agencyName,
          lineName: record.lineName,
          siteName: record.siteName,
          location: record.location,
          latitude: record.latitude,
          longitude: record.longitude,
          accidentAt: record.accidentAt,
          accidentAtText: record.accidentAtText,
          rainfallMm: record.rainfallMm,
          rainfall15mMm: record.rainfall15mMm,
          rainfall30mMm: record.rainfall30mMm,
          rainfall60mMm: record.rainfall60mMm,
          rainfall360mMm: record.rainfall360mMm,
          weatherStationCode: record.weatherStationCode,
          notes: record.notes,
        },
        this.addressGeocodeService,
      );

      if (mapping.weatherStationCode) {
        codes.add(mapping.weatherStationCode);
      }
    }

    return [...codes];
  }

  async syncAll(): Promise<{ stationCount: number; refreshed: number; failed: number }> {
    const stationCodes = await this.collectStationCodes();
    const result = await this.rainfallCacheService.refreshStations(stationCodes);
    return {
      stationCount: stationCodes.length,
      ...result,
    };
  }
}
