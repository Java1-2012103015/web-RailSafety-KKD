import { Router } from "express";
import { AdminUsageLogController } from "../controllers/admin-usage-log.controller";
import { UsageLogService } from "../services/usage-log.service";
import { UsageLogRepository } from "../repositories/usage-log.repository";
import { UserRepository } from "../repositories/user.repository";

const router = Router();
const usageLogRepository = new UsageLogRepository();
const userRepository = new UserRepository();
const usageLogService = new UsageLogService(usageLogRepository, userRepository);
const controller = new AdminUsageLogController(usageLogService);

router.get("/usage-stats", controller.list);
router.get("/usage-stats/summary", controller.summary);

export default router;
