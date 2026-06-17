import { Router } from "express";
import { InvestmentDisclosureController } from "../controllers/investment-disclosure.controller";
import { InvestmentDisclosureService } from "../services/investment-disclosure.service";
import { InvestmentDisclosureRepository } from "../repositories/investment-disclosure.repository";

const router = Router();
const repository = new InvestmentDisclosureRepository();
const service = new InvestmentDisclosureService(repository);
const controller = new InvestmentDisclosureController(service);

router.get("/investment-disclosure/info", controller.getAdminInfo);
router.get("/investment-disclosure/sample-csv", controller.getSampleCsv);
router.get("/investment-disclosure/export-csv", controller.getExportCsv);
router.post("/investment-disclosure/upload-csv", controller.uploadCsv);

export default router;
