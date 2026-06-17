import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
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

router.use(authenticate);

router.get("/", noticeController.listNotices);
router.get("/:id", noticeController.getNoticeById);
router.post("/", noticeController.createNotice);
router.put("/:id", noticeController.updateNotice);
router.delete("/:id", noticeController.deleteNotice);

export default router;
