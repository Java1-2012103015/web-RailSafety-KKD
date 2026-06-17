import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { DashboardService } from "../services/dashboard.service";
import { AccidentRepository } from "../repositories/accident.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { BrandingController } from "../controllers/branding.controller";
import { BrandingService } from "../services/branding.service";
import { BrandingRepository } from "../repositories/branding.repository";
import { RoleRepository } from "../repositories/role.repository";
import { InvestmentDisclosureController } from "../controllers/investment-disclosure.controller";
import { InvestmentDisclosureService } from "../services/investment-disclosure.service";
import { InvestmentDisclosureRepository } from "../repositories/investment-disclosure.repository";
import { FloodAlertController } from "../controllers/flood-alert.controller";
import { floodAlertService } from "../bootstrap/flood-alert-services";

const router = Router();

const accidentRepository = new AccidentRepository();
const permissionRepository = new PermissionRepository();
const dashboardService = new DashboardService(accidentRepository, permissionRepository);
const dashboardController = new DashboardController(dashboardService);

const brandingRepository = new BrandingRepository();
const roleRepository = new RoleRepository();
const brandingService = new BrandingService(brandingRepository, roleRepository);
const brandingController = new BrandingController(brandingService);

const investmentDisclosureRepository = new InvestmentDisclosureRepository();
const investmentDisclosureService = new InvestmentDisclosureService(investmentDisclosureRepository);
const investmentDisclosureController = new InvestmentDisclosureController(investmentDisclosureService);

const floodAlertController = new FloodAlertController(floodAlertService);

router.get("/dashboard/stats", dashboardController.getStats);
router.get("/dashboard/portal-stats", dashboardController.getGuestPortalStats);
router.get("/investment-disclosure", investmentDisclosureController.getPortalDashboard);
router.get("/investment-disclosure/report", investmentDisclosureController.getPrintReport);
router.get("/flood-alert/dashboard", floodAlertController.getDashboard);
router.get("/branding", brandingController.getPublicBranding);

export default router;
