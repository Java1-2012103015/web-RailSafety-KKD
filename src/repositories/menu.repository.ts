import type { Menu, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export class MenuRepository {
  findById(id: number): Promise<Menu | null> {
    return prisma.menu.findUnique({ where: { id } });
  }

  create(data: { title: string; path?: string; sequence?: number; parentId?: number | null }): Promise<Menu> {
    return prisma.menu.create({ data });
  }

  update(id: number, data: Prisma.MenuUpdateInput): Promise<Menu> {
    return prisma.menu.update({
      where: { id },
      data,
    });
  }

  findAll(): Promise<Menu[]> {
    return prisma.menu.findMany({
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
    });
  }

  deleteManyByIds(ids: number[]): Promise<{ count: number }> {
    return prisma.menu.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  findByParentIds(parentIds: number[]): Promise<Pick<Menu, "id" | "parentId">[]> {
    return prisma.menu.findMany({
      where: {
        parentId: {
          in: parentIds,
        },
      },
      select: {
        id: true,
        parentId: true,
      },
    });
  }
}
