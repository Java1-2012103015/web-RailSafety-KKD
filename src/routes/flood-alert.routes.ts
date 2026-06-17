import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { floodAlertService } from "../bootstrap/flood-alert-services";
import { FloodAlertController } from "../controllers/flood-alert.controller";

const router = Router();
const controller = new FloodAlertController(floodAlertService);

router.get("/", authenticate, controller.getPortalList);
router.delete("/", authenticate, controller.deleteRecords);
router.get("/dashboard", authenticate, controller.getDashboard);
router.get("/sample-csv", authenticate, controller.getSampleCsv);
router.get("/export-csv", authenticate, controller.getExportCsv);

export default router;
