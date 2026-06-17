import type { Notice } from "@prisma/client";
import type { MenuActionKey } from "../constants/menu-action-permissions";
import { NoticeRepository } from "../repositories/notice.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { UserRepository } from "../repositories/user.repository";
import { MenuActionPermissionService } from "./menu-action-permission.service";
import { HttpError } from "../utils/http-error";

interface NoticeAuth {
  userId: number;
  roleId: number;
  role: string;
}

export class NoticeService {
  private readonly menuActionPermissionService: MenuActionPermissionService;

  constructor(
    private readonly noticeRepository: NoticeRepository,
    private readonly userRepository: UserRepository,
    permissionRepository: PermissionRepository,
  ) {
    this.menuActionPermissionService = new MenuActionPermissionService(permissionRepository);
  }

  async listNotices(
    page: number,
    pageSize: number,
    auth: NoticeAuth,
  ): Promise<{ items: Notice[]; total: number; page: number; pageSize: number }> {
    await this.assertNoticeAction(auth, "read");

    const skip = (page - 1) * pageSize;
    const { items, total } = await this.noticeRepository.findMany({ skip, take: pageSize });

    return { items, total, page, pageSize };
  }

  async getNoticeById(id: number, auth: NoticeAuth): Promise<Notice> {
    await this.assertNoticeAction(auth, "read");

    const notice = await this.noticeRepository.findById(id);
    if (!notice) {
      throw new HttpError(404, "공지사항을 찾을 수 없습니다.");
    }
    return notice;
  }

  async createNotice(
    input: { title?: string; content?: string },
    auth: NoticeAuth,
  ): Promise<Notice> {
    await this.assertNoticeAction(auth, "create");

    const title = input.title?.trim();
    const content = input.content?.trim();
    if (!title) {
      throw new HttpError(400, "제목을 입력해 주세요.");
    }
    if (!content) {
      throw new HttpError(400, "내용을 입력해 주세요.");
    }

    const user = await this.userRepository.findById(auth.userId);
    const authorName = user?.name?.trim() || "관리자";

    return this.noticeRepository.create({
      title,
      content,
      authorName,
      createdBy: { connect: { id: auth.userId } },
    });
  }

  async updateNotice(
    id: number,
    input: { title?: string; content?: string },
    auth: NoticeAuth,
  ): Promise<Notice> {
    await this.assertNoticeAction(auth, "update");

    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid notice id.");
    }

    const existing = await this.noticeRepository.findById(id);
    if (!existing) {
      throw new HttpError(404, "공지사항을 찾을 수 없습니다.");
    }

    const title = input.title?.trim();
    const content = input.content?.trim();
    if (title !== undefined && !title) {
      throw new HttpError(400, "제목을 입력해 주세요.");
    }
    if (content !== undefined && !content) {
      throw new HttpError(400, "내용을 입력해 주세요.");
    }

    return this.noticeRepository.update(id, {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
    });
  }

  async deleteNotice(id: number, auth: NoticeAuth): Promise<void> {
    await this.assertNoticeAction(auth, "delete");

    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid notice id.");
    }

    const existing = await this.noticeRepository.findById(id);
    if (!existing) {
      throw new HttpError(404, "공지사항을 찾을 수 없습니다.");
    }

    await this.noticeRepository.delete(id);
  }

  private assertNoticeAction(auth: NoticeAuth, action: MenuActionKey): Promise<void> {
    return this.menuActionPermissionService.assertMenuAction(auth.roleId, auth.role, "/notices", action);
  }
}
