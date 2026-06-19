import type { NextFunction, Request, Response } from "express";
import { AccidentDetailPublicationService } from "../services/accident-detail-publication.service";
import { HttpError } from "../utils/http-error";
import { normalizeVisibleColumnKeys, normalizeVisibleTabKeys } from "../utils/accident-detail-publication";

export class AccidentDetailPublicationController {
  constructor(private readonly publicationService: AccidentDetailPublicationService) {}

  getAdminSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.publicationService.getAdminSettings();
      res.status(200).json({ message: "Accident DB publication settings loaded.", data });
    } catch (error) {
      next(error);
    }
  };

  updateRolePublication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleId = Number(req.params.roleId);
      if (!Number.isInteger(roleId) || roleId < 1) {
        throw new HttpError(400, "Invalid role id.");
      }

      const body = req.body as { visibleColumnKeys?: unknown; visibleTabKeys?: unknown };
      const visibleColumnKeys = normalizeVisibleColumnKeys(body.visibleColumnKeys);
      const visibleTabKeys = normalizeVisibleTabKeys(body.visibleTabKeys);
      const data = await this.publicationService.updateRolePublication(
        roleId,
        visibleColumnKeys,
        visibleTabKeys,
      );

      res.status(200).json({ message: "Accident DB publication settings saved.", data });
    } catch (error) {
      next(error);
    }
  };
}
