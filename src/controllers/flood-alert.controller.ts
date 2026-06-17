import type { Request, Response, NextFunction } from "express";
import { FloodAlertService } from "../services/flood-alert.service";
import { HttpError } from "../utils/http-error";

export class FloodAlertController {
  constructor(private readonly floodAlertService: FloodAlertService) {}

  getPortalList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.floodAlertService.getPortalList({
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        page: typeof req.query.page === "string" ? req.query.page : undefined,
        pageSize: typeof req.query.pageSize === "string" ? req.query.pageSize : undefined,
      });
      res.status(200).json({ message: "Flood alert records retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.floodAlertService.getDashboard();
      res.status(200).json({ message: "Flood alert dashboard retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  uploadCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
      const data = await this.floodAlertService.uploadCsv(csv);
      res.status(200).json({ message: "Flood alert CSV uploaded.", data });
    } catch (error) {
      next(error);
    }
  };

  getSampleCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = this.floodAlertService.getSampleCsv();
      res.status(200).json({ message: "Flood alert sample CSV retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getExportCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.floodAlertService.getExportCsv();
      res.status(200).json({ message: "Flood alert export CSV retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getAdminInfo = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.floodAlertService.getAdminInfo();
      res.status(200).json({ message: "Flood alert admin info retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.floodAlertService.getSettings();
      res.status(200).json({ message: "Flood alert settings retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const newsKeywords = Array.isArray(req.body?.newsKeywords)
        ? req.body.newsKeywords.map((value: unknown) => String(value))
        : undefined;
      const data = await this.floodAlertService.updateSettings({ newsKeywords });
      res.status(200).json({ message: "Flood alert settings updated.", data });
    } catch (error) {
      next(error);
    }
  };

  deleteRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
      }

      const data = await this.floodAlertService.deleteRecords(req.body as { ids?: unknown[] }, {
        role: req.user.role,
      });
      res.status(200).json({ message: "Selected flood alert records deleted.", data });
    } catch (error) {
      next(error);
    }
  };
}
