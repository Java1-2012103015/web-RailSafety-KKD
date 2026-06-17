import { prisma } from "../config/prisma";
import type { FloodAlertInput } from "../utils/flood-alert-csv";
import { toRowData } from "../utils/flood-alert-csv";

export class FloodAlertRepository {
  count() {
    return prisma.floodAlertRecord.count();
  }

  findAll() {
    return prisma.floodAlertRecord.findMany({
      orderBy: [{ accidentAt: "desc" }, { accidentNumber: "asc" }],
    });
  }

  findMany(query: { search?: string; page: number; pageSize: number }) {
    const where = query.search
      ? {
          OR: [
            { accidentNumber: { contains: query.search } },
            { agencyName: { contains: query.search } },
            { lineName: { contains: query.search } },
            { siteName: { contains: query.search } },
            { location: { contains: query.search } },
          ],
        }
      : undefined;

    return Promise.all([
      prisma.floodAlertRecord.findMany({
        where,
        orderBy: [{ accidentAt: "desc" }, { accidentNumber: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.floodAlertRecord.count({ where }),
    ]);
  }

  findByAccidentNumbers(accidentNumbers: string[]) {
    if (!accidentNumbers.length) return Promise.resolve([]);
    return prisma.floodAlertRecord.findMany({
      where: { accidentNumber: { in: accidentNumbers } },
      select: { accidentNumber: true },
    });
  }

  async upsertMany(rows: FloodAlertInput[]) {
    const accidentNumbers = rows.map((row) => row.accidentNumber);
    const existing = await this.findByAccidentNumbers(accidentNumbers);
    const existingSet = new Set(existing.map((row) => row.accidentNumber));

    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(
      rows.map((row) => {
        const isUpdate = existingSet.has(row.accidentNumber);
        if (isUpdate) updatedCount += 1;
        else createdCount += 1;

        return prisma.floodAlertRecord.upsert({
          where: { accidentNumber: row.accidentNumber },
          update: toRowData(row),
          create: toRowData(row),
        });
      }),
    );

    return {
      processedCount: rows.length,
      createdCount,
      updatedCount,
    };
  }

  async seedDefaultsIfEmpty(rows: FloodAlertInput[]) {
    const count = await this.count();
    if (count > 0) return;
    await prisma.floodAlertRecord.createMany({ data: rows.map((row) => toRowData(row)) });
  }

  getSettings() {
    return prisma.floodAlertSetting.findUnique({ where: { id: 1 } });
  }

  upsertSettings(newsKeywords: string[]) {
    return prisma.floodAlertSetting.upsert({
      where: { id: 1 },
      update: { newsKeywords },
      create: { id: 1, newsKeywords },
    });
  }

  deleteByIds(ids: number[]) {
    if (!ids.length) return Promise.resolve({ count: 0 });
    return prisma.floodAlertRecord.deleteMany({
      where: { id: { in: ids } },
    });
  }
}
