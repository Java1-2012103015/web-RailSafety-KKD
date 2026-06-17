import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { InvestmentDisclosureController } from "../controllers/investment-disclosure.controller";
import { InvestmentDisclosureService } from "../services/investment-disclosure.service";
import { InvestmentDisclosureRepository } from "../repositories/investment-disclosure.repository";

const router = Router();
const repository = new InvestmentDisclosureRepository();
const service = new InvestmentDisclosureService(repository);
const controller = new InvestmentDisclosureController(service);

router.get("/", authenticate, controller.getPortalDashboard);
router.get("/export-csv", authenticate, controller.getPortalExportCsv);
router.get("/export-rows", authenticate, controller.getPortalExportRows);

export default router;
