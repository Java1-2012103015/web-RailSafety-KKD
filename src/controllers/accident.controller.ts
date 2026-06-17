import type { NextFunction, Request, Response } from "express";
import { AccidentService } from "../services/accident.service";
import { HttpError } from "../utils/http-error";

export class AccidentController {
  constructor(private readonly accidentService: AccidentService) {}

  getAccidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        startDate,
        endDate,
        lineName,
        accidentType,
        accidentKindCategory,
        accidentKinds,
        registrationAgency,
        page,
        pageSize,
      } = req.query as {
        startDate?: string;
        endDate?: string;
        lineName?: string;
        accidentType?: string;
        accidentKindCategory?: string;
        accidentKinds?: string;
        registrationAgency?: string;
        page?: string;
        pageSize?: string;
      };

      if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
      }

      const result = await this.accidentService.getAccidents({
        startDate,
        endDate,
        lineName,
        accidentType,
        accidentKindCategory,
        accidentKinds,
        registrationAgency,
        page,
        pageSize,
      }, {
        roleId: req.user.roleId,
        role: req.user.role,
      });

      res.status(200).json({
        message: "Accident list retrieved successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getAccidentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
      }

      const id = Number(req.params.id);
      const { accident, publication } = await this.accidentService.getAccidentById(id, {
        roleId: req.user.roleId,
        role: req.user.role,
      });

      res.status(200).json({
        message: "Accident detail retrieved successfully.",
        data: accident,
        publication,
      });
    } catch (error) {
      next(error);
    }
  };

  bulkUpsertAccidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
      }

      const result = await this.accidentService.upsertBulk(req.body as Record<string, unknown>, {
        roleId: req.user.roleId,
        role: req.user.role,
      });

      res.status(200).json({
        message: "Bulk registration completed.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteAccidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
      }

      const result = await this.accidentService.deleteAccidents(req.body as Record<string, unknown>, {
        roleId: req.user.roleId,
        role: req.user.role,
      });

      res.status(200).json({
        message: "Selected accidents deleted.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
