import type { JwtPayload, SelfReportJwtPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      selfReportUser?: SelfReportJwtPayload;
    }
  }
}

export {};
