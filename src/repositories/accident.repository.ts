import type { AccidentType, Prisma, RailwayAccident } from "@prisma/client";
import { prisma } from "../config/prisma";
import type { AccidentKindCategory } from "../constants/accident-kind-category";
import { buildAccidentKindCategoryWhere } from "../constants/accident-kind-category";
import {
  buildLocationScopeWhere,
  buildRegistrationAgencyWhere,
  type LocationScopeRule,
} from "../constants/query-location-scope";
import { inferRailCategoryFromLineName } from "../utils/rail-category";
export interface AccidentSearchQuery {
  startDate?: Date;
  endDate?: Date;
  lineNames?: string[];
  accidentTypes?: AccidentType[];
  accidentKindCategories?: AccidentKindCategory[];
  accidentKinds?: string[];
  locationScope?: LocationScopeRule[];
  registrationAgency?: string;
  page: number;
  pageSize: number;
}

export interface BulkAccidentRecord {
  base: {
    accidentAt: Date;
    location: string;
    lineName: string;
    accidentType: AccidentType;
    cause: string;
    damageScale: string;
    deaths: number;
    injuries: number;
    trainCount?: number | null;
    weather?: string | null;
  };
  detail: Record<string, unknown>;
}

export type RegistrationAgencyLine = {
  registrationAgency: string | null;
  lineName: string;
};

export type AccidentSearchFilters = Omit<AccidentSearchQuery, "page" | "pageSize">;

function buildAccidentSearchWhere(query: AccidentSearchFilters): Prisma.RailwayAccidentWhereInput {
  const where: Prisma.RailwayAccidentWhereInput = {};

  if (query.startDate || query.endDate) {
    where.accidentAt = {};
    if (query.startDate) {
      where.accidentAt.gte = query.startDate;
    }
    if (query.endDate) {
      where.accidentAt.lte = query.endDate;
    }
  }

  if (query.lineNames && query.lineNames.length > 0) {
    where.lineName = { in: query.lineNames };
  }

  if (query.accidentTypes && query.accidentTypes.length > 0) {
    where.accidentType = {
      in: query.accidentTypes,
    };
  }

  const accidentKindCategoryWhere = buildAccidentKindCategoryWhere(query.accidentKindCategories ?? []);
  if (query.accidentKinds?.length) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { detail: { accidentKind: { in: query.accidentKinds } } },
    ];
  } else if (accidentKindCategoryWhere) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), accidentKindCategoryWhere];
  }

  const registrationAgencyWhere = buildRegistrationAgencyWhere(query.registrationAgency ?? "");
  if (registrationAgencyWhere) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      registrationAgencyWhere,
    ];
  }

  const locationScopeWhere = buildLocationScopeWhere(query.locationScope ?? []);
  if (locationScopeWhere) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), locationScopeWhere];
  }

  return where;
}

export class AccidentRepository {
  async findById(id: number): Promise<RailwayAccident | null> {
    return prisma.railwayAccident.findUnique({
      where: { id },
      include: { detail: true },
    });
  }

  async findMany(query: AccidentSearchQuery): Promise<{ items: RailwayAccident[]; total: number }> {
    const where = buildAccidentSearchWhere(query);

    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const [items, total] = await Promise.all([
      prisma.railwayAccident.findMany({
        where,
        orderBy: { accidentAt: "desc" },
        skip,
        take,
        include: {
          detail: true,
        },
      }),
      prisma.railwayAccident.count({ where }),
    ]);

    return { items, total };
  }

  async getDashboardStats(): Promise<{
    total: number;
    deaths: number;
    injuries: number;
    byType: { type: string; count: number }[];
    byLine: { lineName: string; count: number }[];
  }> {
    const [total, deathsAgg, injuriesAgg, byType, accidents] = await Promise.all([
      prisma.railwayAccident.count(),
      prisma.railwayAccident.aggregate({ _sum: { deaths: true } }),
      prisma.railwayAccident.aggregate({ _sum: { injuries: true } }),
      prisma.railwayAccident.groupBy({
        by: ["accidentType"],
        _count: { accidentType: true },
      }),
      prisma.railwayAccident.findMany({
        select: { lineName: true },
      }),
    ]);

    const lineMap = new Map<string, number>();
    for (const row of accidents) {
      lineMap.set(row.lineName, (lineMap.get(row.lineName) ?? 0) + 1);
    }

    const byLine = Array.from(lineMap.entries())
      .map(([lineName, count]) => ({ lineName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      deaths: deathsAgg._sum.deaths ?? 0,
      injuries: injuriesAgg._sum.injuries ?? 0,
      byType: byType.map((row) => ({
        type: row.accidentType,
        count: row._count.accidentType,
      })),
      byLine,
    };
  }

  async findRecentPublic(limit = 10): Promise<
    Pick<RailwayAccident, "accidentAt" | "lineName" | "accidentType" | "location" | "deaths" | "injuries">[]
  > {
    return prisma.railwayAccident.findMany({
      orderBy: { accidentAt: "desc" },
      take: limit,
      select: {
        accidentAt: true,
        lineName: true,
        accidentType: true,
        location: true,
        deaths: true,
        injuries: true,
      },
    });
  }

  async findDistinctRegistrationAgencies(): Promise<string[]> {
    const rows = await prisma.accidentDetail.findMany({
      where: { registrationAgency: { not: null } },
      select: { registrationAgency: true },
      distinct: ["registrationAgency"],
      orderBy: { registrationAgency: "asc" },
    });

    return rows
      .map((row) => row.registrationAgency?.trim())
      .filter((value): value is string => Boolean(value));
  }

  async findDistinctLineNames(query: AccidentSearchFilters = {}): Promise<string[]> {
    const where = buildAccidentSearchWhere(query);
    if (!where.lineName) {
      where.lineName = { not: "" };
    }

    const rows = await prisma.railwayAccident.findMany({
      where,
      distinct: ["lineName"],
      select: { lineName: true },
      orderBy: { lineName: "asc" },
    });

    return rows
      .map((row) => row.lineName.trim())
      .filter((value): value is string => Boolean(value));
  }

  async findDistinctRailCategories(query: AccidentSearchFilters = {}): Promise<string[]> {
    const baseWhere = buildAccidentSearchWhere(query);
    const categories = new Set<string>();

    const explicitRows = await prisma.accidentDetail.findMany({
      where: {
        accident: baseWhere,
        AND: [{ railwayDivision: { not: null } }, { railwayDivision: { not: "" } }],
      },
      distinct: ["railwayDivision"],
      select: { railwayDivision: true },
      orderBy: { railwayDivision: "asc" },
    });

    for (const row of explicitRows) {
      const value = row.railwayDivision?.trim();
      if (value) categories.add(value);
    }

    const implicitLines = await prisma.railwayAccident.findMany({
      where: {
        AND: [
          baseWhere,
          {
            OR: [
              { detail: null },
              { detail: { railwayDivision: null } },
              { detail: { railwayDivision: "" } },
            ],
          },
        ],
      },
      distinct: ["lineName"],
      select: { lineName: true },
    });

    for (const row of implicitLines) {
      categories.add(inferRailCategoryFromLineName(row.lineName));
    }

    return [...categories].sort((a, b) => a.localeCompare(b, "ko"));
  }

  async findDistinctRegistrationAgencyLines(): Promise<RegistrationAgencyLine[]> {
    const rows = await prisma.$queryRaw<Array<{ registrationAgency: string | null; lineName: string }>>`
      SELECT DISTINCT
        NULLIF(TRIM(d.registrationAgency), '') AS registrationAgency,
        TRIM(a.lineName) AS lineName
      FROM RailwayAccident a
      LEFT JOIN AccidentDetail d ON d.accidentId = a.id
      WHERE a.lineName IS NOT NULL AND TRIM(a.lineName) != ''
      ORDER BY registrationAgency, lineName
    `;

    return rows.map((row) => ({
      registrationAgency: row.registrationAgency?.trim() || null,
      lineName: row.lineName.trim(),
    }));
  }

  async findAllForDashboard(): Promise<
    Array<{
      accidentAt: Date;
      lineName: string;
      accidentType: AccidentType;
      deaths: number;
      injuries: number;
      detail: {
        registrationAgency: string | null;
        registrationStatus: string | null;
        accidentKind: string | null;
        railwayDivision: string | null;
        seriousInjuries: number | null;
        stationA: string | null;
        stationB: string | null;
        baseStation: string | null;
        occurrencePlace: string | null;
      } | null;
    }>
  > {
    return prisma.railwayAccident.findMany({
      select: {
        accidentAt: true,
        lineName: true,
        accidentType: true,
        deaths: true,
        injuries: true,
        detail: {
          select: {
            registrationAgency: true,
            registrationStatus: true,
            accidentKind: true,
            railwayDivision: true,
            seriousInjuries: true,
            stationA: true,
            stationB: true,
            baseStation: true,
            occurrencePlace: true,
          },
        },
      },
      orderBy: { accidentAt: "asc" },
    });
  }

  async upsertBulk(records: BulkAccidentRecord[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const record of records) {
      await prisma.$transaction(async (tx) => {
        const accidentNumber =
          typeof record.detail.accidentNumber === "string" ? record.detail.accidentNumber.trim() : "";
        const accidentNumberBackup =
          typeof record.detail.accidentNumberBackup === "string" ? record.detail.accidentNumberBackup.trim() : "";
        const detailInput = { ...record.detail };

        const lookupNumbers = [accidentNumber, accidentNumberBackup].filter(Boolean);
        if (lookupNumbers.length > 0) {
          const existing = await (tx as any).accidentDetail.findFirst({
            where: {
              OR: lookupNumbers.flatMap((num) => [{ accidentNumber: num }, { accidentNumberBackup: num }]),
            },
            select: { id: true, accidentId: true },
          });

          if (existing) {
            await tx.railwayAccident.update({
              where: { id: existing.accidentId },
              data: record.base,
            });
            await (tx as any).accidentDetail.update({
              where: { id: existing.id },
              data: {
                ...detailInput,
                accidentNumber: accidentNumber || null,
                accidentNumberBackup: accidentNumberBackup || null,
                lineName: record.base.lineName,
              },
            });
            updated += 1;
            return;
          }
        }

        const accident = await tx.railwayAccident.create({ data: record.base });
        await (tx as any).accidentDetail.create({
          data: {
            ...detailInput,
            accidentNumber: accidentNumber || null,
            accidentNumberBackup: accidentNumberBackup || null,
            lineName: record.base.lineName,
            accidentId: accident.id,
          },
        });
        created += 1;
      });
    }

    return { created, updated };
  }

  async deleteByIds(ids: number[]): Promise<number> {
    const result = await prisma.railwayAccident.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }
}
