import { FloodAlertRepository } from "../repositories/flood-alert.repository";
import { ExternalApiRepository } from "../repositories/external-api.repository";
import { AddressGeocodeService } from "../services/address-geocode.service";
import { FloodAlertService } from "../services/flood-alert.service";
import { NewsApiService } from "../services/news-api.service";
import { RainfallCacheService } from "../services/rainfall-cache.service";
import { RainfallSyncService } from "../services/rainfall-sync.service";
import { WeatherApiService } from "../services/weather-api.service";

const floodAlertRepository = new FloodAlertRepository();
const externalApiRepository = new ExternalApiRepository();
const weatherApiService = new WeatherApiService(externalApiRepository);
const addressGeocodeService = new AddressGeocodeService(externalApiRepository);
const rainfallCacheService = new RainfallCacheService(weatherApiService);
const rainfallSyncService = new RainfallSyncService(
  floodAlertRepository,
  rainfallCacheService,
  addressGeocodeService,
);
const newsApiService = new NewsApiService(externalApiRepository);

export const floodAlertService = new FloodAlertService(
  floodAlertRepository,
  rainfallCacheService,
  newsApiService,
  addressGeocodeService,
  rainfallSyncService,
);

export {
  floodAlertRepository,
  rainfallCacheService,
  rainfallSyncService,
};
