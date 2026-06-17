import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export interface CreateUsageLogInput {
  userId: number;
  email: string;
  name?: string | null;
  roleName?: string | null;
  path: string;
  pageTitle?: string | null;
  sessionKey: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ListUsageLogsQuery {
  page: number;
  pageSize: number;
  email?: string;
  path?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface UsageSummaryQuery {
  fromDate?: Date;
  toDate?: Date;
}

export class UsageLogRepository {
  create(input: CreateUsageLogInput) {
    return prisma.userPageUsageLog.create({ data: input });
  }

  updateDwell(sessionKey: string, userId: number, dwellSeconds: number) {
    return prisma.userPageUsageLog.updateMany({
      where: { sessionKey, userId },
      data: {
        dwellSeconds,
        leftAt: new Date(),
      },
    });
  }

  async list(query: ListUsageLogsQuery) {
    const where = this.buildWhere(query);

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      prisma.userPageUsageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
      prisma.userPageUsageLog.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getSummary(query: UsageSummaryQuery) {
    const where = this.buildWhere({ page: 1, pageSize: 1, ...query });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalVisits, uniqueUsers, dwellAgg, todayVisits, topPathsRaw, dailyRaw] = await Promise.all([
      prisma.userPageUsageLog.count({ where }),
      prisma.userPageUsageLog.groupBy({
        by: ["userId"],
        where: { ...where, userId: { not: null } },
      }),
      prisma.userPageUsageLog.aggregate({
        where: { ...where, dwellSeconds: { gt: 0 } },
        _avg: { dwellSeconds: true },
        _sum: { dwellSeconds: true },
      }),
      prisma.userPageUsageLog.count({
        where: { ...where, createdAt: { gte: todayStart } },
      }),
      prisma.userPageUsageLog.groupBy({
        by: ["path"],
        where,
        _count: { _all: true },
        _avg: { dwellSeconds: true },
      }),
      this.fetchDailyVisits(query),
    ]);

    const topPaths = topPathsRaw
      .map((row) => ({
        path: row.path,
        visits: row._count._all,
        avgDwellSeconds: Math.round(row._avg.dwellSeconds ?? 0),
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    const dailyVisits = dailyRaw;

    return {
      totalVisits,
      uniqueUsers: uniqueUsers.length,
      avgDwellSeconds: Math.round(dwellAgg._avg.dwellSeconds ?? 0),
      totalDwellSeconds: dwellAgg._sum.dwellSeconds ?? 0,
      todayVisits,
      topPaths,
      dailyVisits,
    };
  }

  private buildWhere(query: Partial<ListUsageLogsQuery>): Prisma.UserPageUsageLogWhereInput {
    const where: Prisma.UserPageUsageLogWhereInput = {};

    if (query.email?.trim()) {
      where.email = { contains: query.email.trim() };
    }
    if (query.path?.trim()) {
      where.path = { contains: query.path.trim() };
    }
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = query.fromDate;
      if (query.toDate) where.createdAt.lte = query.toDate;
    }

    return where;
  }

  private async fetchDailyVisits(query: UsageSummaryQuery) {
    const from = query.fromDate ?? new Date(0);
    const to = query.toDate ?? new Date();

    const rows = await prisma.$queryRaw<{ date: Date; visits: bigint; uniqueUsers: bigint }[]>`
      SELECT DATE(createdAt) AS date,
             COUNT(*) AS visits,
             COUNT(DISTINCT userId) AS uniqueUsers
      FROM UserPageUsageLog
      WHERE createdAt >= ${from}
        AND createdAt <= ${to}
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
      LIMIT 30
    `;

    return rows
      .map((row) => ({
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
        visits: Number(row.visits),
        uniqueUsers: Number(row.uniqueUsers),
      }))
      .reverse();
  }
}
