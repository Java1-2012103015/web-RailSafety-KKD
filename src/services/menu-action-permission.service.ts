import {
  buildAdminMenuActionsMap,
  createFullMenuActionFlags,
  createReadOnlyMenuActionFlags,
  isMenuActionPath,
  MENU_ACTION_PATHS,
  type MenuActionFlags,
  type MenuActionKey,
  type MenuActionPath,
  type MenuActionPermissionRecord,
  recordToMenuActionFlags,
} from "../constants/menu-action-permissions";
import { ROLES } from "../constants/roles";
import { PermissionRepository } from "../repositories/permission.repository";
import { HttpError } from "../utils/http-error";

export class MenuActionPermissionService {
  constructor(private readonly permissionRepository: PermissionRepository) {}

  async getMenuActionsForRole(roleId: number, role: string): Promise<Record<MenuActionPath, MenuActionFlags>> {
    if (role === ROLES.ADMIN) {
      return buildAdminMenuActionsMap();
    }

    const records = await this.permissionRepository.findRoleMenuActionPermissions(roleId);
    const map = {} as Record<MenuActionPath, MenuActionFlags>;

    for (const menuPath of MENU_ACTION_PATHS) {
      const record = records.find((item) => item.menuPath === menuPath);
      map[menuPath] = record
        ? recordToMenuActionFlags({
            menuPath,
            canRead: record.canRead,
            canCreate: record.canCreate,
            canUpdate: record.canUpdate,
            canDelete: record.canDelete,
          })
        : createReadOnlyMenuActionFlags();
    }

    return map;
  }

  async assertMenuAction(
    roleId: number,
    role: string,
    menuPath: MenuActionPath,
    action: MenuActionKey,
  ): Promise<void> {
    const actions = await this.getMenuActionsForRole(roleId, role);
    const flags = actions[menuPath] ?? createReadOnlyMenuActionFlags();

    if (!flags[action]) {
      const messages: Record<MenuActionKey, string> = {
        read: "열람",
        create: "등록",
        update: "수정",
        delete: "삭제",
      };
      throw new HttpError(403, `${messages[action]} 권한이 없습니다.`);
    }
  }

  normalizeMenuActionPermissions(input: unknown): MenuActionPermissionRecord[] {
    if (!Array.isArray(input)) {
      throw new HttpError(400, "menuActionPermissions must be an array.");
    }

    const records: MenuActionPermissionRecord[] = [];

    for (const item of input) {
      const raw = item as {
        menuPath?: string;
        canRead?: boolean;
        canCreate?: boolean;
        canUpdate?: boolean;
        canDelete?: boolean;
      };

      const menuPath = raw.menuPath?.trim();
      if (!isMenuActionPath(menuPath)) {
        throw new HttpError(400, `Invalid menuPath: ${raw.menuPath ?? ""}`);
      }

      records.push({
        menuPath,
        canRead: Boolean(raw.canRead),
        canCreate: Boolean(raw.canCreate),
        canUpdate: Boolean(raw.canUpdate),
        canDelete: Boolean(raw.canDelete),
      });
    }

    return records;
  }

  buildDefaultMenuActionPermissions(fullAccess = false): MenuActionPermissionRecord[] {
    const flags = fullAccess ? createFullMenuActionFlags() : createReadOnlyMenuActionFlags();
    return MENU_ACTION_PATHS.map((menuPath) => ({
      menuPath,
      canRead: flags.read,
      canCreate: flags.create,
      canUpdate: flags.update,
      canDelete: flags.delete,
    }));
  }
}
