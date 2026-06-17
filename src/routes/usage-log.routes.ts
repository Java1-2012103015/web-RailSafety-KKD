import { Router } from "express";
import { UsageLogController } from "../controllers/usage-log.controller";
import { UsageLogService } from "../services/usage-log.service";
import { UsageLogRepository } from "../repositories/usage-log.repository";
import { UserRepository } from "../repositories/user.repository";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();
const usageLogRepository = new UsageLogRepository();
const userRepository = new UserRepository();
const usageLogService = new UsageLogService(usageLogRepository, userRepository);
const controller = new UsageLogController(usageLogService);

router.post("/view", authenticate, controller.recordView);
router.post("/leave", authenticate, controller.recordLeave);

export default router;
