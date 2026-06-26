import type {
  SelfReportAssignmentType,
  SelfReportAttachmentKind,
  SelfReportIntakeDecision,
  SelfReportProcessingPath,
  SelfReportStatus,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { normalizeSelfReportSerialNo } from "../utils/self-report-case-csv";
import { extractSelfReportSerialKey } from "../utils/self-report-attachment-naming";

export class SelfReportRepository {
  findInstitutionByCode(code: string) {
    return prisma.selfReportInstitution.findUnique({ where: { code } });
  }

  findInstitutionById(id: number) {
    return prisma.selfReportInstitution.findUnique({ where: { id } });
  }

  listInstitutions() {
    return prisma.selfReportInstitution.findMany({ orderBy: { name: "asc" } });
  }

  listEnabledInstitutionsPublic() {
    return prisma.selfReportInstitution.findMany({
      where: { enabled: true },
      select: { id: true, name: true, code: true, regionalHq: true },
      orderBy: { name: "asc" },
    });
  }

  createInstitution(data: {
    name: string;
    code: string;
    authKeyHash: string;
    regionalHq?: string | null;
  }) {
    return prisma.selfReportInstitution.create({ data });
  }

  updateInstitution(
    id: number,
    data: Partial<{
      name: string;
      code: string;
      authKeyHash: string;
      regionalHq: string | null;
      enabled: boolean;
    }>,
  ) {
    return prisma.selfReportInstitution.update({ where: { id }, data });
  }

  deleteInstitution(id: number) {
    return prisma.selfReportInstitution.delete({ where: { id } });
  }

  listStaffByInstitution(institutionId: number, tier?: number) {
    return prisma.selfReportStaff.findMany({
      where: { institutionId, ...(tier !== undefined ? { tier } : {}), enabled: true },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });
  }

  findStaffById(id: number) {
    return prisma.selfReportStaff.findUnique({
      where: { id },
      include: { institution: true },
    });
  }

  findStaffByUserId(userId: number) {
    return prisma.selfReportStaff.findFirst({
      where: { userId, enabled: true },
      include: { institution: true },
    });
  }

  findStaffByInstitutionEmail(institutionId: number, email: string, tier: number) {
    const normalized = email.trim();
    if (!normalized) return null;
    return prisma.selfReportStaff.findFirst({
      where: {
        institutionId,
        tier,
        enabled: true,
        email: normalized,
      },
    });
  }

  findStaffByInstitutionEmailAnyTier(institutionId: number, email: string) {
    const normalized = email.trim();
    if (!normalized) return null;
    return prisma.selfReportStaff.findFirst({
      where: {
        institutionId,
        enabled: true,
        email: normalized,
      },
    });
  }

  createStaff(data: {
    institutionId: number;
    name: string;
    phone?: string | null;
    email?: string | null;
    tier: number;
    userId?: number | null;
  }) {
    return prisma.selfReportStaff.create({ data });
  }

  updateStaff(
    id: number,
    data: Partial<{ name: string; phone: string | null; email: string | null; tier: number; enabled: boolean }>,
  ) {
    return prisma.selfReportStaff.update({ where: { id }, data });
  }

  deleteStaff(id: number) {
    return prisma.selfReportStaff.delete({ where: { id } });
  }

  listCases(filters: {
    status?: SelfReportStatus;
    institutionId?: number;
    assigneeStaffId?: number;
    search?: string;
    excludeReporterFromSearch?: boolean;
    page: number;
    pageSize: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.institutionId) where.institutionId = filters.institutionId;
    if (filters.assigneeStaffId) where.assigneeStaffId = filters.assigneeStaffId;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      const orConditions: Record<string, unknown>[] = [
        { receiptNumber: { contains: q } },
        { title: { contains: q } },
        { location: { contains: q } },
      ];
      if (!filters.excludeReporterFromSearch) {
        orConditions.push({ reporterName: { contains: q } });
      }
      where.OR = orConditions;
    }

    return prisma.selfReportCase.findMany({
      where,
      include: {
        institution: { select: { id: true, name: true, code: true, regionalHq: true } },
        assigneeStaff: { select: { id: true, name: true, tier: true, phone: true, email: true } },
        assignments: {
          where: { assignmentType: "TIER1_TO_TIER2" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            fromStaff: { select: { id: true, name: true, tier: true, email: true } },
            toStaff: { select: { id: true, name: true, tier: true, email: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    });
  }

  countCases(filters: {
    status?: SelfReportStatus;
    institutionId?: number;
    assigneeStaffId?: number;
    search?: string;
    excludeReporterFromSearch?: boolean;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.institutionId) where.institutionId = filters.institutionId;
    if (filters.assigneeStaffId) where.assigneeStaffId = filters.assigneeStaffId;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      const orConditions: Record<string, unknown>[] = [
        { receiptNumber: { contains: q } },
        { title: { contains: q } },
        { location: { contains: q } },
      ];
      if (!filters.excludeReporterFromSearch) {
        orConditions.push({ reporterName: { contains: q } });
      }
      where.OR = orConditions;
    }
    return prisma.selfReportCase.count({ where });
  }

  findCaseByReceiptNumber(receiptNumber: string) {
    return prisma.selfReportCase.findUnique({
      where: { receiptNumber: receiptNumber.trim() },
      select: { id: true, receiptNumber: true },
    });
  }

  findCasesByReceiptSerialKey(serialKey: string) {
    let normalized: string;
    try {
      normalized = normalizeSelfReportSerialNo(serialKey);
    } catch {
      return Promise.resolve([]);
    }

    return prisma.selfReportCase
      .findMany({
        where: {
          OR: [
            { receiptNumber: normalized },
            { receiptNumber: { endsWith: `-${normalized}` } },
            { receiptNumber: { contains: normalized } },
          ],
        },
        select: { id: true, receiptNumber: true },
        orderBy: { createdAt: "desc" },
      })
      .then((cases) =>
        cases.filter((item) => {
          if (item.receiptNumber === normalized) return true;
          return extractSelfReportSerialKey(item.receiptNumber).toLowerCase() === normalized.toLowerCase();
        }),
      );
  }

  listAttachmentFileNamesByCase(caseId: number) {
    return prisma.selfReportAttachment.findMany({
      where: { caseId },
      select: { fileName: true },
      orderBy: { createdAt: "asc" },
    });
  }

  findCaseById(id: number) {
    return prisma.selfReportCase.findUnique({
      where: { id },
      include: {
        institution: true,
        assigneeStaff: true,
        assignments: {
          include: {
            fromStaff: { select: { id: true, name: true, tier: true, email: true } },
            toStaff: { select: { id: true, name: true, tier: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        histories: { orderBy: { createdAt: "desc" } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  createCase(data: {
    receiptNumber: string;
    title: string;
    content: string;
    reporterName?: string | null;
    reporterPhone?: string | null;
    location?: string | null;
  }) {
    return prisma.selfReportCase.create({ data });
  }

  updateCase(
    id: number,
    data: Partial<{
      title: string;
      content: string;
      reporterName: string | null;
      reporterPhone: string | null;
      location: string | null;
      status: SelfReportStatus;
      institutionId: number | null;
      assigneeStaffId: number | null;
      regionalHq: string | null;
      processingPlanDate: Date | null;
      processingPlanContent: string | null;
      processingResultDate: Date | null;
      processingResultContent: string | null;
      intakeDecision: SelfReportIntakeDecision | null;
      processingPath: SelfReportProcessingPath | null;
      priorCompletionDate: Date | null;
      priorCompletionContent: string | null;
      unprocessableReason: string | null;
      unprocessableTier1StaffId: number | null;
    }>,
  ) {
    return prisma.selfReportCase.update({ where: { id }, data });
  }

  createAssignment(data: {
    caseId: number;
    assignmentType: SelfReportAssignmentType;
    fromStaffId?: number | null;
    toStaffId?: number | null;
    toInstitutionId?: number | null;
    toRegionalHq?: string | null;
    note?: string | null;
    adminUserId?: number | null;
    smsSent?: boolean;
  }) {
    return prisma.selfReportAssignment.create({ data });
  }

  createHistory(data: {
    caseId: number;
    action: string;
    note?: string | null;
    actorName?: string | null;
    actorRole?: string | null;
  }) {
    return prisma.selfReportHistory.create({ data });
  }

  countAttachmentsByCase(caseId: number, kind?: SelfReportAttachmentKind) {
    return prisma.selfReportAttachment.count({
      where: { caseId, ...(kind ? { kind } : {}) },
    });
  }

  createAttachment(data: {
    caseId: number;
    kind?: SelfReportAttachmentKind;
    fileName: string;
    storedName: string;
    mimeType: string;
    fileSize: number;
    url: string;
  }) {
    return prisma.selfReportAttachment.create({ data });
  }

  findAttachmentById(id: number) {
    return prisma.selfReportAttachment.findUnique({ where: { id } });
  }

  deleteAttachment(id: number) {
    return prisma.selfReportAttachment.delete({ where: { id } });
  }

  listAttachmentsByCaseIds(caseIds: number[]) {
    if (!caseIds.length) return Promise.resolve([]);
    return prisma.selfReportAttachment.findMany({
      where: { caseId: { in: caseIds } },
      select: { id: true, caseId: true, url: true },
    });
  }

  deleteCasesByIds(ids: number[]) {
    if (!ids.length) return Promise.resolve({ count: 0 });
    return prisma.selfReportCase.deleteMany({ where: { id: { in: ids } } });
  }
}
