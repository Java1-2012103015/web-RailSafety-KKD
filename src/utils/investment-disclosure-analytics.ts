export interface DisclosureRecord {
  agencyName: string;
  disclosureYear: number;
  category1: string;
  category2: string;
  category3: string;
  yearLabel: number;
  amountMillion: number;
}

export interface DisclosureFilters {
  agencies?: string[];
  category1?: string;
  search?: string;
  compareYear?: string;
}

function filterRows(all: DisclosureRecord[], filters: DisclosureFilters): DisclosureRecord[] {
  const agencySet =
    filters.agencies?.length && filters.agencies.length > 0 ? new Set(filters.agencies) : null;
  const category1 = filters.category1 && filters.category1 !== "ALL" ? filters.category1 : null;
  const search = filters.search?.trim().toLowerCase() ?? "";

  return all.filter((d) => {
    if (agencySet && !agencySet.has(d.agencyName)) return false;
    if (category1 && d.category1 !== category1) return false;
    if (search) {
      const hay = `${d.agencyName} ${d.category1} ${d.category2} ${d.category3}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

/** 당해~2년후(당해, 당해+1, 당해+2) 계획 연도 */
export function getTotalPlanYears(referenceYear = new Date().getFullYear()) {
  return [referenceYear, referenceYear + 1, referenceYear + 2];
}

export function formatTotalPlanYearLabel(years: number[]) {
  return years.map((y) => `${y}년`).join(" · ");
}

export function computeStats(filtered: DisclosureRecord[]) {
  const totalPlanYears = getTotalPlanYears();
  const planRows = filtered.filter(
    (d) =>
      d.category2.includes("계획") &&
      d.category3.includes("소계") &&
      totalPlanYears.includes(d.yearLabel),
  );
  const totalPlan = planRows.reduce((sum, row) => sum + (row.amountMillion || 0), 0);

  const baseYears = [2023, 2024, 2025];
  const historicalPlans = filtered.filter(
    (d) => d.category2.includes("계획") && d.category3.includes("소계") && baseYears.includes(d.yearLabel),
  );
  const historicalActuals = filtered.filter(
    (d) => d.category2.includes("실적") && d.category3.includes("소계") && baseYears.includes(d.yearLabel),
  );

  const planSumForRate = historicalPlans.reduce((sum, r) => sum + (r.amountMillion || 0), 0);
  const actualSumForRate = historicalActuals.reduce((sum, r) => sum + (r.amountMillion || 0), 0);
  const executionRate = planSumForRate > 0 ? (actualSumForRate / planSumForRate) * 100 : 0;

  const totalWithSources = filtered.filter((d) => d.category2.includes("계획"));
  const totalSourceSum = totalWithSources
    .filter((d) => d.category3.includes("소계"))
    .reduce((sum, r) => sum + (r.amountMillion || 0), 0);
  const selfSourceSum = totalWithSources
    .filter((d) => d.category3.includes("자체수입"))
    .reduce((sum, r) => sum + (r.amountMillion || 0), 0);
  const selfRelianceRate = totalSourceSum > 0 ? (selfSourceSum / totalSourceSum) * 100 : 0;

  let grade = "B";
  let gradeClass = "text-amber-700 bg-amber-50 border-amber-200";
  let gradeDesc =
    "철도 인프라의 안정성과 계획 이행도가 무난한 수준에서 지속 관리되고 있습니다.";

  if (executionRate >= 96 && selfRelianceRate >= 45) {
    grade = "S";
    gradeClass = "text-emerald-700 bg-emerald-50 border-emerald-200";
    gradeDesc =
      "자체 재정을 바탕으로 계획 대비 안전 실적을 완벽하게 투입하고 있는 신뢰도 안심 1등급 기관 연합입니다.";
  } else if (executionRate >= 90) {
    grade = "A";
    gradeClass = "text-sky-700 bg-sky-50 border-sky-200";
    gradeDesc = "공시된 실적 계획 대비 투자금 집행이 매우 투명하고 계획적으로 이행되고 있습니다.";
  } else if (executionRate < 80) {
    grade = "C";
    gradeClass = "text-rose-700 bg-rose-50 border-rose-200";
    gradeDesc =
      "의무 계획 대비 이행 실적이 다소 지연되거나 불투명한 미투자 영역이 발견되어 관계 기관의 점검이 요구됩니다.";
  }

  return {
    totalPlan,
    totalPlanYears,
    totalPlanYearLabel: formatTotalPlanYearLabel(totalPlanYears),
    executionRate,
    selfRelianceRate,
    grade,
    gradeClass,
    gradeDesc,
    actualSumForRate,
    planSumForRate,
  };
}

export function computeTrendChart(filtered: DisclosureRecord[]) {
  const years = [2023, 2024, 2025, 2026, 2027, 2028];
  return years.map((yr) => {
    const planSum = filtered
      .filter((d) => d.yearLabel === yr && d.category2.includes("계획") && d.category3.includes("소계"))
      .reduce((sum, r) => sum + (r.amountMillion || 0), 0);
    const actualSum = filtered
      .filter((d) => d.yearLabel === yr && d.category2.includes("실적") && d.category3.includes("소계"))
      .reduce((sum, r) => sum + (r.amountMillion || 0), 0);
    const point: { name: string; plan: number; actual?: number } = {
      name: `${yr}년`,
      plan: Math.round(planSum),
    };
    if (yr <= 2025) point.actual = Math.round(actualSum);
    return point;
  });
}

const FUNDING_RATIO_YEARS = [2023, 2024, 2025, 2026, 2027, 2028];

function computeFundingRatioForYear(filtered: DisclosureRecord[], year: number) {
  const totalPlans = filtered.filter((d) => d.category2.includes("계획") && d.yearLabel === year);
  const national = totalPlans.filter((d) => d.category3.includes("국비")).reduce((s, r) => s + (r.amountMillion || 0), 0);
  const local = totalPlans.filter((d) => d.category3.includes("지방비")).reduce((s, r) => s + (r.amountMillion || 0), 0);
  const self = totalPlans.filter((d) => d.category3.includes("자체수입")).reduce((s, r) => s + (r.amountMillion || 0), 0);
  const total = national + local + self;
  if (total === 0) return [];

  return [
    { name: "국비 (정부지원)", value: Math.round(national), percent: ((national / total) * 100).toFixed(1) },
    { name: "지방비 (지자체부담)", value: Math.round(local), percent: ((local / total) * 100).toFixed(1) },
    { name: "자체수입 (자재보조)", value: Math.round(self), percent: ((self / total) * 100).toFixed(1) },
  ];
}

export function computeFundingRatioByYear(filtered: DisclosureRecord[]) {
  const byYear: Record<string, ReturnType<typeof computeFundingRatioForYear>> = {};
  const yearsWithData: number[] = [];

  for (const year of FUNDING_RATIO_YEARS) {
    const ratio = computeFundingRatioForYear(filtered, year);
    byYear[String(year)] = ratio;
    if (ratio.some((item) => item.value > 0)) {
      yearsWithData.push(year);
    }
  }

  const years = FUNDING_RATIO_YEARS.map((year) => ({
    value: year,
    label: `${year}년`,
  }));

  const defaultYear = yearsWithData.length > 0 ? yearsWithData[yearsWithData.length - 1] : 2026;

  return { years, defaultYear, byYear };
}

const CATEGORY_TREND_YEARS = [2023, 2024, 2025, 2026, 2027, 2028];

function isDetailPlanSubtotal(row: DisclosureRecord) {
  return row.category2.includes("계획") && row.category3.includes("소계") && !row.category1.includes("합계");
}

export function computeCategoryYearTrend(filtered: DisclosureRecord[]) {
  const categoryKeys = Array.from(
    new Set(filtered.filter(isDetailPlanSubtotal).map((d) => d.category1)),
  ).sort((a, b) => a.localeCompare(b, "ko"));

  const categories = [
    { value: "ALL", label: "전체" },
    ...categoryKeys.map((key) => ({
      value: key,
      label: key.replace(/^\d+\.\s*/, ""),
    })),
  ];

  const buildSeries = (categoryFilter: "ALL" | string) =>
    CATEGORY_TREND_YEARS.map((yr) => {
      const amount = filtered
        .filter((d) => {
          if (!isDetailPlanSubtotal(d) || d.yearLabel !== yr) return false;
          if (categoryFilter === "ALL") return true;
          return d.category1 === categoryFilter;
        })
        .reduce((sum, r) => sum + (r.amountMillion || 0), 0);
      return { year: yr, label: `${yr}년`, amount: Math.round(amount) };
    });

  const seriesByCategory: Record<string, ReturnType<typeof buildSeries>> = {
    ALL: buildSeries("ALL"),
  };
  for (const key of categoryKeys) {
    seriesByCategory[key] = buildSeries(key);
  }

  return { categories, seriesByCategory };
}

export function computeAgencyCompare(
  all: DisclosureRecord[],
  compareYear?: string,
  agenciesFilter?: string[],
) {
  let agencies = Array.from(new Set(all.map((d) => d.agencyName)));
  if (agenciesFilter?.length) {
    const allowed = new Set(agenciesFilter);
    agencies = agencies.filter((name) => allowed.has(name));
  }
  const targetYears =
    !compareYear || compareYear === "ALL" ? [2023, 2024, 2025] : [parseInt(compareYear, 10)];

  return agencies
    .map((agency) => {
      const agencyRows = all.filter((d) => d.agencyName === agency && d.category3.includes("소계"));
      const planSum = agencyRows
        .filter((d) => d.category2.includes("계획") && targetYears.includes(d.yearLabel))
        .reduce((sum, r) => sum + (r.amountMillion || 0), 0);
      const actualSum = agencyRows
        .filter((d) => d.category2.includes("실적") && targetYears.includes(d.yearLabel))
        .reduce((sum, r) => sum + (r.amountMillion || 0), 0);
      const rate = planSum > 0 ? (actualSum / planSum) * 100 : 0;
      return {
        name: agency,
        rate: Math.round(rate * 10) / 10,
        planSum: Math.round(planSum),
        actualSum: Math.round(actualSum),
      };
    })
    .sort((a, b) => b.rate - a.rate);
}

export function buildInsightReport(
  filters: DisclosureFilters,
  stats: ReturnType<typeof computeStats>,
): string {
  const selectedText = !filters.agencies?.length
    ? "전국 주요 철도·도시철도 운영사 전체"
    : `${filters.agencies.join(", ")} 특별 분석군`;
  let body = `${selectedText}의 철도안전 투자 실적 및 계획 공시를 종합적으로 분석한 결과입니다. `;
  body += `누적 계획 예산 규모는 합계 ${Math.round(stats.totalPlan).toLocaleString()}백만원 수준이며, `;

  if (stats.executionRate > 0) {
    body += `실제 집행 실적 비교 검증이 가능한 최근 3개년(2023~2025)의 이행 정합 비율은 ${stats.executionRate.toFixed(1)}%로 포착되었습니다. `;
    if (stats.executionRate >= 92) {
      body += "이행률 수치가 우수하여 시설 노후화 극복 예산이 현장 개량 보수비로 누수 없이 정시에 투입되고 있는 유의미한 수치가 입증됩니다. ";
    } else {
      body += "국가 권고선(90%)보다 다소 낮게 머물러 있어, 실제 현장 안전 보수나 부품 적기 교체 일정이 계획 대비 다소 지연되었을 수 있으니 세부 점검이 권장됩니다. ";
    }
  }

  if (stats.selfRelianceRate > 0) {
    body += `또한, 계획 투자 재원 중 자체 수입을 통한 자립 안전 투자 비율은 ${stats.selfRelianceRate.toFixed(1)}%로 산출됩니다. `;
    if (stats.selfRelianceRate < 35) {
      body += "이는 지방재정 지원금이나 정부의 국비 매칭 의존도가 상대적으로 높음을 뜻하므로, 정부 재정 변동성에 취약할 수 있어 자립적인 예산 방어전략이 필요해 보입니다.";
    } else {
      body += "지속 가능한 자조 예산 비중을 보유하여 미래 예측 불가한 돌발 안전 상황이나 지능형 인프라 고도화 사업에 자력으로 유연하게 대처할 수 있는 체력이 튼튼합니다.";
    }
  }

  return body;
}

export function buildDashboardAnalytics(all: DisclosureRecord[], filters: DisclosureFilters) {
  const filtered = filterRows(all, filters);
  const stats = computeStats(filtered);
  return {
    filteredCount: filtered.length,
    stats,
    trendChart: computeTrendChart(filtered),
    fundingRatioByYear: computeFundingRatioByYear(filtered),
    categoryYearTrend: computeCategoryYearTrend(filtered),
    agencyCompare: computeAgencyCompare(all, filters.compareYear, filters.agencies),
    insightReport: buildInsightReport(filters, stats),
  };
}

export function paginateRecords(
  records: DisclosureRecord[],
  page: number,
  pageSize: number,
) {
  const start = (page - 1) * pageSize;
  return records.slice(start, start + pageSize);
}

export function filterRowsForTable(all: DisclosureRecord[], filters: DisclosureFilters) {
  return filterRows(all, filters);
}
