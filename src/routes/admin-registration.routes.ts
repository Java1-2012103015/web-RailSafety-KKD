import { Router } from "express";
import { RegistrationRequestController } from "../controllers/registration-request.controller";
import { RegistrationRequestService } from "../services/registration-request.service";
import { RegistrationRequestRepository } from "../repositories/registration-request.repository";
import { UserRepository } from "../repositories/user.repository";
import { RoleRepository } from "../repositories/role.repository";

const router = Router();

const registrationRequestRepository = new RegistrationRequestRepository();
const userRepository = new UserRepository();
const roleRepository = new RoleRepository();
const registrationRequestService = new RegistrationRequestService(
  registrationRequestRepository,
  userRepository,
  roleRepository,
);
const registrationRequestController = new RegistrationRequestController(registrationRequestService);

router.get("/registration-requests", registrationRequestController.listPending);
router.post("/registration-requests/:id/approve", registrationRequestController.approve);
router.post("/registration-requests/:id/reject", registrationRequestController.reject);

export default router;
