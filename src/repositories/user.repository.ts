import type { User } from "@prisma/client";
import { prisma } from "../config/prisma";

export class UserRepository {
  findByEmail(email: string): Promise<(User & { role: { name: string } }) | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { role: { select: { name: true } } },
    });
  }

  findByEmailForSelfReport(email: string) {
    return prisma.user.findUnique({
      where: { email: email.trim() },
      include: {
        role: { select: { name: true } },
        selfReportInstitution: { select: { id: true, name: true, code: true } },
      },
    });
  }

  create(params: {
    email: string;
    password: string;
    name: string;
    roleId: number;
    affiliation?: string | null;
    selfReportInstitutionId?: number | null;
    selfReportAuthKeyHash?: string | null;
    selfReportAuthKeyEnc?: string | null;
    passkeyEnc?: string | null;
    ipRestrictionEnabled?: boolean;
    allowedIp?: string | null;
  }): Promise<User> {
    return prisma.user.create({ data: params });
  }

  findAll() {
    return prisma.user.findMany({
      include: {
        role: { select: { id: true, name: true } },
        selfReportInstitution: { select: { id: true, name: true, code: true } },
      },
      orderBy: { id: "asc" },
    });
  }

  findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  findByIdWithRole(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: { select: { name: true } } },
    });
  }

  update(
    id: number,
    params: {
      name?: string;
      email?: string;
      roleId?: number;
      password?: string;
      selfReportInstitutionId?: number | null;
      selfReportAuthKeyHash?: string | null;
      selfReportAuthKeyEnc?: string | null;
      passkeyEnc?: string | null;
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
