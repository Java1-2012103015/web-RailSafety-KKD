import { EXTERNAL_API_TYPES } from "../constants/external-api-types";
import { ExternalApiRepository } from "../repositories/external-api.repository";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  source: "vworld" | "juso";
}

function parseCoordinate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export class AddressGeocodeService {
  constructor(private readonly externalApiRepository: ExternalApiRepository) {}

  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    const query = address.trim();
    if (!query) return null;

    const vworld = await this.geocodeWithVWorld(query);
    if (vworld) return vworld;

    return this.geocodeWithJuso(query);
  }

  private async geocodeWithVWorld(address: string): Promise<GeocodeResult | null> {
    const config = await this.externalApiRepository.findByType(EXTERNAL_API_TYPES.MAP_ADDRESS);
    if (!config?.enabled || !config.apiKey) return null;

    const endpoint = new URL(
      config.endpointUrl?.trim() || "https://api.vworld.kr/req/address",
    );
    endpoint.searchParams.set("service", "address");
    endpoint.searchParams.set("request", "getCoord");
    endpoint.searchParams.set("version", "2.0");
    endpoint.searchParams.set("crs", "epsg:4326");
    endpoint.searchParams.set("address", address);
    endpoint.searchParams.set("refine", "true");
    endpoint.searchParams.set("simple", "false");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("type", "road");
    endpoint.searchParams.set("key", config.apiKey);

    try {
      const response = await fetch(endpoint.toString());
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        response?: {
          status?: string;
          result?: { point?: { x?: string; y?: string } };
        };
      };
      if (payload.response?.status !== "OK") return null;

      const latitude = parseCoordinate(payload.response.result?.point?.y);
      const longitude = parseCoordinate(payload.response.result?.point?.x);
      if (latitude == null || longitude == null) return null;

      return { latitude, longitude, source: "vworld" };
    } catch {
      return null;
    }
  }

  private async geocodeWithJuso(address: string): Promise<GeocodeResult | null> {
    const config = await this.externalApiRepository.findByType(EXTERNAL_API_TYPES.ROAD_ADDRESS);
    if (!config?.enabled || !config.apiKey) return null;

    const endpoint = new URL(
      config.endpointUrl?.trim() || "https://business.juso.go.kr/addrlink/addrLinkApi.do",
    );
    endpoint.searchParams.set("confmKey", config.apiKey);
    endpoint.searchParams.set("currentPage", "1");
    endpoint.searchParams.set("countPerPage", "1");
    endpoint.searchParams.set("keyword", address);
    endpoint.searchParams.set("resultType", "json");

    try {
      const response = await fetch(endpoint.toString());
      if (!response.ok) return null;

      const payload = (await response.json()) as {
        results?: {
          common?: { errorCode?: string };
          juso?: Array<{ entX?: string; entY?: string }>;
        };
      };
      if (payload.results?.common?.errorCode !== "0") return null;

      const juso = payload.results.juso?.[0];
      const longitude = parseCoordinate(juso?.entX);
      const latitude = parseCoordinate(juso?.entY);
      if (latitude == null || longitude == null) return null;

      return { latitude, longitude, source: "juso" };
    } catch {
      return null;
    }
  }
}
