import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";
import { MenuService } from "../services/menu.service";

export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  createMenu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, path, sequence, parentId } = req.body as {
        title?: string;
        path?: string;
        sequence?: number;
        parentId?: number | null;
      };

      const result = await this.menuService.createMenu({
        title,
        path,
        sequence,
        parentId,
      });

      res.status(201).json({
        message: "Menu created successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateMenu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new HttpError(400, "Invalid menu id.");
      }

      const { title, path, sequence } = req.body as {
        title?: string;
        path?: string | null;
        sequence?: number;
      };

      const result = await this.menuService.updateMenu(id, {
        title,
        path,
        sequence,
      });

      res.status(200).json({
        message: "Menu updated successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteMenu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new HttpError(400, "Invalid menu id.");
      }

      const result = await this.menuService.deleteMenu(id);
      res.status(200).json({
        message: "Menu deleted successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getMenuTree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Unauthorized.");
      }

      const result = await this.menuService.getMenuTree({
        roleId: req.user.roleId,
        role: req.user.role,
      });
      res.status(200).json({
        message: "Menu tree retrieved successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
