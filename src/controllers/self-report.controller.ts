import type { Request, Response, NextFunction } from "express";
import { SelfReportRepository } from "../repositories/self-report.repository";
import { ExternalApiRepository } from "../repositories/external-api.repository";
import { SelfReportAuthService } from "../services/self-report-auth.service";
import { SelfReportService } from "../services/self-report.service";
import { SmsNotificationService } from "../services/sms-notification.service";
import { SmsTemplateService } from "../services/sms-template.service";
import { getSelfReportActor } from "../middlewares/self-report-auth.middleware";

function selfReportDashboardUrl(req: Request): string {
  const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
  const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "localhost").split(",")[0].trim();
  return `${proto}://${host}/dashboard/self-report`;
}

const selfReportRepository = new SelfReportRepository();
const externalApiRepository = new ExternalApiRepository();
const selfReportAuthService = new SelfReportAuthService(selfReportRepository);
const selfReportService = new SelfReportService(
  selfReportRepository,
  new SmsNotificationService(externalApiRepository),
  new SmsTemplateService(externalApiRepository),
);

export class SelfReportController {
  listPublicInstitutions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await selfReportService.listPublicInstitutions();
      res.status(200).json({ data: items });
    } catch (error) {
      next(error);
    }
  };

  verifyInstitution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionCode, email, password, authKey } = req.body as {
        institutionCode?: string;
        authKey?: string;
        email?: string;
        password?: string;
      };
      const result = await selfReportAuthService.verifyInstitution(
        institutionCode ?? "",
        email ?? "",
        password,
        authKey,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionCode, email, password, authKey } = req.body as {
        institutionCode?: string;
        email?: string;
        password?: string;
        authKey?: string;
      };
      const result = await selfReportAuthService.login({
        institutionCode: institutionCode ?? "",
        email: email ?? "",
        password,
        authKey,
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  listCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await selfReportService.listCases(getSelfReportActor(req), {
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        page: Number(req.query.page),
        pageSize: Number(req.query.pageSize),
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  getCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await selfReportService.getCase(getSelfReportActor(req), Number(req.params.id));
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  createCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, content, reporterName, reporterPhone, location } = req.body as {
        title?: string;
        content?: string;
        reporterName?: string;
        reporterPhone?: string;
        location?: string;
      };
      const result = await selfReportService.createCase(getSelfReportActor(req), {
        title: title ?? "",
        content: content ?? "",
        reporterName,
        reporterPhone,
        location,
      });
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  updateCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, content, reporterName, reporterPhone, location } = req.body as {
        title?: string;
        content?: string;
        reporterName?: string;
        reporterPhone?: string;
        location?: string;
      };
      const result = await selfReportService.updateCaseContentByAdmin(
        getSelfReportActor(req),
        Number(req.params.id),
        {
          title: title ?? "",
          content: content ?? "",
          reporterName,
          reporterPhone,
          location,
        },
      );
      res.status(200).json({ data: result, message: "보고 내용을 수정했습니다." });
    } catch (error) {
      next(error);
    }
  };

  getCasesSampleCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = selfReportService.getCasesSampleCsv();
      res.status(200).json({ data, message: "샘플 CSV를 반환했습니다." });
    } catch (error) {
      next(error);
    }
  };

  bulkCreateCasesFromCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { csv } = req.body as { csv?: string };
      const result = await selfReportService.bulkCreateCasesFromCsv(getSelfReportActor(req), csv ?? "");
      res.status(201).json({
        data: result,
        message: `${result.created}건의 보고를 등록했습니다.`,
      });
    } catch (error) {
      next(error);
    }
  };

  bulkUploadAttachments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { files } = req.body as {
        files?: Array<{ fileName?: string; mimeType?: string; data?: string }>;
      };
      const normalized = (files ?? [])
        .filter((f): f is { fileName: string; mimeType: string; data: string } =>
          Boolean(f.fileName && f.mimeType && f.data),
        );
      const result = await selfReportService.bulkUploadAttachments(getSelfReportActor(req), normalized);
      const errorCount = result.errors.length;
      res.status(201).json({
        data: result,
        message:
          errorCount > 0
            ? `${result.uploaded}개 등록, ${errorCount}개 실패`
            : `${result.uploaded}개의 첨부파일을 등록했습니다.`,
      });
    } catch (error) {
      next(error);
    }
  };

  bulkDeleteCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids } = req.body as { ids?: number[] };
      const normalized = (ids ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
      const result = await selfReportService.bulkDeleteCases(getSelfReportActor(req), normalized);
      res.status(200).json({
        data: result,
        message: `${result.deleted}건의 보고를 삭제했습니다.`,
      });
    } catch (error) {
      next(error);
    }
  };

  assignAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        institutionId,
        note,
        toStaffId,
        staffName,
        staffEmail,
        staffAuthKey,
        staffPhone,
      } = req.body as {
        institutionId?: number;
        note?: string;
        toStaffId?: number;
        staffName?: string;
        staffEmail?: string;
        staffAuthKey?: string;
        staffPhone?: string;
      };
      const result = await selfReportService.assignByAdmin(getSelfReportActor(req), Number(req.params.id), {
        institutionId: Number(institutionId),
        note,
        toStaffId: toStaffId ? Number(toStaffId) : undefined,
        staffName,
        staffEmail,
        staffAuthKey,
        staffPhone,
      });
      res.status(200).json({
        data: result,
        message: result.assignedStaff?.isExisting
          ? "기존 1차 담당자에게 배정했습니다."
          : "1차 담당자를 등록하고 배정했습니다.",
      });
    } catch (error) {
      next(error);
    }
  };

  checkTier1StaffEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { institutionId, email } = req.body as { institutionId?: number; email?: string };
      const result = await selfReportService.checkTier1StaffEmailForAdmin(
        Number(institutionId),
        email ?? "",
      );
      res.status(200).json({ data: result, message: result.message });
    } catch (error) {
      next(error);
    }
  };

  assignTier1 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { toStaffId, toRegionalHq, note, processingPlanDate, processingPlanContent } = req.body as {
        toStaffId?: number;
        toRegionalHq?: string;
        note?: string;
        processingPlanDate?: string;
        processingPlanContent?: string;
      };
      const result = await selfReportService.assignByTier1(getSelfReportActor(req), Number(req.params.id), {
        toStaffId,
        toRegionalHq,
        note,
        processingPlanDate,
        processingPlanContent,
      });
      res.status(200).json({ data: result, message: "2차 담당자에게 배정했습니다." });
    } catch (error) {
      next(error);
    }
  };

  createTier2Staff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, authKey, phone } = req.body as {
        name?: string;
        email?: string;
        authKey?: string;
        phone?: string;
      };
      const result = await selfReportService.createTier2Staff(getSelfReportActor(req), {
        name: name ?? "",
        email: email ?? "",
        authKey,
        phone,
      });
      const message = result.isExisting
        ? "기존 2차 담당자를 연결했습니다."
        : "2차 담당자가 생성되었습니다.";
      res.status(201).json({ data: result, message });
    } catch (error) {
      next(error);
    }
  };

  checkTier2Email = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body as { email?: string };
      const result = await selfReportService.checkTier2Email(getSelfReportActor(req), email ?? "");
      res.status(200).json({ data: result, message: result.message });
    } catch (error) {
      next(error);
    }
  };

  sendTier2AccountSms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone, name, email, authKey, institutionCode, message } = req.body as {
        phone?: string;
        name?: string;
        email?: string;
        authKey?: string;
        institutionCode?: string;
        message?: string;
      };
      const result = await selfReportService.sendTier2AccountSms(getSelfReportActor(req), {
        phone: phone ?? "",
        name: name ?? "",
        email: email ?? "",
        authKey: authKey ?? "",
        institutionCode: institutionCode ?? "",
        dashboardUrl: selfReportDashboardUrl(req),
        message,
      });
      res.status(200).json({ data: result, message: result.message });
    } catch (error) {
      next(error);
    }
  };

  transferTier2 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { toStaffId, note } = req.body as { toStaffId?: number; note?: string };
      const result = await selfReportService.transferByTier2(getSelfReportActor(req), Number(req.params.id), {
        toStaffId: Number(toStaffId),
        note,
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  requestUnprocessable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body as { reason?: string };
      const result = await selfReportService.requestUnprocessableByTier2(
        getSelfReportActor(req),
        Number(req.params.id),
        { reason: reason ?? "" },
      );
      res.status(200).json({
        data: result,
        message: "처리불가 요청을 등록했습니다. 1차 배정 담당자에게 문자를 발송했습니다.",
      });
    } catch (error) {
      next(error);
    }
  };

  confirmUnprocessable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await selfReportService.confirmUnprocessableByTier1(
        getSelfReportActor(req),
        Number(req.params.id),
      );
      res.status(200).json({
        data: result,
        message: "처리불가를 확정했습니다. 보고자에게 문자를 발송했습니다.",
      });
    } catch (error) {
      next(error);
    }
  };

  submitIntakeDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { decision } = req.body as { decision?: "PROCESS" | "UNPROCESSABLE" | "RETURN_TO_ADMIN" };
      if (!decision || !["PROCESS", "UNPROCESSABLE", "RETURN_TO_ADMIN"].includes(decision)) {
        res.status(400).json({ message: "접수 결정을 선택해 주세요." });
        return;
      }
      const result = await selfReportService.submitIntakeDecision(
        getSelfReportActor(req),
        Number(req.params.id),
        { decision },
      );
      const messages: Record<string, string> = {
        PROCESS: "처리 결정이 확인되었습니다. 처리 방법(2차 담당 배정 또는 직접 입력)을 선택해 주세요.",
        UNPROCESSABLE: "처리불가 처리 되었습니다.",
        RETURN_TO_ADMIN: "관리자에게 반려되었습니다.",
      };
      res.status(200).json({ data: result, message: messages[decision] });
    } catch (error) {
      next(error);
    }
  };

  submitProcessingPath = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { path } = req.body as { path?: "TIER2_ASSIGN" | "DIRECT_INPUT" };
      if (!path || !["TIER2_ASSIGN", "DIRECT_INPUT"].includes(path)) {
        res.status(400).json({ message: "처리 방법을 선택해 주세요." });
        return;
      }
      const result = await selfReportService.submitProcessingPath(
        getSelfReportActor(req),
        Number(req.params.id),
        { path },
      );
      const messages: Record<string, string> = {
        TIER2_ASSIGN: "2차담당 배정 상태로 변경되었습니다. 담당자를 지정해 주세요.",
        DIRECT_INPUT: "직접 입력으로 진행합니다. 조치계획·조치결과를 입력해 주세요.",
      };
      res.status(200).json({ data: result, message: messages[path] });
    } catch (error) {
      next(error);
    }
  };

  submitTier1StatusChange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { decision } = req.body as {
        decision?: "PROCESS" | "UNPROCESSABLE" | "RETURN_TO_ADMIN" | "REASSIGN_TIER2";
      };
      if (!decision || !["PROCESS", "UNPROCESSABLE", "RETURN_TO_ADMIN", "REASSIGN_TIER2"].includes(decision)) {
        res.status(400).json({ message: "상태변경 결정을 선택해 주세요." });
        return;
      }
      const result = await selfReportService.submitTier1StatusChange(
        getSelfReportActor(req),
        Number(req.params.id),
        { decision },
      );
      const messages: Record<string, string> = {
        PROCESS: "1차 기관 최초 배정 상태로 되돌렸습니다. 접수부터 다시 진행해 주세요.",
        REASSIGN_TIER2: "2차 담당 배정을 해제했습니다. 다른 담당자를 지정해 주세요.",
        UNPROCESSABLE: "처리불가 처리 되었습니다.",
        RETURN_TO_ADMIN: "관리자에게 반려되었습니다.",
      };
      res.status(200).json({ data: result, message: messages[decision] });
    } catch (error) {
      next(error);
    }
  };

  submitProcessingPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { processingPlanDate, processingPlanContent } = req.body as {
        processingPlanDate?: string;
        processingPlanContent?: string;
      };
      const actor = getSelfReportActor(req);
      const result = await selfReportService.submitProcessingPlan(
        actor,
        Number(req.params.id),
        { processingPlanDate, processingPlanContent },
      );
      const message =
        actor.role === "SELF_REPORT_TIER2" ? "처리계획을 저장했습니다." : "조치계획을 저장했습니다.";
      res.status(200).json({ data: result, message });
    } catch (error) {
      next(error);
    }
  };

  submitPriorCompletion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { priorCompletionDate, priorCompletionContent, files } = req.body as {
        priorCompletionDate?: string;
        priorCompletionContent?: string;
        files?: Array<{ fileName?: string; mimeType?: string; data?: string }>;
      };
      const normalizedFiles = (files ?? [])
        .filter((f): f is { fileName: string; mimeType: string; data: string } =>
          Boolean(f.fileName && f.mimeType && f.data),
        );
      const actor = getSelfReportActor(req);
      const result = await selfReportService.submitPriorCompletion(
        actor,
        Number(req.params.id),
        {
          priorCompletionDate,
          priorCompletionContent,
          files: normalizedFiles.length ? normalizedFiles : undefined,
        },
      );
      const message =
        actor.role === "SELF_REPORT_TIER2" ? "기처리 처리 되었습니다." : "기완료 처리 되었습니다.";
      res.status(200).json({ data: result, message });
    } catch (error) {
      next(error);
    }
  };

  submitProcessingResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { processingResultDate, processingResultContent, files } = req.body as {
        processingResultDate?: string;
        processingResultContent?: string;
        files?: Array<{ fileName?: string; mimeType?: string; data?: string }>;
      };
      const normalizedFiles = (files ?? [])
        .filter((f): f is { fileName: string; mimeType: string; data: string } =>
          Boolean(f.fileName && f.mimeType && f.data),
        );
      const result = await selfReportService.submitProcessingResult(
        getSelfReportActor(req),
        Number(req.params.id),
        {
          processingResultDate,
          processingResultContent,
          files: normalizedFiles.length ? normalizedFiles : undefined,
        },
      );
      res.status(200).json({ data: result, message: "처리결과를 저장했습니다." });
    } catch (error) {
      next(error);
    }
  };

  listSmsTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await selfReportService.listSmsTemplates(selfReportDashboardUrl(req));
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  sendCaseSms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone, recipientName, templateType, message, email, authKey, transferReason } = req.body as {
        phone?: string;
        recipientName?: string;
        templateType?: string;
        message?: string;
        email?: string;
        authKey?: string;
        transferReason?: string;
      };
      const result = await selfReportService.sendCaseSms(getSelfReportActor(req), Number(req.params.id), {
        phone: phone ?? "",
        recipientName,
        templateType: templateType as never,
        message,
        email,
        authKey,
        transferReason,
        dashboardUrl: selfReportDashboardUrl(req),
      });
      res.status(200).json({ data: result, message: "문자를 발송했습니다." });
    } catch (error) {
      next(error);
    }
  };

  uploadAttachments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { files } = req.body as {
        files?: Array<{ fileName?: string; mimeType?: string; data?: string }>;
      };
      const normalized = (files ?? [])
        .filter((f): f is { fileName: string; mimeType: string; data: string } =>
          Boolean(f.fileName && f.mimeType && f.data),
        );
      const result = await selfReportService.addAttachments(
        getSelfReportActor(req),
        Number(req.params.id),
        normalized,
      );
      res.status(201).json({ data: result, message: "첨부파일을 등록했습니다." });
    } catch (error) {
      next(error);
    }
  };

  deleteAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await selfReportService.deleteAttachment(
        getSelfReportActor(req),
        Number(req.params.id),
        Number(req.params.attachmentId),
      );
      res.status(200).json({ data: result, message: "첨부파일을 삭제했습니다." });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, note } = req.body as { status?: string; note?: string };
      const result = await selfReportService.updateStatus(getSelfReportActor(req), Number(req.params.id), {
        status: status as never,
        note,
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  listStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const institutionId = req.query.institutionId ? Number(req.query.institutionId) : undefined;
      const result = await selfReportService.listStaffForActor(getSelfReportActor(req), institutionId);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  listInstitutions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await selfReportService.listInstitutions();
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };
}

export class SelfReportAdminController {
  listInstitutions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await selfReportService.listInstitutions();
      res.status(200).json({ data: items });
    } catch (error) {
      next(error);
    }
  };

  createInstitution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, regionalHq } = req.body as {
        name?: string;
        regionalHq?: string;
      };
      const item = await selfReportService.createInstitution(
        { name: name ?? "", regionalHq },
        (key) => selfReportAuthService.hashAuthKey(key),
      );
      res.status(201).json({ data: item });
    } catch (error) {
      next(error);
    }
  };

  updateInstitution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, code, authKey, regionalHq, enabled } = req.body as {
        name?: string;
        code?: string;
        authKey?: string;
        regionalHq?: string;
        enabled?: boolean;
      };
      const item = await selfReportService.updateInstitution(
        Number(req.params.id),
        { name, code, authKey, regionalHq, enabled },
        (key) => selfReportAuthService.hashAuthKey(key),
      );
      res.status(200).json({ data: item });
    } catch (error) {
      next(error);
    }
  };

  deleteInstitution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await selfReportService.deleteInstitution(Number(req.params.id));
      res.status(200).json({ message: "deleted" });
    } catch (error) {
      next(error);
    }
  };

  listStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const institutionId = Number(req.params.institutionId);
      const items = await selfReportRepository.listStaffByInstitution(institutionId);
      res.status(200).json({ data: items });
    } catch (error) {
      next(error);
    }
  };

  createStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, phone, email, tier, authKey } = req.body as {
        name?: string;
        phone?: string;
        email?: string;
        tier?: number;
        authKey?: string;
      };
      const item = await selfReportService.createStaffWithAccount(Number(req.params.institutionId), {
        name: name ?? "",
        phone,
        email: email ?? "",
        tier: Number(tier),
        authKey,
      });
      const message = item.isExisting
        ? "기존 담당자 계정을 연결했습니다."
        : "담당자 계정을 등록했습니다.";
      res.status(201).json({ data: item, message });
    } catch (error) {
      next(error);
    }
  };

  checkStaffEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, tier } = req.body as { email?: string; tier?: number };
      const result = await selfReportService.checkStaffEmailForAdmin(
        Number(req.params.institutionId),
        Number(tier),
        email ?? "",
      );
      res.status(200).json({ data: result, message: result.message });
    } catch (error) {
      next(error);
    }
  };

  sendStaffAccountSms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.email) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const { phone, email, authKey, tier, message } = req.body as {
        phone?: string;
        email?: string;
        authKey?: string;
        tier?: number;
        message?: string;
      };
      const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
      const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "localhost").split(",")[0].trim();
      const dashboardUrl = `${proto}://${host}/dashboard/self-report`;
      const result = await selfReportService.sendStaffAccountSmsByAdmin(req.user.email, {
        phone: phone ?? "",
        email: email ?? "",
        authKey: authKey ?? "",
        tier: Number(tier),
        dashboardUrl,
        message,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, phone, email, tier, enabled } = req.body as {
        name?: string;
        phone?: string;
        email?: string;
        tier?: number;
        enabled?: boolean;
      };
      const item = await selfReportService.updateStaff(Number(req.params.staffId), {
        name,
        phone,
        email,
        tier,
        enabled,
      });
      res.status(200).json({ data: item });
    } catch (error) {
      next(error);
    }
  };

  deleteStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await selfReportService.deleteStaff(Number(req.params.staffId));
      res.status(200).json({ message: "deleted" });
    } catch (error) {
      next(error);
    }
  };
}
