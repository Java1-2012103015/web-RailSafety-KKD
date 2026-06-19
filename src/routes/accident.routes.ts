import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { AccidentRepository } from "../repositories/accident.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { AccidentDetailPublicationRepository } from "../repositories/accident-detail-publication.repository";
import { RoleRepository } from "../repositories/role.repository";
import { AccidentDetailPublicationService } from "../services/accident-detail-publication.service";
import { AccidentService } from "../services/accident.service";
import { AccidentController } from "../controllers/accident.controller";

const router = Router();

const accidentRepository = new AccidentRepository();
const permissionRepository = new PermissionRepository();
const publicationService = new AccidentDetailPublicationService(
  new AccidentDetailPublicationRepository(),
  new RoleRepository(),
);
const accidentService = new AccidentService(
  accidentRepository,
  permissionRepository,
  publicationService,
);
const accidentController = new AccidentController(accidentService);

router.get("/filter-options", authenticate, accidentController.getFilterOptions);
router.get("/", authenticate, accidentController.getAccidents);
router.patch("/:id/investigation-reports", authenticate, accidentController.updateInvestigationReports);
router.get("/:id/investigation-reports/download", authenticate, accidentController.downloadInvestigationReport);
router.get("/:id", authenticate, accidentController.getAccidentById);
router.post("/bulk", authenticate, accidentController.bulkUpsertAccidents);
router.delete("/", authenticate, accidentController.deleteAccidents);

export default router;
