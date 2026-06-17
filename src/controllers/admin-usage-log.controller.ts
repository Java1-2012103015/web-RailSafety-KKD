import type { NextFunction, Request, Response } from "express";
import { UsageLogService } from "../services/usage-log.service";

export class AdminUsageLogController {
  constructor(private readonly usageLogService: UsageLogService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.usageLogService.listForAdmin({
        page: typeof req.query.page === "string" ? req.query.page : undefined,
        pageSize: typeof req.query.pageSize === "string" ? req.query.pageSize : undefined,
        email: typeof req.query.email === "string" ? req.query.email : undefined,
        path: typeof req.query.path === "string" ? req.query.path : undefined,
        fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === "string" ? req.query.toDate : undefined,
      });
      res.status(200).json({ message: "Usage logs retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  summary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.usageLogService.getSummaryForAdmin({
        fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === "string" ? req.query.toDate : undefined,
      });
      res.status(200).json({ message: "Usage summary retrieved.", data });
    } catch (error) {
      next(error);
    }
  };
}
