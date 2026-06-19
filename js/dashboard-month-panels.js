function formatStatusCount(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("ko-KR");
}

function buildStatusColumn(label, value, subLabel, accentClass) {
  return `
    <div class="rounded border border-gray-200 bg-gray-50 px-4 py-4 text-center">
      <p class="text-xs font-medium text-gray-500">${label}</p>
      <p class="mt-2 text-3xl font-bold ${accentClass}">
        ${formatStatusCount(value)}<span class="ml-0.5 text-base font-semibold text-gray-600">건</span>
      </p>
      ${subLabel ? `<p class="mt-1.5 text-[11px] text-gray-400">${subLabel}</p>` : ""}
    </div>
  `;
}

function renderYearStatusPanel(container, title, metric, accentClass) {
  if (!container || !metric) return;

  container.innerHTML = `
    <h3 class="text-sm font-bold text-gray-900">${title}</h3>
    <div class="mt-3 grid grid-cols-2 gap-3">
      ${buildStatusColumn("누적 총계", metric.cumulativeTotal, "DB 기준", accentClass)}
      ${buildStatusColumn("직전월 발생", metric.prevMonthCount, metric.prevMonthLabel, accentClass)}
    </div>
  `;
}

function renderYearStatusPanels(yearStatusSummary, options = {}) {
  const root = document.getElementById(options.rootId || "year-status-root");
  if (!root) return;

  if (!yearStatusSummary) {
    root.classList.add("hidden");
    return;
  }

  root.classList.remove("hidden");

  const { year, currentMonth } = yearStatusSummary;
  const scopeSuffix = options.scopeLabel ? ` (${options.scopeLabel})` : "";
  const monthSuffix = `${year}년 ${currentMonth}월`;

  renderYearStatusPanel(
    document.getElementById("panel-year-disruptions"),
    `${year}년(당월) 장애 현황${scopeSuffix}`,
    yearStatusSummary.disruptions,
    "text-red-700",
  );
  renderYearStatusPanel(
    document.getElementById("panel-year-accidents"),
    `${year}년(당월) 사고 현황${scopeSuffix}`,
    yearStatusSummary.accidents,
    "text-navy-900",
  );

  const periodEl = document.getElementById("year-status-period");
  if (periodEl) periodEl.textContent = monthSuffix;
}

function setYearStatusVisibility(visible) {
  const root = document.getElementById("year-status-root");
  if (!root) return;
  root.classList.toggle("hidden", !visible);
}

/** @deprecated use renderYearStatusPanels */
function renderMonthComparisonPanels(yearStatusSummary, options = {}) {
  renderYearStatusPanels(yearStatusSummary, options);
}

/** @deprecated use setYearStatusVisibility */
function setMonthComparisonVisibility(visible) {
  setYearStatusVisibility(visible);
}

/** 대시보드 API 로딩 — 원형 스피너 오버레이 */
function setDashboardLoadingOverlay(loading, { overlayId, contentId } = {}) {
  const overlay = document.getElementById(overlayId);
  const content = document.getElementById(contentId);
  if (overlay) {
    overlay.classList.toggle("hidden", !loading);
    overlay.setAttribute("aria-hidden", loading ? "false" : "true");
  }
  if (content) {
    content.classList.toggle("opacity-0", loading);
    content.classList.toggle("pointer-events-none", loading);
    content.setAttribute("aria-busy", loading ? "true" : "false");
  }
}

function setPortalDashboardLoading(loading) {
  setDashboardLoadingOverlay(loading, {
    overlayId: "portal-dashboard-loading",
    contentId: "portal-dashboard-content",
  });
}

function setPublicDashboardLoading(loading) {
  setDashboardLoadingOverlay(loading, {
    overlayId: "public-dashboard-loading",
    contentId: "public-dashboard-content",
  });
}
