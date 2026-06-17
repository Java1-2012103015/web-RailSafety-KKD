import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { RegistrationRequestController } from "../controllers/registration-request.controller";
import { AuthService } from "../services/auth.service";
import { RegistrationRequestService } from "../services/registration-request.service";
import { UserRepository } from "../repositories/user.repository";
import { RoleRepository } from "../repositories/role.repository";
import { RegistrationRequestRepository } from "../repositories/registration-request.repository";
import { LoginLogRepository } from "../repositories/login-log.repository";
import { LoginLogService } from "../services/login-log.service";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

const userRepository = new UserRepository();
const roleRepository = new RoleRepository();
const registrationRequestRepository = new RegistrationRequestRepository();
const loginLogRepository = new LoginLogRepository();
const loginLogService = new LoginLogService(loginLogRepository);
const authService = new AuthService(userRepository, roleRepository, loginLogService);
const registrationRequestService = new RegistrationRequestService(
  registrationRequestRepository,
  userRepository,
  roleRepository,
);
const authController = new AuthController(authService);
const registrationRequestController = new RegistrationRequestController(registrationRequestService);

router.post("/signup", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);
router.get("/check-email", registrationRequestController.checkEmail);
router.post("/registration-request", registrationRequestController.submit);

export default router;
