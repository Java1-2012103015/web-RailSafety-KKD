import { randomBytes } from "crypto";
import type {
  SelfReportAssignmentType,
  SelfReportAttachmentKind,
  SelfReportIntakeDecision,
  SelfReportProcessingPath,
  SelfReportStatus,
} from "@prisma/client";
import { ROLES } from "../constants/roles";
import { RoleRepository } from "../repositories/role.repository";
import { SelfReportRepository } from "../repositories/self-report.repository";
import { UserRepository } from "../repositories/user.repository";
import { SmsNotificationService } from "./sms-notification.service";
import { SmsTemplateService } from "./sms-template.service";
import type { SmsTemplateType } from "../constants/sms-templates";
import { SMS_TEMPLATE_TYPES, buildStaffAccountSmsMessage } from "../constants/sms-templates";
import {
  SelfReportUserSyncService,
} from "./self-report-user-sync.service";
import {
  deleteSelfReportAttachmentFile,
  deleteSelfReportCaseAttachmentDir,
  MAX_ATTACHMENTS_PER_CASE,
  parseAttachmentDataUrl,
  saveSelfReportAttachment,
} from "../utils/self-report-attachment-storage";
import {
  parseSelfReportCaseCsv,
  SELF_REPORT_CASE_SAMPLE_CSV,
  normalizeSelfReportReceiptNumberInput,
  normalizeSelfReportSerialNo,
} from "../utils/self-report-case-csv";
import {
  allocateAttachmentSlotIndexes,
  buildSelfReportAttachmentFileName,
  parseBulkAttachmentFileName,
  resolveSelfReportAttachmentFileName,
} from "../utils/self-report-attachment-naming";
import { HttpError } from "../utils/http-error";
import { hashPassword } from "../utils/password";
import { decryptSelfReportAuthKey, encryptSelfReportAuthKey } from "../utils/self-report-auth-key";
import type { SelfReportActor } from "../middlewares/self-report-auth.middleware";
import { isPortalPayload } from "../middlewares/self-report-auth.middleware";

const STATUS_LABELS: Record<SelfReportStatus, string> = {
  RECEIVED: "접수",
  ADMIN_ASSIGNED: "관리자 배정",
  TIER1_PROCESSING: "1차 처리중",
  TIER2_ASSIGNMENT: "2차담당 배정",
  TIER2_PROCESSING: "2차 처리중",
  TRANSFERRED: "이첩",
  COMPLETED: "처리완료",
  CLOSED: "종결",
  UNPROCESSABLE: "처리불가",
  UNPROCESSABLE_PENDING: "처리불가 확인대기",
  RETURNED_TO_ADMIN: "관리자 반려",
};

const INTAKE_DECISION_LABELS: Record<SelfReportIntakeDecision, string> = {
  PROCESS: "처리 결정",
  UNPROCESSABLE: "처리불가 결정",
  RETURN_TO_ADMIN: "담당기관 이첩",
  ALREADY_COMPLETED: "기완료",
};

const PROCESSING_PATH_LABELS: Record<SelfReportProcessingPath, string> = {
  TIER2_ASSIGN: "2차 담당 배정",
  DIRECT_INPUT: "직접 입력",
};

interface ActorContext {
  role: string;
  userId?: number;
  userName?: string;
  institutionId?: number;
  institutionName?: string;
  staffId?: number;
  staffName?: string;
}

export class SelfReportService {
  private readonly selfReportUserSyncService: SelfReportUserSyncService;

  constructor(
    private readonly selfReportRepository: SelfReportRepository,
    private readonly smsNotificationService: SmsNotificationService,
    private readonly smsTemplateService: SmsTemplateService,
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly roleRepository: RoleRepository = new RoleRepository(),
  ) {
    this.selfReportUserSyncService = new SelfReportUserSyncService(selfReportRepository);
  }

  private actorFromPayload(payload: SelfReportActor): ActorContext {
    if (isPortalPayload(payload)) {
      return {
        role: payload.role,
        userId: payload.userId,
        userName: payload.email,
      };
    }
    return {
      role: payload.role,
      institutionId: payload.selfReportInstitutionId,
      institutionName: payload.selfReportInstitutionName,
      staffId: payload.selfReportStaffId,
      staffName: payload.selfReportStaffName,
    };
  }

  private actorDisplayName(actor: ActorContext): string {
    if (actor.role === ROLES.ADMIN) return actor.userName ?? "관리자";
    if (actor.role === ROLES.SELF_REPORT_TIER2) return actor.staffName ?? "2차 담당";
    if (actor.role === ROLES.SELF_REPORT_TIER1) return `${actor.institutionName ?? "기관"} 1차 담당`;
    return "사용자";
  }

  private async resolveAssignerContact(payload: SelfReportActor): Promise<{ assignerName: string; assignerEmail: string }> {
    if (isPortalPayload(payload)) {
      return { assignerName: payload.email, assignerEmail: payload.email };
    }

    const staffName = payload.selfReportStaffName ?? "";
    if (!payload.selfReportStaffId) {
      return { assignerName: staffName, assignerEmail: "" };
    }

    const staff = await this.selfReportRepository.findStaffById(payload.selfReportStaffId);
    return {
      assignerName: staff?.name ?? staffName,
      assignerEmail: staff?.email ?? "",
    };
  }

  private sanitizeCaseForActor<T extends { reporterPhone?: string | null }>(
    payload: SelfReportActor,
    item: T,
  ): T {
    const actor = this.actorFromPayload(payload);
    if (actor.role === ROLES.ADMIN) return item;
    return { ...item, reporterPhone: null };
  }

  private formatDateOnly(value: Date | null | undefined): string {
    if (!value) return "";
    return value.toLocaleDateString("ko-KR");
  }

  private buildSmsVarsFromCase(
    item: {
      receiptNumber: string;
      title: string;
      regionalHq?: string | null;
      reporterName?: string | null;
      processingPlanDate?: Date | null;
      processingPlanContent?: string | null;
      processingResultDate?: Date | null;
      unprocessableReason?: string | null;
      institution?: { name: string } | null;
    },
    overrides?: Partial<{
      institutionName: string;
      processingPlanDate: Date | null;
      processingPlanContent: string | null;
      processingResultDate: Date | null;
      unprocessableReason: string | null;
    }>,
  ) {
    const planDate = overrides?.processingPlanDate ?? item.processingPlanDate;
    const planContent = overrides?.processingPlanContent ?? item.processingPlanContent;
    const resultDate = overrides?.processingResultDate ?? item.processingResultDate;
    const unprocessableReason = overrides?.unprocessableReason ?? item.unprocessableReason ?? "";
    return {
      receiptNumber: item.receiptNumber,
      title: item.title,
      institutionName: overrides?.institutionName ?? item.institution?.name ?? "",
      regionalHq: item.regionalHq ?? "",
      reporterName: item.reporterName ?? "",
      processingPlanDate: this.formatDateOnly(planDate),
      processingPlanContent: planContent ?? "",
      processingResultDate: this.formatDateOnly(resultDate),
      unprocessableReason,
    };
  }

  private async notifyStaffByPhone(
    caseId: number,
    phone: string,
    staffName: string,
    templateType: SmsTemplateType,
    item: Parameters<SelfReportService["buildSmsVarsFromCase"]>[0],
    overrides?: Parameters<SelfReportService["buildSmsVarsFromCase"]>[1] & { dashboardUrl?: string },
  ): Promise<void> {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) return;

    const dashboardUrl =
      overrides?.dashboardUrl ?? (await this.smsTemplateService.getSelfReportDashboardUrl());
    const message = await this.smsTemplateService.render(templateType, {
      ...this.buildSmsVarsFromCase(item, overrides),
      staffName,
      dashboardUrl,
    });
    const sent = await this.smsNotificationService.sendSms(normalizedPhone, message);
    if (!sent) {
      console.info("[self-report] staff SMS not sent:", templateType, caseId);
      return;
    }

    await this.selfReportRepository.createHistory({
      caseId,
      action: "담당자 문자 발송",
      note: message,
      actorName: "시스템",
      actorRole: "SYSTEM",
    });
  }

  private async resolveTier1AssignerStaff(
    caseId: number,
    institutionId: number,
    assignments: Array<{ assignmentType: string; fromStaffId: number | null }>,
  ) {
    const tier1Assignment = assignments.find((a) => a.assignmentType === "TIER1_TO_TIER2");
    if (tier1Assignment?.fromStaffId) {
      const staff = await this.selfReportRepository.findStaffById(tier1Assignment.fromStaffId);
      if (staff?.tier === 1 && staff.institutionId === institutionId) return staff;
    }

    const tier1Staff = await this.selfReportRepository.listStaffByInstitution(institutionId, 1);
    return tier1Staff.find((s) => s.phone?.trim()) ?? tier1Staff[0] ?? null;
  }

  private async notifyReporter(
    caseId: number,
    item: {
      reporterPhone?: string | null;
      receiptNumber: string;
      title: string;
      regionalHq?: string | null;
      reporterName?: string | null;
      processingPlanDate?: Date | null;
      processingPlanContent?: string | null;
      processingResultDate?: Date | null;
      institution?: { name: string } | null;
    },
    templateType: SmsTemplateType,
    overrides?: Parameters<SelfReportService["buildSmsVarsFromCase"]>[1],
  ): Promise<void> {
    const phone = item.reporterPhone?.replace(/\D/g, "") ?? "";
    if (phone.length < 10 || phone.length > 11) return;

    const message = await this.smsTemplateService.render(
      templateType,
      this.buildSmsVarsFromCase(item, overrides),
    );
    const sent = await this.smsNotificationService.sendSms(phone, message);
    if (!sent) {
      console.info("[self-report] reporter SMS not sent:", templateType, caseId);
      return;
    }

    await this.selfReportRepository.createHistory({
      caseId,
      action: "보고자 문자 발송",
      note: message,
      actorName: "시스템",
      actorRole: "SYSTEM",
    });
  }

  private hadProcessingPlan(item: {
    processingPlanDate?: Date | null;
    processingPlanContent?: string | null;
  }): boolean {
    return Boolean(item.processingPlanDate || item.processingPlanContent?.trim());
  }

  private resolveCaseAssignees(item: {
    assigneeStaff?: { name: string; email?: string | null; tier: number } | null;
    assignments?: Array<{
      assignmentType: string;
      createdAt: Date;
      fromStaff?: { name: string; email?: string | null; tier: number } | null;
      toStaff?: { name: string; email?: string | null; tier: number } | null;
    }>;
  }) {
    const tier1Assignment = item.assignments
      ?.filter((a) => a.assignmentType === "TIER1_TO_TIER2")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    const tier1Staff = tier1Assignment?.fromStaff?.tier === 1 ? tier1Assignment.fromStaff : null;
    let resolvedTier1 = tier1Staff;
    if (!resolvedTier1 && item.assigneeStaff?.tier === 1) {
      resolvedTier1 = item.assigneeStaff;
    }
    let tier2Staff = item.assigneeStaff?.tier === 2 ? item.assigneeStaff : null;
    if (!tier2Staff && tier1Assignment?.toStaff?.tier === 2) {
      tier2Staff = tier1Assignment.toStaff;
    }

    const toContact = (staff: { name: string; email?: string | null } | null | undefined) =>
      staff ? { name: staff.name, email: staff.email?.trim() || null } : null;

    return {
      tier1Assignee: toContact(resolvedTier1),
      tier2Assignee: toContact(tier2Staff),
    };
  }

  private async generateReceiptNumber(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const prefix = `SR-${y}${m}${d}-`;
    const count = await this.selfReportRepository.countCases({});
    return `${prefix}${String(count + 1).padStart(4, "0")}`;
  }

  private async resolveReceiptNumberForCreate(input: {
    receiptNumber?: string;
    serialNo?: string;
  }): Promise<string> {
    let receiptNumber: string;
    if (input.receiptNumber?.trim()) {
      receiptNumber = normalizeSelfReportReceiptNumberInput(input.receiptNumber);
    } else if (input.serialNo?.trim()) {
      receiptNumber = normalizeSelfReportSerialNo(input.serialNo);
    } else {
      return this.generateReceiptNumber();
    }

    const existing = await this.selfReportRepository.findCaseByReceiptNumber(receiptNumber);
    if (existing) {
      throw new HttpError(409, `접수번호 ${receiptNumber}는 이미 사용 중입니다.`);
    }
    return receiptNumber;
  }

  private async listCaseAttachmentFileNames(caseId: number): Promise<string[]> {
    const rows = await this.selfReportRepository.listAttachmentFileNamesByCase(caseId);
    return rows.map((row) => row.fileName);
  }

  private async persistCaseAttachment(params: {
    caseId: number;
    receiptNumber: string;
    kind?: SelfReportAttachmentKind;
    fileName: string;
    mimeType: string;
    data: string;
    slotIndex?: number;
    existingFileNames?: string[];
  }) {
    const mimeType = params.mimeType.trim().toLowerCase();
    if (!mimeType || !params.data?.trim()) {
      throw new HttpError(400, "첨부파일 정보가 올바르지 않습니다.");
    }

    const existingFileNames =
      params.existingFileNames ?? (await this.listCaseAttachmentFileNames(params.caseId));
    const displayName = resolveSelfReportAttachmentFileName({
      receiptNumber: params.receiptNumber,
      originalFileName: params.fileName.trim(),
      existingFileNames,
      slotIndex: params.slotIndex,
    });

    const buffer = parseAttachmentDataUrl(params.data, mimeType);
    const saved = await saveSelfReportAttachment({
      caseId: params.caseId,
      fileName: displayName,
      mimeType,
      buffer,
    });

    const attachment = await this.selfReportRepository.createAttachment({
      caseId: params.caseId,
      kind: params.kind ?? "CASE",
      fileName: displayName,
      storedName: saved.storedName,
      mimeType,
      fileSize: saved.fileSize,
      url: saved.url,
    });

    existingFileNames.push(displayName);
    return attachment;
  }

  async listCases(payload: SelfReportActor, query: { status?: string; search?: string; page?: number; pageSize?: number }) {
    const actor = this.actorFromPayload(payload);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 15));
    const status = query.status as SelfReportStatus | undefined;

    const filters: Parameters<SelfReportRepository["listCases"]>[0] = {
      status,
      search: query.search,
      page,
      pageSize,
    };

    if (actor.role === ROLES.SELF_REPORT_TIER1) {
      filters.institutionId = actor.institutionId;
    } else if (actor.role === ROLES.SELF_REPORT_TIER2) {
      filters.institutionId = actor.institutionId;
      filters.assigneeStaffId = actor.staffId;
    }

    const [items, total] = await Promise.all([
      this.selfReportRepository.listCases(filters),
      this.selfReportRepository.countCases(filters),
    ]);

    return {
      items: items.map((item) =>
        this.sanitizeCaseForActor(payload, {
          ...item,
          ...this.resolveCaseAssignees(item),
          statusLabel: STATUS_LABELS[item.status],
        }),
      ),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getCase(payload: SelfReportActor, caseId: number) {
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    this.assertCaseAccess(payload, item.institutionId, item.assigneeStaffId);

    let unprocessableTier1Staff: { id: number; name: string; phone: string | null } | null = null;
    if (item.unprocessableTier1StaffId) {
      const staff = await this.selfReportRepository.findStaffById(item.unprocessableTier1StaffId);
      if (staff) {
        unprocessableTier1Staff = { id: staff.id, name: staff.name, phone: staff.phone };
      }
    }

    return this.sanitizeCaseForActor(payload, {
      ...item,
      unprocessableTier1Staff,
      ...this.resolveCaseAssignees(item),
      statusLabel: STATUS_LABELS[item.status],
      intakeDecisionLabel: item.intakeDecision ? INTAKE_DECISION_LABELS[item.intakeDecision] : null,
      processingPathLabel: item.processingPath ? PROCESSING_PATH_LABELS[item.processingPath] : null,
    });
  }

  private assertTier1InstitutionCase(actor: ActorContext, institutionId: number | null) {
    if (institutionId !== actor.institutionId) {
      throw new HttpError(403, "소속 기관 보고만 처리할 수 있습니다.");
    }
  }

  private assertIntakeNotFinalized(intakeDecision: SelfReportIntakeDecision | null) {
    if (
      intakeDecision === "UNPROCESSABLE" ||
      intakeDecision === "RETURN_TO_ADMIN" ||
      intakeDecision === "ALREADY_COMPLETED"
    ) {
      throw new HttpError(400, "이미 접수 결정이 완료된 보고입니다.");
    }
  }

  private parseDateField(value: string | undefined, fieldLabel: string): Date | null {
    if (!value?.trim()) return null;
    const parsed = new Date(`${value.trim()}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(400, `${fieldLabel} 형식이 올바르지 않습니다.`);
    }
    return parsed;
  }

  async submitIntakeDecision(
    payload: SelfReportActor,
    caseId: number,
    input: { decision: "PROCESS" | "UNPROCESSABLE" | "RETURN_TO_ADMIN" },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER1) {
      throw new HttpError(403, "1차 기관담당만 접수 결정을 할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    this.assertTier1InstitutionCase(actor, item.institutionId);

    if (item.intakeDecision === "PROCESS" && input.decision === "PROCESS") {
      return this.getCase(payload, caseId);
    }
    this.assertIntakeNotFinalized(item.intakeDecision);

    const actorName = this.actorDisplayName(actor);

    if (input.decision === "PROCESS") {
      await this.selfReportRepository.updateCase(caseId, {
        intakeDecision: "PROCESS",
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "접수: 처리 결정",
        note: "처리 방법(2차 담당 배정 또는 직접 입력)을 선택해 주세요.",
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    } else if (input.decision === "UNPROCESSABLE") {
      await this.selfReportRepository.updateCase(caseId, {
        intakeDecision: "UNPROCESSABLE",
        status: "UNPROCESSABLE",
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "접수: 처리불가 결정",
        note: "처리불가로 종결합니다.",
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    } else if (input.decision === "RETURN_TO_ADMIN") {
      await this.selfReportRepository.updateCase(caseId, {
        intakeDecision: "RETURN_TO_ADMIN",
        status: "RETURNED_TO_ADMIN",
        institutionId: null,
        assigneeStaffId: null,
        regionalHq: null,
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "접수: 담당기관 이첩",
        note: "관리자에게 반려되었습니다.",
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    }

    return this.getCase(payload, caseId);
  }

  async submitTier1StatusChange(
    payload: SelfReportActor,
    caseId: number,
    input: { decision: "PROCESS" | "UNPROCESSABLE" | "RETURN_TO_ADMIN" | "REASSIGN_TIER2" },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER1) {
      throw new HttpError(403, "1차 기관담당만 상태를 변경할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    this.assertTier1InstitutionCase(actor, item.institutionId);

    if (item.intakeDecision !== "PROCESS") {
      throw new HttpError(400, "접수에서 '처리 결정'을 선택한 보고만 상태를 변경할 수 있습니다.");
    }

    if (input.decision === "REASSIGN_TIER2" && item.processingPath !== "TIER2_ASSIGN") {
      throw new HttpError(400, "'2차 담당 배정' 처리 중인 보고만 재배정할 수 있습니다.");
    }

    const actorName = this.actorDisplayName(actor);
    const progressReset = {
      assigneeStaffId: null,
      processingPath: null,
      processingPlanDate: null,
      processingPlanContent: null,
      processingResultDate: null,
      processingResultContent: null,
    };

    if (input.decision === "REASSIGN_TIER2") {
      if (!item.assigneeStaffId) {
        throw new HttpError(400, "배정된 2차 담당자가 없습니다.");
      }
      const assignee = await this.selfReportRepository.findStaffById(item.assigneeStaffId);
      if (!assignee || assignee.tier !== 2) {
        throw new HttpError(400, "배정된 2차 담당자가 없습니다.");
      }

      await this.selfReportRepository.updateCase(caseId, {
        assigneeStaffId: null,
        status: "TIER2_ASSIGNMENT",
        processingPlanDate: null,
        processingPlanContent: null,
        processingResultDate: null,
        processingResultContent: null,
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "상태변경: 2차 담당자 재배정",
        note: `${assignee.name} 담당 배정을 해제했습니다. 다른 2차 담당자를 지정해 주세요.`,
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    } else if (input.decision === "PROCESS") {
      await this.selfReportRepository.updateCase(caseId, {
        ...progressReset,
        intakeDecision: null,
        status: "ADMIN_ASSIGNED",
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "상태변경: 처리 결정",
        note: "1차 기관 최초 배정 상태로 되돌렸습니다. 접수부터 다시 진행해 주세요.",
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    } else if (input.decision === "UNPROCESSABLE") {
      await this.selfReportRepository.updateCase(caseId, {
        ...progressReset,
        intakeDecision: "UNPROCESSABLE",
        status: "UNPROCESSABLE",
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "상태변경: 처리불가 결정",
        note: "처리불가로 종결합니다.",
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    } else if (input.decision === "RETURN_TO_ADMIN") {
      await this.selfReportRepository.updateCase(caseId, {
        ...progressReset,
        intakeDecision: "RETURN_TO_ADMIN",
        status: "RETURNED_TO_ADMIN",
        institutionId: null,
        regionalHq: null,
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "상태변경: 이첩 결정",
        note: "관리자에게 반려되었습니다.",
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    }

    return this.getCase(payload, caseId);
  }

  async submitProcessingPath(
    payload: SelfReportActor,
    caseId: number,
    input: { path: "TIER2_ASSIGN" | "DIRECT_INPUT" },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER1) {
      throw new HttpError(403, "1차 기관담당만 처리 방법을 선택할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    this.assertTier1InstitutionCase(actor, item.institutionId);

    if (item.intakeDecision !== "PROCESS") {
      throw new HttpError(400, "접수에서 '처리 결정'을 선택한 후 진행할 수 있습니다.");
    }
    if (item.processingPath === input.path) {
      return this.getCase(payload, caseId);
    }
    if (item.processingPath) {
      throw new HttpError(400, "이미 처리 방법이 선택되었습니다.");
    }

    const actorName = this.actorDisplayName(actor);

    if (input.path === "TIER2_ASSIGN") {
      await this.selfReportRepository.updateCase(caseId, {
        processingPath: "TIER2_ASSIGN",
        status: "TIER2_ASSIGNMENT",
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "처리 방법: 2차 담당 배정",
        note: "2차 담당자를 지정해 주세요.",
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    } else {
      await this.selfReportRepository.updateCase(caseId, {
        processingPath: "DIRECT_INPUT",
        status: "TIER1_PROCESSING",
      });
      await this.selfReportRepository.createHistory({
        caseId,
        action: "처리 방법: 직접 입력",
        note: "조치계획·조치결과를 입력해 주세요.",
        actorName,
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    }

    return this.getCase(payload, caseId);
  }

  async submitProcessingPlan(
    payload: SelfReportActor,
    caseId: number,
    input: { processingPlanDate?: string; processingPlanContent?: string },
  ) {
    const actor = this.actorFromPayload(payload);
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");

    if (payload.role === ROLES.SELF_REPORT_TIER2) {
      if (item.assigneeStaffId !== actor.staffId) {
        throw new HttpError(403, "본인에게 배정된 보고만 처리계획을 등록할 수 있습니다.");
      }
    } else if (payload.role === ROLES.SELF_REPORT_TIER1) {
      this.assertTier1InstitutionCase(actor, item.institutionId);
      if (item.intakeDecision !== "PROCESS" || item.processingPath !== "DIRECT_INPUT") {
        throw new HttpError(400, "'직접 입력'을 선택한 후 조치계획을 등록할 수 있습니다.");
      }
    } else {
      throw new HttpError(403, "조치계획을 등록할 권한이 없습니다.");
    }

    const processingPlanContent = input.processingPlanContent?.trim() || null;
    const processingPlanDate = this.parseDateField(input.processingPlanDate, "조치계획일");

    if (!processingPlanDate && !processingPlanContent) {
      throw new HttpError(400, "조치계획일 또는 조치계획 내용을 입력해 주세요.");
    }

    const isFirstPlan = !this.hadProcessingPlan(item);

    const updateData: {
      processingPlanDate: Date | null;
      processingPlanContent: string | null;
      status?: "TIER2_PROCESSING";
    } = {
      processingPlanDate,
      processingPlanContent,
    };
    if (payload.role === ROLES.SELF_REPORT_TIER2) {
      updateData.status = "TIER2_PROCESSING";
    }

    await this.selfReportRepository.updateCase(caseId, updateData);

    const planLabel = payload.role === ROLES.SELF_REPORT_TIER2 ? "처리계획 등록" : "조치계획 등록";
    await this.selfReportRepository.createHistory({
      caseId,
      action: planLabel,
      note: processingPlanContent ?? undefined,
      actorName: this.actorDisplayName(actor),
      actorRole: payload.role,
    });

    if (isFirstPlan) {
      await this.notifyReporter(caseId, item, SMS_TEMPLATE_TYPES.REPORTER_PLAN_ESTABLISHED, {
        processingPlanDate,
        processingPlanContent,
      });
    }

    return this.getCase(payload, caseId);
  }

  async submitPriorCompletion(
    payload: SelfReportActor,
    caseId: number,
    input: {
      priorCompletionDate?: string;
      priorCompletionContent?: string;
      files?: Array<{ fileName: string; mimeType: string; data: string }>;
    },
  ) {
    if (payload.role === ROLES.SELF_REPORT_TIER2) {
      return this.submitPriorProcessingByTier2(payload, caseId, input);
    }

    if (payload.role !== ROLES.SELF_REPORT_TIER1) {
      throw new HttpError(403, "1차 기관담당만 기완료 처리를 할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    this.assertTier1InstitutionCase(actor, item.institutionId);
    this.assertIntakeNotFinalized(item.intakeDecision);

    const priorCompletionContent = input.priorCompletionContent?.trim() || null;
    const priorCompletionDate = this.parseDateField(input.priorCompletionDate, "기완료 일자");
    const files = input.files ?? [];

    if (!priorCompletionDate && !priorCompletionContent && !files.length) {
      throw new HttpError(400, "기완료 일자, 내용 또는 첨부파일 중 하나 이상을 입력해 주세요.");
    }

    if (files.length) {
      const currentCount = await this.selfReportRepository.countAttachmentsByCase(caseId);
      if (currentCount + files.length > MAX_ATTACHMENTS_PER_CASE) {
        throw new HttpError(400, `첨부파일은 최대 ${MAX_ATTACHMENTS_PER_CASE}개까지 등록할 수 있습니다.`);
      }
    }

    await this.selfReportRepository.updateCase(caseId, {
      intakeDecision: "ALREADY_COMPLETED",
      priorCompletionDate,
      priorCompletionContent,
      status: "COMPLETED",
    });

    const uploaded = [];
    const existingFileNames = await this.listCaseAttachmentFileNames(caseId);
    const slots = allocateAttachmentSlotIndexes(
      existingFileNames,
      item.receiptNumber,
      files.length,
    );
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.fileName?.trim();
      const mimeType = file.mimeType?.trim().toLowerCase();
      if (!fileName || !mimeType || !file.data?.trim()) {
        throw new HttpError(400, "첨부파일 정보가 올바르지 않습니다.");
      }

      const attachment = await this.persistCaseAttachment({
        caseId,
        receiptNumber: item.receiptNumber,
        kind: "PRIOR_COMPLETION",
        fileName,
        mimeType,
        data: file.data,
        slotIndex: slots[i],
        existingFileNames,
      });
      uploaded.push(attachment);
    }

    const note = [
      priorCompletionDate ? priorCompletionDate.toLocaleDateString("ko-KR") : null,
      priorCompletionContent,
      uploaded.length ? `첨부 ${uploaded.length}개` : null,
    ]
      .filter(Boolean)
      .join(" / ");

    await this.selfReportRepository.createHistory({
      caseId,
      action: "접수: 기완료 처리",
      note: note || "기완료 처리되었습니다.",
      actorName: this.actorDisplayName(actor),
      actorRole: ROLES.SELF_REPORT_TIER1,
    });

    return this.getCase(payload, caseId);
  }

  private async submitPriorProcessingByTier2(
    payload: SelfReportActor,
    caseId: number,
    input: {
      priorCompletionDate?: string;
      priorCompletionContent?: string;
    },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER2) {
      throw new HttpError(403, "2차 실무담당만 기처리를 등록할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    if (item.assigneeStaffId !== actor.staffId) {
      throw new HttpError(403, "본인에게 배정된 보고만 기처리할 수 있습니다.");
    }

    const priorCompletionContent = input.priorCompletionContent?.trim() || null;
    const priorCompletionDate = this.parseDateField(input.priorCompletionDate, "기처리 일자");

    if (!priorCompletionDate && !priorCompletionContent) {
      throw new HttpError(400, "기처리 일자 또는 내용을 입력해 주세요.");
    }

    await this.selfReportRepository.updateCase(caseId, {
      priorCompletionDate,
      priorCompletionContent,
      status: "COMPLETED",
    });

    const note = [
      priorCompletionDate ? priorCompletionDate.toLocaleDateString("ko-KR") : null,
      priorCompletionContent,
    ]
      .filter(Boolean)
      .join(" / ");

    await this.selfReportRepository.createHistory({
      caseId,
      action: "2차: 기처리",
      note: note || "기처리 처리되었습니다.",
      actorName: actor.staffName ?? "2차 담당",
      actorRole: ROLES.SELF_REPORT_TIER2,
    });

    return this.getCase(payload, caseId);
  }

  private assertCaseAccess(payload: SelfReportActor, institutionId: number | null, assigneeStaffId: number | null) {
    const actor = this.actorFromPayload(payload);
    if (actor.role === ROLES.ADMIN) return;
    if (actor.role === ROLES.SELF_REPORT_TIER1) {
      if (institutionId !== actor.institutionId) throw new HttpError(403, "접근 권한이 없습니다.");
      return;
    }
    if (actor.role === ROLES.SELF_REPORT_TIER2) {
      if (institutionId !== actor.institutionId) throw new HttpError(403, "접근 권한이 없습니다.");
      if (assigneeStaffId !== actor.staffId) throw new HttpError(403, "배정된 보고만 조회할 수 있습니다.");
      return;
    }
    throw new HttpError(403, "접근 권한이 없습니다.");
  }

  async createCase(
    payload: SelfReportActor,
    input: {
      title: string;
      content: string;
      reporterName?: string;
      reporterPhone?: string;
      location?: string;
    },
  ) {
    if (payload.role !== ROLES.ADMIN) {
      throw new HttpError(403, "관리자만 보고를 등록할 수 있습니다.");
    }

    return this.createCaseRecord(payload, input);
  }

  getCasesSampleCsv() {
    return SELF_REPORT_CASE_SAMPLE_CSV;
  }

  async bulkCreateCasesFromCsv(payload: SelfReportActor, csv: string) {
    if (payload.role !== ROLES.ADMIN) {
      throw new HttpError(403, "관리자만 보고를 일괄 등록할 수 있습니다.");
    }

    const rows = parseSelfReportCaseCsv(csv);
    const actor = this.actorFromPayload(payload);
    const created: Array<{ row: number; receiptNumber: string; title: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const item = await this.createCaseRecord(payload, row, {
        historyNote: `CSV 일괄등록 (${i + 1}/${rows.length})`,
      });
      created.push({ row: i + 2, receiptNumber: item.receiptNumber, title: item.title });
    }

    return {
      created: created.length,
      items: created,
      actorName: actor.userName ?? "관리자",
    };
  }

  async bulkUploadAttachments(
    payload: SelfReportActor,
    files: Array<{ fileName: string; mimeType: string; data: string }>,
  ) {
    if (payload.role !== ROLES.ADMIN) {
      throw new HttpError(403, "관리자만 첨부파일을 일괄 등록할 수 있습니다.");
    }
    if (!files.length) {
      throw new HttpError(400, "업로드할 파일을 선택해 주세요.");
    }
    if (files.length > 200) {
      throw new HttpError(400, "한 번에 최대 200개까지 업로드할 수 있습니다.");
    }

    const actor = this.actorFromPayload(payload);
    const uploaded: Array<{ fileName: string; receiptNumber: string; savedAs: string }> = [];
    const errors: Array<{ fileName: string; reason: string }> = [];
    const caseFileNames = new Map<number, string[]>();

    for (const file of files) {
      const originalName = file.fileName?.trim();
      if (!originalName || !file.mimeType?.trim() || !file.data?.trim()) {
        errors.push({ fileName: originalName ?? "(이름 없음)", reason: "파일 정보가 올바르지 않습니다." });
        continue;
      }

      const parsed = parseBulkAttachmentFileName(originalName);
      if (!parsed) {
        errors.push({
          fileName: originalName,
          reason: "파일명은 일련번호_01 형식이어야 합니다. (예: 20260528A106_01.jpg)",
        });
        continue;
      }

      let targetCase: { id: number; receiptNumber: string } | null = null;
      if (parsed.receiptNumber) {
        targetCase = await this.selfReportRepository.findCaseByReceiptNumber(parsed.receiptNumber);
        if (!targetCase) {
          errors.push({
            fileName: originalName,
            reason: `접수번호 ${parsed.receiptNumber} 보고를 찾을 수 없습니다.`,
          });
          continue;
        }
      } else if (parsed.serialKey) {
        const matches = await this.selfReportRepository.findCasesByReceiptSerialKey(parsed.serialKey);
        if (!matches.length) {
          errors.push({
            fileName: originalName,
            reason: `일련번호 ${parsed.serialKey}에 해당하는 보고를 찾을 수 없습니다.`,
          });
          continue;
        }
        if (matches.length > 1) {
          errors.push({
            fileName: originalName,
            reason: `일련번호 ${parsed.serialKey}에 해당하는 보고가 ${matches.length}건입니다. 접수번호를 포함한 파일명을 사용해 주세요.`,
          });
          continue;
        }
        targetCase = matches[0];
      }

      if (!targetCase) continue;

      const existingNames =
        caseFileNames.get(targetCase.id) ??
        (await this.listCaseAttachmentFileNames(targetCase.id));
      const currentCount = existingNames.length;
      if (currentCount >= MAX_ATTACHMENTS_PER_CASE) {
        errors.push({
          fileName: originalName,
          reason: `첨부파일은 보고당 최대 ${MAX_ATTACHMENTS_PER_CASE}개까지 등록할 수 있습니다.`,
        });
        continue;
      }

      try {
        const savedAs = buildSelfReportAttachmentFileName(
          targetCase.receiptNumber,
          parsed.index,
          parsed.extension,
        );
        const attachment = await this.persistCaseAttachment({
          caseId: targetCase.id,
          receiptNumber: targetCase.receiptNumber,
          fileName: savedAs,
          mimeType: file.mimeType,
          data: file.data,
          slotIndex: parsed.index,
          existingFileNames: existingNames,
        });
        caseFileNames.set(targetCase.id, existingNames);
        uploaded.push({
          fileName: originalName,
          receiptNumber: targetCase.receiptNumber,
          savedAs: attachment.fileName,
        });
      } catch (error) {
        errors.push({
          fileName: originalName,
          reason: error instanceof HttpError ? error.message : "업로드에 실패했습니다.",
        });
      }
    }

    if (uploaded.length) {
      const grouped = new Map<number, number>();
      for (const item of uploaded) {
        const match = await this.selfReportRepository.findCaseByReceiptNumber(item.receiptNumber);
        if (!match) continue;
        grouped.set(match.id, (grouped.get(match.id) ?? 0) + 1);
      }
      for (const [caseId, count] of grouped) {
        await this.selfReportRepository.createHistory({
          caseId,
          action: "첨부파일 일괄등록",
          note: `${count}개 파일 추가`,
          actorName: actor.userName ?? "관리자",
          actorRole: ROLES.ADMIN,
        });
      }
    }

    return { uploaded: uploaded.length, errors, items: uploaded };
  }

  private async createCaseRecord(
    payload: SelfReportActor,
    input: {
      title: string;
      content: string;
      reporterName?: string;
      reporterPhone?: string;
      location?: string;
      receiptNumber?: string;
      serialNo?: string;
    },
    options?: { historyNote?: string },
  ) {
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title || !content) {
      throw new HttpError(400, "제목과 내용은 필수입니다.");
    }

    const receiptNumber = await this.resolveReceiptNumberForCreate({
      receiptNumber: input.receiptNumber,
      serialNo: input.serialNo,
    });
    const created = await this.selfReportRepository.createCase({
      receiptNumber,
      title,
      content,
      reporterName: input.reporterName?.trim() || null,
      reporterPhone: input.reporterPhone?.trim() || null,
      location: input.location?.trim() || null,
    });

    const actor = this.actorFromPayload(payload);

    await this.selfReportRepository.createHistory({
      caseId: created.id,
      action: "보고 접수",
      note: options?.historyNote ?? "관리자가 보고를 등록했습니다.",
      actorName: actor.userName ?? "관리자",
      actorRole: ROLES.ADMIN,
    });

    return created;
  }

  async bulkDeleteCases(payload: SelfReportActor, ids: number[]) {
    if (payload.role !== ROLES.ADMIN) {
      throw new HttpError(403, "관리자만 보고를 삭제할 수 있습니다.");
    }

    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    if (!uniqueIds.length) {
      throw new HttpError(400, "삭제할 보고를 선택해 주세요.");
    }
    if (uniqueIds.length > 200) {
      throw new HttpError(400, "한 번에 최대 200건까지 삭제할 수 있습니다.");
    }

    const attachments = await this.selfReportRepository.listAttachmentsByCaseIds(uniqueIds);
    for (const attachment of attachments) {
      await deleteSelfReportAttachmentFile(attachment.url);
    }
    for (const caseId of uniqueIds) {
      await deleteSelfReportCaseAttachmentDir(caseId);
    }

    const result = await this.selfReportRepository.deleteCasesByIds(uniqueIds);
    return { deleted: result.count, ids: uniqueIds };
  }

  async assignByAdmin(
    payload: SelfReportActor,
    caseId: number,
    input: {
      institutionId: number;
      note?: string;
      toStaffId?: number;
      staffName?: string;
      staffEmail?: string;
      staffAuthKey?: string;
      staffPhone?: string;
    },
  ) {
    if (payload.role !== ROLES.ADMIN) throw new HttpError(403, "관리자만 1차 담당 배정이 가능합니다.");
    const actor = this.actorFromPayload(payload);

    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");

    const institution = await this.selfReportRepository.findInstitutionById(input.institutionId);
    if (!institution || !institution.enabled) throw new HttpError(400, "배정할 기관을 찾을 수 없습니다.");

    let tier1Staff: { id: number; name: string; email?: string | null; phone?: string | null };
    let isExistingStaff = false;

    if (input.toStaffId) {
      const staff = await this.selfReportRepository.findStaffById(input.toStaffId);
      if (!staff || staff.institutionId !== institution.id || staff.tier !== 1) {
        throw new HttpError(400, "배정할 1차 담당자를 찾을 수 없습니다.");
      }
      tier1Staff = staff;
      isExistingStaff = true;
    } else {
      const created = await this.createSelfReportStaffAccount(institution.id, {
        name: input.staffName ?? "",
        email: input.staffEmail ?? "",
        authKey: input.staffAuthKey,
        tier: 1,
        phone: input.staffPhone,
      });
      isExistingStaff = created.isExisting;
      const staff = await this.selfReportRepository.findStaffById(created.staffId);
      if (!staff) throw new HttpError(500, "1차 담당자 정보를 확인할 수 없습니다.");
      tier1Staff = staff;
    }

    await this.selfReportRepository.updateCase(caseId, {
      institutionId: institution.id,
      assigneeStaffId: tier1Staff.id,
      regionalHq: institution.regionalHq,
      status: "TIER1_PROCESSING",
      intakeDecision: null,
    });

    await this.selfReportRepository.createAssignment({
      caseId,
      assignmentType: "ADMIN_TO_INSTITUTION",
      toInstitutionId: institution.id,
      toStaffId: tier1Staff.id,
      note: input.note?.trim() || null,
      adminUserId: actor.userId ?? null,
    });

    await this.selfReportRepository.createHistory({
      caseId,
      action: "관리자 → 1차 담당 배정",
      note: `${institution.name} / ${tier1Staff.name} 담당${input.note ? `: ${input.note}` : ""}`,
      actorName: actor.userName ?? "관리자",
      actorRole: ROLES.ADMIN,
    });

    await this.notifyReporter(caseId, item, SMS_TEMPLATE_TYPES.REPORTER_TIER1_ASSIGNED, {
      institutionName: institution.name,
    });

    const caseData = await this.getCase(payload, caseId);
    const authKey = await this.resolveAuthKeyForStaffEmail(tier1Staff.email);
    return {
      ...caseData,
      assignedStaff: {
        staffId: tier1Staff.id,
        name: tier1Staff.name,
        email: tier1Staff.email,
        phone: tier1Staff.phone,
        isExisting: isExistingStaff,
        authKey,
      },
    };
  }

  async checkTier1StaffEmailForAdmin(institutionId: number, emailInput: string) {
    if (!institutionId) throw new HttpError(400, "기관을 선택해 주세요.");
    return this.checkStaffEmail(institutionId, 1, emailInput);
  }

  private selfReportRoleForTier(tier: 1 | 2): string {
    return tier === 1 ? ROLES.SELF_REPORT_TIER1 : ROLES.SELF_REPORT_TIER2;
  }

  private async resolveAuthKeyForStaffEmail(email: string | null | undefined): Promise<string | null> {
    if (!email?.trim()) return null;
    const user = await this.userRepository.findByEmail(email.trim());
    if (!user) return null;
    return decryptSelfReportAuthKey(user.selfReportAuthKeyEnc);
  }

  async checkStaffEmail(
    institutionId: number,
    tier: 1 | 2,
    emailInput: string,
    options?: { forbidSelfEmail?: string },
  ) {
    const email = emailInput.trim();
    if (!email) {
      throw new HttpError(400, "이메일을 입력해 주세요.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "이메일 형식이 올바르지 않습니다.");
    }

    if (options?.forbidSelfEmail && options.forbidSelfEmail.trim().toLowerCase() === email.toLowerCase()) {
      throw new HttpError(400, "본인에게는 이첩할 수 없습니다.");
    }

    const roleName = this.selfReportRoleForTier(tier);
    const existingUser = await this.userRepository.findByEmail(email);
    if (!existingUser) {
      return {
        status: "available" as const,
        message: "사용 가능한 이메일입니다.",
      };
    }

    if (existingUser.role.name === roleName && existingUser.selfReportInstitutionId === institutionId) {
      const authKey = await this.resolveAuthKeyForStaffEmail(email);
      return {
        status: "existing" as const,
        message: authKey
          ? "기존에 송부한 이력이 있는 이메일입니다. 저장된 패스키로 진행됩니다."
          : "기존에 송부한 이력이 있는 이메일입니다. 당시 설정된 패스키로 진행됩니다",
        name: existingUser.name,
        authKey,
      };
    }

    throw new HttpError(409, "다른 용도로 사용 중인 이메일입니다.");
  }

  async checkTier2Email(payload: SelfReportActor, emailInput: string) {
    if (payload.role !== ROLES.SELF_REPORT_TIER1 && payload.role !== ROLES.SELF_REPORT_TIER2) {
      throw new HttpError(403, "기관 담당자만 이메일 중복확인을 할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);
    if (!actor.institutionId) {
      throw new HttpError(400, "기관 정보가 없습니다.");
    }

    let forbidSelfEmail: string | undefined;
    if (payload.role === ROLES.SELF_REPORT_TIER2 && actor.staffId) {
      const selfStaff = await this.selfReportRepository.findStaffById(actor.staffId);
      forbidSelfEmail = selfStaff?.email ?? undefined;
    }

    return this.checkStaffEmail(actor.institutionId, 2, emailInput, { forbidSelfEmail });
  }

  async checkStaffEmailForAdmin(institutionId: number, tier: number, emailInput: string) {
    if (![1, 2].includes(tier)) throw new HttpError(400, "담당 구분(tier)은 1 또는 2입니다.");
    return this.checkStaffEmail(institutionId, tier as 1 | 2, emailInput);
  }

  private async createSelfReportStaffAccount(
    institutionId: number,
    input: { name: string; email: string; authKey?: string; tier: 1 | 2; phone?: string | null },
  ) {
    const name = input.name.trim();
    const email = input.email.trim();
    const authKey = input.authKey?.trim() ?? "";
    if (!name || !email) {
      throw new HttpError(400, "이름과 이메일을 입력해 주세요.");
    }

    const institution = await this.selfReportRepository.findInstitutionById(institutionId);
    if (!institution) throw new HttpError(400, "기관을 찾을 수 없습니다.");

    const roleName = this.selfReportRoleForTier(input.tier);
    const role = await this.roleRepository.findByName(roleName);
    if (!role) throw new HttpError(500, `${input.tier === 1 ? "1차" : "2차"} 담당자 역할을 찾을 수 없습니다.`);

    const existingUser = await this.userRepository.findByEmail(email);
    let isExisting = false;

    if (existingUser) {
      if (
        existingUser.role.name !== roleName ||
        existingUser.selfReportInstitutionId !== institutionId
      ) {
        throw new HttpError(409, "이미 사용 중인 이메일입니다.");
      }
      isExisting = true;
      await this.userRepository.update(existingUser.id, { name });
    } else {
      if (!authKey) {
        throw new HttpError(400, "신규 이메일은 인증키를 입력해 주세요.");
      }
      if (authKey.length < 4) {
        throw new HttpError(400, "인증키는 4자 이상이어야 합니다.");
      }
      const hashed = await hashPassword(authKey);
      await this.userRepository.create({
        email,
        password: hashed,
        name,
        roleId: role.id,
        selfReportInstitutionId: institutionId,
        selfReportAuthKeyHash: hashed,
        selfReportAuthKeyEnc: encryptSelfReportAuthKey(authKey),
      });
    }

    const userWithRole = await this.userRepository.findByEmailForSelfReport(email);
    if (!userWithRole) throw new HttpError(500, "사용자 정보를 확인할 수 없습니다.");
    const staff = await this.selfReportUserSyncService.syncStaffFromUser(userWithRole);
    if (!staff) throw new HttpError(500, "담당자 생성에 실패했습니다.");

    if (input.phone?.trim()) {
      await this.selfReportRepository.updateStaff(staff.id, { phone: input.phone.trim() });
    }

    const resolvedAuthKey = isExisting
      ? await this.resolveAuthKeyForStaffEmail(email)
      : input.authKey?.trim() || null;

    return {
      staffId: staff.id,
      name: staff.name,
      email: staff.email ?? email,
      phone: input.phone?.trim() || staff.phone,
      institutionCode: institution.code,
      institutionName: institution.name,
      isExisting,
      tier: input.tier,
      authKey: resolvedAuthKey,
    };
  }

  async createTier2Staff(
    payload: SelfReportActor,
    input: { name: string; email: string; authKey?: string; phone?: string },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER1 && payload.role !== ROLES.SELF_REPORT_TIER2) {
      throw new HttpError(403, "기관 담당자만 2차 담당자를 등록할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);
    if (!actor.institutionId) {
      throw new HttpError(400, "기관 정보가 없습니다.");
    }

    if (payload.role === ROLES.SELF_REPORT_TIER2 && actor.staffId) {
      const selfStaff = await this.selfReportRepository.findStaffById(actor.staffId);
      if (selfStaff?.email?.trim().toLowerCase() === input.email.trim().toLowerCase()) {
        throw new HttpError(400, "본인에게는 이첩할 수 없습니다.");
      }
    }

    return this.createSelfReportStaffAccount(actor.institutionId, {
      ...input,
      tier: 2,
    });
  }

  async createStaffWithAccount(
    institutionId: number,
    input: { name: string; email: string; authKey?: string; tier: number; phone?: string },
  ) {
    if (![1, 2].includes(input.tier)) throw new HttpError(400, "담당 구분(tier)은 1 또는 2입니다.");
    return this.createSelfReportStaffAccount(institutionId, {
      name: input.name,
      email: input.email,
      authKey: input.authKey,
      tier: input.tier as 1 | 2,
      phone: input.phone,
    });
  }

  async sendStaffAccountSms(
    assigner: { assignerName: string; assignerEmail: string },
    input: {
      phone: string;
      email: string;
      authKey: string;
      tier: 1 | 2;
      dashboardUrl?: string;
      message?: string;
    },
  ) {
    const normalizedPhone = input.phone.replace(/\D/g, "");
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      throw new HttpError(400, "휴대폰 번호를 올바르게 입력해 주세요.");
    }

    const dashboardUrl = await this.smsTemplateService.getSelfReportDashboardUrl(input.dashboardUrl);
    const message =
      input.message?.trim() ||
      buildStaffAccountSmsMessage(input.tier, {
        email: input.email.trim(),
        authKey: input.authKey.trim(),
        dashboardUrl,
        assignerName: assigner.assignerName,
        assignerEmail: assigner.assignerEmail,
      });

    const sent = await this.smsNotificationService.sendSms(normalizedPhone, message);
    if (!sent) {
      throw new HttpError(502, "문자 발송에 실패했습니다. API 설정을 확인해 주세요.");
    }

    return { sent: true, message: "접속안내 문자를 발송했습니다." };
  }

  async sendTier2AccountSms(
    payload: SelfReportActor,
    input: {
      phone: string;
      name: string;
      email: string;
      authKey: string;
      institutionCode?: string;
      dashboardUrl?: string;
      message?: string;
    },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER1 && payload.role !== ROLES.SELF_REPORT_TIER2) {
      throw new HttpError(403, "기관 담당자만 계정 안내 문자를 발송할 수 있습니다.");
    }

    const assigner = await this.resolveAssignerContact(payload);
    return this.sendStaffAccountSms(assigner, {
      phone: input.phone,
      email: input.email,
      authKey: input.authKey,
      tier: 2,
      dashboardUrl: input.dashboardUrl,
      message: input.message,
    });
  }

  async sendStaffAccountSmsByAdmin(
    adminEmail: string,
    input: {
      phone: string;
      email: string;
      authKey: string;
      tier: number;
      dashboardUrl?: string;
      message?: string;
    },
  ) {
    if (![1, 2].includes(input.tier)) throw new HttpError(400, "담당 구분(tier)은 1 또는 2입니다.");
    return this.sendStaffAccountSms(
      { assignerName: "관리자", assignerEmail: adminEmail },
      {
        phone: input.phone,
        email: input.email,
        authKey: input.authKey,
        tier: input.tier as 1 | 2,
        dashboardUrl: input.dashboardUrl,
        message: input.message,
      },
    );
  }

  async assignByTier1(
    payload: SelfReportActor,
    caseId: number,
    input: {
      toStaffId?: number;
      toRegionalHq?: string;
      note?: string;
      processingPlanDate?: string;
      processingPlanContent?: string;
    },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER1) {
      throw new HttpError(403, "1차 기관담당만 배정할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);

    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    if (item.institutionId !== actor.institutionId) {
      throw new HttpError(403, "소속 기관 보고만 처리할 수 있습니다.");
    }
    if (item.intakeDecision !== "PROCESS") {
      throw new HttpError(400, "접수에서 '처리 결정'을 선택한 후 진행할 수 있습니다.");
    }
    if (item.processingPath !== "TIER2_ASSIGN") {
      throw new HttpError(400, "'2차 담당 배정'을 선택한 후 진행할 수 있습니다.");
    }

    const processingPlanContent = input.processingPlanContent?.trim() || null;
    let processingPlanDate: Date | null = null;
    if (input.processingPlanDate?.trim()) {
      const parsed = new Date(`${input.processingPlanDate.trim()}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        throw new HttpError(400, "처리계획일 형식이 올바르지 않습니다.");
      }
      processingPlanDate = parsed;
    }
    const planFields = { processingPlanDate, processingPlanContent };
    const planNote =
      processingPlanDate || processingPlanContent
        ? ` / 처리계획: ${processingPlanDate ? processingPlanDate.toLocaleDateString("ko-KR") : "일정 미정"}${processingPlanContent ? ` — ${processingPlanContent}` : ""}`
        : "";
    const isFirstPlan =
      !this.hadProcessingPlan(item) && Boolean(processingPlanDate || processingPlanContent);

    if (input.toStaffId) {
      const staff = await this.selfReportRepository.findStaffById(input.toStaffId);
      if (!staff || staff.institutionId !== actor.institutionId || staff.tier !== 2) {
        throw new HttpError(400, "배정할 2차 실무담당을 찾을 수 없습니다.");
      }

      await this.selfReportRepository.updateCase(caseId, {
        assigneeStaffId: staff.id,
        status: "TIER2_PROCESSING",
        ...planFields,
      });

      await this.selfReportRepository.createAssignment({
        caseId,
        assignmentType: "TIER1_TO_TIER2",
        fromStaffId: actor.staffId ?? null,
        toStaffId: staff.id,
        note: input.note?.trim() || null,
      });

      await this.selfReportRepository.createHistory({
        caseId,
        action: "1차 → 2차 실무담당 배정",
        note: `${staff.name}에게 배정${input.note ? `: ${input.note}` : ""}${planNote}`,
        actorName: this.actorDisplayName(this.actorFromPayload(payload)),
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    } else if (input.toRegionalHq?.trim()) {
      await this.selfReportRepository.updateCase(caseId, {
        assigneeStaffId: null,
        regionalHq: input.toRegionalHq.trim(),
        status: "TIER1_PROCESSING",
        ...planFields,
      });

      await this.selfReportRepository.createAssignment({
        caseId,
        assignmentType: "TIER1_TO_REGIONAL",
        toRegionalHq: input.toRegionalHq.trim(),
        note: input.note?.trim() || null,
      });

      await this.selfReportRepository.createHistory({
        caseId,
        action: "1차 → 지역본부 배정",
        note: `${input.toRegionalHq.trim()}으로 배정${input.note ? `: ${input.note}` : ""}${planNote}`,
        actorName: this.actorDisplayName(this.actorFromPayload(payload)),
        actorRole: ROLES.SELF_REPORT_TIER1,
      });
    } else {
      throw new HttpError(400, "2차 담당자를 확인(생성)한 후 배정해 주세요.");
    }

    if (isFirstPlan) {
      await this.notifyReporter(caseId, item, SMS_TEMPLATE_TYPES.REPORTER_PLAN_ESTABLISHED, {
        processingPlanDate,
        processingPlanContent,
      });
    }

    return this.getCase(payload, caseId);
  }

  async transferByTier2(
    payload: SelfReportActor,
    caseId: number,
    input: { toStaffId: number; note?: string },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER2) {
      throw new HttpError(403, "2차 실무담당만 이첩할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);

    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    if (item.assigneeStaffId !== actor.staffId) {
      throw new HttpError(403, "본인에게 배정된 보고만 이첩할 수 있습니다.");
    }

    const staff = await this.selfReportRepository.findStaffById(input.toStaffId);
    if (!staff || staff.institutionId !== actor.institutionId || staff.tier !== 2) {
      throw new HttpError(400, "이첩할 2차 실무담당을 찾을 수 없습니다.");
    }
    if (staff.id === actor.staffId) {
      throw new HttpError(400, "동일 담당자에게는 이첩할 수 없습니다.");
    }

    await this.selfReportRepository.updateCase(caseId, {
      assigneeStaffId: staff.id,
      status: "TRANSFERRED",
    });

    await this.selfReportRepository.createAssignment({
      caseId,
      assignmentType: "TIER2_TRANSFER",
      fromStaffId: actor.staffId ?? null,
      toStaffId: staff.id,
      note: input.note?.trim() || null,
    });

    await this.selfReportRepository.createHistory({
      caseId,
      action: "2차 → 2차 이첩",
      note: `${staff.name}에게 이첩${input.note ? `: ${input.note}` : ""}`,
      actorName: actor.staffName ?? "2차 담당",
      actorRole: ROLES.SELF_REPORT_TIER2,
    });

    return this.getCase(payload, caseId);
  }

  async requestUnprocessableByTier2(
    payload: SelfReportActor,
    caseId: number,
    input: { reason: string },
  ) {
    if (payload.role !== ROLES.SELF_REPORT_TIER2) {
      throw new HttpError(403, "2차 실무담당만 처리불가를 요청할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);
    const reason = input.reason?.trim();
    if (!reason) {
      throw new HttpError(400, "처리불가 사유를 입력해 주세요.");
    }

    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    if (item.assigneeStaffId !== actor.staffId) {
      throw new HttpError(403, "본인에게 배정된 보고만 처리불가를 요청할 수 있습니다.");
    }
    if (item.status === "UNPROCESSABLE_PENDING") {
      throw new HttpError(400, "이미 처리불가 확인을 요청한 보고입니다.");
    }
    if (["COMPLETED", "CLOSED", "UNPROCESSABLE"].includes(item.status)) {
      throw new HttpError(400, "종결된 보고입니다.");
    }
    if (!item.institutionId) {
      throw new HttpError(400, "기관이 배정되지 않은 보고입니다.");
    }

    const tier1Staff = await this.resolveTier1AssignerStaff(
      caseId,
      item.institutionId,
      item.assignments ?? [],
    );
    if (!tier1Staff) {
      throw new HttpError(400, "1차 배정 담당자를 찾을 수 없습니다. 1차 담당자 연락처를 등록해 주세요.");
    }
    if (!tier1Staff.phone?.trim()) {
      throw new HttpError(400, "1차 배정 담당자 연락처가 없어 문자를 보낼 수 없습니다.");
    }

    await this.selfReportRepository.updateCase(caseId, {
      status: "UNPROCESSABLE_PENDING",
      unprocessableReason: reason,
      unprocessableTier1StaffId: tier1Staff.id,
    });

    await this.selfReportRepository.createHistory({
      caseId,
      action: "처리불가 요청",
      note: reason,
      actorName: actor.staffName ?? "2차 담당",
      actorRole: ROLES.SELF_REPORT_TIER2,
    });

    const dashboardUrl = await this.smsTemplateService.getSelfReportDashboardUrl();
    await this.notifyStaffByPhone(
      caseId,
      tier1Staff.phone,
      tier1Staff.name,
      SMS_TEMPLATE_TYPES.TIER1_UNPROCESSABLE_REQUEST,
      { ...item, unprocessableReason: reason },
      { unprocessableReason: reason, dashboardUrl },
    );

    return this.getCase(payload, caseId);
  }

  async confirmUnprocessableByTier1(payload: SelfReportActor, caseId: number) {
    if (payload.role !== ROLES.SELF_REPORT_TIER1) {
      throw new HttpError(403, "1차 기관담당만 처리불가를 확정할 수 있습니다.");
    }
    const actor = this.actorFromPayload(payload);

    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    if (item.institutionId !== actor.institutionId) {
      throw new HttpError(403, "소속 기관 보고만 처리할 수 있습니다.");
    }
    if (item.status !== "UNPROCESSABLE_PENDING") {
      throw new HttpError(400, "처리불가 확인 대기 중인 보고가 아닙니다.");
    }
    const reason = item.unprocessableReason?.trim();
    if (!reason) {
      throw new HttpError(400, "처리불가 사유가 없습니다.");
    }

    await this.selfReportRepository.updateCase(caseId, {
      status: "UNPROCESSABLE",
      intakeDecision: "UNPROCESSABLE",
      unprocessableTier1StaffId: null,
    });

    await this.selfReportRepository.createHistory({
      caseId,
      action: "처리불가 확정",
      note: reason,
      actorName: this.actorDisplayName(actor),
      actorRole: ROLES.SELF_REPORT_TIER1,
    });

    await this.notifyReporter(caseId, item, SMS_TEMPLATE_TYPES.REPORTER_UNPROCESSABLE, {
      unprocessableReason: reason,
    });

    return this.getCase(payload, caseId);
  }

  async listSmsTemplates(fallbackDashboardUrl?: string) {
    return this.smsTemplateService.getSmsSettings(fallbackDashboardUrl);
  }

  async sendCaseSms(
    payload: SelfReportActor,
    caseId: number,
    input: {
      phone: string;
      recipientName?: string;
      templateType?: SmsTemplateType;
      message?: string;
      dashboardUrl?: string;
      email?: string;
      authKey?: string;
      transferReason?: string;
    },
  ) {
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");

    const actor = this.actorFromPayload(payload);
    const normalizedPhone = input.phone?.replace(/\D/g, "") ?? "";
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      throw new HttpError(400, "휴대폰 번호를 올바르게 입력해 주세요.");
    }

    if (payload.role === ROLES.ADMIN) {
      if (!item.institutionId) {
        throw new HttpError(400, "기관 배정 후 문자를 발송할 수 있습니다.");
      }
    } else if (payload.role === ROLES.SELF_REPORT_TIER1) {
      if (item.institutionId !== actor.institutionId) {
        throw new HttpError(403, "소속 기관 보고에만 문자를 발송할 수 있습니다.");
      }
    } else if (payload.role === ROLES.SELF_REPORT_TIER2) {
      if (item.assigneeStaffId !== actor.staffId || item.institutionId !== actor.institutionId) {
        throw new HttpError(403, "본인에게 배정된 보고에만 문자를 발송할 수 있습니다.");
      }
    } else {
      throw new HttpError(403, "문자 발송 권한이 없습니다.");
    }

    const institution = item.institutionId
      ? await this.selfReportRepository.findInstitutionById(item.institutionId)
      : null;
    const templateType = input.templateType ?? this.smsTemplateService.templateTypeForRole(payload.role);
    const assigner = await this.resolveAssignerContact(payload);
    const assigneeStaff =
      item.assigneeStaffId != null ? await this.selfReportRepository.findStaffById(item.assigneeStaffId) : null;
    const dashboardUrl = await this.smsTemplateService.getSelfReportDashboardUrl(input.dashboardUrl);
    const customMessage = input.message?.trim();
    const message =
      customMessage ||
      (await this.smsTemplateService.render(templateType, {
        receiptNumber: item.receiptNumber,
        title: item.title,
        institutionName: institution?.name ?? "",
        staffName: input.recipientName?.trim() ?? "",
        regionalHq: item.regionalHq ?? "",
        reporterName: item.reporterName ?? "",
        email: input.email?.trim() || assigneeStaff?.email || "",
        authKey: input.authKey?.trim() || "",
        dashboardUrl,
        assignerName: assigner.assignerName,
        assignerEmail: assigner.assignerEmail,
        transferReason: input.transferReason?.trim() || "",
      }));

    if (!message) {
      throw new HttpError(400, "문자 내용을 입력해 주세요.");
    }

    const sent = await this.smsNotificationService.sendSms(normalizedPhone, message);
    if (!sent) {
      throw new HttpError(
        502,
        "문자 발송에 실패했습니다. 관리자 메뉴(외부 API · 문자)에서 API 설정을 확인해 주세요.",
      );
    }

    await this.selfReportRepository.createHistory({
      caseId,
      action: "문자 발송",
      note: message,
      actorName: this.actorDisplayName(actor),
      actorRole: payload.role,
    });

    return {
      sent: true,
      message,
      templateType,
    };
  }

  async submitProcessingResult(
    payload: SelfReportActor,
    caseId: number,
    input: {
      processingResultDate?: string;
      processingResultContent?: string;
      files?: Array<{ fileName: string; mimeType: string; data: string }>;
    },
  ) {
    const actor = this.actorFromPayload(payload);
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");

    if (payload.role === ROLES.SELF_REPORT_TIER2) {
      if (item.assigneeStaffId !== actor.staffId) {
        throw new HttpError(403, "본인에게 배정된 보고만 처리결과를 등록할 수 있습니다.");
      }
    } else if (payload.role === ROLES.SELF_REPORT_TIER1) {
      if (item.institutionId !== actor.institutionId) {
        throw new HttpError(403, "소속 기관 보고만 처리결과를 등록할 수 있습니다.");
      }
      if (item.intakeDecision !== "PROCESS") {
        throw new HttpError(400, "접수에서 '처리 결정'을 선택한 후 진행할 수 있습니다.");
      }
      if (item.processingPath !== "DIRECT_INPUT") {
        throw new HttpError(400, "'직접 입력'을 선택한 후 처리결과를 등록할 수 있습니다.");
      }
    } else {
      throw new HttpError(403, "처리결과를 등록할 권한이 없습니다.");
    }

    const processingResultContent = input.processingResultContent?.trim() || null;
    let processingResultDate: Date | null = null;
    if (input.processingResultDate?.trim()) {
      const parsed = new Date(`${input.processingResultDate.trim()}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        throw new HttpError(400, "처리완료일 형식이 올바르지 않습니다.");
      }
      processingResultDate = parsed;
    }

    const files = input.files ?? [];
    if (!processingResultDate && !processingResultContent && !files.length) {
      throw new HttpError(400, "처리완료일, 처리 내용 또는 첨부파일 중 하나 이상을 입력해 주세요.");
    }

    if (files.length) {
      const currentCount = await this.selfReportRepository.countAttachmentsByCase(caseId);
      if (currentCount + files.length > MAX_ATTACHMENTS_PER_CASE) {
        throw new HttpError(400, `첨부파일은 최대 ${MAX_ATTACHMENTS_PER_CASE}개까지 등록할 수 있습니다.`);
      }
    }

    await this.selfReportRepository.updateCase(caseId, {
      processingResultDate,
      processingResultContent,
      status: "COMPLETED",
    });

    const uploaded = [];
    const existingFileNames = await this.listCaseAttachmentFileNames(caseId);
    const slots = allocateAttachmentSlotIndexes(
      existingFileNames,
      item.receiptNumber,
      files.length,
    );
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.fileName?.trim();
      const mimeType = file.mimeType?.trim().toLowerCase();
      if (!fileName || !mimeType || !file.data?.trim()) {
        throw new HttpError(400, "첨부파일 정보가 올바르지 않습니다.");
      }

      const attachment = await this.persistCaseAttachment({
        caseId,
        receiptNumber: item.receiptNumber,
        kind: "RESULT",
        fileName,
        mimeType,
        data: file.data,
        slotIndex: slots[i],
        existingFileNames,
      });
      uploaded.push(attachment);
    }

    const resultNote = [
      processingResultDate ? processingResultDate.toLocaleDateString("ko-KR") : null,
      processingResultContent,
      uploaded.length ? `첨부 ${uploaded.length}개` : null,
    ]
      .filter(Boolean)
      .join(" / ");

    await this.selfReportRepository.createHistory({
      caseId,
      action: "처리결과 등록",
      note: resultNote || null,
      actorName: this.actorDisplayName(actor),
      actorRole: payload.role,
    });

    await this.notifyReporter(caseId, item, SMS_TEMPLATE_TYPES.REPORTER_COMPLETED, {
      processingResultDate,
    });

    return this.getCase(payload, caseId);
  }

  async addAttachments(
    payload: SelfReportActor,
    caseId: number,
    files: Array<{ fileName: string; mimeType: string; data: string }>,
  ) {
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    this.assertCaseAccess(payload, item.institutionId, item.assigneeStaffId);

    if (!files.length) {
      throw new HttpError(400, "업로드할 파일을 선택해 주세요.");
    }

    const currentCount = await this.selfReportRepository.countAttachmentsByCase(caseId);
    if (currentCount + files.length > MAX_ATTACHMENTS_PER_CASE) {
      throw new HttpError(400, `첨부파일은 최대 ${MAX_ATTACHMENTS_PER_CASE}개까지 등록할 수 있습니다.`);
    }

    const created = [];
    const existingFileNames = await this.listCaseAttachmentFileNames(caseId);
    const slots = allocateAttachmentSlotIndexes(
      existingFileNames,
      item.receiptNumber,
      files.length,
    );
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.fileName?.trim();
      const mimeType = file.mimeType?.trim().toLowerCase();
      if (!fileName || !mimeType || !file.data?.trim()) {
        throw new HttpError(400, "첨부파일 정보가 올바르지 않습니다.");
      }

      const attachment = await this.persistCaseAttachment({
        caseId,
        receiptNumber: item.receiptNumber,
        kind: "CASE",
        fileName,
        mimeType,
        data: file.data,
        slotIndex: slots[i],
        existingFileNames,
      });
      created.push(attachment);
    }

    const actor = this.actorFromPayload(payload);
    await this.selfReportRepository.createHistory({
      caseId,
      action: "첨부파일 등록",
      note: `${created.length}개 파일 추가`,
      actorName: this.actorDisplayName(actor),
      actorRole: payload.role,
    });

    return created;
  }

  async deleteAttachment(payload: SelfReportActor, caseId: number, attachmentId: number) {
    if (payload.role !== ROLES.ADMIN) {
      throw new HttpError(403, "관리자만 첨부파일을 삭제할 수 있습니다.");
    }

    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");

    const attachment = await this.selfReportRepository.findAttachmentById(attachmentId);
    if (!attachment || attachment.caseId !== caseId) {
      throw new HttpError(404, "첨부파일을 찾을 수 없습니다.");
    }

    await deleteSelfReportAttachmentFile(attachment.url);
    await this.selfReportRepository.deleteAttachment(attachmentId);

    const actor = this.actorFromPayload(payload);
    await this.selfReportRepository.createHistory({
      caseId,
      action: "첨부파일 삭제",
      note: attachment.fileName,
      actorName: this.actorDisplayName(actor),
      actorRole: ROLES.ADMIN,
    });

    return { id: attachmentId };
  }

  async updateStatus(payload: SelfReportActor, caseId: number, input: { status: SelfReportStatus; note?: string }) {
    const item = await this.selfReportRepository.findCaseById(caseId);
    if (!item) throw new HttpError(404, "보고를 찾을 수 없습니다.");
    this.assertCaseAccess(payload, item.institutionId, item.assigneeStaffId);

    if (payload.role === ROLES.SELF_REPORT_TIER2 && !["TIER2_PROCESSING", "TRANSFERRED", "COMPLETED"].includes(input.status)) {
      throw new HttpError(403, "변경할 수 없는 상태입니다.");
    }

    await this.selfReportRepository.updateCase(caseId, { status: input.status });
    await this.selfReportRepository.createHistory({
      caseId,
      action: `상태 변경: ${STATUS_LABELS[input.status]}`,
      note: input.note?.trim() || null,
      actorName: this.actorDisplayName(this.actorFromPayload(payload)),
      actorRole: payload.role,
    });

    return this.getCase(payload, caseId);
  }

  async listStaffForActor(payload: SelfReportActor, institutionId?: number) {
    const actor = this.actorFromPayload(payload);
    let targetInstitutionId = institutionId;
    if (payload.role === ROLES.ADMIN) {
      if (!targetInstitutionId) throw new HttpError(400, "기관 ID가 필요합니다.");
    } else {
      targetInstitutionId = actor.institutionId;
    }
    if (!targetInstitutionId) throw new HttpError(400, "기관 정보가 없습니다.");

    const staff = await this.selfReportRepository.listStaffByInstitution(targetInstitutionId);
    return staff;
  }

  // Admin institution CRUD
  listInstitutions() {
    return this.selfReportRepository.listInstitutions();
  }

  listPublicInstitutions() {
    return this.selfReportRepository.listEnabledInstitutionsPublic();
  }

  private async generateInstitutionCode(): Promise<string> {
    const institutions = await this.selfReportRepository.listInstitutions();
    let next = institutions.reduce((max, item) => {
      const match = item.code.match(/^SR(\d+)$/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

    while (true) {
      const code = `SR${String(next).padStart(4, "0")}`;
      const existing = await this.selfReportRepository.findInstitutionByCode(code);
      if (!existing) return code;
      next += 1;
    }
  }

  async createInstitution(input: {
    name: string;
    regionalHq?: string;
  }, hashFn: (key: string) => Promise<string>) {
    const name = input.name.trim();
    if (!name) throw new HttpError(400, "기관명을 입력해 주세요.");

    const code = await this.generateInstitutionCode();
    const placeholderAuthKey = randomBytes(32).toString("hex");

    return this.selfReportRepository.createInstitution({
      name,
      code,
      authKeyHash: await hashFn(placeholderAuthKey),
      regionalHq: input.regionalHq?.trim() || null,
    });
  }

  async updateInstitution(
    id: number,
    input: Partial<{ name: string; code: string; authKey: string; regionalHq: string; enabled: boolean }>,
    hashFn: (key: string) => Promise<string>,
  ) {
    const data: Parameters<SelfReportRepository["updateInstitution"]>[1] = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.code !== undefined) data.code = input.code.trim();
    if (input.regionalHq !== undefined) data.regionalHq = input.regionalHq.trim() || null;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.authKey?.trim()) data.authKeyHash = await hashFn(input.authKey.trim());
    return this.selfReportRepository.updateInstitution(id, data);
  }

  deleteInstitution(id: number) {
    return this.selfReportRepository.deleteInstitution(id);
  }

  createStaff(input: {
    institutionId: number;
    name: string;
    phone?: string;
    email?: string;
    tier: number;
  }) {
    if (![1, 2].includes(input.tier)) throw new HttpError(400, "담당 구분(tier)은 1 또는 2입니다.");
    return this.selfReportRepository.createStaff({
      institutionId: input.institutionId,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      tier: input.tier,
    });
  }

  updateStaff(id: number, input: Partial<{ name: string; phone: string; email: string; tier: number; enabled: boolean }>) {
    const data: Parameters<SelfReportRepository["updateStaff"]>[1] = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.phone !== undefined) data.phone = input.phone.trim() || null;
    if (input.email !== undefined) data.email = input.email.trim() || null;
    if (input.tier !== undefined) data.tier = input.tier;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    return this.selfReportRepository.updateStaff(id, data);
  }

  deleteStaff(id: number) {
    return this.selfReportRepository.deleteStaff(id);
  }
}
