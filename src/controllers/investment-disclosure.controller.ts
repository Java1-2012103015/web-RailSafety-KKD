import type { NextFunction, Request, Response } from "express";
import { InvestmentDisclosureService } from "../services/investment-disclosure.service";
import { parseAgenciesFromQuery } from "../utils/investment-disclosure-query";

export class InvestmentDisclosureController {
  constructor(private readonly service: InvestmentDisclosureService) {}

  getPortalDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getPortalDashboard({
        agencies: parseAgenciesFromQuery(req),
        category1: typeof req.query.category1 === "string" ? req.query.category1 : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        compareYear: typeof req.query.compareYear === "string" ? req.query.compareYear : undefined,
        page: typeof req.query.page === "string" ? req.query.page : undefined,
        pageSize: typeof req.query.pageSize === "string" ? req.query.pageSize : undefined,
      });
      res.status(200).json({ message: "Investment disclosure dashboard retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  uploadCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { csv } = req.body as { csv?: string };
      const data = await this.service.uploadCsv(csv);
      res.status(200).json({ message: "Investment disclosure CSV uploaded.", data });
    } catch (error) {
      next(error);
    }
  };

  getAdminInfo = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getAdminInfo();
      res.status(200).json({ message: "Investment disclosure info retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getSampleCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = this.service.getSampleCsv();
      res.status(200).json({ message: "Sample CSV generated.", data });
    } catch (error) {
      next(error);
    }
  };

  private readPortalExportFilters(req: Request) {
    return {
      agencies: parseAgenciesFromQuery(req),
      category1: typeof req.query.category1 === "string" ? req.query.category1 : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    };
  }

  getPortalExportCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getFilteredExportCsv(this.readPortalExportFilters(req));
      res.status(200).json({ message: "Filtered investment disclosure exported.", data });
    } catch (error) {
      next(error);
    }
  };

  getPortalExportRows = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getFilteredExportRows(this.readPortalExportFilters(req));
      res.status(200).json({ message: "Filtered investment disclosure rows retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getExportCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getExportCsv();
      res.status(200).json({ message: "Investment disclosure exported.", data });
    } catch (error) {
      next(error);
    }
  };
}
