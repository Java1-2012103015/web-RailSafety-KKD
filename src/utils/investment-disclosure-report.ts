import type { DisclosureRecord } from "./investment-disclosure-analytics";
import {
  buildDashboardAnalytics,
  computeStats,
  getTotalPlanYears,
} from "./investment-disclosure-analytics";

export interface ReportTableRow {
  category1: string;
  category2: string;
  category3: string;
  amounts: Record<number, number>;
}

export interface ReportSection {
  index: number;
  title: string;
  sortAmount: number;
  rows: ReportTableRow[];
  summary: {
    totalPlan: number;
    totalPlanYearLabel: string;
    executionRate: number;
    selfRelianceRate: number;
  };
  dashboard: ReturnType<typeof buildDashboardAnalytics>;
}

export interface InvestmentDisclosureReport {
  disclosureYear: number;
  generatedAt: string;
  yearColumns: number[];
  dashboard: ReturnType<typeof buildDashboardAnalytics>;
  sections: ReportSection[];
}

const REPORT_YEAR_COLUMNS = [2023, 2024, 2025, 2026, 2027, 2028];

function rowKey(category1: string, category2: string, category3: string) {
  return `${category1}\0${category2}\0${category3}`;
}

function compareCategoryRows(a: ReportTableRow, b: ReportTableRow) {
  const keys = ["category1", "category2", "category3"] as const;
  for (const key of keys) {
    const cmp = a[key].localeCompare(b[key], "ko", { numeric: true });
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function pivotRows(records: DisclosureRecord[]): ReportTableRow[] {
  const map = new Map<string, ReportTableRow>();

  for (const record of records) {
    const key = rowKey(record.category1, record.category2, record.category3);
    let row = map.get(key);
    if (!row) {
      row = {
        category1: record.category1,
        category2: record.category2,
        category3: record.category3,
        amounts: {},
      };
      map.set(key, row);
    }
    row.amounts[record.yearLabel] =
      (row.amounts[record.yearLabel] ?? 0) + (record.amountMillion || 0);
  }

  return Array.from(map.values()).sort(compareCategoryRows);
}

function getAgencySortAmount(records: DisclosureRecord[], disclosureYear: number): number {
  const planYears = getTotalPlanYears(disclosureYear);
  const planSubtotals = records.filter(
    (d) => d.category2.includes("계획") && d.category3.includes("소계") && planYears.includes(d.yearLabel),
  );
  const totalRows = planSubtotals.filter((d) => d.category1.includes("합계"));
  const source = totalRows.length > 0 ? totalRows : planSubtotals;
  return source.reduce((sum, row) => sum + (row.amountMillion || 0), 0);
}

function buildSection(
  index: number,
  title: string,
  records: DisclosureRecord[],
  disclosureYear: number,
  sortAmount: number,
): ReportSection {
  const stats = computeStats(records, disclosureYear);
  return {
    index,
    title,
    sortAmount,
    rows: pivotRows(records),
    summary: {
      totalPlan: stats.totalPlan,
      totalPlanYearLabel: stats.totalPlanYearLabel,
      executionRate: stats.executionRate,
      selfRelianceRate: stats.selfRelianceRate,
    },
    dashboard: buildDashboardAnalytics(records, {}),
  };
}

export function buildInvestmentDisclosureReport(
  all: DisclosureRecord[],
  disclosureYear?: number,
): InvestmentDisclosureReport {
  const resolvedYear =
    disclosureYear ??
    (all.length > 0 ? Math.max(...all.map((row) => row.disclosureYear)) : new Date().getFullYear());

  const yearRecords = all.filter((row) => row.disclosureYear === resolvedYear);
  const source = yearRecords.length > 0 ? yearRecords : all;

  const agencyNames = Array.from(new Set(source.map((row) => row.agencyName)));
  const agencySections = agencyNames
    .map((agencyName) => {
      const agencyRecords = source.filter((row) => row.agencyName === agencyName);
      return {
        agencyName,
        records: agencyRecords,
        sortAmount: getAgencySortAmount(agencyRecords, resolvedYear),
      };
    })
    .sort((a, b) => b.sortAmount - a.sortAmount);

  const sections: ReportSection[] = [
    buildSection(1, "전체기관", source, resolvedYear, getAgencySortAmount(source, resolvedYear)),
    ...agencySections.map((agency, idx) =>
      buildSection(idx + 2, agency.agencyName, agency.records, resolvedYear, agency.sortAmount),
    ),
  ];

  return {
    disclosureYear: resolvedYear,
    generatedAt: new Date().toISOString(),
    yearColumns: REPORT_YEAR_COLUMNS,
    dashboard: buildDashboardAnalytics(source, {}),
    sections,
  };
}
