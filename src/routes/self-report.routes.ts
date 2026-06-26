import { Router } from "express";
import { SelfReportController } from "../controllers/self-report.controller";
import {
  authenticateAny,
  authorizeSelfReportRoles,
  SELF_REPORT_ACCESS_ROLES,
} from "../middlewares/self-report-auth.middleware";
import { ROLES } from "../constants/roles";

const router = Router();
const controller = new SelfReportController();

router.get("/public/institutions", controller.listPublicInstitutions);
router.post("/auth/verify", controller.verifyInstitution);
router.post("/auth/login", controller.login);

router.use(authenticateAny, authorizeSelfReportRoles(...SELF_REPORT_ACCESS_ROLES));

router.get("/cases", controller.listCases);
router.get("/cases/sample-csv", authorizeSelfReportRoles(ROLES.ADMIN), controller.getCasesSampleCsv);
router.post("/cases/bulk-csv", authorizeSelfReportRoles(ROLES.ADMIN), controller.bulkCreateCasesFromCsv);
router.post("/cases/bulk-attachments", authorizeSelfReportRoles(ROLES.ADMIN), controller.bulkUploadAttachments);
router.post("/cases/bulk-delete", authorizeSelfReportRoles(ROLES.ADMIN), controller.bulkDeleteCases);
router.get("/cases/:id", controller.getCase);
router.patch("/cases/:id", authorizeSelfReportRoles(ROLES.ADMIN), controller.updateCase);
router.post("/cases", authorizeSelfReportRoles(ROLES.ADMIN), controller.createCase);
router.post("/cases/:id/assign-admin", authorizeSelfReportRoles(ROLES.ADMIN), controller.assignAdmin);
router.post("/tier1-staff/check-email", authorizeSelfReportRoles(ROLES.ADMIN), controller.checkTier1StaffEmail);
router.post("/cases/:id/assign-tier1", authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1), controller.assignTier1);
router.post(
  "/tier2-staff/check-email",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1, ROLES.SELF_REPORT_TIER2),
  controller.checkTier2Email,
);
router.post(
  "/tier2-staff",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1, ROLES.SELF_REPORT_TIER2),
  controller.createTier2Staff,
);
router.post(
  "/send-tier2-account-sms",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1, ROLES.SELF_REPORT_TIER2),
  controller.sendTier2AccountSms,
);
router.post(
  "/cases/:id/intake-decision",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1),
  controller.submitIntakeDecision,
);
router.post(
  "/cases/:id/processing-path",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1),
  controller.submitProcessingPath,
);
router.post(
  "/cases/:id/tier1-status-change",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1),
  controller.submitTier1StatusChange,
);
router.post(
  "/cases/:id/processing-plan",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1, ROLES.SELF_REPORT_TIER2),
  controller.submitProcessingPlan,
);
router.post(
  "/cases/:id/prior-completion",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1, ROLES.SELF_REPORT_TIER2),
  controller.submitPriorCompletion,
);
router.post("/cases/:id/transfer-tier2", authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER2), controller.transferTier2);
router.post(
  "/cases/:id/unprocessable-request",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER2),
  controller.requestUnprocessable,
);
router.post(
  "/cases/:id/unprocessable-confirm",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1),
  controller.confirmUnprocessable,
);
router.post(
  "/cases/:id/processing-result",
  authorizeSelfReportRoles(ROLES.SELF_REPORT_TIER1, ROLES.SELF_REPORT_TIER2),
  controller.submitProcessingResult,
);
router.post("/cases/:id/send-sms", controller.sendCaseSms);
router.post("/cases/:id/attachments", controller.uploadAttachments);
router.delete("/cases/:id/attachments/:attachmentId", authorizeSelfReportRoles(ROLES.ADMIN), controller.deleteAttachment);
router.get("/sms/templates", controller.listSmsTemplates);
router.patch("/cases/:id/status", controller.updateStatus);
router.get("/staff", controller.listStaff);
router.get("/institutions", authorizeSelfReportRoles(ROLES.ADMIN), controller.listInstitutions);

export default router;
