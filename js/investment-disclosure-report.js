const reportCharts = {};

const REPORT_PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#6366f1", "#14b8a6"];

function isPublicInvestmentReportPage() {
  return (
    document.body?.dataset?.invReportPublic === "true" ||
    window.location.pathname.startsWith("/public/")
  );
}

function sectionKey(section) {
  return `s${section.index}`;
}

function destroyReportChart(key) {
  if (reportCharts[key]) {
    reportCharts[key].destroy();
    delete reportCharts[key];
  }
}

function formatReportAmount(value) {
  if (!value) return "-";
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function formatReportDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKoreanWonFromMillion(valueInMillions) {
  if (!valueInMillions) return "0원";
  const absoluteWon = Math.round(valueInMillions * 1000000);
  const jo = Math.floor(absoluteWon / 1000000000000);
  const eok = Math.floor((absoluteWon % 1000000000000) / 100000000);
  const man = Math.floor((absoluteWon % 100000000) / 10000);
  const parts = [];
  if (jo > 0) parts.push(`${jo.toLocaleString()}조`);
  if (eok > 0) parts.push(`${eok.toLocaleString()}억`);
  if (man > 0 && jo === 0) parts.push(`${man.toLocaleString()}만`);
  if (!parts.length) parts.push(`${(absoluteWon % 10000).toLocaleString()}`);
  return `${parts.join(" ")} 원`;
}

function pickTrendMoneyUnit(maxAmountMillion) {
  if (maxAmountMillion >= 1000000) return { divisor: 1000000, unit: "조" };
  return { divisor: 100, unit: "억" };
}

function formatTrendMoney(amountMillion, unitInfo) {
  if (amountMillion == null || Number.isNaN(amountMillion)) return "-";
  const value = amountMillion / unitInfo.divisor;
  if (value === 0) return `0${unitInfo.unit}`;
  if (unitInfo.unit === "조") {
    return value >= 10
      ? `${Math.round(value).toLocaleString()}조`
      : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;
  }
  return value >= 100
    ? `${Math.round(value).toLocaleString()}억`
    : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
}

function formatTrendRate(plan, actual) {
  if (actual == null || actual === undefined) return "-";
  if (!plan) return actual > 0 ? "100%+" : "-";
  return `${((actual / plan) * 100).toFixed(1)}%`;
}

function renderReportTable(yearColumns, rows) {
  const yearHeaders = yearColumns.map((year) => `<th class="col-year">${year}년</th>`).join("");

  const body = rows.length
    ? rows
        .map((row) => {
          const yearCells = yearColumns
            .map((year) => `<td class="col-year">${formatReportAmount(row.amounts[year])}</td>`)
            .join("");
          return `
            <tr>
              <td class="col-category">${row.category1}</td>
              <td class="col-type">${row.category2}</td>
              <td class="col-source">${row.category3}</td>
              ${yearCells}
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="${3 + yearColumns.length}" style="text-align:center;padding:24px;color:#6b7280;">표시할 데이터가 없습니다.</td></tr>`;

  return `
    <div class="inv-report-table-wrap">
      <table class="inv-report-table">
        <thead>
          <tr>
            <th class="col-category">구분1</th>
            <th class="col-type">구분2</th>
            <th class="col-source">구분3</th>
            ${yearHeaders}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderSummaryHtml(stats) {
  return `
    <dl class="inv-report-summary">
      <div class="inv-report-summary-card">
        <dt>총 투자 예정금 (${stats.totalPlanYearLabel ?? ""})</dt>
        <dd>${formatKoreanWonFromMillion(stats.totalPlan)}</dd>
      </div>
      <div class="inv-report-summary-card">
        <dt>계획 대비 실적 집행률 (2023~2025)</dt>
        <dd>${stats.executionRate.toFixed(1)}%</dd>
      </div>
      <div class="inv-report-summary-card">
        <dt>안전 투자 재정 자력 조달율</dt>
        <dd>${stats.selfRelianceRate.toFixed(1)}%</dd>
      </div>
    </dl>`;
}

function renderSectionChartsHtml(key, isOverall) {
  const agencyChartHtml = isOverall
    ? `
        <div class="inv-report-chart-card span-2 inv-report-chart-card-agency">
          <h4>전체 참여기관 계획대비 실적 집행률</h4>
          <div id="${key}-agency-wrap" class="inv-report-chart-box inv-report-chart-box-agency">
            <canvas id="${key}-chart-agency"></canvas>
          </div>
          <p class="inv-report-chart-note">기관별 예산 계획 대비 실투자 집행 정합성 (2023~2025)</p>
        </div>`
    : "";

  return `
    <div class="inv-report-charts-block">
    <div class="inv-report-charts-grid">
      <div class="inv-report-chart-card inv-report-chart-card-trend">
        <h4>연도별 투자 추이 (2023~2028)</h4>
        <div class="inv-report-chart-box inv-report-chart-box-trend">
          <canvas id="${key}-chart-trend"></canvas>
        </div>
        <div id="${key}-trend-summary" class="inv-report-trend-summary"></div>
        <p class="inv-report-chart-note">2026~2028년은 계획만 표시 · 소계 기준</p>
      </div>
      <div class="inv-report-chart-card inv-report-chart-card-funding">
        <h4 id="${key}-funding-title">투자예산 재원비율</h4>
        <div class="inv-report-funding-row">
          <div class="inv-report-chart-box inv-report-chart-box-funding">
            <canvas id="${key}-chart-funding"></canvas>
          </div>
          <div id="${key}-funding-legend" class="inv-report-funding-legend"></div>
        </div>
      </div>
      <div class="inv-report-chart-card span-2">
        <h4>연도별 세부 안전분야별 투자 현황</h4>
        <div class="inv-report-chart-box tall"><canvas id="${key}-chart-category"></canvas></div>
        <p class="inv-report-chart-note">계획·소계 기준 · 전체 분야 누적</p>
      </div>
      ${agencyChartHtml}
    </div>
    </div>`;
}

function renderReportSection(section, yearColumns) {
  const key = sectionKey(section);
  const isOverall = section.index === 1;
  return `
    <section class="inv-report-section inv-report-section-page" data-section-key="${key}">
      <h3 class="inv-report-section-title">${section.index}. ${section.title}</h3>
      ${renderSummaryHtml(section.summary)}
      ${renderSectionChartsHtml(key, isOverall)}
      <div class="inv-report-detail-data">
        <p class="inv-report-section-table-title">공시 상세 데이터 (금액 단위: 백만원)</p>
        ${renderReportTable(yearColumns, section.rows)}
      </div>
    </section>`;
}

function renderTrendSummaryTable(containerId, data, unitInfo) {
  const wrap = document.getElementById(containerId);
  if (!wrap || !data?.length) return;

  const rows = data
    .map((d) => {
      const rate = formatTrendRate(d.plan, d.actual);
      return `
        <tr>
          <td>${d.name}</td>
          <td>${formatTrendMoney(d.plan, unitInfo)}</td>
          <td>${formatTrendMoney(d.actual, unitInfo)}</td>
          <td>${rate}</td>
        </tr>`;
    })
    .join("");

  wrap.innerHTML = `
    <table class="inv-report-trend-table">
      <thead>
        <tr>
          <th>연도</th>
          <th>계획</th>
          <th>실적</th>
          <th>집행률</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="inv-report-chart-note inv-report-trend-unit">단위: ${unitInfo.unit}원</p>`;
}

function getTrendChartOptions(unitInfo) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 4, right: 8, bottom: 2, left: 8 },
    },
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: { boxWidth: 10, font: { size: 10 } },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { size: 9 },
          padding: 6,
          maxTicksLimit: 6,
          callback: (value) => formatTrendMoney(value, unitInfo),
        },
      },
      x: {
        ticks: {
          font: { size: 9 },
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          padding: 8,
        },
        grid: { drawTicks: false },
      },
    },
  };
}

function renderSectionTrendChart(key, data) {
  const chartKey = `${key}-trend`;
  destroyReportChart(chartKey);
  const canvas = document.getElementById(`${key}-chart-trend`);
  if (!canvas || !window.Chart) return;

  const maxAmount = data?.length
    ? Math.max(...data.flatMap((d) => [d.plan || 0, d.actual || 0]))
    : 0;
  const unitInfo = pickTrendMoneyUnit(maxAmount);
  renderTrendSummaryTable(`${key}-trend-summary`, data, unitInfo);

  reportCharts[chartKey] = new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((d) => d.name),
      datasets: [
        {
          label: "계획",
          data: data.map((d) => d.plan),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: "실적",
          data: data.map((d) => d.actual ?? null),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: getTrendChartOptions(unitInfo),
  });
}

function renderSectionFundingChart(key, fundingRatioByYear) {
  const chartKey = `${key}-funding`;
  destroyReportChart(chartKey);
  const canvas = document.getElementById(`${key}-chart-funding`);
  const legend = document.getElementById(`${key}-funding-legend`);
  const title = document.getElementById(`${key}-funding-title`);
  if (!canvas || !window.Chart) return;

  const year = fundingRatioByYear?.defaultYear ?? 2026;
  const data = fundingRatioByYear?.byYear?.[String(year)] ?? [];
  if (title) title.textContent = `투자예산 재원비율 (${year}년)`;

  if (!data.length) {
    if (legend) legend.innerHTML = '<p class="inv-report-chart-note">재원 비중 데이터가 없습니다.</p>';
    return;
  }

  reportCharts[chartKey] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: data.map((d) => d.name),
      datasets: [{ data: data.map((d) => d.value), backgroundColor: REPORT_PIE_COLORS }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
    },
  });

  if (legend) {
    legend.innerHTML = data
      .map(
        (entry, idx) => `
      <div class="inv-report-funding-legend-item">
        <span class="inv-report-funding-legend-label"><span class="inv-report-funding-legend-dot" style="background:${REPORT_PIE_COLORS[idx]}"></span>${entry.name.split(" ")[0]}</span>
        <span class="inv-report-funding-legend-value">${entry.percent}% (${formatTrendMoney(entry.value, pickTrendMoneyUnit(entry.value))})</span>
      </div>`,
      )
      .join("");
  }
}

function renderSectionCategoryChart(key, categoryYearTrend) {
  const chartKey = `${key}-category`;
  destroyReportChart(chartKey);
  const canvas = document.getElementById(`${key}-chart-category`);
  if (!canvas || !window.Chart || !categoryYearTrend) return;

  const categoryItems = categoryYearTrend.categories.filter((c) => c.value !== "ALL");
  const labels = (categoryYearTrend.seriesByCategory.ALL ?? []).map((d) => d.label);
  const datasets = categoryItems.map((cat, idx) => {
    const series = categoryYearTrend.seriesByCategory[cat.value] ?? [];
    return {
      label: cat.label,
      data: series.map((d) => d.amount),
      backgroundColor: REPORT_PIE_COLORS[idx % REPORT_PIE_COLORS.length],
      borderRadius: 3,
      stack: "category",
    };
  });

  reportCharts[chartKey] = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 9 } } },
      },
      scales: {
        x: { stacked: true, ticks: { font: { size: 9 } } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            font: { size: 9 },
            callback: (value) => formatTrendMoney(value, pickTrendMoneyUnit(value)),
          },
        },
      },
    },
  });
}

function renderSectionAgencyChart(key, data) {
  const chartKey = `${key}-agency`;
  destroyReportChart(chartKey);
  const canvas = document.getElementById(`${key}-chart-agency`);
  const wrap = document.getElementById(`${key}-agency-wrap`);
  if (!canvas || !window.Chart || !wrap) return;

  const rows = data ?? [];
  const rowHeight = 32;
  const height = Math.max(200, rows.length * rowHeight + 48);
  wrap.style.height = `${height}px`;
  wrap.style.minHeight = `${height}px`;
  wrap.dataset.agencyCount = String(rows.length);
  wrap.dataset.agencyHeight = String(height);

  const agencyRows = rows.map((d) => ({
    name: d.name,
    rate: d.rate ?? 0,
    planSum: Number(d.planSum) || 0,
    actualSum: Number(d.actualSum) || 0,
  }));

  const labelPlugin = createAgencyRateLabelPlugin(`reportAgencyRateLabels-${key}`);

  reportCharts[chartKey] = new Chart(canvas, {
    type: "bar",
    plugins: [labelPlugin],
    data: {
      labels: agencyRows.map((d) => d.name),
      datasets: [
        {
          label: "집행률",
          data: agencyRows.map((d) => d.rate),
          backgroundColor: agencyRows.map((d) =>
            d.rate >= 95 ? "#10b981" : d.rate >= 85 ? "#3b82f6" : "#f59e0b",
          ),
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 100, ticks: { font: { size: 9 } } },
        y: { ticks: { font: { size: 9 } } },
      },
    },
  });
  reportCharts[chartKey].$agencyTooltipRows = agencyRows;
  reportCharts[chartKey].resize();
}

function renderSectionCharts(section) {
  const key = sectionKey(section);
  const dashboard = section.dashboard;
  if (!dashboard) return;

  renderSectionTrendChart(key, dashboard.trendChart ?? []);
  renderSectionFundingChart(key, dashboard.fundingRatioByYear ?? null);
  renderSectionCategoryChart(key, dashboard.categoryYearTrend ?? null);

  if (section.index === 1) {
    renderSectionAgencyChart(key, dashboard.agencyCompare ?? []);
  }
}

function renderAllSectionCharts(sections) {
  for (const section of sections) {
    renderSectionCharts(section);
  }
}

function renderReportCover(report, sectionCount) {
  const subtitle = "철도·도시철도 운영사 철도안전 투자 계획 및 실적 공시 종합";
  const metaLine = `작성일시: ${formatReportDate(report.generatedAt)} · 금액 단위: 백만원`;
  const noteLine = `총 ${sectionCount}개 기관 · 기관별 1페이지`;

  return `
    <header class="inv-report-cover">
      <div class="inv-report-cover-inner">
        <h2>${report.disclosureYear}(공시년도) 철도안전투자 공시현황</h2>
        <p
          class="inv-report-cover-editable"
          contenteditable="true"
          spellcheck="false"
          data-cover-field="subtitle"
          data-placeholder="부제목을 입력하세요"
        >${subtitle}</p>
        <p
          class="inv-report-cover-editable"
          contenteditable="true"
          spellcheck="false"
          data-cover-field="meta"
          data-placeholder="작성일시·단위 정보"
        >${metaLine}</p>
        <p
          class="inv-report-cover-editable"
          contenteditable="true"
          spellcheck="false"
          data-cover-field="note"
          data-placeholder="기관 수·페이지 안내 문구"
        >${noteLine}</p>
      </div>
    </header>`;
}

function setupCoverEditableFields() {
  document.querySelectorAll(".inv-report-cover-editable").forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
    });
    el.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      document.execCommand("insertText", false, text.replace(/\r?\n/g, " "));
    });
  });
}

function renderReportDocument(report) {
  const documentEl = document.getElementById("inv-report-document");
  if (!documentEl) return;

  const sections = report.sections ?? [];
  const sectionsHtml = sections
    .map((section) => renderReportSection(section, report.yearColumns ?? []))
    .join("");

  documentEl.innerHTML = `
    ${renderReportCover(report, sections.length)}
    ${sectionsHtml}
    <footer class="inv-report-footnote">
      본 보고서는 철도안전정보종합관리시스템에 등록된 공시 데이터를 기준으로 자동 생성되었습니다.
      전체기관은 참여 기관 데이터를 합산한 값이며, 기관별 순서는 당해~2년후 계획 소계 투자금액이 큰 순입니다.
    </footer>`;

  setupCoverEditableFields();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => renderAllSectionCharts(sections));
  });

  document.title = `${report.disclosureYear} 철도안전투자 공시현황 | 철도안전정보종합관리시스템`;
}

async function loadInvestmentDisclosureReport() {
  const loadingEl = document.getElementById("inv-report-loading");
  const errorEl = document.getElementById("inv-report-error");
  const documentEl = document.getElementById("inv-report-document");

  const params = new URLSearchParams(window.location.search);
  const year = params.get("year");
  const query = year ? `?year=${encodeURIComponent(year)}` : "";

  try {
    const apiPath = isPublicInvestmentReportPage()
      ? `/api/public/investment-disclosure/report${query}`
      : `/api/investment-disclosure/report${query}`;
    const res = await apiFetch(apiPath, { auth: !isPublicInvestmentReportPage() });
    renderReportDocument(res.data);
    loadingEl?.classList.add("hidden");
    errorEl?.classList.add("hidden");
    documentEl?.classList.remove("hidden");
  } catch (error) {
    loadingEl?.classList.add("hidden");
    documentEl?.classList.add("hidden");
    if (errorEl) {
      errorEl.textContent = `보고서를 불러오지 못했습니다: ${error.message}`;
      errorEl.classList.remove("hidden");
    }
  }
}

function resizeAllReportCharts() {
  Object.values(reportCharts).forEach((chart) => {
    try {
      chart.resize();
    } catch {
      /* ignore */
    }
  });
}

const REPORT_PRINT_HELP_KEY = "inv-report-print-help-dismissed";
let savedReportPageTitle = document.title;
const reportPrintLayoutState = { agencyWraps: [] };

function getReportPrintPageHeightPx() {
  const pageTopMarginMm = 10;
  return Math.floor(((297 - pageTopMarginMm) * 96) / 25.4);
}

function getAgencyChartKeyFromWrap(wrap) {
  const id = wrap?.id ?? "";
  return id.replace("-agency-wrap", "");
}

function scaleAgencyChartForPrint(wrap, maxChartHeight) {
  const chartKey = `${getAgencyChartKeyFromWrap(wrap)}-agency`;
  const chart = reportCharts[chartKey];
  const rowCount = parseInt(wrap.dataset.agencyCount ?? "0", 10) || 1;
  const chartHeight = Math.max(160, Math.min(maxChartHeight, rowCount * 32 + 48));
  const fontSize = chartHeight < 320 ? 7 : chartHeight < 500 ? 8 : 9;

  wrap.style.height = `${chartHeight}px`;
  wrap.style.minHeight = `${chartHeight}px`;

  if (chart) {
    chart.options.scales.y.ticks.font.size = fontSize;
    chart.options.scales.x.ticks.font.size = fontSize;
    chart.resize();
  }
}

function prepareReportPrintLayout() {
  const pageHeight = getReportPrintPageHeightPx();
  const doc = document.getElementById("inv-report-document");
  if (!doc) return;

  reportPrintLayoutState.agencyWraps = [];
  const docTop = doc.getBoundingClientRect().top + window.scrollY;

  document.querySelectorAll(".inv-report-chart-card").forEach((card) => {
    card.classList.remove("inv-report-chart-page-start", "inv-report-chart-card-compact");

    const rect = card.getBoundingClientRect();
    const top = rect.top + window.scrollY - docTop;
    const height = rect.height;
    const offsetInPage = top % pageHeight;
    const spaceLeft = pageHeight - offsetInPage;

    if (height <= spaceLeft + 4) return;

    card.classList.add("inv-report-chart-page-start");

    if (height > pageHeight - 32) {
      card.classList.add("inv-report-chart-card-compact");
      const wrap = card.querySelector(".inv-report-chart-box-agency");
      if (wrap) {
        reportPrintLayoutState.agencyWraps.push({
          wrap,
          height: wrap.dataset.agencyHeight ? `${wrap.dataset.agencyHeight}px` : wrap.style.height,
          minHeight: wrap.style.minHeight,
          chartKey: `${getAgencyChartKeyFromWrap(wrap)}-agency`,
        });
        scaleAgencyChartForPrint(wrap, pageHeight - 88);
      }
    }
  });
}

function restoreReportPrintLayout() {
  document.querySelectorAll(".inv-report-chart-card").forEach((card) => {
    card.classList.remove("inv-report-chart-page-start", "inv-report-chart-card-compact");
  });

  for (const item of reportPrintLayoutState.agencyWraps) {
    const { wrap, height, minHeight, chartKey } = item;
    wrap.style.height = height;
    wrap.style.minHeight = minHeight;
    const chart = reportCharts[chartKey];
    if (chart) {
      chart.options.scales.y.ticks.font.size = 9;
      chart.options.scales.x.ticks.font.size = 9;
      chart.resize();
    }
  }

  reportPrintLayoutState.agencyWraps = [];
}

function prepareReportPrint() {
  savedReportPageTitle = document.title;
  document.title = " ";
}

function restoreReportPrint() {
  if (savedReportPageTitle) {
    document.title = savedReportPageTitle;
  }
}

function triggerReportPrint() {
  resizeAllReportCharts();
  prepareReportPrintLayout();
  prepareReportPrint();
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      restoreReportPrint();
      restoreReportPrintLayout();
    }, 500);
  }, 200);
}

function openReportPrintHelp() {
  const dismissed = localStorage.getItem(REPORT_PRINT_HELP_KEY) === "1";
  if (dismissed) {
    triggerReportPrint();
    return;
  }
  document.getElementById("inv-report-print-help")?.classList.remove("hidden");
}

function closeReportPrintHelp() {
  document.getElementById("inv-report-print-help")?.classList.add("hidden");
}

function setupReportPrintHelp() {
  const help = document.getElementById("inv-report-print-help");
  const goBtn = document.getElementById("inv-report-print-help-go");
  const cancelBtn = document.getElementById("inv-report-print-help-cancel");
  const skipCheck = document.getElementById("inv-report-print-help-skip");

  goBtn?.addEventListener("click", () => {
    if (skipCheck?.checked) {
      localStorage.setItem(REPORT_PRINT_HELP_KEY, "1");
    }
    closeReportPrintHelp();
    triggerReportPrint();
  });

  cancelBtn?.addEventListener("click", closeReportPrintHelp);

  help?.addEventListener("click", (e) => {
    if (e.target === help) closeReportPrintHelp();
  });
}

function setupReportToolbar() {
  const printBtn = document.getElementById("inv-report-print-btn");
  printBtn?.addEventListener("click", openReportPrintHelp);
  setupReportPrintHelp();

  const backLink = document.getElementById("inv-report-back");
  if (backLink && isPublicInvestmentReportPage()) {
    backLink.href = "/public/dashboard/investment-disclosure";
  }

  window.addEventListener("beforeprint", () => {
    prepareReportPrintLayout();
    prepareReportPrint();
    resizeAllReportCharts();
  });
  window.addEventListener("afterprint", () => {
    restoreReportPrint();
    restoreReportPrintLayout();
    resizeAllReportCharts();
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("print") === "1") {
    window.addEventListener("load", () => {
      setTimeout(() => {
        const dismissed = localStorage.getItem(REPORT_PRINT_HELP_KEY) === "1";
        if (dismissed) {
          triggerReportPrint();
        } else {
          openReportPrintHelp();
        }
      }, 1200);
    });
  }
}

async function initInvestmentDisclosureReportPage() {
  if (isPublicInvestmentReportPage()) {
    document.body.dataset.invReportPublic = "true";
  } else if (!requireAuth()) {
    return;
  }

  setupReportToolbar();
  await loadInvestmentDisclosureReport();
}
