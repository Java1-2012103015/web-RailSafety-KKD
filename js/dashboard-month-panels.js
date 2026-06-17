function formatCompareCount(value, { average = false } = {}) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  if (average) {
    return Number(value).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return Number(value).toLocaleString("ko-KR");
}

function yearLabelFromPeriod(periodLabel) {
  const match = (periodLabel || "").match(/^(\d+년)/);
  return match ? match[1] : "";
}

/** 패널 기준 월 — `periodLabel`(예: 2026년 5월) 또는 `metric.month` */
function monthLabelFromMetric(metric) {
  if (metric?.month != null && metric.month >= 1 && metric.month <= 12) {
    return `${metric.month}월`;
  }
  const match = (metric?.periodLabel || "").match(/(\d{1,2})월/);
  return match ? `${Number(match[1])}월` : "";
}

function columnLabelWithMonth(baseLabel, metric) {
  const monthPart = monthLabelFromMetric(metric);
  return monthPart ? `${baseLabel} (${monthPart})` : baseLabel;
}

function buildMetricColumn(label, value, subLabel, accentClass, { pending = false, pendingText = "집계중" } = {}) {
  const valueHtml = pending
    ? `<p class="mt-1 text-lg font-bold text-gray-500">${pendingText}</p>`
    : `<p class="mt-1 text-2xl font-bold ${accentClass}">${value}<span class="ml-0.5 text-sm font-semibold text-gray-600">건</span></p>`;

  return `
    <div class="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-center">
      <p class="text-[11px] font-medium text-gray-500">${label}</p>
      ${valueHtml}
      ${subLabel ? `<p class="mt-1 text-[10px] text-gray-400">${subLabel}</p>` : ""}
    </div>
  `;
}

function renderComparePanel(
  container,
  title,
  metric,
  { showCurrentYear, accentClass, aggregating = false, updating = false } = {},
) {
  if (!container || !metric) return;

  let columns;
  const currentYearLabel = metric.currentYearLabel || yearLabelFromPeriod(metric.periodLabel);
  const priorYearColumnLabel = columnLabelWithMonth("직전년도", metric);
  const currentYearColumnLabel = columnLabelWithMonth("올해", metric);

  if (aggregating) {
    columns = [
      buildMetricColumn(
        "최근 5년 평균",
        formatCompareCount(metric.recent5YearAvg, { average: true }),
        "직전 5개년 동월",
        accentClass,
      ),
      buildMetricColumn(
        priorYearColumnLabel,
        formatCompareCount(metric.priorYear),
        metric.priorYearLabel,
        accentClass,
      ),
      buildMetricColumn(currentYearColumnLabel, null, currentYearLabel, accentClass, { pending: true }),
    ];
  } else if (updating) {
    columns = [
      buildMetricColumn("최근 5년 평균", null, "직전 5개년 동월", accentClass, {
        pending: true,
        pendingText: "갱신중",
      }),
      buildMetricColumn(priorYearColumnLabel, null, metric.priorYearLabel, accentClass, {
        pending: true,
        pendingText: "갱신중",
      }),
      buildMetricColumn(currentYearColumnLabel, null, currentYearLabel, accentClass, {
        pending: true,
        pendingText: "갱신중",
      }),
    ];
  } else {
    columns = [
      buildMetricColumn(
        "최근 5년 평균",
        formatCompareCount(metric.recent5YearAvg, { average: true }),
        "직전 5개년 동월",
        accentClass,
      ),
      buildMetricColumn(
        priorYearColumnLabel,
        formatCompareCount(metric.priorYear),
        metric.priorYearLabel,
        accentClass,
      ),
    ];

    if (showCurrentYear) {
      columns.push(
        buildMetricColumn(
          currentYearColumnLabel,
          formatCompareCount(metric.currentYear),
          metric.currentYearLabel,
          accentClass,
        ),
      );
    }
  }

  const gridClass = showCurrentYear || aggregating || updating ? "grid-cols-3" : "grid-cols-2";

  container.innerHTML = `
    <h3 class="text-sm font-bold text-gray-900">
      ${title}
      <span class="ml-1 font-semibold text-navy-700">(${metric.periodLabel})</span>
    </h3>
    <div class="mt-3 grid gap-3 ${gridClass}">${columns.join("")}</div>
  `;
}

function renderMonthComparisonPanels(monthComparison, options = {}) {
  const root = document.getElementById(options.rootId || "month-compare-root");
  if (!root) return;

  if (!monthComparison) {
    root.classList.add("hidden");
    return;
  }

  root.classList.remove("hidden");

  const scopeSuffix = options.scopeLabel ? ` (${options.scopeLabel})` : "";

  renderComparePanel(
    document.getElementById("panel-prev-month-accidents"),
    `직전 월 철도사고 발생현황${scopeSuffix}`,
    monthComparison.prevMonth?.accidents,
    {
      showCurrentYear: true,
      accentClass: "text-navy-900",
      updating: monthComparison.prevMonth?.accidents?.dataReady === false,
    },
  );
  renderComparePanel(
    document.getElementById("panel-current-month-accidents"),
    `당월 철도사고 발생현황${scopeSuffix}`,
    monthComparison.currentMonth?.accidents,
    { showCurrentYear: true, aggregating: true, accentClass: "text-navy-900" },
  );
  renderComparePanel(
    document.getElementById("panel-prev-month-disruptions"),
    `직전 월 운행장애 발생현황${scopeSuffix}`,
    monthComparison.prevMonth?.disruptions,
    {
      showCurrentYear: true,
      accentClass: "text-red-700",
      updating: monthComparison.prevMonth?.disruptions?.dataReady === false,
    },
  );
  renderComparePanel(
    document.getElementById("panel-current-month-disruptions"),
    `당월 운행장애 발생현황${scopeSuffix}`,
    monthComparison.currentMonth?.disruptions,
    { showCurrentYear: true, aggregating: true, accentClass: "text-red-700" },
  );
}

function setMonthComparisonVisibility(visible) {
  const root = document.getElementById("month-compare-root");
  if (!root) return;
  root.classList.toggle("hidden", !visible);
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
