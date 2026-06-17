import { Router } from "express";
import { PermissionController } from "../controllers/permission.controller";
import { MenuRepository } from "../repositories/menu.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { RoleRepository } from "../repositories/role.repository";
import { UserRepository } from "../repositories/user.repository";
import { PermissionService } from "../services/permission.service";

const router = Router();

const roleRepository = new RoleRepository();
const menuRepository = new MenuRepository();
const permissionRepository = new PermissionRepository();
const userRepository = new UserRepository();
const permissionService = new PermissionService(roleRepository, menuRepository, permissionRepository, userRepository);
const permissionController = new PermissionController(permissionService);

router.get("/roles", permissionController.listRoles);
router.post("/roles", permissionController.createRole);
router.put("/roles/:roleId", permissionController.updateRole);
router.delete("/roles/:roleId", permissionController.deleteRole);
router.get("/roles/:roleId/permissions", permissionController.getRolePermissions);
router.put("/roles/:roleId/menu-permissions", permissionController.setRoleMenuPermissions);
router.put("/roles/:roleId/query-permission", permissionController.setRoleQueryPermission);

export default router;
