import { Router } from "express";
import { SelfReportAdminController } from "../controllers/self-report.controller";

const router = Router();
const controller = new SelfReportAdminController();

router.get("/institutions", controller.listInstitutions);
router.post("/institutions", controller.createInstitution);
router.put("/institutions/:id", controller.updateInstitution);
router.delete("/institutions/:id", controller.deleteInstitution);

router.get("/institutions/:institutionId/staff", controller.listStaff);
router.post("/institutions/:institutionId/staff/check-email", controller.checkStaffEmail);
router.post("/institutions/:institutionId/staff/send-account-sms", controller.sendStaffAccountSms);
router.post("/institutions/:institutionId/staff", controller.createStaff);
router.put("/institutions/:institutionId/staff/:staffId", controller.updateStaff);
router.delete("/institutions/:institutionId/staff/:staffId", controller.deleteStaff);

export default router;
