import { Router } from "express";
import { floodAlertService } from "../bootstrap/flood-alert-services";
import { FloodAlertController } from "../controllers/flood-alert.controller";

const router = Router();
const controller = new FloodAlertController(floodAlertService);

router.get("/flood-alert/info", controller.getAdminInfo);
router.get("/flood-alert/sample-csv", controller.getSampleCsv);
router.get("/flood-alert/export-csv", controller.getExportCsv);
router.post("/flood-alert/upload-csv", controller.uploadCsv);
router.get("/flood-alert/settings", controller.getSettings);
router.put("/flood-alert/settings", controller.updateSettings);

export default router;
