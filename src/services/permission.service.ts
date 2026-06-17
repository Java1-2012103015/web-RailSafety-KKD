import type { QueryEnforcementMode } from "@prisma/client";
import {
  ACCIDENT_KIND_CATEGORIES,
  normalizeAccidentKindCategories,
  type AccidentKindCategory,
} from "../constants/accident-kind-category";
import {
  buildAdminMenuActionsMap,
  createReadOnlyMenuActionFlags,
  MENU_ACTION_PATHS,
  type MenuActionPermissionRecord,
} from "../constants/menu-action-permissions";
import { ROLES } from "../constants/roles";
import { normalizeLocationScope, type LocationScopeRule } from "../constants/query-location-scope";
import { MenuRepository } from "../repositories/menu.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { RoleRepository } from "../repositories/role.repository";
import { UserRepository } from "../repositories/user.repository";
import { MenuActionPermissionService } from "./menu-action-permission.service";
import { HttpError } from "../utils/http-error";

interface SetRoleMenuPermissionsInput {
  roleId?: number;
  menuIds?: number[];
  menuActionPermissions?: MenuActionPermissionRecord[];
}

interface SetRoleQueryPermissionInput {
  roleId?: number;
  enforcementMode?: QueryEnforcementMode;
  minAccidentAt?: string | null;
  maxAccidentAt?: string | null;
  allowedLineNames?: string[] | null;
  allowedTypes?: string[] | null;
  allowedLocationScope?: LocationScopeRule[] | null;
  enforcedLineName?: string | null;
}

export class PermissionService {
  private readonly menuActionPermissionService: MenuActionPermissionService;

  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly menuRepository: MenuRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly userRepository: UserRepository,
  ) {
    this.menuActionPermissionService = new MenuActionPermissionService(permissionRepository);
  }

  private normalizeRoleName(name?: string): string {
    const normalizedName = name?.trim();
    if (!normalizedName) {
      throw new HttpError(400, "name is required.");
    }
    if (!/^[\p{L}\p{N}_\-\s]+$/u.test(normalizedName)) {
      throw new HttpError(400, "Role name can include Korean/English letters, numbers, spaces, underscore(_), hyphen(-).");
    }
    if (normalizedName.toUpperCase() === ROLES.ADMIN) {
      throw new HttpError(400, "ADMIN role cannot be modified manually.");
    }
    return normalizedName;
  }

  async createRole(name?: string) {
    const normalizedName = this.normalizeRoleName(name);

    const existing = await this.roleRepository.findByName(normalizedName);
    if (existing) {
      throw new HttpError(409, "Role name already exists.");
    }

    return this.roleRepository.create(normalizedName);
  }

  async updateRoleName(roleId: number, name?: string) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new HttpError(404, "Role not found.");
    }
    if (role.name === ROLES.ADMIN) {
      throw new HttpError(400, "ADMIN role cannot be modified.");
    }

    const normalizedName = this.normalizeRoleName(name);
    const existing = await this.roleRepository.findByName(normalizedName);
    if (existing && existing.id !== roleId) {
      throw new HttpError(409, "Role name already exists.");
    }

    return this.roleRepository.updateName(roleId, normalizedName);
  }

  async deleteRole(roleId: number) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new HttpError(404, "Role not found.");
    }
    if (role.name === ROLES.ADMIN) {
      throw new HttpError(400, "ADMIN role cannot be deleted.");
    }

    const userCount = await this.userRepository.countByRoleId(roleId);
    if (userCount > 0) {
      throw new HttpError(400, `Cannot delete role in use by ${userCount} user(s).`);
    }

    await this.roleRepository.deleteById(roleId);
    return { roleId };
  }

  async setRoleMenuPermissions(input: SetRoleMenuPermissionsInput) {
    if (!input.roleId || !Number.isInteger(input.roleId) || input.roleId < 1) {
      throw new HttpError(400, "roleId is required.");
    }
    if (!Array.isArray(input.menuIds)) {
      throw new HttpError(400, "menuIds must be an array.");
    }

    const role = await this.roleRepository.findById(input.roleId);
    if (!role) {
      throw new HttpError(404, "Role not found.");
    }
    if (role.name === ROLES.ADMIN) {
      throw new HttpError(400, "ADMIN menu permissions are always fully allowed.");
    }

    const uniqueIds = Array.from(new Set(input.menuIds));
    if (uniqueIds.some((id) => !Number.isInteger(id) || id < 1)) {
      throw new HttpError(400, "menuIds must contain valid positive integers.");
    }

    if (uniqueIds.length > 0) {
      const allMenus = await this.menuRepository.findAll();
      const menuIdSet = new Set(allMenus.map((menu) => menu.id));
      const invalidId = uniqueIds.find((id) => !menuIdSet.has(id));
      if (invalidId) {
        throw new HttpError(404, `Menu not found: ${invalidId}`);
      }
    }

    const saved = await this.permissionRepository.replaceRoleMenuPermissions(input.roleId, uniqueIds);

    let menuActionPermissions: MenuActionPermissionRecord[] = [];
    if (input.menuActionPermissions !== undefined) {
      menuActionPermissions = this.menuActionPermissionService.normalizeMenuActionPermissions(
        input.menuActionPermissions,
      );
      await this.permissionRepository.replaceRoleMenuActionPermissions(input.roleId, menuActionPermissions);
    }

    return {
      roleId: input.roleId,
      menuIds: saved.map((item) => item.menuId),
      menuActionPermissions,
    };
  }

  async setRoleQueryPermission(input: SetRoleQueryPermissionInput) {
    if (!input.roleId || !Number.isInteger(input.roleId) || input.roleId < 1) {
      throw new HttpError(400, "roleId is required.");
    }

    const role = await this.roleRepository.findById(input.roleId);
    if (!role) {
      throw new HttpError(404, "Role not found.");
    }

    const mode = input.enforcementMode ?? "OVERWRITE";
    if (mode !== "OVERWRITE" && mode !== "BLOCK") {
      throw new HttpError(400, "enforcementMode must be OVERWRITE or BLOCK.");
    }

    const minAccidentAt = input.minAccidentAt ? new Date(input.minAccidentAt) : null;
    const maxAccidentAt = input.maxAccidentAt ? new Date(input.maxAccidentAt) : null;
    if (minAccidentAt && Number.isNaN(minAccidentAt.getTime())) {
      throw new HttpError(400, "Invalid minAccidentAt format.");
    }
    if (maxAccidentAt && Number.isNaN(maxAccidentAt.getTime())) {
      throw new HttpError(400, "Invalid maxAccidentAt format.");
    }
    if (minAccidentAt && maxAccidentAt && minAccidentAt > maxAccidentAt) {
      throw new HttpError(400, "minAccidentAt cannot be greater than maxAccidentAt.");
    }

    const normalizeLines = input.allowedLineNames?.map((line) => line.trim()).filter((line) => line.length > 0) ?? null;

    const allowedTypeCandidates = input.allowedTypes ?? null;

    let allowedTypes: AccidentKindCategory[] | null = null;
    if (allowedTypeCandidates) {
      const normalized = normalizeAccidentKindCategories(allowedTypeCandidates);
      const invalidType = allowedTypeCandidates.find((type) => {
        const value = String(type ?? "").trim();
        if (!value) return false;
        if ((ACCIDENT_KIND_CATEGORIES as readonly string[]).includes(value)) return false;
        return !normalizeAccidentKindCategories([value]).length;
      });
      if (invalidType) {
        throw new HttpError(400, `Invalid accident kind category: ${invalidType}`);
      }
      allowedTypes = normalized.length > 0 ? normalized : null;
    }

    const enforcedLineName = input.enforcedLineName?.trim() || null;
    if (enforcedLineName && normalizeLines && !normalizeLines.includes(enforcedLineName)) {
      throw new HttpError(400, "enforcedLineName must be included in allowedLineNames.");
    }

    const allowedLocationScope = input.allowedLocationScope
      ? normalizeLocationScope(input.allowedLocationScope)
      : null;

    const saved = await this.permissionRepository.upsertRoleQueryPermission({
      roleId: input.roleId,
      enforcementMode: mode,
      minAccidentAt,
      maxAccidentAt,
      allowedLineNames: normalizeLines,
      allowedTypes,
      allowedLocationScope,
      enforcedLineName,
    });

    return {
      roleId: saved.roleId,
      enforcementMode: saved.enforcementMode,
      minAccidentAt: saved.minAccidentAt,
      maxAccidentAt: saved.maxAccidentAt,
      allowedLineNames: saved.allowedLineNames,
      allowedTypes: saved.allowedTypes,
      allowedLocationScope: saved.allowedLocationScope,
      enforcedLineName: saved.enforcedLineName,
    };
  }

  async listRoles() {
    return this.roleRepository.findAll();
  }

  async getRolePermissions(roleId: number) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new HttpError(404, "Role not found.");
    }
    const menuPermissions = await this.permissionRepository.findRoleMenuPermissions(roleId);
    const menuIds = menuPermissions.map((mp) => mp.menuId);
    const queryPermission = await this.permissionRepository.findRoleQueryPermission(roleId);

    let menuActionPermissions: MenuActionPermissionRecord[] = [];
    if (role.name === ROLES.ADMIN) {
      menuActionPermissions = MENU_ACTION_PATHS.map((menuPath) => {
        const flags = buildAdminMenuActionsMap()[menuPath];
        return {
          menuPath,
          canRead: flags.read,
          canCreate: flags.create,
          canUpdate: flags.update,
          canDelete: flags.delete,
        };
      });
    } else {
      const records = await this.permissionRepository.findRoleMenuActionPermissions(roleId);
      menuActionPermissions = MENU_ACTION_PATHS.map((menuPath) => {
        const record = records.find((item) => item.menuPath === menuPath);
        if (record) {
          return {
            menuPath,
            canRead: record.canRead,
            canCreate: record.canCreate,
            canUpdate: record.canUpdate,
            canDelete: record.canDelete,
          };
        }
        const defaults = createReadOnlyMenuActionFlags();
        return {
          menuPath,
          canRead: defaults.read,
          canCreate: defaults.create,
          canUpdate: defaults.update,
          canDelete: defaults.delete,
        };
      });
    }

    return {
      menuIds,
      menuActionPermissions,
      queryPermission,
    };
  }
}
