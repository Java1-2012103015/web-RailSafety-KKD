import type { User } from "@prisma/client";
import { ROLES } from "../constants/roles";
import { SelfReportRepository } from "../repositories/self-report.repository";
import { prisma } from "../config/prisma";

export function isSelfReportRole(roleName: string): boolean {
  return roleName === ROLES.SELF_REPORT_TIER1 || roleName === ROLES.SELF_REPORT_TIER2;
}

export function tierFromRole(roleName: string): 1 | 2 | null {
  if (roleName === ROLES.SELF_REPORT_TIER1) return 1;
  if (roleName === ROLES.SELF_REPORT_TIER2) return 2;
  return null;
}

export class SelfReportUserSyncService {
  constructor(private readonly selfReportRepository: SelfReportRepository) {}

  async syncStaffFromUser(user: User & { role: { name: string } }) {
    const tier = tierFromRole(user.role.name);
    if (!tier || !user.selfReportInstitutionId) {
      return null;
    }

    const existingByUser = await prisma.selfReportStaff.findUnique({
      where: { userId: user.id },
    });
    if (existingByUser) {
      return prisma.selfReportStaff.update({
        where: { id: existingByUser.id },
        data: {
          institutionId: user.selfReportInstitutionId,
          name: user.name,
          email: user.email,
          tier,
          enabled: true,
        },
      });
    }

    const existingByEmail = await prisma.selfReportStaff.findFirst({
      where: {
        institutionId: user.selfReportInstitutionId,
        email: user.email,
        tier,
      },
    });
    if (existingByEmail) {
      return prisma.selfReportStaff.update({
        where: { id: existingByEmail.id },
        data: {
          userId: user.id,
          name: user.name,
          enabled: true,
        },
      });
    }

    return this.selfReportRepository.createStaff({
      institutionId: user.selfReportInstitutionId,
      name: user.name,
      email: user.email,
      tier,
      userId: user.id,
    });
  }

  async clearStaffLinkForUser(userId: number): Promise<void> {
    await prisma.selfReportStaff.updateMany({
      where: { userId },
      data: { enabled: false, userId: null },
    });
  }
}
