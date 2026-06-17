import type { NextFunction, Request, Response } from "express";
import { LoginLogService } from "../services/login-log.service";

export class AdminLoginLogController {
  constructor(private readonly loginLogService: LoginLogService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.loginLogService.listForAdmin({
        page: typeof req.query.page === "string" ? req.query.page : undefined,
        pageSize: typeof req.query.pageSize === "string" ? req.query.pageSize : undefined,
        email: typeof req.query.email === "string" ? req.query.email : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
      });
      res.status(200).json({ message: "Login logs retrieved.", data });
    } catch (error) {
      next(error);
    }
  };
}
