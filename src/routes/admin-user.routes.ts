import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { UserRepository } from "../repositories/user.repository";
import { RoleRepository } from "../repositories/role.repository";

const router = Router();

const userRepository = new UserRepository();
const roleRepository = new RoleRepository();
const userController = new UserController(userRepository, roleRepository);

router.get("/users", userController.listUsers);
router.post("/users", userController.createUser);
router.put("/users/:id", userController.updateUser);
router.delete("/users/:id", userController.deleteUser);

export default router;
