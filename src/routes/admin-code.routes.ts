import { Router } from "express";
import { CodeController } from "../controllers/code.controller";
import { AccidentRepository } from "../repositories/accident.repository";
import { CodeRepository } from "../repositories/code.repository";
import { CodeService } from "../services/code.service";

const router = Router();

const codeRepository = new CodeRepository();
const accidentRepository = new AccidentRepository();
const codeService = new CodeService(codeRepository, accidentRepository);
const codeController = new CodeController(codeService);

router.get("/codes/tree", codeController.getTree);
router.get("/codes/sample-csv/:type", codeController.getSampleCsv);
router.get("/codes/export-csv/:type", codeController.getExportCsv);
router.post("/codes/upload-csv/:type", codeController.uploadCsv);
router.post("/codes/sync-registration-agencies", codeController.syncRegistrationAgencies);

export default router;
