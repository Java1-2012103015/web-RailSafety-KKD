import type { QueryEnforcementMode, RoleMenuActionPermission, RoleMenuPermission, RoleQueryPermission } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import type { AccidentKindCategory } from "../constants/accident-kind-category";
import type { MenuActionPermissionRecord } from "../constants/menu-action-permissions";
import type { LocationScopeRule } from "../constants/query-location-scope";

export interface UpsertRoleQueryPermissionInput {
  roleId: number;
  enforcementMode: QueryEnforcementMode;
  minAccidentAt?: Date | null;
  maxAccidentAt?: Date | null;
  allowedLineNames?: string[] | null;
  allowedTypes?: AccidentKindCategory[] | null;
  allowedLocationScope?: LocationScopeRule[] | null;
  enforcedLineName?: string | null;
}

export class PermissionRepository {
  async replaceRoleMenuPermissions(roleId: number, menuIds: number[]): Promise<RoleMenuPermission[]> {
    await prisma.roleMenuPermission.deleteMany({ where: { roleId } });

    if (menuIds.length === 0) {
      return [];
    }

    await prisma.roleMenuPermission.createMany({
      data: menuIds.map((menuId) => ({ roleId, menuId })),
      skipDuplicates: true,
    });

    return prisma.roleMenuPermission.findMany({
      where: { roleId },
      orderBy: { menuId: "asc" },
    });
  }

  findRoleMenuPermissions(roleId: number): Promise<RoleMenuPermission[]> {
    return prisma.roleMenuPermission.findMany({
      where: { roleId },
      orderBy: { menuId: "asc" },
    });
  }

  findRoleMenuActionPermissions(roleId: number): Promise<RoleMenuActionPermission[]> {
    return prisma.roleMenuActionPermission.findMany({
      where: { roleId },
      orderBy: { menuPath: "asc" },
    });
  }

  async replaceRoleMenuActionPermissions(
    roleId: number,
    records: MenuActionPermissionRecord[],
  ): Promise<RoleMenuActionPermission[]> {
    await prisma.roleMenuActionPermission.deleteMany({ where: { roleId } });

    if (records.length === 0) {
      return [];
    }

    await prisma.roleMenuActionPermission.createMany({
      data: records.map((record) => ({
        roleId,
        menuPath: record.menuPath,
        canRead: record.canRead,
        canCreate: record.canCreate,
        canUpdate: record.canUpdate,
        canDelete: record.canDelete,
      })),
      skipDuplicates: true,
    });

    return this.findRoleMenuActionPermissions(roleId);
  }

  upsertRoleQueryPermission(input: UpsertRoleQueryPermissionInput): Promise<RoleQueryPermission> {
    return prisma.roleQueryPermission.upsert({
      where: { roleId: input.roleId },
      update: {
        enforcementMode: input.enforcementMode,
        minAccidentAt: input.minAccidentAt ?? null,
        maxAccidentAt: input.maxAccidentAt ?? null,
        allowedLineNames: input.allowedLineNames ?? Prisma.JsonNull,
        allowedTypes: input.allowedTypes ?? Prisma.JsonNull,
        allowedLocationScope: input.allowedLocationScope ?? Prisma.JsonNull,
        enforcedLineName: input.enforcedLineName ?? null,
      },
      create: {
        roleId: input.roleId,
        enforcementMode: input.enforcementMode,
        minAccidentAt: input.minAccidentAt ?? null,
        maxAccidentAt: input.maxAccidentAt ?? null,
        allowedLineNames: input.allowedLineNames ?? Prisma.JsonNull,
        allowedTypes: input.allowedTypes ?? Prisma.JsonNull,
        allowedLocationScope: input.allowedLocationScope ?? Prisma.JsonNull,
        enforcedLineName: input.enforcedLineName ?? null,
      },
    });
  }

  findRoleQueryPermission(roleId: number): Promise<RoleQueryPermission | null> {
    return prisma.roleQueryPermission.findUnique({ where: { roleId } });
  }
}
