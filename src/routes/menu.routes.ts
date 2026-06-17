import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { MenuRepository } from "../repositories/menu.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { MenuService } from "../services/menu.service";
import { MenuController } from "../controllers/menu.controller";

const router = Router();

const menuRepository = new MenuRepository();
const permissionRepository = new PermissionRepository();
const menuService = new MenuService(menuRepository, permissionRepository);
const menuController = new MenuController(menuService);

router.get("/", authenticate, menuController.getMenuTree);

export default router;
