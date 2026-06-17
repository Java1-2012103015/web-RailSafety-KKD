import type { Notice, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export class NoticeRepository {
  async findMany(options: { skip: number; take: number }): Promise<{ items: Notice[]; total: number }> {
    const [items, total] = await Promise.all([
      prisma.notice.findMany({
        orderBy: { createdAt: "desc" },
        skip: options.skip,
        take: options.take,
      }),
      prisma.notice.count(),
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
