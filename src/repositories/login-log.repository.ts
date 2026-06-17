import type { LoginLogStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export interface CreateLoginLogInput {
  userId?: number | null;
  email: string;
  name?: string | null;
  roleName?: string | null;
  status: LoginLogStatus;
  ipAddress?: string | null;
  userAgent?: string | null;
  failReason?: string | null;
}

export interface ListLoginLogsQuery {
  page: number;
  pageSize: number;
  email?: string;
  status?: LoginLogStatus;
}

export class LoginLogRepository {
  create(input: CreateLoginLogInput) {
    return prisma.userLoginLog.create({ data: input });
  }

  async list(query: ListLoginLogsQuery): Promise<{
    items: {
      id: number;
      userId: number | null;
      email: string;
      name: string | null;
      roleName: string | null;
      status: LoginLogStatus;
      ipAddress: string | null;
      userAgent: string | null;
      failReason: string | null;
      createdAt: Date;
    }[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: Prisma.UserLoginLogWhereInput = {};

    if (query.email?.trim()) {
      where.email = { contains: query.email.trim() };
    }
    if (query.status) {
      where.status = query.status;
    }

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      prisma.userLoginLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
      prisma.userLoginLog.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
