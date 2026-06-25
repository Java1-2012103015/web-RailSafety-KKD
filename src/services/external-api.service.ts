import {
  EXTERNAL_API_DEFAULTS,
  isExternalApiType,
  type ExternalApiType,
} from "../constants/external-api-types";
import { ExternalApiRepository } from "../repositories/external-api.repository";
import { HttpError } from "../utils/http-error";

export class ExternalApiService {
  constructor(private readonly externalApiRepository: ExternalApiRepository) {}

  async ensureDefaults(): Promise<void> {
    for (const item of EXTERNAL_API_DEFAULTS) {
      const existing = await this.externalApiRepository.findByType(item.apiType);
      if (existing) continue;

      await this.externalApiRepository.upsert(item.apiType, {
        name: item.name,
        endpointUrl: item.endpointUrl,
        apiKey: null,
        enabled: false,
      });
    }
  }

  async listConfigs() {
    await this.ensureDefaults();
    return this.externalApiRepository.findAll();
  }

  async updateConfig(
    apiTypeRaw: string,
    input: {
      endpointUrl?: string | null;
      apiKey?: string | null;
      enabled?: boolean;
      extraConfig?: unknown | null;
    },
  ) {
    if (!isExternalApiType(apiTypeRaw)) {
      throw new HttpError(400, "Invalid external API type.");
    }

    const apiType = apiTypeRaw as ExternalApiType;
    await this.ensureDefaults();

    const defaults = EXTERNAL_API_DEFAULTS.find((item) => item.apiType === apiType);
    const existing = await this.externalApiRepository.findByType(apiType);

    const endpointUrl =
      input.endpointUrl !== undefined ? input.endpointUrl?.trim() || null : (existing?.endpointUrl ?? null);
    const apiKey = input.apiKey !== undefined ? input.apiKey?.trim() || null : (existing?.apiKey ?? null);
    const enabled = input.enabled ?? existing?.enabled ?? false;
    const extraConfig =
      input.extraConfig !== undefined ? input.extraConfig : (existing?.extraConfig ?? null);

    return this.externalApiRepository.upsert(apiType, {
      name: defaults?.name ?? existing?.name ?? apiType,
      endpointUrl,
      apiKey,
      enabled,
      extraConfig,
    });
  }
}
