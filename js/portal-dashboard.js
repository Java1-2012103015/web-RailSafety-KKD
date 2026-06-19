const portalCharts = {};

const CHART_COLOR_ACCIDENT = "#2563eb";
const CHART_COLOR_DISRUPTION = "#9f1239";

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function destroyPortalChart(key) {
  if (portalCharts[key]) {
    portalCharts[key].destroy();
    delete portalCharts[key];
  }
}

function resizePortalCharts() {
  Object.values(portalCharts).forEach((chart) => {
    if (chart?.resize) {
      chart.resize();
    }
  });
}

function navigateToScopedAccidentSearch({ year, month = null, throughMonth = null, dashboardChart }) {
  const params = new URLSearchParams();
  params.set("year", String(year));
  if (month) params.set("month", String(month));
  if (throughMonth) params.set("throughMonth", String(throughMonth));
  params.set("dashboardChart", dashboardChart);
  window.location.href = `/accidents?${params.toString()}`;
}

function showChartAccessDenied() {
  alert("조회 권한이 없습니다.");
}

/** Y축 max = max(기본값, 데이터 최대값 + 5) — 상단 포인트가 잘리지 않도록 여유 확보 */
function computeAxisMax(values, defaultMax) {
  const numeric = values.filter((value) => value != null).map((value) => Number(value) || 0);
  const dataMax = numeric.length ? Math.max(0, ...numeric) : 0;
  return Math.max(defaultMax, dataMax + 5);
}

function computeAxisStepSize(max) {
  if (max <= 10) return 1;
  if (max <= 20) return 2;
  if (max <= 50) return 5;
  return Math.ceil(max / 10);
}

function formatAgencyBreakdown(byAgency) {
  if (!byAgency?.length) return ["  (등록기관 정보 없음)"];
  return byAgency.map(({ agency, count }) => `  ${agency}: ${count}건`);
}

function buildScopedTooltipLines(rows, tooltipItems, { accessDenied = false, loginRequired = false } = {}) {
  const index = tooltipItems[0]?.dataIndex;
  const row = rows[index];
  const lines = [];

  if (!accessDenied) {
    lines.push("", "기관별 발생 건수", ...formatAgencyBreakdown(row?.byAgency));
  }

  lines.push("");
  lines.push(
    accessDenied
      ? "로그인 후 조회권한 기관별 데이터를 확인할 수 있습니다."
      : loginRequired
        ? "로그인 후 상세 목록을 확인할 수 있습니다."
        : "클릭하면 해당 연도 사고 목록으로 이동합니다.",
  );
  return lines;
}

function getMonthlyDataCutoffMonth(currentYear) {
  const now = new Date();
  const calendarYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (currentYear < calendarYear) return 12;
  if (currentYear > calendarYear) return 0;
  // 당해 연도: 직전월까지만 표시 (당월은 집계 중)
  return Math.max(0, currentMonth - 1);
}

/** 월별 누적 — 아직 도래하지 않은 달은 null (선·막대 미표시) */
function buildCumulativeMonthly(monthlyRows, field, currentYear) {
  const cutoffMonth = getMonthlyDataCutoffMonth(currentYear);
  let sum = 0;
  return monthlyRows.map((row) => {
    if (row.month > cutoffMonth) return null;
    sum += Number(row[field]) || 0;
    return sum;
  });
}

function buildMonthlyTooltipLines(rows, tooltipItems) {
  const item = tooltipItems[0];
  const index = item?.dataIndex;
  const row = rows[index];
  const byAgency = item?.datasetIndex === 0 ? row?.accidentsByAgency : row?.disruptionsByAgency;

  return [
    "",
    "기관별 발생 건수",
    ...formatAgencyBreakdown(byAgency),
    "",
    "클릭하면 해당 월 사고 목록으로 이동합니다.",
  ];
}

function getMonthlyFieldCount(rows, index, field) {
  return Number(rows[index]?.[field]) || 0;
}

function buildYearlyStatusTooltipLabel(context, { allRows, scopedRows, field, showScoped }) {
  if (context.parsed.y == null) return null;
  const rows = !showScoped || context.datasetIndex === 0 ? allRows : scopedRows;
  const monthlyCount = getMonthlyFieldCount(rows, context.dataIndex, field);
  return `${context.dataset.label}: ${monthlyCount.toLocaleString("ko-KR")}건`;
}

function buildYearlyStatusTooltipLines(rows, tooltipItems, { isAccidentDataset, loginRequired = false } = {}) {
  const item = tooltipItems[0];
  const index = item?.dataIndex;
  const row = rows[index];
  const byAgency = isAccidentDataset ? row?.accidentsByAgency : row?.disruptionsByAgency;

  return [
    "",
    "기관별 발생 건수",
    ...formatAgencyBreakdown(byAgency),
    "",
    loginRequired
      ? "로그인 후 상세 목록을 확인할 수 있습니다."
      : "클릭하면 해당 월 사고 목록으로 이동합니다.",
  ];
}

function renderLineChart(
  canvasId,
  chartKey,
  label,
  rows,
  color,
  { clickable = false, dashboardChart = null, accessDenied = false, axisDefaultMax = null } = {},
) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  destroyPortalChart(chartKey);

  if (clickable) {
    canvas.style.cursor = "pointer";
  }

  const counts = rows.map((row) => row.count);
  const yMax = axisDefaultMax ? computeAxisMax(counts, axisDefaultMax) : undefined;

  portalCharts[chartKey] = new Chart(canvas, {
    type: "line",
    data: {
      labels: rows.map((row) => `${row.year}년`),
      datasets: [
        {
          label,
          data: rows.map((row) => row.count),
          borderColor: color,
          backgroundColor: `${color}33`,
          tension: 0.25,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: clickable
            ? {
                afterBody: (tooltipItems) =>
                  buildScopedTooltipLines(rows, tooltipItems, { accessDenied }),
              }
            : undefined,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ...(yMax ? { max: yMax, ticks: { stepSize: computeAxisStepSize(yMax) } } : { ticks: { stepSize: 1 } }),
        },
      },
      onClick: clickable
        ? (_event, elements) => {
            if (!elements.length) return;
            if (accessDenied) {
              showChartAccessDenied();
              return;
            }
            if (!dashboardChart) return;
            const index = elements[0].index;
            const year = rows[index]?.year;
            if (!year) return;
            navigateToScopedAccidentSearch({ year, dashboardChart });
          }
        : undefined,
    },
  });
}

function renderMonthlyBarChart(rows, currentYear, options = {}) {
  const { clickable = true, accessDenied = false } = options;
  const canvas = document.getElementById("chart-scoped-monthly");
  if (!canvas) return;

  destroyPortalChart("monthly");
  canvas.style.cursor = clickable ? "pointer" : "default";

  const accidentValues = rows.map((row) => row.accidents);
  const disruptionValues = rows.map((row) => row.disruptions);
  const accidentMax = computeAxisMax(accidentValues, 10);
  const disruptionMax = computeAxisMax(disruptionValues, 20);

  portalCharts.monthly = new Chart(canvas, {
    type: "bar",
    data: {
      labels: rows.map((row) => `${row.month}월`),
      datasets: [
        {
          label: "철도사고",
          data: accidentValues,
          backgroundColor: "#253056",
          borderRadius: 4,
          yAxisID: "yAccident",
        },
        {
          label: "운행장애",
          data: disruptionValues,
          backgroundColor: "#dc2626",
          borderRadius: 4,
          yAxisID: "yDisruption",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            afterBody: (tooltipItems) =>
              accessDenied
                ? ["", "로그인 후 조회권한 기관별 데이터를 확인할 수 있습니다."]
                : buildMonthlyTooltipLines(rows, tooltipItems),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
        },
        yAccident: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          max: accidentMax,
          ticks: { stepSize: computeAxisStepSize(accidentMax) },
          grid: { drawOnChartArea: false },
          title: { display: true, text: "철도사고", color: "#253056", font: { size: 11 } },
        },
        yDisruption: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          max: disruptionMax,
          ticks: { stepSize: computeAxisStepSize(disruptionMax) },
          title: { display: true, text: "운행장애", color: "#dc2626", font: { size: 11 } },
        },
      },
      onClick: clickable
        ? (_event, elements) => {
            if (accessDenied) {
              showChartAccessDenied();
              return;
            }
            if (!elements.length || !currentYear) return;
            const { index, datasetIndex } = elements[0];
            const month = rows[index]?.month;
            if (!month) return;
            const dashboardChart = datasetIndex === 0 ? "scoped-accidents" : "scoped-disruptions";
            navigateToScopedAccidentSearch({ year: currentYear, month, dashboardChart });
          }
        : undefined,
    },
  });
}

function shouldUseCombinedTrendCharts(isGuest) {
  if (isGuest) return true;
  const user = typeof getUser === "function" ? getUser() : null;
  return user?.role !== "ADMIN";
}

function shouldShowScopedChartSeries(isGuest) {
  return shouldUseCombinedTrendCharts(isGuest) && !isGuest;
}

function applyCombinedTrendLayout(useCombined) {
  const hasTabs = Boolean(document.getElementById("portal-dashboard-tabs"));

  const combinedSection = document.getElementById("portal-combined-trends-section");
  if (combinedSection) {
    combinedSection.classList.toggle("hidden", !useCombined || hasTabs);
  }

  const yearlyStatusSection = document.getElementById("portal-yearly-status-section");
  if (yearlyStatusSection && !hasTabs) {
    yearlyStatusSection.classList.toggle("hidden", !useCombined);
  }

  const tabsRoot = document.getElementById("portal-dashboard-tabs");
  if (tabsRoot) {
    tabsRoot.classList.toggle("hidden", !useCombined);
  }

  const legacyMonthlySection = document.getElementById("portal-monthly-legacy-section");
  if (legacyMonthlySection) {
    legacyMonthlySection.classList.toggle("hidden", useCombined);
  }

  document.querySelectorAll(".portal-dashboard-accident-split, .portal-dashboard-disruption-split").forEach((el) => {
    el.classList.toggle("hidden", useCombined);
  });

  const grid = document.getElementById("portal-dashboard-charts-grid");
  if (grid) {
    grid.classList.toggle("hidden", useCombined);
  }

  if (!useCombined) {
    destroyPortalChart("combinedAccidents");
    destroyPortalChart("combinedDisruptions");
    destroyPortalChart("yearlyAccidentStatus");
    destroyPortalChart("yearlyDisruptionStatus");
  }
}

function renderCombinedTrendChart({
  canvasId,
  chartKey,
  allRows,
  scopedRows,
  axisDefaultMax,
  scopedDashboardChart,
  showScoped = true,
}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  destroyPortalChart(chartKey);
  canvas.style.cursor = "pointer";

  const labels = allRows.map((row) => `${row.year}년`);
  const allCounts = allRows.map((row) => row.count);
  const scopedCounts = scopedRows.map((row) => row.count);
  const yMax = computeAxisMax(
    showScoped ? [...allCounts, ...scopedCounts] : allCounts,
    axisDefaultMax,
  );

  const datasets = [
    {
      label: "전체기관",
      data: allCounts,
      borderColor: "#2563eb",
      backgroundColor: "#2563eb33",
      tension: 0.25,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
  ];

  if (showScoped) {
    datasets.push({
      label: "조회권한 기관",
      data: scopedCounts,
      borderColor: "#dc2626",
      backgroundColor: "#dc262633",
      tension: 0.25,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6,
    });
  }

  portalCharts[chartKey] = new Chart(canvas, {
    type: "line",
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
              if (!item) return [];
              const datasetIndex = item.datasetIndex;
              const rows = datasetIndex === 0 ? allRows : scopedRows;
              const accessDenied = showScoped && datasetIndex === 0;
              return buildScopedTooltipLines(rows, tooltipItems, {
                accessDenied,
                loginRequired: !showScoped,
              });
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yMax,
          ticks: { stepSize: computeAxisStepSize(yMax) },
        },
      },
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const { index, datasetIndex } = elements[0];
        const year = allRows[index]?.year;
        if (!year) return;

        if (!showScoped || datasetIndex === 0) {
          showChartAccessDenied();
          return;
        }

        navigateToScopedAccidentSearch({ year, dashboardChart: scopedDashboardChart });
      },
    },
  });
}

function setYearlyStatusChartTitles(currentYear) {
  const accidentsTitle = document.getElementById("chart-yearly-accidents-title");
  if (accidentsTitle) {
    accidentsTitle.textContent = `${currentYear}년 철도사고 발생현황`;
  }
  const disruptionsTitle = document.getElementById("chart-yearly-disruptions-title");
  if (disruptionsTitle) {
    disruptionsTitle.textContent = `${currentYear}년 운행장애 발생현황`;
  }
}

function renderYearlyStatusMixedChart({
  canvasId,
  chartKey,
  allRows,
  scopedRows,
  currentYear,
  field,
  lineLabel,
  barLabel,
  yLabel,
  yColor,
  axisDefaultMax,
  dashboardChart,
  showScoped = true,
}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  destroyPortalChart(chartKey);
  canvas.style.cursor = "pointer";

  const labels = allRows.map((row) => `${row.month}월`);
  const allCumulative = buildCumulativeMonthly(allRows, field, currentYear);
  const scopedCumulative = buildCumulativeMonthly(scopedRows, field, currentYear);
  const yMax = computeAxisMax(
    showScoped ? [...allCumulative, ...scopedCumulative] : allCumulative,
    axisDefaultMax,
  );

  const datasets = [
    {
      type: "line",
      label: lineLabel,
      data: allCumulative,
      borderColor: yColor,
      backgroundColor: `${yColor}33`,
      tension: 0.25,
      fill: false,
      spanGaps: false,
      pointRadius: 4,
      pointHoverRadius: 6,
      order: 0,
    },
  ];

  if (showScoped) {
    datasets.push({
      type: "bar",
      label: barLabel,
      data: scopedCumulative,
      backgroundColor: `${yColor}99`,
      borderColor: yColor,
      borderWidth: 1,
      borderRadius: 4,
      order: 1,
    });
  }

  portalCharts[chartKey] = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) =>
              buildYearlyStatusTooltipLabel(context, { allRows, scopedRows, field, showScoped }),
            afterBody: (tooltipItems) => {
              const item = tooltipItems[0];
              if (!item) return [];
              const datasetIndex = item.datasetIndex;
              const isAccidentDataset = field === "accidents";

              if (!showScoped || datasetIndex === 0) {
                if (!showScoped) {
                  return buildYearlyStatusTooltipLines(allRows, tooltipItems, {
                    isAccidentDataset,
                    loginRequired: true,
                  });
                }
                return ["", "로그인 후 조회권한 기관별 데이터를 확인할 수 있습니다."];
              }

              return buildYearlyStatusTooltipLines(scopedRows, tooltipItems, { isAccidentDataset });
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          max: yMax,
          ticks: { stepSize: computeAxisStepSize(yMax) },
          title: { display: true, text: yLabel, color: yColor, font: { size: 11 } },
        },
      },
      onClick: (_event, elements) => {
        if (!elements.length || !currentYear) return;
        const { index, datasetIndex } = elements[0];

        if (!showScoped || datasetIndex === 0) {
          showChartAccessDenied();
          return;
        }

        const month = scopedRows[index]?.month;
        if (!month || getMonthlyDataCutoffMonth(currentYear) < month) return;
        navigateToScopedAccidentSearch({ year: currentYear, month, dashboardChart });
      },
    },
  });
}

function renderYearlyCombinedStatusChart(allRows, scopedRows, currentYear, { showScoped = true } = {}) {
  renderYearlyStatusMixedChart({
    canvasId: "chart-yearly-accidents-status",
    chartKey: "yearlyAccidentStatus",
    allRows,
    scopedRows,
    currentYear,
    field: "accidents",
    lineLabel: "전체기관 철도사고",
    barLabel: "조회권한 기관 철도사고",
    yLabel: "철도사고 (누적)",
    yColor: CHART_COLOR_ACCIDENT,
    axisDefaultMax: 10,
    dashboardChart: "scoped-accidents",
    showScoped,
  });

  renderYearlyStatusMixedChart({
    canvasId: "chart-yearly-disruptions-status",
    chartKey: "yearlyDisruptionStatus",
    allRows,
    scopedRows,
    currentYear,
    field: "disruptions",
    lineLabel: "전체기관 운행장애",
    barLabel: "조회권한 기관 운행장애",
    yLabel: "운행장애 (누적)",
    yColor: CHART_COLOR_DISRUPTION,
    axisDefaultMax: 20,
    dashboardChart: "scoped-disruptions",
    showScoped,
  });
}

function renderQueryScopeSection(summary, isGuest) {
  const section = document.getElementById("portal-query-scope-section");
  const roleEl = document.getElementById("portal-query-scope-role");
  const metaEl = document.getElementById("portal-query-scope-meta");

  if (!section) return;

  if (isGuest || !summary) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");

  if (roleEl) {
    roleEl.textContent = `${summary.roleName} 권한으로 설정된 범위의 데이터를 조회할 수 있습니다.`;
  }

  if (metaEl) {
    const metaParts = [];
    const { min, max } = summary.dateRange ?? {};
    if (min || max) {
      metaParts.push(`조회 기간: ${min ?? "제한 없음"} ~ ${max ?? "제한 없음"}`);
    }
    if (summary.allowedTypes?.length) {
      metaParts.push(`허용 유형: ${summary.allowedTypes.join(", ")}`);
    }
    if (summary.enforcedLineName) {
      metaParts.push(`지정 노선: ${summary.enforcedLineName}`);
    } else if (summary.allowedLineNames?.length) {
      metaParts.push(`조회 노선: ${summary.allowedLineNames.join(", ")}`);
    }
    metaEl.innerHTML = metaParts.length
      ? metaParts.map((line) => `<p>${line}</p>`).join("")
      : "";
  }
}

function applyGuestPortalDashboardLayout(isGuest, options = {}) {
  const showScoped = Boolean(options.showScopedCharts);
  const hideScoped = isGuest && !showScoped;
  const useCombined = shouldUseCombinedTrendCharts(isGuest);

  applyCombinedTrendLayout(useCombined);

  if (!useCombined) {
    document.querySelectorAll(".portal-dashboard-scoped").forEach((el) => {
      el.classList.toggle("hidden", hideScoped);
    });
  }

  const privateSection = document.getElementById("portal-dashboard-private-section");
  if (privateSection) {
    privateSection.classList.toggle("hidden", hideScoped);
  }

  const grid = document.getElementById("portal-dashboard-charts-grid");
  if (grid && !useCombined) {
    const twoCols = !isGuest || showScoped;
    grid.classList.toggle("lg:grid-cols-2", twoCols);
    grid.classList.toggle("lg:grid-cols-1", !twoCols);
  }
}

async function refreshPortalDashboard(options = {}) {
  const isGuest = options.guest ?? (typeof getToken !== "function" || !getToken());
  const showScopedCharts = Boolean(options.showScopedCharts);
  setPortalDashboardLoading(true);

  let renderCharts = () => {};

  try {
    applyGuestPortalDashboardLayout(isGuest, { showScopedCharts });
    const result = isGuest
      ? await apiFetch("/api/public/dashboard/portal-stats")
      : await apiFetch("/api/dashboard/stats", { auth: true });
    const { all, scoped, updatedAt, currentYear, yearStatusSummary, queryScopeSummary, detailRows, allDetailRows, filterOptions, recentYears } =
      result.data;

    renderQueryScopeSection(queryScopeSummary, isGuest);

    renderYearStatusPanels(yearStatusSummary, {
      scopeLabel: isGuest ? "전체기관" : "조회권한 기관",
      clickable: !isGuest,
    });

    const updatedEl = document.getElementById("portal-stat-updated");
    if (updatedEl) updatedEl.textContent = formatDateTime(updatedAt);

    const monthlyTitle = document.getElementById("chart-monthly-title");
    if (monthlyTitle) {
      const scopeLabel = isGuest ? "전체기관" : "조회권한 기관";
      monthlyTitle.textContent = `${currentYear}년 철도사고·장애 발생현황 (${scopeLabel})`;
    }

    const useCombinedTrend = shouldUseCombinedTrendCharts(isGuest);
    const showScopedSeries = shouldShowScopedChartSeries(isGuest);
    const hasDashboardTabs = Boolean(document.getElementById("portal-dashboard-tabs"));

    renderCharts = () => {
      if (useCombinedTrend) {
        if (hasDashboardTabs && typeof initDashboardTabs === "function") {
          initDashboardTabs({
            currentYear,
            detailRows: detailRows ?? [],
            allDetailRows: allDetailRows ?? detailRows ?? [],
            filterOptions: filterOptions ?? { agencies: [], railCategories: [] },
            recentYears: recentYears ?? [],
            showScopedSeries,
          });
        } else {
          setYearlyStatusChartTitles(currentYear);

          renderCombinedTrendChart({
            canvasId: "chart-combined-accidents",
            chartKey: "combinedAccidents",
            allRows: all.recent5Accidents,
            scopedRows: scoped.recent5Accidents,
            axisDefaultMax: 10,
            scopedDashboardChart: "scoped-accidents",
            showScoped: showScopedSeries,
          });
          renderCombinedTrendChart({
            canvasId: "chart-combined-disruptions",
            chartKey: "combinedDisruptions",
            allRows: all.recent5Disruptions,
            scopedRows: scoped.recent5Disruptions,
            axisDefaultMax: 20,
            scopedDashboardChart: "scoped-disruptions",
            showScoped: showScopedSeries,
          });
        }

        renderYearlyCombinedStatusChart(
          all.monthlyCurrentYear ?? scoped.monthlyCurrentYear,
          scoped.monthlyCurrentYear,
          currentYear,
          { showScoped: showScopedSeries },
        );
        return;
      }

      renderLineChart(
        "chart-all-accidents",
        "allAccidents",
        "철도사고",
        all.recent5Accidents,
        "#253056",
        { clickable: !isGuest, accessDenied: true, axisDefaultMax: 10 },
      );
      renderLineChart(
        "chart-scoped-accidents",
        "scopedAccidents",
        "철도사고",
        scoped.recent5Accidents,
        "#2e3a67",
        {
          clickable: !isGuest,
          dashboardChart: isGuest ? null : "scoped-accidents",
          accessDenied: isGuest && showScopedCharts,
          axisDefaultMax: 10,
        },
      );
      renderLineChart(
        "chart-all-disruptions",
        "allDisruptions",
        "운행장애",
        all.recent5Disruptions,
        "#dc2626",
        { clickable: !isGuest, accessDenied: true, axisDefaultMax: 20 },
      );
      renderLineChart(
        "chart-scoped-disruptions",
        "scopedDisruptions",
        "운행장애",
        scoped.recent5Disruptions,
        "#ea580c",
        {
          clickable: !isGuest,
          dashboardChart: isGuest ? null : "scoped-disruptions",
          accessDenied: isGuest && showScopedCharts,
          axisDefaultMax: 20,
        },
      );
      renderMonthlyBarChart(scoped.monthlyCurrentYear, currentYear, {
        clickable: !isGuest,
        accessDenied: isGuest && showScopedCharts,
      });
    };
  } finally {
    setPortalDashboardLoading(false);
  }

  requestAnimationFrame(() => {
    renderCharts();
    requestAnimationFrame(() => {
      resizePortalCharts();
      if (typeof resizeDashboardTabCharts === "function") {
        resizeDashboardTabCharts();
      }
    });
  });
}

window.resizePortalCharts = resizePortalCharts;

function initPortalDashboard(options = {}) {
  const hasCombinedCharts = document.getElementById("chart-combined-accidents");
  const hasLegacyCharts = document.getElementById("chart-all-accidents");
  if (!hasCombinedCharts && !hasLegacyCharts) return;

  refreshPortalDashboard(options).catch((error) => {
    console.error("Portal dashboard load failed:", error);
  });
}
