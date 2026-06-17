import type { NextFunction, Request, Response } from "express";
import { RegistrationRequestService } from "../services/registration-request.service";
import { HttpError } from "../utils/http-error";

export class RegistrationRequestController {
  constructor(private readonly registrationRequestService: RegistrationRequestService) {}

  checkEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = String(req.query.email ?? "").trim();
      const result = await this.registrationRequestService.checkEmailAvailable(email);
      res.status(200).json({
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.registrationRequestService.submitRequest(
        req.body as {
          email?: string;
          password?: string;
          passwordConfirm?: string;
          name?: string;
          affiliation?: string;
        },
      );
      res.status(201).json({
        message: "사용등록 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listPending = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.registrationRequestService.listPending();
      res.status(200).json({
        message: "Registration requests retrieved successfully.",
        data: items.map(({ password, ...item }) => item),
      });
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const { roleId } = req.body as { roleId?: number };
      if (!Number.isInteger(roleId) || (roleId ?? 0) < 1) {
        throw new HttpError(400, "roleId is required.");
      }

      const result = await this.registrationRequestService.approve(id, roleId as number);
      res.status(200).json({
        message: "사용등록 신청이 승인되었습니다.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      await this.registrationRequestService.reject(id);
      res.status(200).json({
        message: "사용등록 신청이 반려되었습니다.",
      });
    } catch (error) {
      next(error);
    }
  };
}
