import type { Menu } from "@prisma/client";
import { ROLES } from "../constants/roles";
import { HttpError } from "../utils/http-error";
import { MenuRepository } from "../repositories/menu.repository";
import { PermissionRepository } from "../repositories/permission.repository";

interface CreateMenuInput {
  title?: string;
  path?: string;
  sequence?: number;
  parentId?: number | null;
}

interface UpdateMenuInput {
  title?: string;
  path?: string | null;
  sequence?: number;
}

export interface MenuTreeNode {
  id: number;
  title: string;
  path: string | null;
  sequence: number;
  parentId: number | null;
  children: MenuTreeNode[];
}

export class MenuService {
  constructor(
    private readonly menuRepository: MenuRepository,
    private readonly permissionRepository: PermissionRepository,
  ) {}

  async createMenu(input: CreateMenuInput): Promise<Menu> {
    if (!input.title?.trim()) {
      throw new HttpError(400, "title is required.");
    }

    if (input.parentId !== undefined && input.parentId !== null) {
      const parentMenu = await this.menuRepository.findById(input.parentId);
      if (!parentMenu) {
        throw new HttpError(404, "Parent menu not found.");
      }
    }

    return this.menuRepository.create({
      title: input.title.trim(),
      path: input.path?.trim() || undefined,
      sequence: input.sequence ?? 0,
      parentId: input.parentId ?? null,
    });
  }

  async updateMenu(id: number, input: UpdateMenuInput): Promise<Menu> {
    const menu = await this.menuRepository.findById(id);
    if (!menu) {
      throw new HttpError(404, "Menu not found.");
    }

    const data: {
      title?: string;
      path?: string | null;
      sequence?: number;
    } = {};

    if (input.title !== undefined) {
      if (!input.title.trim()) {
        throw new HttpError(400, "title cannot be empty.");
      }
      data.title = input.title.trim();
    }

    if (input.path !== undefined) {
      data.path = input.path?.trim() || null;
    }

    if (input.sequence !== undefined) {
      data.sequence = input.sequence;
    }

    return this.menuRepository.update(id, data);
  }

  async deleteMenu(id: number): Promise<{ deletedCount: number }> {
    const rootMenu = await this.menuRepository.findById(id);
    if (!rootMenu) {
      throw new HttpError(404, "Menu not found.");
    }

    const idsToDelete: number[] = [id];
    let currentLevel: number[] = [id];

    while (currentLevel.length > 0) {
      const children = await this.menuRepository.findByParentIds(currentLevel);
      const childIds = children.map((child) => child.id);
      if (childIds.length === 0) {
        break;
      }

      idsToDelete.push(...childIds);
      currentLevel = childIds;
    }

    const result = await this.menuRepository.deleteManyByIds(idsToDelete);
    return { deletedCount: result.count };
  }

  async getMenuTree(auth: { roleId: number; role: string }): Promise<MenuTreeNode[]> {
    const menus = await this.menuRepository.findAll();

    if (auth.role === ROLES.ADMIN) {
      return this.buildTree(menus);
    }

    const permissions = await this.permissionRepository.findRoleMenuPermissions(auth.roleId);
    const allowedSet = new Set(permissions.map((item) => item.menuId));

    const filteredMenus = menus.filter((menu) => this.isMenuVisible(menu.id, menus, allowedSet));
    return this.buildTree(filteredMenus);
  }

  private isMenuVisible(id: number, allMenus: Menu[], allowedSet: Set<number>): boolean {
    if (allowedSet.has(id)) {
      return true;
    }

    const descendants = allMenus.filter((menu) => menu.parentId === id);
    if (descendants.some((child) => this.isMenuVisible(child.id, allMenus, allowedSet))) {
      return true;
    }

    return false;
  }

  private buildTree(menus: Menu[]): MenuTreeNode[] {
    const nodeMap = new Map<number, MenuTreeNode>();
    const roots: MenuTreeNode[] = [];

    for (const menu of menus) {
      nodeMap.set(menu.id, {
        id: menu.id,
        title: menu.title,
        path: menu.path,
        sequence: menu.sequence,
        parentId: menu.parentId,
        children: [],
      });
    }

    for (const menu of menus) {
      const node = nodeMap.get(menu.id);
      if (!node) {
        continue;
      }

      if (menu.parentId === null) {
        roots.push(node);
        continue;
      }

      const parentNode = nodeMap.get(menu.parentId);
      if (!parentNode) {
        roots.push(node);
        continue;
      }

      parentNode.children.push(node);
    }

    const sortNodes = (items: MenuTreeNode[]): void => {
      items.sort((a, b) => a.sequence - b.sequence || a.id - b.id);
      for (const item of items) {
        sortNodes(item.children);
      }
    };

    sortNodes(roots);
    return roots;
  }
}
