import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { DashboardController } from "../controllers/dashboard.controller";
import { DashboardService } from "../services/dashboard.service";
import { AccidentRepository } from "../repositories/accident.repository";
import { PermissionRepository } from "../repositories/permission.repository";

const router = Router();

const accidentRepository = new AccidentRepository();
const permissionRepository = new PermissionRepository();
const dashboardService = new DashboardService(accidentRepository, permissionRepository);
const dashboardController = new DashboardController(dashboardService);

router.get("/stats", authenticate, dashboardController.getPortalStats);

export default router;
