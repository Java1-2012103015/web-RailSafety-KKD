import type { NextFunction, Request, Response } from "express";
import { BrandingService } from "../services/branding.service";
import { HttpError } from "../utils/http-error";

export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  getPublicBranding = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.brandingService.getGlobalBranding();
      res.status(200).json({ message: "Public branding retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getCurrentBranding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
      }

      const data = await this.brandingService.getBrandingForRole(req.user.roleId, req.user.role);
      res.status(200).json({ message: "Branding retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  listAdminBranding = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.brandingService.listAdminBranding();
      res.status(200).json({ message: "Branding list retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  updateGlobalBranding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.brandingService.updateGlobalBranding(req.body);
      res.status(200).json({ message: "Global branding updated.", data });
    } catch (error) {
      next(error);
    }
  };

  updateRoleBranding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleId = Number(req.params.roleId);
      if (!Number.isInteger(roleId) || roleId < 1) {
        throw new HttpError(400, "Invalid roleId.");
      }

      const data = await this.brandingService.updateRoleBranding(roleId, req.body);
      res.status(200).json({ message: "Role branding updated.", data });
    } catch (error) {
      next(error);
    }
  };

  uploadLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = req.body?.scope;
      if (scope !== "GLOBAL" && scope !== "ROLE") {
        throw new HttpError(400, "scope must be GLOBAL or ROLE.");
      }

      const data = await this.brandingService.uploadLogo({
        scope,
        roleId: scope === "ROLE" ? Number(req.body?.roleId) : undefined,
        logoData: String(req.body?.logoData ?? ""),
      });
      res.status(200).json({ message: "Logo uploaded.", data });
    } catch (error) {
      next(error);
    }
  };
}
