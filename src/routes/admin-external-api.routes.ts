import { Router } from "express";
import { ExternalApiController } from "../controllers/external-api.controller";
import { ExternalApiRepository } from "../repositories/external-api.repository";
import { ExternalApiService } from "../services/external-api.service";

const router = Router();

const externalApiRepository = new ExternalApiRepository();
const externalApiService = new ExternalApiService(externalApiRepository);
const externalApiController = new ExternalApiController(externalApiService);

router.get("/external-apis", externalApiController.listConfigs);
router.put("/external-apis/:apiType", externalApiController.updateConfig);

export default router;
