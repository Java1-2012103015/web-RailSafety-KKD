import { prisma } from "../config/prisma";
import type { InvestmentDisclosureInput } from "../utils/investment-disclosure-csv";

export class InvestmentDisclosureRepository {
  async count(): Promise<number> {
    return prisma.investmentDisclosureRecord.count();
  }

  async findAll(): Promise<
    Array<{
      id: number;
      agencyName: string;
      disclosureYear: number;
      category1: string;
      category2: string;
      category3: string;
      yearLabel: number;
      amountMillion: number;
    }>
  > {
    return prisma.investmentDisclosureRecord.findMany({
      orderBy: [{ agencyName: "asc" }, { category1: "asc" }, { yearLabel: "asc" }],
    });
  }

  async replaceAll(rows: InvestmentDisclosureInput[]): Promise<number> {
    await prisma.$transaction([
      prisma.investmentDisclosureRecord.deleteMany(),
      prisma.investmentDisclosureRecord.createMany({
        data: rows.map((r) => ({
          agencyName: r.agencyName,
          disclosureYear: r.disclosureYear,
          category1: r.category1,
          category2: r.category2,
          category3: r.category3,
          yearLabel: r.yearLabel,
          amountMillion: r.amountMillion,
        })),
      }),
    ]);
    return rows.length;
  }

  async seedDefaultsIfEmpty(rows: InvestmentDisclosureInput[]): Promise<boolean> {
    const existing = await this.count();
    if (existing > 0) return false;
    await this.replaceAll(rows);
    return true;
  }
}
