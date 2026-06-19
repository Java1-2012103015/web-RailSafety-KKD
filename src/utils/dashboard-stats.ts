import type { RoleQueryPermission } from "@prisma/client";
import { ROLES } from "../constants/roles";
import {
  normalizeAccidentKindCategories,
  rowMatchesAccidentKindCategories,
} from "../constants/accident-kind-category";
import { normalizeLocationScope, rowMatchesLocationScope } from "../constants/query-location-scope";

/** 엑셀 L열(사고 종류) 기준 — 대시보드 철도사고 차트 */
export const DASHBOARD_RAILWAY_ACCIDENT_KINDS = ["사고"] as const;

/** 엑셀 L열(사고 종류) 기준 — 대시보드 운행장애 차트 */
export const DASHBOARD_OPERATION_DISRUPTION_KINDS = ["장애(지연)", "장애(무정차)"] as const;

/** 엑셀 L열(사고 종류) 기준 — 공개 대시보드 준사고 집계 */
export const DASHBOARD_NEAR_MISS_KINDS = ["준사고"] as const;

/** 엑셀 I열(등록상태/단독상태) — 대시보드 집계 대상 */
export const DASHBOARD_REGISTRATION_STATUS = "단독";

const railwayAccidentKindSet = new Set<string>(DASHBOARD_RAILWAY_ACCIDENT_KINDS);
const operationDisruptionKindSet = new Set<string>(DASHBOARD_OPERATION_DISRUPTION_KINDS);
const nearMissKindSet = new Set<string>(DASHBOARD_NEAR_MISS_KINDS);

export type DashboardRow = {
  accidentAt: Date;
  lineName: string;
  accidentType: string;
  deaths?: number;
  injuries?: number;
  detail: {
    registrationAgency: string | null;
    registrationStatus: string | null;
    accidentKind: string | null;
    railwayDivision?: string | null;
    seriousInjuries?: number | null;
    stationA?: string | null;
    stationB?: string | null;
    baseStation?: string | null;
    occurrencePlace?: string | null;
  } | null;
};

export type DashboardDetailRow = {
  year: number;
  month: number;
  agency: string;
  railCategory: string | null;
  deaths: number;
  seriousInjuries: number;
  isAccident: boolean;
  isDisruption: boolean;
};

export type DashboardFilterOptions = {
  agencies: string[];
  railCategories: string[];
};

export function isDisruption(row: DashboardRow): boolean {
  const kind = (row.detail?.accidentKind ?? "").trim();
  return operationDisruptionKindSet.has(kind);
}

export function isRailwayAccident(row: DashboardRow): boolean {
  const kind = (row.detail?.accidentKind ?? "").trim();
  return railwayAccidentKindSet.has(kind);
}

export function isNearMiss(row: DashboardRow): boolean {
  const kind = (row.detail?.accidentKind ?? "").trim();
  return nearMissKindSet.has(kind);
}

export function isDashboardTargetRow(row: DashboardRow): boolean {
  return (row.detail?.registrationStatus ?? "").trim() === DASHBOARD_REGISTRATION_STATUS;
}

export function filterDashboardTargetRows(rows: DashboardRow[]): DashboardRow[] {
  return rows.filter(isDashboardTargetRow);
}

export type AgencyCount = { agency: string; count: number };

function resolveRegistrationAgency(row: DashboardRow): string {
  return row.detail?.registrationAgency?.trim() || "미등록";
}

function incrementAgencyCount(map: Map<string, number>, agency: string): void {
  map.set(agency, (map.get(agency) ?? 0) + 1);
}

function mapToAgencyCounts(map: Map<string, number>): AgencyCount[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([agency, count]) => ({ agency, count }));
}

function getOrCreateNestedMap(parent: Map<number, Map<string, number>>, key: number): Map<string, number> {
  let nested = parent.get(key);
  if (!nested) {
    nested = new Map<string, number>();
    parent.set(key, nested);
  }
  return nested;
}

/** 당해를 제외한 직전 5개년 (예: 2026년 기준 → 2021~2025) */
export function getRecent5Years(calendarYear = new Date().getFullYear()): number[] {
  return Array.from({ length: 5 }, (_v, i) => calendarYear - 5 + i);
}

export function getLastDisplayYear(calendarYear = new Date().getFullYear()): number {
  return calendarYear - 1;
}

export type YearStatusMetric = {
  cumulativeTotal: number;
  prevMonthCount: number;
  prevMonth: number;
  prevMonthYear: number;
  prevMonthLabel: string;
};

export type YearStatusSummary = {
  year: number;
  currentMonth: number;
  accidents: YearStatusMetric;
  disruptions: YearStatusMetric;
};

function countRowsInMonth(
  rows: DashboardRow[],
  year: number,
  month: number,
  kind: "accident" | "disruption",
): number {
  return rows.filter((row) => {
    const y = row.accidentAt.getFullYear();
    const m = row.accidentAt.getMonth() + 1;
    if (y !== year || m !== month) return false;
    return kind === "accident" ? isRailwayAccident(row) : isDisruption(row);
  }).length;
}

function countRowsInYearThroughMonth(
  rows: DashboardRow[],
  year: number,
  throughMonth: number,
  kind: "accident" | "disruption",
): number {
  return rows.filter((row) => {
    const y = row.accidentAt.getFullYear();
    const m = row.accidentAt.getMonth() + 1;
    if (y !== year || m > throughMonth) return false;
    return kind === "accident" ? isRailwayAccident(row) : isDisruption(row);
  }).length;
}

function buildYearStatusMetric(
  rows: DashboardRow[],
  year: number,
  currentMonth: number,
  prevMonthYear: number,
  prevMonth: number,
  kind: "accident" | "disruption",
): YearStatusMetric {
  return {
    cumulativeTotal: countRowsInYearThroughMonth(rows, year, currentMonth, kind),
    prevMonthCount: countRowsInMonth(rows, prevMonthYear, prevMonth, kind),
    prevMonth,
    prevMonthYear,
    prevMonthLabel: `${prevMonthYear}년 ${prevMonth}월`,
  };
}

/** 당해 연도 장애·사고 현황 (DB 기준 누적 총계·직전월 발생 건수) */
export function computeYearStatusSummary(
  rows: DashboardRow[],
  referenceDate: Date = new Date(),
): YearStatusSummary {
  const year = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  const prevDate = new Date(year, referenceDate.getMonth() - 1, 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevMonthYear = prevDate.getFullYear();

  return {
    year,
    currentMonth,
    accidents: buildYearStatusMetric(rows, year, currentMonth, prevMonthYear, prevMonth, "accident"),
    disruptions: buildYearStatusMetric(rows, year, currentMonth, prevMonthYear, prevMonth, "disruption"),
  };
}

export function computeTrendStats(
  rows: DashboardRow[],
  calendarYear = new Date().getFullYear(),
  monthlyYear: number = calendarYear,
) {
  const recentYears = getRecent5Years(calendarYear);
  const yearlyAccidentMap = new Map<number, number>();
  const yearlyDisruptionMap = new Map<number, number>();
  const yearlyAccidentAgencyMap = new Map<number, Map<string, number>>();
  const yearlyDisruptionAgencyMap = new Map<number, Map<string, number>>();
  const monthlyAccidentMap = new Map<number, number>();
  const monthlyDisruptionMap = new Map<number, number>();
  const monthlyAccidentAgencyMap = new Map<number, Map<string, number>>();
  const monthlyDisruptionAgencyMap = new Map<number, Map<string, number>>();

  for (const row of rows) {
    const year = row.accidentAt.getFullYear();
    const month = row.accidentAt.getMonth() + 1;
    const agency = resolveRegistrationAgency(row);

    if (isRailwayAccident(row)) {
      yearlyAccidentMap.set(year, (yearlyAccidentMap.get(year) ?? 0) + 1);
      incrementAgencyCount(getOrCreateNestedMap(yearlyAccidentAgencyMap, year), agency);
    }
    if (isDisruption(row)) {
      yearlyDisruptionMap.set(year, (yearlyDisruptionMap.get(year) ?? 0) + 1);
      incrementAgencyCount(getOrCreateNestedMap(yearlyDisruptionAgencyMap, year), agency);
    }

    if (year === monthlyYear) {
      if (isRailwayAccident(row)) {
        monthlyAccidentMap.set(month, (monthlyAccidentMap.get(month) ?? 0) + 1);
        incrementAgencyCount(getOrCreateNestedMap(monthlyAccidentAgencyMap, month), agency);
      }
      if (isDisruption(row)) {
        monthlyDisruptionMap.set(month, (monthlyDisruptionMap.get(month) ?? 0) + 1);
        incrementAgencyCount(getOrCreateNestedMap(monthlyDisruptionAgencyMap, month), agency);
      }
    }
  }

  return {
    recent5Accidents: recentYears.map((year) => ({
      year,
      count: yearlyAccidentMap.get(year) ?? 0,
      byAgency: mapToAgencyCounts(yearlyAccidentAgencyMap.get(year) ?? new Map()),
    })),
    recent5Disruptions: recentYears.map((year) => ({
      year,
      count: yearlyDisruptionMap.get(year) ?? 0,
      byAgency: mapToAgencyCounts(yearlyDisruptionAgencyMap.get(year) ?? new Map()),
    })),
    monthlyCurrentYear: Array.from({ length: 12 }, (_v, i) => {
      const month = i + 1;
      return {
        month,
        accidents: monthlyAccidentMap.get(month) ?? 0,
        disruptions: monthlyDisruptionMap.get(month) ?? 0,
        accidentsByAgency: mapToAgencyCounts(monthlyAccidentAgencyMap.get(month) ?? new Map()),
        disruptionsByAgency: mapToAgencyCounts(monthlyDisruptionAgencyMap.get(month) ?? new Map()),
      };
    }),
  };
}

export function filterRowsByQueryPermission(
  rows: DashboardRow[],
  role: string,
  queryPermission: RoleQueryPermission | null,
): DashboardRow[] {
  if (role === ROLES.ADMIN) return rows;
  if (!queryPermission) return rows;

  let filtered = rows;

  if (queryPermission.minAccidentAt) {
    const min = new Date(queryPermission.minAccidentAt);
    filtered = filtered.filter((row) => row.accidentAt >= min);
  }

  if (queryPermission.maxAccidentAt) {
    const max = new Date(queryPermission.maxAccidentAt);
    filtered = filtered.filter((row) => row.accidentAt <= max);
  }

  if (queryPermission.enforcedLineName) {
    filtered = filtered.filter((row) => row.lineName === queryPermission.enforcedLineName);
  } else {
    const locationScope = normalizeLocationScope(queryPermission.allowedLocationScope);
    if (!locationScope.length) {
      const allowedLineNames = Array.isArray(queryPermission.allowedLineNames)
        ? (queryPermission.allowedLineNames as string[])
        : undefined;
      if (allowedLineNames?.length) {
        filtered = filtered.filter((row) => allowedLineNames.includes(row.lineName));
      }
    }
  }

  const allowedCategories = normalizeAccidentKindCategories(queryPermission.allowedTypes);
  if (allowedCategories.length) {
    filtered = filtered.filter((row) =>
      rowMatchesAccidentKindCategories(row.detail?.accidentKind, allowedCategories),
    );
  }

  const locationScope = normalizeLocationScope(queryPermission.allowedLocationScope);
  if (locationScope.length) {
    filtered = filtered.filter((row) => rowMatchesLocationScope(row, locationScope));
  }

  return filtered;
}

export function buildDashboardDetailRows(rows: DashboardRow[]): DashboardDetailRow[] {
  return rows.map((row) => ({
    year: row.accidentAt.getFullYear(),
    month: row.accidentAt.getMonth() + 1,
    agency: resolveRegistrationAgency(row),
    railCategory: row.detail?.railwayDivision?.trim() || null,
    deaths: row.deaths ?? 0,
    seriousInjuries: row.detail?.seriousInjuries ?? row.injuries ?? 0,
    isAccident: isRailwayAccident(row),
    isDisruption: isDisruption(row),
  }));
}

export function extractDashboardFilterOptions(detailRows: DashboardDetailRow[]): DashboardFilterOptions {
  const agencies = [...new Set(detailRows.map((row) => row.agency))].sort((a, b) => a.localeCompare(b, "ko"));
  const railCategories = [
    ...new Set(
      detailRows
        .map((row) => row.railCategory)
        .filter((value): value is string => Boolean(value?.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b, "ko"));
  return { agencies, railCategories };
}
