let recentFiveChart;
let yearlyAccidentChart;
let yearlyDisruptionChart;
let agencyChart;

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

function destroyChart(chart) {
  if (chart) chart.destroy();
}

function renderSummary(summary) {
  document.getElementById("stat-recent-accidents").textContent = summary.recent5YearAccidents.toLocaleString("ko-KR");
  document.getElementById("stat-recent-disruptions").textContent = summary.recent5YearDisruptions.toLocaleString("ko-KR");
  document.getElementById("stat-recent-near-misses").textContent = (
    summary.recent5YearNearMisses ?? 0
  ).toLocaleString("ko-KR");
  document.getElementById("stat-updated").textContent = formatDateTime(summary.updatedAt);
}

function renderCharts(stats) {
  const recentFiveCtx = document.getElementById("chart-recent-five");
  const yearlyAccidentCtx = document.getElementById("chart-yearly-accident");
  const yearlyDisruptionCtx = document.getElementById("chart-yearly-disruption");
  const agencyCtx = document.getElementById("chart-agency");

  destroyChart(recentFiveChart);
  destroyChart(yearlyAccidentChart);
  destroyChart(yearlyDisruptionChart);
  destroyChart(agencyChart);
  agencyChart = null;

  recentFiveChart = new Chart(recentFiveCtx, {
    type: "line",
    data: {
      labels: stats.recent5.map((row) => `${row.year}`),
      datasets: [
        {
          label: "사고",
          data: stats.recent5.map((row) => row.accidents),
          borderColor: "#253056",
          backgroundColor: "rgba(37, 48, 86, 0.2)",
          tension: 0.25,
          fill: false,
        },
        {
          label: "장애",
          data: stats.recent5.map((row) => row.disruptions),
          borderColor: "#dc2626",
          backgroundColor: "rgba(220, 38, 38, 0.2)",
          tension: 0.25,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });

  yearlyAccidentChart = new Chart(yearlyAccidentCtx, {
    type: "bar",
    data: {
      labels: stats.yearlyAccidents.map((row) => `${row.year}`),
      datasets: [
        {
          label: "사고 건수",
          data: stats.yearlyAccidents.map((row) => row.count),
          backgroundColor: "#2e3a67",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });

  yearlyDisruptionChart = new Chart(yearlyDisruptionCtx, {
    type: "line",
    data: {
      labels: stats.yearlyDisruptions.map((row) => `${row.year}`),
      datasets: [
        {
          label: "장애 건수",
          data: stats.yearlyDisruptions.map((row) => row.count),
          borderColor: "#dc2626",
          backgroundColor: "rgba(220, 38, 38, 0.15)",
          tension: 0.25,
          fill: false,
          pointRadius: 4,
          pointBackgroundColor: "#dc2626",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });

  if (agencyCtx && stats.byAgency?.length) {
    agencyChart = new Chart(agencyCtx, {
      type: "bar",
      data: {
        labels: stats.byAgency.map((row) => row.agency),
        datasets: [
          {
            label: "사고 건수",
            data: stats.byAgency.map((row) => row.count),
            backgroundColor: "#0f766e",
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    });
  }
}

async function refreshDashboard() {
  setPublicDashboardLoading(true);
  try {
    const result = await apiFetch("/api/public/dashboard/stats");
    renderSummary(result.data.summary);
    renderMonthComparisonPanels(result.data.monthComparison);
    renderCharts(result.data);
  } finally {
    setPublicDashboardLoading(false);
  }
}

function initDashboard() {
  refreshDashboard().catch((error) => {
    console.error(error);
  });
}

document.addEventListener("DOMContentLoaded", initDashboard);
