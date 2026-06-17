import { Router } from "express";
import { AdminLoginLogController } from "../controllers/admin-login-log.controller";
import { LoginLogService } from "../services/login-log.service";
import { LoginLogRepository } from "../repositories/login-log.repository";

const router = Router();
const loginLogRepository = new LoginLogRepository();
const loginLogService = new LoginLogService(loginLogRepository);
const controller = new AdminLoginLogController(loginLogService);

router.get("/login-logs", controller.list);

export default router;
