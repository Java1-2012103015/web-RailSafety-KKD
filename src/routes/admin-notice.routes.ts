import { Router } from "express";
import { NoticeController } from "../controllers/notice.controller";
import { NoticeService } from "../services/notice.service";
import { NoticeRepository } from "../repositories/notice.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { UserRepository } from "../repositories/user.repository";

const router = Router();

const noticeRepository = new NoticeRepository();
const userRepository = new UserRepository();
const permissionRepository = new PermissionRepository();
const noticeService = new NoticeService(noticeRepository, userRepository, permissionRepository);
const noticeController = new NoticeController(noticeService);

router.post("/notices", noticeController.createNotice);
router.put("/notices/:id", noticeController.updateNotice);
router.delete("/notices/:id", noticeController.deleteNotice);

export default router;
