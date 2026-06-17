import type { Notice, NoticeBoardType } from "@prisma/client";
import type { MenuActionKey, MenuActionPath } from "../constants/menu-action-permissions";
import { NoticeRepository } from "../repositories/notice.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { UserRepository } from "../repositories/user.repository";
import { ROLES } from "../constants/roles";
import { MenuActionPermissionService } from "./menu-action-permission.service";
import { HttpError } from "../utils/http-error";

interface NoticeAuth {
  userId: number;
  roleId: number;
  role: string;
}

export type NoticeInput = {
  title?: string;
  content?: string;
  boardType?: string;
  postedAt?: string;
  visible?: boolean;
};

function parseBoardType(value?: string): NoticeBoardType {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "ARCHIVE") return "ARCHIVE";
  return "NOTICE";
}

function menuPathForBoardType(boardType: NoticeBoardType): MenuActionPath {
  return boardType === "ARCHIVE" ? "/archive" : "/notices";
}

function parsePostedAt(value?: string): Date {
  if (!value?.trim()) {
    return new Date();
  }

  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (Number.isNaN(date.getTime())) {
      throw new HttpError(400, "등록일 형식이 올바르지 않습니다.");
    }
    return date;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "등록일 형식이 올바르지 않습니다.");
  }
  return parsed;
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
    options: { boardType?: string; includeHidden?: boolean } = {},
  ): Promise<{ items: Notice[]; total: number; page: number; pageSize: number }> {
    const boardType = parseBoardType(options.boardType);
    await this.assertBoardAction(auth, boardType, "read");

    const canSeeHidden =
      options.includeHidden &&
      (await this.canBoardAction(auth, boardType, "update"));

    const skip = (page - 1) * pageSize;
    const { items, total } = await this.noticeRepository.findMany({
      skip,
      take: pageSize,
      boardType,
      visibleOnly: !canSeeHidden,
    });

    return { items, total, page, pageSize };
  }

  async getNoticeById(id: number, auth: NoticeAuth): Promise<Notice> {
    const notice = await this.noticeRepository.findById(id);
    if (!notice) {
      throw new HttpError(404, "게시물을 찾을 수 없습니다.");
    }

    await this.assertBoardAction(auth, notice.boardType, "read");

    if (!notice.visible) {
      const canSeeHidden = await this.canBoardAction(auth, notice.boardType, "update");
      if (!canSeeHidden) {
        throw new HttpError(404, "게시물을 찾을 수 없습니다.");
      }
    }

    return notice;
  }

  async createNotice(input: NoticeInput, auth: NoticeAuth): Promise<Notice> {
    const boardType = parseBoardType(input.boardType);
    await this.assertBoardAction(auth, boardType, "create");

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
      boardType,
      postedAt: parsePostedAt(input.postedAt),
      visible: input.visible !== false,
      createdBy: { connect: { id: auth.userId } },
    });
  }

  async updateNotice(id: number, input: NoticeInput, auth: NoticeAuth): Promise<Notice> {
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid notice id.");
    }

    const existing = await this.noticeRepository.findById(id);
    if (!existing) {
      throw new HttpError(404, "게시물을 찾을 수 없습니다.");
    }

    const targetBoardType =
      input.boardType !== undefined ? parseBoardType(input.boardType) : existing.boardType;
    await this.assertBoardAction(auth, existing.boardType, "update");
    if (targetBoardType !== existing.boardType) {
      await this.assertBoardAction(auth, targetBoardType, "create");
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
      ...(input.boardType !== undefined ? { boardType: targetBoardType } : {}),
      ...(input.postedAt !== undefined ? { postedAt: parsePostedAt(input.postedAt) } : {}),
      ...(input.visible !== undefined ? { visible: Boolean(input.visible) } : {}),
    });
  }

  async deleteNotice(id: number, auth: NoticeAuth): Promise<void> {
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid notice id.");
    }

    const existing = await this.noticeRepository.findById(id);
    if (!existing) {
      throw new HttpError(404, "게시물을 찾을 수 없습니다.");
    }

    await this.assertBoardAction(auth, existing.boardType, "delete");
    await this.noticeRepository.delete(id);
  }

  private async canBoardAction(
    auth: NoticeAuth,
    boardType: NoticeBoardType,
    action: MenuActionKey,
  ): Promise<boolean> {
    if (auth.role === ROLES.ADMIN) return true;
    const menuPath = menuPathForBoardType(boardType);
    const actions = await this.menuActionPermissionService.getMenuActionsForRole(auth.roleId, auth.role);
    return Boolean(actions[menuPath]?.[action]);
  }

  private async assertBoardAction(
    auth: NoticeAuth,
    boardType: NoticeBoardType,
    action: MenuActionKey,
  ): Promise<void> {
    const menuPath = menuPathForBoardType(boardType);
    await this.menuActionPermissionService.assertMenuAction(auth.roleId, auth.role, menuPath, action);
  }
}
