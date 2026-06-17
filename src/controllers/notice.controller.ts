import type { NextFunction, Request, Response } from "express";
import { NoticeService, type NoticeInput } from "../services/notice.service";
import { HttpError } from "../utils/http-error";

export class NoticeController {
  constructor(private readonly noticeService: NoticeService) {}

  listNotices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = req.user;
      if (!auth) {
        throw new HttpError(401, "Unauthorized.");
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
      const boardType = typeof req.query.boardType === "string" ? req.query.boardType : undefined;
      const includeHidden = req.query.includeHidden === "true" || req.query.includeHidden === "1";

      const result = await this.noticeService.listNotices(page, pageSize, auth, {
        boardType,
        includeHidden,
      });

      res.status(200).json({
        message: "Notices retrieved successfully.",
        data: result.items,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getNoticeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = req.user;
      if (!auth) {
        throw new HttpError(401, "Unauthorized.");
      }

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new HttpError(400, "Invalid notice id.");
      }

      const notice = await this.noticeService.getNoticeById(id, auth);

      res.status(200).json({
        message: "Notice retrieved successfully.",
        data: notice,
      });
    } catch (error) {
      next(error);
    }
  };

  createNotice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = req.user;
      if (!auth) {
        throw new HttpError(401, "Unauthorized.");
      }

      const notice = await this.noticeService.createNotice(req.body as NoticeInput, auth);

      res.status(201).json({
        message: "Notice created successfully.",
        data: notice,
      });
    } catch (error) {
      next(error);
    }
  };

  updateNotice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = req.user;
      if (!auth) {
        throw new HttpError(401, "Unauthorized.");
      }

      const id = Number(req.params.id);
      const notice = await this.noticeService.updateNotice(id, req.body as NoticeInput, auth);

      res.status(200).json({
        message: "Notice updated successfully.",
        data: notice,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteNotice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = req.user;
      if (!auth) {
        throw new HttpError(401, "Unauthorized.");
      }

      const id = Number(req.params.id);
      await this.noticeService.deleteNotice(id, auth);

      res.status(200).json({
        message: "Notice deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  };
}
