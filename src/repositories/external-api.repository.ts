import { prisma } from "../config/prisma";
import type { ExternalApiType } from "../constants/external-api-types";

export class ExternalApiRepository {
  private readonly db = prisma as any;

  findAll() {
    return this.db.externalApiConfig.findMany({
      orderBy: { apiType: "asc" },
    });
  }

  findByType(apiType: ExternalApiType) {
    return this.db.externalApiConfig.findUnique({
      where: { apiType },
    });
  }

  upsert(
    apiType: ExternalApiType,
    data: {
      name: string;
      endpointUrl?: string | null;
      apiKey?: string | null;
      enabled?: boolean;
      extraConfig?: unknown | null;
    },
  ) {
    return this.db.externalApiConfig.upsert({
      where: { apiType },
      update: {
        name: data.name,
        endpointUrl: data.endpointUrl ?? null,
        apiKey: data.apiKey ?? null,
        enabled: data.enabled ?? false,
        ...(data.extraConfig !== undefined ? { extraConfig: data.extraConfig } : {}),
      },
      create: {
        apiType,
        name: data.name,
        endpointUrl: data.endpointUrl ?? null,
        apiKey: data.apiKey ?? null,
        enabled: data.enabled ?? false,
        extraConfig: data.extraConfig ?? null,
      },
    });
  }
}
