import { AccidentRepository } from "../repositories/accident.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { ROLES } from "../constants/roles";
import {
  buildDashboardDetailRows,
  computeYearStatusSummary,
  computeTrendStats,
  extractDashboardFilterOptions,
  filterDashboardTargetRows,
  filterRowsByQueryPermission,
  getLastDisplayYear,
  getRecent5Years,
  isDisruption,
  isNearMiss,
  isRailwayAccident,
  type DashboardRow,
} from "../utils/dashboard-stats";
import { buildQueryScopeSummary } from "../utils/query-scope-summary";

export class DashboardService {
  constructor(
    private readonly accidentRepository: AccidentRepository,
    private readonly permissionRepository: PermissionRepository,
  ) {}

  async getStats() {
    const rawRows = await this.accidentRepository.findAllForDashboard();
    const rows = filterDashboardTargetRows(rawRows);
    return this.buildLegacyStats(rows);
  }

  /** 비로그인 포털 대시보드 — 전체기관 통계 (당해 연도 월별 포함) */
  async getGuestPortalStats() {
    const rawRows = await this.accidentRepository.findAllForDashboard();
    const rows = filterDashboardTargetRows(rawRows);
    const currentYear = new Date().getFullYear();
    const allStats = computeTrendStats(rows, currentYear);
    const detailRows = buildDashboardDetailRows(rows);

    return {
      updatedAt: new Date().toISOString(),
      currentYear,
      recentYears: getRecent5Years(currentYear),
      guest: true,
      yearStatusSummary: computeYearStatusSummary(rows),
      filterOptions: extractDashboardFilterOptions(detailRows),
      detailRows,
      allDetailRows: detailRows,
      all: {
        recent5Accidents: allStats.recent5Accidents,
        recent5Disruptions: allStats.recent5Disruptions,
        monthlyCurrentYear: allStats.monthlyCurrentYear,
      },
      scoped: {
        recent5Accidents: allStats.recent5Accidents,
        recent5Disruptions: allStats.recent5Disruptions,
        monthlyCurrentYear: allStats.monthlyCurrentYear,
      },
    };
  }

  async getPortalStats(auth: { roleId: number; role: string }) {
    const rawRows = await this.accidentRepository.findAllForDashboard();
    const rows = filterDashboardTargetRows(rawRows);
    const currentYear = new Date().getFullYear();
    const allStats = computeTrendStats(rows, currentYear);

    let scopedRows = rows;
    let queryScopeSummary = null;
    if (auth.role !== ROLES.ADMIN) {
      const queryPermission = await this.permissionRepository.findRoleQueryPermission(auth.roleId);
      scopedRows = filterRowsByQueryPermission(rows, auth.role, queryPermission);
      queryScopeSummary = buildQueryScopeSummary(auth.role, queryPermission);
    }

    const scopedStats = computeTrendStats(scopedRows, currentYear);
    const detailRows = buildDashboardDetailRows(scopedRows);
    const allDetailRows = buildDashboardDetailRows(rows);

    return {
      updatedAt: new Date().toISOString(),
      currentYear,
      recentYears: getRecent5Years(currentYear),
      yearStatusSummary: computeYearStatusSummary(scopedRows),
      queryScopeSummary,
      filterOptions: extractDashboardFilterOptions(detailRows),
      detailRows,
      allDetailRows,
      all: {
        recent5Accidents: allStats.recent5Accidents,
        recent5Disruptions: allStats.recent5Disruptions,
        monthlyCurrentYear: allStats.monthlyCurrentYear,
      },
      scoped: {
        recent5Accidents: scopedStats.recent5Accidents,
        recent5Disruptions: scopedStats.recent5Disruptions,
        monthlyCurrentYear: scopedStats.monthlyCurrentYear,
      },
    };
  }

  private buildLegacyStats(rows: DashboardRow[]) {
    const calendarYear = new Date().getFullYear();
    const throughYear = getLastDisplayYear(calendarYear);
    const chartRows = rows.filter((row) => row.accidentAt.getFullYear() <= throughYear);
    const recentYears = getRecent5Years(calendarYear);
    const recentYearSet = new Set(recentYears);

    const inferAgency = (lineName: string, registrationAgency?: string | null): string => {
      if (registrationAgency?.trim()) return registrationAgency.trim();
      if (lineName.includes("8호선") || lineName.includes("도시")) return "서울교통공사";
      if (lineName.includes("공항")) return "공항철도";
      if (lineName.includes("고속")) return "국가철도공단";
      return "한국철도공사";
    };

    const yearlyAccidentMap = new Map<number, number>();
    const yearlyDisruptionMap = new Map<number, number>();
    const agencyMap = new Map<string, number>();
    let recent5Accidents = 0;
    let recent5Disruptions = 0;
    let recent5NearMisses = 0;

    for (const row of chartRows) {
      const year = row.accidentAt.getFullYear();
      if (isRailwayAccident(row)) {
        yearlyAccidentMap.set(year, (yearlyAccidentMap.get(year) ?? 0) + 1);
      }
      if (isDisruption(row)) {
        yearlyDisruptionMap.set(year, (yearlyDisruptionMap.get(year) ?? 0) + 1);
      }

      const agency = inferAgency(row.lineName, row.detail?.registrationAgency);
      agencyMap.set(agency, (agencyMap.get(agency) ?? 0) + 1);

      if (recentYearSet.has(year)) {
        if (isRailwayAccident(row)) recent5Accidents += 1;
        if (isDisruption(row)) recent5Disruptions += 1;
        if (isNearMiss(row)) recent5NearMisses += 1;
      }
    }

    const recent5 = recentYears.map((year) => ({
      year,
      accidents: yearlyAccidentMap.get(year) ?? 0,
      disruptions: yearlyDisruptionMap.get(year) ?? 0,
    }));

    const yearlyAccidents = Array.from(yearlyAccidentMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count }));

    const yearlyDisruptions = Array.from(yearlyDisruptionMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count }));

    const byAgency = Array.from(agencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([agency, count]) => ({ agency, count }));

    return {
      summary: {
        recent5YearAccidents: recent5Accidents,
        recent5YearDisruptions: recent5Disruptions,
        recent5YearNearMisses: recent5NearMisses,
        updatedAt: new Date().toISOString(),
      },
      yearStatusSummary: computeYearStatusSummary(rows),
      recent5,
      yearlyAccidents,
      yearlyDisruptions,
      byAgency,
    };
  }
}
