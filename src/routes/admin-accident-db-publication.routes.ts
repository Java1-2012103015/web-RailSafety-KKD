import { Router } from "express";
import { AccidentDetailPublicationController } from "../controllers/accident-detail-publication.controller";
import { AccidentDetailPublicationService } from "../services/accident-detail-publication.service";
import { AccidentDetailPublicationRepository } from "../repositories/accident-detail-publication.repository";
import { RoleRepository } from "../repositories/role.repository";

const router = Router();
const publicationRepository = new AccidentDetailPublicationRepository();
const roleRepository = new RoleRepository();
const publicationService = new AccidentDetailPublicationService(publicationRepository, roleRepository);
const controller = new AccidentDetailPublicationController(publicationService);

router.get("/accident-db-publication", controller.getAdminSettings);
router.put("/accident-db-publication/:roleId", controller.updateRolePublication);

export default router;
