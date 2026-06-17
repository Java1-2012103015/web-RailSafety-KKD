import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { BrandingController } from "../controllers/branding.controller";
import { BrandingService } from "../services/branding.service";
import { BrandingRepository } from "../repositories/branding.repository";
import { RoleRepository } from "../repositories/role.repository";

const router = Router();

const brandingRepository = new BrandingRepository();
const roleRepository = new RoleRepository();
const brandingService = new BrandingService(brandingRepository, roleRepository);
const brandingController = new BrandingController(brandingService);

router.get("/me", authenticate, brandingController.getCurrentBranding);

export default router;
