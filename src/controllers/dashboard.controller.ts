import type { NextFunction, Request, Response } from "express";
import { DashboardService } from "../services/dashboard.service";
import { HttpError } from "../utils/http-error";

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.dashboardService.getStats();
      res.status(200).json({ message: "Dashboard statistics retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getGuestPortalStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.dashboardService.getGuestPortalStats();
      res.status(200).json({ message: "Guest portal dashboard statistics retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getPortalStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Authorization token is missing.");
      }

      const data = await this.dashboardService.getPortalStats(req.user);
      res.status(200).json({ message: "Portal dashboard statistics retrieved.", data });
    } catch (error) {
      next(error);
    }
  };
}
