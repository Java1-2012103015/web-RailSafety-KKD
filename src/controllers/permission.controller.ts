import type { NextFunction, Request, Response } from "express";
import type { MenuActionPermissionRecord } from "../constants/menu-action-permissions";
import { PermissionService } from "../services/permission.service";
import { HttpError } from "../utils/http-error";
import type { LocationScopeRule } from "../constants/query-location-scope";

export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name } = req.body as { name?: string };
      const data = await this.permissionService.createRole(name);
      res.status(201).json({
        message: "Role created successfully.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleId = Number(req.params.roleId);
      if (!Number.isInteger(roleId) || roleId < 1) {
        throw new HttpError(400, "Invalid roleId.");
      }
      const { name } = req.body as { name?: string };
      const data = await this.permissionService.updateRoleName(roleId, name);
      res.status(200).json({
        message: "Role updated successfully.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleId = Number(req.params.roleId);
      if (!Number.isInteger(roleId) || roleId < 1) {
        throw new HttpError(400, "Invalid roleId.");
      }
      const data = await this.permissionService.deleteRole(roleId);
      res.status(200).json({
        message: "Role deleted successfully.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  setRoleMenuPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleId = Number(req.params.roleId);
      if (!Number.isInteger(roleId) || roleId < 1) {
        throw new HttpError(400, "Invalid roleId.");
      }

      const { menuIds, menuActionPermissions } = req.body as {
        menuIds?: number[];
        menuActionPermissions?: MenuActionPermissionRecord[];
      };
      const result = await this.permissionService.setRoleMenuPermissions({
        roleId,
        menuIds,
        menuActionPermissions,
      });

      res.status(200).json({
        message: "Role menu permissions updated successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  setRoleQueryPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleId = Number(req.params.roleId);
      if (!Number.isInteger(roleId) || roleId < 1) {
        throw new HttpError(400, "Invalid roleId.");
      }

      const { enforcementMode, minAccidentAt, maxAccidentAt, allowedLineNames, allowedTypes, allowedLocationScope, enforcedLineName } =
        req.body as {
          enforcementMode?: "OVERWRITE" | "BLOCK";
          minAccidentAt?: string | null;
          maxAccidentAt?: string | null;
          allowedLineNames?: string[] | null;
          allowedTypes?: string[] | null;
          allowedLocationScope?: LocationScopeRule[] | null;
          enforcedLineName?: string | null;
        };

      const result = await this.permissionService.setRoleQueryPermission({
        roleId,
        enforcementMode,
        minAccidentAt,
        maxAccidentAt,
        allowedLineNames,
        allowedTypes,
        allowedLocationScope,
        enforcedLineName,
      });

      res.status(200).json({
        message: "Role query permissions updated successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listRoles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roles = await this.permissionService.listRoles();
      res.status(200).json({
        message: "Roles list retrieved.",
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  };

  getRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleId = Number(req.params.roleId);
      if (!Number.isInteger(roleId) || roleId < 1) {
        throw new HttpError(400, "Invalid roleId.");
      }

      const result = await this.permissionService.getRolePermissions(roleId);
      res.status(200).json({
        message: "Role permissions retrieved.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
