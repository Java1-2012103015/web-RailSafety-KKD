import type { RoleBranding } from "@prisma/client";
import { prisma } from "../config/prisma";

export type BrandingUpsertInput = {
  pageTitle: string;
  systemName: string;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  showLogo: boolean;
  logoUrl?: string | null;
  showCiMark: boolean;
  ciMarkLabel?: string | null;
  showHero: boolean;
  showFooter: boolean;
};

export class BrandingRepository {
  findGlobal(): Promise<RoleBranding | null> {
    return prisma.roleBranding.findFirst({ where: { roleId: null } });
  }

  findByRoleId(roleId: number): Promise<RoleBranding | null> {
    return prisma.roleBranding.findUnique({ where: { roleId } });
  }

  findAllWithRoles(): Promise<
    (RoleBranding & {
      role: { id: number; name: string } | null;
    })[]
  > {
    return prisma.roleBranding.findMany({
      include: {
        role: { select: { id: true, name: true } },
      },
      orderBy: [{ roleId: "asc" }],
    });
  }

  async upsertGlobal(data: BrandingUpsertInput): Promise<RoleBranding> {
    const existing = await this.findGlobal();
    if (existing) {
      return prisma.roleBranding.update({ where: { id: existing.id }, data });
    }
    return prisma.roleBranding.create({ data: { roleId: null, ...data } });
  }

  upsertForRole(roleId: number, data: BrandingUpsertInput): Promise<RoleBranding> {
    return prisma.roleBranding.upsert({
      where: { roleId },
      create: { roleId, ...data },
      update: data,
    });
  }

  async ensureGlobalDefaults(data: BrandingUpsertInput): Promise<RoleBranding> {
    const existing = await this.findGlobal();
    if (existing) return existing;
    return prisma.roleBranding.create({ data: { roleId: null, ...data } });
  }

  async ensureRoleDefaults(roleId: number, data: BrandingUpsertInput): Promise<RoleBranding> {
    const existing = await this.findByRoleId(roleId);
    if (existing) return existing;
    return prisma.roleBranding.create({ data: { roleId, ...data } });
  }
}
