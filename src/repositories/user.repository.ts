import type { User } from "@prisma/client";
import { prisma } from "../config/prisma";

export class UserRepository {
  findByEmail(email: string): Promise<(User & { role: { name: string } }) | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { role: { select: { name: true } } },
    });
  }

  create(params: {
    email: string;
    password: string;
    name: string;
    roleId: number;
    affiliation?: string | null;
    ipRestrictionEnabled?: boolean;
    allowedIp?: string | null;
  }): Promise<User> {
    return prisma.user.create({ data: params });
  }

  findAll(): Promise<(User & { role: { id: number; name: string } })[]> {
    return prisma.user.findMany({
      include: { role: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
    });
  }

  findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  update(
    id: number,
    params: {
      name?: string;
      email?: string;
      roleId?: number;
      password?: string;
      ipRestrictionEnabled?: boolean;
      allowedIp?: string | null;
    },
  ): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: params,
    });
  }

  delete(id: number): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  }

  countByRoleId(roleId: number): Promise<number> {
    return prisma.user.count({ where: { roleId } });
  }
}
