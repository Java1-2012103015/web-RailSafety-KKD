const dashboardTabCharts = {};

const TAB_CHART_COLOR_ACCIDENT = "#2563eb";
const TAB_CHART_COLOR_DISRUPTION = "#9f1239";
const TAB_CHART_COLOR_DEATH = "#1f2747";
const TAB_CHART_COLOR_INJURY = "#ea580c";

let dashboardTabState = null;
let dashboardTabEventsBound = false;

function destroyDashboardTabChart(key) {
  if (dashboardTabCharts[key]) {
    dashboardTabCharts[key].destroy();
    delete dashboardTabCharts[key];
  }
}

function tabComputeAxisMax(values, defaultMax) {
  const numeric = values.filter((value) => value != null).map((value) => Number(value) || 0);
  const dataMax = numeric.length ? Math.max(0, ...numeric) : 0;
  return Math.max(defaultMax, dataMax + 5);
}

function tabComputeAxisStepSize(max) {
  if (max <= 10) return 1;
  if (max <= 20) return 2;
  if (max <= 50) return 5;
  return Math.ceil(max / 10);
}

function filterDashboardDetailRows(rows, { agency, railCategory }) {
  return rows.filter((row) => {
    if (agency && agency !== "전체" && row.agency !== agency) return false;
    if (railCategory && railCategory !== "전체") {
      if (!row.railCategory || row.railCategory !== railCategory) return false;
    }
    return true;
  });
}

function aggregateRecent5Events(rows, recentYears) {
  return recentYears.map((year) => ({
    year,
    accidents: rows.filter((row) => row.year === year && row.isAccident).length,
    disruptions: rows.filter((row) => row.year === year && row.isDisruption).length,
  }));
}

function aggregateRecent5Casualties(rows, recentYears) {
  return recentYears.map((year) => {
    const yearRows = rows.filter((row) => row.year === year && row.isAccident);
    return {
      year,
      deaths: yearRows.reduce((sum, row) => sum + row.deaths, 0),
      seriousInjuries: yearRows.reduce((sum, row) => sum + row.seriousInjuries, 0),
    };
  });
}

function populateFilterSelect(select, values) {
  if (!select) return;
  const current = select.value || "전체";
  select.innerHTML = '<option value="전체">전체</option>';
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  if (current === "전체" || values.includes(current)) {
    select.value = current;
  }
}

function renderTabMixedYearChart({
  canvasId,
  chartKey,
  labels,
  allData,
  scopedData,
  lineLabel,
  barLabel,
  yMax,
  yLabel,
  yColor,
  showScoped = false,
  onScopedClick = null,
}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  destroyDashboardTabChart(chartKey);
  canvas.style.cursor = showScoped && onScopedClick ? "pointer" : "default";

  const datasets = [
    {
      type: "line",
      label: lineLabel,
      data: allData,
      borderColor: yColor,
      backgroundColor: `${yColor}33`,
      tension: 0.25,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6,
      order: 0,
    },
  ];

  if (showScoped) {
    datasets.push({
      type: "bar",
      label: barLabel,
      data: scopedData,
      backgroundColor: `${yColor}99`,
      borderColor: yColor,
      borderWidth: 1,
      borderRadius: 4,
      order: 1,
    });
  }

  dashboardTabCharts[chartKey] = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            afterBody: (tooltipItems) => {
              const item = tooltipItems[0];
              if (!item || !showScoped || item.datasetIndex !== 0) return [];
              return ["", "로그인 후 조회권한 기관별 데이터를 확인할 수 있습니다."];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          max: yMax,
          ticks: { stepSize: tabComputeAxisStepSize(yMax) },
          title: yLabel ? { display: true, text: yLabel, color: yColor, font: { size: 11 } } : undefined,
        },
      },
      onClick: (_event, elements) => {
        if (!elements.length || !showScoped || !onScopedClick) return;
        const { index, datasetIndex } = elements[0];
        if (datasetIndex === 0) {
          if (typeof showChartAccessDenied === "function") showChartAccessDenied();
          return;
        }
        const year = dashboardTabState?.recentYears?.[index];
        if (year) onScopedClick(year);
      },
    },
  });
}

function renderRecent5EventCharts() {
  if (!dashboardTabState) return;

  const agency = document.getElementById("filter-dashboard-agency-events")?.value || "전체";
  const railCategory = document.getElementById("filter-dashboard-rail-events")?.value || "전체";
  const filteredAll = filterDashboardDetailRows(dashboardTabState.allDetailRows, { agency, railCategory });
  const filteredScoped = filterDashboardDetailRows(dashboardTabState.detailRows, { agency, railCategory });
  const aggregatedAll = aggregateRecent5Events(filteredAll, dashboardTabState.recentYears);
  const aggregatedScoped = aggregateRecent5Events(filteredScoped, dashboardTabState.recentYears);
  const labels = aggregatedAll.map((row) => `${row.year}년`);
  const allDisruptionCounts = aggregatedAll.map((row) => row.disruptions);
  const scopedDisruptionCounts = aggregatedScoped.map((row) => row.disruptions);
  const allAccidentCounts = aggregatedAll.map((row) => row.accidents);
  const scopedAccidentCounts = aggregatedScoped.map((row) => row.accidents);
  const showScoped = Boolean(dashboardTabState.showScopedSeries);

  renderTabMixedYearChart({
    canvasId: "chart-tab-recent5-disruptions",
    chartKey: "tabRecent5Disruptions",
    labels,
    allData: allDisruptionCounts,
    scopedData: scopedDisruptionCounts,
    lineLabel: "전체기관 운행장애",
    barLabel: "조회권한 기관 운행장애",
    yMax: tabComputeAxisMax(showScoped ? [...allDisruptionCounts, ...scopedDisruptionCounts] : allDisruptionCounts, 20),
    yLabel: "운행장애 (건)",
    yColor: TAB_CHART_COLOR_DISRUPTION,
    showScoped,
    onScopedClick: (year) => {
      if (typeof navigateToScopedAccidentSearch === "function") {
        navigateToScopedAccidentSearch({ year, dashboardChart: "scoped-disruptions" });
      }
    },
  });

  renderTabMixedYearChart({
    canvasId: "chart-tab-recent5-accidents",
    chartKey: "tabRecent5Accidents",
    labels,
    allData: allAccidentCounts,
    scopedData: scopedAccidentCounts,
    lineLabel: "전체기관 철도사고",
    barLabel: "조회권한 기관 철도사고",
    yMax: tabComputeAxisMax(showScoped ? [...allAccidentCounts, ...scopedAccidentCounts] : allAccidentCounts, 10),
    yLabel: "철도사고 (건)",
    yColor: TAB_CHART_COLOR_ACCIDENT,
    showScoped,
    onScopedClick: (year) => {
      if (typeof navigateToScopedAccidentSearch === "function") {
        navigateToScopedAccidentSearch({ year, dashboardChart: "scoped-accidents" });
      }
    },
  });
}

function renderRecent5CasualtyCharts() {
  if (!dashboardTabState) return;

  const agency = document.getElementById("filter-dashboard-agency-casualties")?.value || "전체";
  const railCategory = document.getElementById("filter-dashboard-rail-casualties")?.value || "전체";
  const filteredAll = filterDashboardDetailRows(dashboardTabState.allDetailRows, { agency, railCategory });
  const filteredScoped = filterDashboardDetailRows(dashboardTabState.detailRows, { agency, railCategory });
  const aggregatedAll = aggregateRecent5Casualties(filteredAll, dashboardTabState.recentYears);
  const aggregatedScoped = aggregateRecent5Casualties(filteredScoped, dashboardTabState.recentYears);
  const labels = aggregatedAll.map((row) => `${row.year}년`);
  const allDeaths = aggregatedAll.map((row) => row.deaths);
  const allInjuries = aggregatedAll.map((row) => row.seriousInjuries);
  const scopedDeaths = aggregatedScoped.map((row) => row.deaths);
  const scopedInjuries = aggregatedScoped.map((row) => row.seriousInjuries);
  const showScoped = Boolean(dashboardTabState.showScopedSeries);

  renderTabMixedYearChart({
    canvasId: "chart-tab-recent5-deaths",
    chartKey: "tabRecent5Deaths",
    labels,
    allData: allDeaths,
    scopedData: scopedDeaths,
    lineLabel: "전체기관 사망",
    barLabel: "조회권한 기관 사망",
    yMax: tabComputeAxisMax(showScoped ? [...allDeaths, ...scopedDeaths] : allDeaths, 5),
    yLabel: "사망 (명)",
    yColor: TAB_CHART_COLOR_DEATH,
    showScoped,
    onScopedClick: (year) => {
      if (typeof navigateToScopedAccidentSearch === "function") {
        navigateToScopedAccidentSearch({ year, dashboardChart: "scoped-accidents" });
      }
    },
  });

  renderTabMixedYearChart({
    canvasId: "chart-tab-recent5-injuries",
    chartKey: "tabRecent5Injuries",
    labels,
    allData: allInjuries,
    scopedData: scopedInjuries,
    lineLabel: "전체기관 부상(중상)",
    barLabel: "조회권한 기관 부상(중상)",
    yMax: tabComputeAxisMax(showScoped ? [...allInjuries, ...scopedInjuries] : allInjuries, 5),
    yLabel: "부상(중상) (명)",
    yColor: TAB_CHART_COLOR_INJURY,
    showScoped,
    onScopedClick: (year) => {
      if (typeof navigateToScopedAccidentSearch === "function") {
        navigateToScopedAccidentSearch({ year, dashboardChart: "scoped-accidents" });
      }
    },
  });
}

function resizeDashboardTabCharts() {
  Object.values(dashboardTabCharts).forEach((chart) => {
    if (chart?.resize) chart.resize();
  });
}

function switchDashboardTab(tabId) {
  document.querySelectorAll(".dashboard-tab-btn").forEach((btn) => {
    const active = btn.dataset.dashboardTab === tabId;
    btn.classList.toggle("dashboard-tab-btn-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  document.querySelectorAll(".dashboard-tab-panel").forEach((panel) => {
    const show = panel.id === `dashboard-tab-panel-${tabId}`;
    panel.classList.toggle("hidden", !show);
    panel.setAttribute("aria-hidden", show ? "false" : "true");
  });

  if (tabId === "recent5-events") {
    requestAnimationFrame(() => {
      renderRecent5EventCharts();
      requestAnimationFrame(resizeDashboardTabCharts);
    });
  } else if (tabId === "recent5-casualties") {
    requestAnimationFrame(() => {
      renderRecent5CasualtyCharts();
      requestAnimationFrame(resizeDashboardTabCharts);
    });
  } else if (tabId === "current-year" && typeof window.resizePortalCharts === "function") {
    requestAnimationFrame(window.resizePortalCharts);
  }
}

function bindDashboardTabEvents() {
  if (dashboardTabEventsBound) return;
  dashboardTabEventsBound = true;

  document.querySelectorAll(".dashboard-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.dashboardTab;
      if (tabId) switchDashboardTab(tabId);
    });
  });

  document.getElementById("filter-dashboard-agency-events")?.addEventListener("change", renderRecent5EventCharts);
  document.getElementById("filter-dashboard-rail-events")?.addEventListener("change", renderRecent5EventCharts);
  document.getElementById("filter-dashboard-agency-casualties")?.addEventListener("change", renderRecent5CasualtyCharts);
  document.getElementById("filter-dashboard-rail-casualties")?.addEventListener("change", renderRecent5CasualtyCharts);
}

function initDashboardTabs({ currentYear, detailRows, allDetailRows, filterOptions, recentYears, showScopedSeries = false }) {
  dashboardTabState = {
    currentYear,
    detailRows: detailRows ?? [],
    allDetailRows: allDetailRows ?? detailRows ?? [],
    filterOptions: filterOptions ?? { agencies: [], railCategories: [] },
    recentYears: recentYears ?? [],
    showScopedSeries: Boolean(showScopedSeries),
  };

  const tabsRoot = document.getElementById("portal-dashboard-tabs");
  if (!tabsRoot) return;

  tabsRoot.classList.remove("hidden");

  const currentYearTabBtn = document.getElementById("dashboard-tab-btn-current-year");
  if (currentYearTabBtn) {
    currentYearTabBtn.textContent = `${currentYear}년 사고·장애 발생현황`;
  }

  const currentYearTitle = document.getElementById("chart-yearly-accidents-title");
  if (currentYearTitle) {
    currentYearTitle.textContent = `${currentYear}년 철도사고 발생현황`;
  }
  const currentYearDisruptionTitle = document.getElementById("chart-yearly-disruptions-title");
  if (currentYearDisruptionTitle) {
    currentYearDisruptionTitle.textContent = `${currentYear}년 운행장애 발생현황`;
  }

  populateFilterSelect(document.getElementById("filter-dashboard-agency-events"), dashboardTabState.filterOptions.agencies);
  populateFilterSelect(document.getElementById("filter-dashboard-rail-events"), dashboardTabState.filterOptions.railCategories);
  populateFilterSelect(document.getElementById("filter-dashboard-agency-casualties"), dashboardTabState.filterOptions.agencies);
  populateFilterSelect(document.getElementById("filter-dashboard-rail-casualties"), dashboardTabState.filterOptions.railCategories);

  bindDashboardTabEvents();
  switchDashboardTab("current-year");
}

window.initDashboardTabs = initDashboardTabs;
window.resizeDashboardTabCharts = resizeDashboardTabCharts;
