function formatStatusCount(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("ko-KR");
}

function buildStatusCountMarkup(value, accentClass, { clickable, navConfig } = {}) {
  const countText = formatStatusCount(value);
  if (!clickable || !navConfig) {
    return `<span class="text-3xl font-bold ${accentClass}">${countText}</span>`;
  }

  const { year, month, throughMonth, kind, label } = navConfig;
  const attrs = [
    `data-year="${year}"`,
    `data-kind="${kind}"`,
    month ? `data-month="${month}"` : "",
    throughMonth ? `data-through-month="${throughMonth}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<button type="button" class="year-status-count-btn border-0 bg-transparent p-0 text-3xl font-bold ${accentClass} hover:underline cursor-pointer" ${attrs} aria-label="${label} ${countText}건 데이터시트로 이동">${countText}</button>`;
}

function buildStatusColumn(label, value, subLabel, accentClass, navOptions = {}) {
  return `
    <div class="rounded border border-gray-200 bg-gray-50 px-4 py-4 text-center">
      <p class="text-xs font-medium text-gray-500">${label}</p>
      <p class="mt-2">
        ${buildStatusCountMarkup(value, accentClass, navOptions)}
        <span class="ml-0.5 text-base font-semibold text-gray-600">건</span>
      </p>
      ${subLabel ? `<p class="mt-1.5 text-[11px] text-gray-400">${subLabel}</p>` : ""}
    </div>
  `;
}

function handleYearStatusCountClick(event) {
  const btn = event.target.closest(".year-status-count-btn");
  if (!btn || typeof navigateToScopedAccidentSearch !== "function") return;

  const kind = btn.dataset.kind;
  const year = Number(btn.dataset.year);
  const month = btn.dataset.month ? Number(btn.dataset.month) : null;
  const throughMonth = btn.dataset.throughMonth ? Number(btn.dataset.throughMonth) : null;
  const dashboardChart = kind === "accident" ? "scoped-accidents" : "scoped-disruptions";

  navigateToScopedAccidentSearch({ year, month, throughMonth, dashboardChart });
}

let yearStatusClickBound = false;

function bindYearStatusClickHandlers(rootId) {
  if (yearStatusClickBound) return;
  const root = document.getElementById(rootId || "year-status-root");
  if (!root) return;
  root.addEventListener("click", handleYearStatusCountClick);
  yearStatusClickBound = true;
}

function renderYearStatusPanel(container, title, metric, accentClass, { year, currentMonth, kind, clickable } = {}) {
  if (!container || !metric) return;

  const navBase = { kind, clickable };
  container.innerHTML = `
    <h3 class="text-sm font-bold text-gray-900">${title}</h3>
    <div class="mt-3 grid grid-cols-2 gap-3">
      ${buildStatusColumn(
        "누적 총계",
        metric.cumulativeTotal,
        "DB 기준",
        accentClass,
        {
          ...navBase,
          label: "누적 총계",
          navConfig: clickable
            ? { year, throughMonth: currentMonth, kind, label: "누적 총계" }
            : null,
        },
      )}
      ${buildStatusColumn(
        "직전월 발생",
        metric.prevMonthCount,
        metric.prevMonthLabel,
        accentClass,
        {
          ...navBase,
          label: "직전월 발생",
          navConfig: clickable
            ? { year: metric.prevMonthYear, month: metric.prevMonth, kind, label: "직전월 발생" }
            : null,
        },
      )}
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

  const panelOptions = { year, currentMonth, clickable: Boolean(options.clickable) };
  if (options.clickable) {
    bindYearStatusClickHandlers(options.rootId);
  }

  renderYearStatusPanel(
    document.getElementById("panel-year-disruptions"),
    `${year}년 장애 현황${scopeSuffix}`,
    yearStatusSummary.disruptions,
    "text-red-700",
    { ...panelOptions, kind: "disruption" },
  );
  renderYearStatusPanel(
    document.getElementById("panel-year-accidents"),
    `${year}년 사고 현황${scopeSuffix}`,
    yearStatusSummary.accidents,
    "text-navy-900",
    { ...panelOptions, kind: "accident" },
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
