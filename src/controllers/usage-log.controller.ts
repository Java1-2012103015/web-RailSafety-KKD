import type { NextFunction, Request, Response } from "express";
import { UsageLogService } from "../services/usage-log.service";
import { getClientIp } from "../utils/client-ip";
import { HttpError } from "../utils/http-error";

export class UsageLogController {
  constructor(private readonly usageLogService: UsageLogService) {}

  recordView = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Authorization token is missing.");
      }

      const { path, pageTitle, sessionKey } = req.body ?? {};

      await this.usageLogService.recordPageView(
        req.user,
        {
          path: typeof path === "string" ? path : "",
          pageTitle: typeof pageTitle === "string" ? pageTitle : null,
          sessionKey: typeof sessionKey === "string" ? sessionKey : "",
        },
        {
          ipAddress: getClientIp(req),
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        },
      );

      res.status(201).json({ message: "Page view recorded." });
    } catch (error) {
      next(error);
    }
  };

  recordLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Authorization token is missing.");
      }

      const { sessionKey, dwellSeconds } = req.body ?? {};

      await this.usageLogService.recordPageLeave(req.user, {
        sessionKey: typeof sessionKey === "string" ? sessionKey : "",
        dwellSeconds: typeof dwellSeconds === "number" ? dwellSeconds : Number(dwellSeconds),
      });

      res.status(200).json({ message: "Page leave recorded." });
    } catch (error) {
      next(error);
    }
  };
}
