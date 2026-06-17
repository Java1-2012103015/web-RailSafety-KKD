import type { NextFunction, Request, Response } from "express";
import { ExternalApiService } from "../services/external-api.service";

export class ExternalApiController {
  constructor(private readonly externalApiService: ExternalApiService) {}

  listConfigs = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.externalApiService.listConfigs();
      res.status(200).json({ message: "External API configs retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  updateConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiTypeParam = Array.isArray(req.params.apiType) ? req.params.apiType[0] : req.params.apiType;
      const { endpointUrl, apiKey, enabled } = req.body as {
        endpointUrl?: string | null;
        apiKey?: string | null;
        enabled?: boolean;
      };

      const data = await this.externalApiService.updateConfig(apiTypeParam, {
        endpointUrl,
        apiKey,
        enabled,
      });

      res.status(200).json({ message: "External API config saved.", data });
    } catch (error) {
      next(error);
    }
  };
}
