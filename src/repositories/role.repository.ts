import type { Role } from "@prisma/client";
import { prisma } from "../config/prisma";

export class RoleRepository {
  findById(id: number): Promise<Role | null> {
    return prisma.role.findUnique({ where: { id } });
  }

  findByName(name: string): Promise<Role | null> {
    return prisma.role.findUnique({ where: { name } });
  }

  create(name: string): Promise<Role> {
    return prisma.role.create({ data: { name } });
  }

  findAll(): Promise<Role[]> {
    return prisma.role.findMany({ orderBy: { id: "asc" } });
  }

  updateName(id: number, name: string): Promise<Role> {
    return prisma.role.update({
      where: { id },
      data: { name },
    });
  }

  deleteById(id: number): Promise<Role> {
    return prisma.role.delete({ where: { id } });
  }
}
