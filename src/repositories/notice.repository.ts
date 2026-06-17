import type { Notice, NoticeBoardType, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export type NoticeListFilter = {
  skip: number;
  take: number;
  boardType?: NoticeBoardType;
  visibleOnly?: boolean;
};

export class NoticeRepository {
  async findMany(options: NoticeListFilter): Promise<{ items: Notice[]; total: number }> {
    const where: Prisma.NoticeWhereInput = {};
    if (options.boardType) {
      where.boardType = options.boardType;
    }
    if (options.visibleOnly) {
      where.visible = true;
    }

    const [items, total] = await Promise.all([
      prisma.notice.findMany({
        where,
        orderBy: { postedAt: "desc" },
        skip: options.skip,
        take: options.take,
      }),
      prisma.notice.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: number): Promise<Notice | null> {
    return prisma.notice.findUnique({ where: { id } });
  }

  async create(data: Prisma.NoticeCreateInput): Promise<Notice> {
    return prisma.notice.create({ data });
  }

  async update(id: number, data: Prisma.NoticeUpdateInput): Promise<Notice> {
    return prisma.notice.update({ where: { id }, data });
  }

  async delete(id: number): Promise<void> {
    await prisma.notice.delete({ where: { id } });
  }
}
