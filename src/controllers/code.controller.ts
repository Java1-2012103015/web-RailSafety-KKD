import type { NextFunction, Request, Response } from "express";
import { CodeService, type CodeCsvType } from "../services/code.service";
import { HttpError } from "../utils/http-error";

export class CodeController {
  constructor(private readonly codeService: CodeService) {}

  private readType(value: string | undefined): CodeCsvType {
    if (value === "institutions" || value === "lines" || value === "stations") return value;
    throw new HttpError(400, "type must be institutions, lines, or stations.");
  }

  getTree = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.codeService.getCodeTree();
      res.status(200).json({ message: "Code tree retrieved.", data });
    } catch (error) {
      next(error);
    }
  };

  getSampleCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const typeParam = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
      const type = this.readType(typeParam);
      const data = this.codeService.getSampleCsv(type);
      res.status(200).json({ message: "Sample CSV generated.", data });
    } catch (error) {
      next(error);
    }
  };

  getExportCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const typeParam = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
      const type = this.readType(typeParam);
      const data = await this.codeService.getExportCsv(type);
      res.status(200).json({ message: "Current codes exported.", data });
    } catch (error) {
      next(error);
    }
  };

  uploadCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const typeParam = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
      const type = this.readType(typeParam);
      const { csv } = req.body as { csv?: string };
      const data = await this.codeService.uploadCsv(type, csv);
      res.status(200).json({ message: "CSV uploaded successfully.", data });
    } catch (error) {
      next(error);
    }
  };

  syncRegistrationAgencies = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.codeService.syncRegistrationAgenciesFromAccidents();
      res.status(200).json({ message: "Registration agencies and lines synced to code tables.", data });
    } catch (error) {
      next(error);
    }
  };
}
