const portalCharts = {};

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

function navigateToScopedAccidentSearch({ year, month = null, dashboardChart }) {
  const params = new URLSearchParams();
  params.set("year", String(year));
  if (month) params.set("month", String(month));
  params.set("dashboardChart", dashboardChart);
  window.location.href = `/accidents?${params.toString()}`;
}

function showChartAccessDenied() {
  alert("조회 권한이 없습니다.");
}

/** Y축 max = max(기본값, 데이터 최대값 + 5) — 상단 포인트가 잘리지 않도록 여유 확보 */
function computeAxisMax(values, defaultMax) {
  const dataMax = Math.max(0, ...values.map((value) => Number(value) || 0));
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

function buildScopedTooltipLines(rows, tooltipItems, { accessDenied = false } = {}) {
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
      : "클릭하면 해당 연도 사고 목록으로 이동합니다.",
  );
  return lines;
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
          position: "left",
          beginAtZero: true,
          max: accidentMax,
          ticks: { stepSize: computeAxisStepSize(accidentMax) },
          title: { display: true, text: "철도사고", color: "#253056", font: { size: 11 } },
        },
        yDisruption: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          max: disruptionMax,
          ticks: { stepSize: computeAxisStepSize(disruptionMax) },
          grid: { drawOnChartArea: false },
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

function applyGuestPortalDashboardLayout(isGuest, options = {}) {
  const showScoped = Boolean(options.showScopedCharts);
  const hideScoped = isGuest && !showScoped;

  document.querySelectorAll(".portal-dashboard-scoped").forEach((el) => {
    el.classList.toggle("hidden", hideScoped);
  });

  const privateSection = document.getElementById("portal-dashboard-private-section");
  if (privateSection) {
    privateSection.classList.toggle("hidden", hideScoped);
  }

  const grid = document.getElementById("portal-dashboard-charts-grid");
  if (grid) {
    const twoCols = !isGuest || showScoped;
    grid.classList.toggle("lg:grid-cols-2", twoCols);
    grid.classList.toggle("lg:grid-cols-1", !twoCols);
  }
}

async function refreshPortalDashboard(options = {}) {
  const isGuest = options.guest ?? (typeof getToken !== "function" || !getToken());
  const showScopedCharts = Boolean(options.showScopedCharts);
  setPortalDashboardLoading(true);
  try {
    applyGuestPortalDashboardLayout(isGuest, { showScopedCharts });
    const result = isGuest
      ? await apiFetch("/api/public/dashboard/portal-stats")
      : await apiFetch("/api/dashboard/stats", { auth: true });
    const { all, scoped, updatedAt, currentYear, monthComparison } = result.data;

    renderMonthComparisonPanels(monthComparison, {
      scopeLabel: isGuest ? null : "조회권한 기관",
    });

    const updatedEl = document.getElementById("portal-stat-updated");
    if (updatedEl) updatedEl.textContent = formatDateTime(updatedAt);

    const monthlyTitle = document.getElementById("chart-monthly-title");
    if (monthlyTitle) {
      const scopeLabel = isGuest ? "전체기관" : "조회권한 기관";
      monthlyTitle.textContent = `${currentYear}년 철도사고·장애 발생현황 (${scopeLabel})`;
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
  } finally {
    setPortalDashboardLoading(false);
  }
}

function initPortalDashboard(options = {}) {
  if (!document.getElementById("chart-all-accidents")) return;

  refreshPortalDashboard(options).catch((error) => {
    console.error("Portal dashboard load failed:", error);
  });
}
