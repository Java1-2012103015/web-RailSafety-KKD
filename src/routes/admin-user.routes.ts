import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { UserRepository } from "../repositories/user.repository";
import { RoleRepository } from "../repositories/role.repository";
import { SelfReportRepository } from "../repositories/self-report.repository";
import { SelfReportUserSyncService } from "../services/self-report-user-sync.service";

const router = Router();

const userRepository = new UserRepository();
const roleRepository = new RoleRepository();
const selfReportRepository = new SelfReportRepository();
const selfReportUserSyncService = new SelfReportUserSyncService(selfReportRepository);
const userController = new UserController(
  userRepository,
  roleRepository,
  selfReportRepository,
  selfReportUserSyncService,
);

router.get("/users", userController.listUsers);
router.post("/users", userController.createUser);
router.put("/users/:id", userController.updateUser);
router.delete("/users/:id", userController.deleteUser);

export default router;
