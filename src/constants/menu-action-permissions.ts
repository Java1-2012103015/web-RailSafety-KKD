export const MENU_ACTION_PATHS = ["/notices", "/archive"] as const;

export type MenuActionPath = (typeof MENU_ACTION_PATHS)[number];

export type MenuActionKey = "read" | "create" | "update" | "delete";

export interface MenuActionFlags {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface MenuActionPermissionRecord {
  menuPath: MenuActionPath;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export const MENU_ACTION_LABELS: Record<MenuActionKey, string> = {
  read: "열람",
  create: "등록",
  update: "수정",
  delete: "삭제",
};

export function createFullMenuActionFlags(): MenuActionFlags {
  return { read: true, create: true, update: true, delete: true };
}

export function createReadOnlyMenuActionFlags(): MenuActionFlags {
  return { read: true, create: false, update: false, delete: false };
}

export function createEmptyMenuActionFlags(): MenuActionFlags {
  return { read: false, create: false, update: false, delete: false };
}

export function recordToMenuActionFlags(record: MenuActionPermissionRecord): MenuActionFlags {
  return {
    read: record.canRead,
    create: record.canCreate,
    update: record.canUpdate,
    delete: record.canDelete,
  };
}

export function menuActionFlagsToRecord(menuPath: MenuActionPath, flags: MenuActionFlags): MenuActionPermissionRecord {
  return {
    menuPath,
    canRead: flags.read,
    canCreate: flags.create,
    canUpdate: flags.update,
    canDelete: flags.delete,
  };
}

export function buildAdminMenuActionsMap(): Record<MenuActionPath, MenuActionFlags> {
  const full = createFullMenuActionFlags();
  return {
    "/notices": { ...full },
    "/archive": { ...full },
  };
}

export function isMenuActionPath(path: string | null | undefined): path is MenuActionPath {
  return MENU_ACTION_PATHS.includes(path as MenuActionPath);
}
