import type { NextFunction, Request, Response } from "express";
import { UserRepository } from "../repositories/user.repository";
import { SelfReportRepository } from "../repositories/self-report.repository";
import { HttpError } from "../utils/http-error";
import { verifyToken, verifySelfReportToken } from "../utils/jwt";
import { assertIpAllowed, getClientIp } from "../utils/client-ip";
import { ROLES } from "../constants/roles";
import type { JwtPayload, SelfReportJwtPayload } from "../utils/jwt";

const userRepository = new UserRepository();
const selfReportRepository = new SelfReportRepository();

export type SelfReportActor = JwtPayload | SelfReportJwtPayload;

function isPortalPayload(payload: SelfReportActor): payload is JwtPayload {
  return "userId" in payload && typeof (payload as JwtPayload).userId === "number";
}

export const authenticateAny = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpError(401, "Authorization token is missing.");
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const portalPayload = verifyToken(token);
      const user = await userRepository.findById(portalPayload.userId);
      if (!user) throw new HttpError(401, "Invalid or expired token.");
      assertIpAllowed(user, getClientIp(req));
      req.user = portalPayload;
      next();
      return;
    } catch {
      // fall through to self-report token
    }

    const selfReportPayload = verifySelfReportToken(token);
    const institution = await selfReportRepository.findInstitutionById(selfReportPayload.selfReportInstitutionId);
    if (!institution || !institution.enabled) {
      throw new HttpError(401, "Invalid or expired token.");
    }
    if (selfReportPayload.selfReportStaffId) {
      const staff = await selfReportRepository.findStaffById(selfReportPayload.selfReportStaffId);
      if (!staff || !staff.enabled || staff.institutionId !== institution.id) {
        throw new HttpError(401, "Invalid or expired token.");
      }
    }

    req.selfReportUser = selfReportPayload;
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Invalid or expired token."));
  }
};

export function getSelfReportActor(req: Request): SelfReportActor {
  if (req.user) return req.user;
  if (req.selfReportUser) return req.selfReportUser;
  throw new HttpError(401, "Authorization token is missing.");
}

export const authorizeSelfReportRoles =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const actor = req.user ?? req.selfReportUser;
    if (!actor || !roles.includes(actor.role)) {
      next(new HttpError(403, "You do not have permission to access this resource."));
      return;
    }
    next();
  };

export const SELF_REPORT_ACCESS_ROLES = [
  ROLES.ADMIN,
  ROLES.SELF_REPORT_TIER1,
  ROLES.SELF_REPORT_TIER2,
] as const;

export { isPortalPayload };
