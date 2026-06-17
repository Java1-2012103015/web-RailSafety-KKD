const invCharts = {};
let invPortalCsvEncoding = "EUC-KR";

function getInvPageMode() {
  return document.body?.dataset?.invPage === "dashboard" ? "dashboard" : "db";
}

function isPublicInvestmentPage() {
  return document.body?.dataset?.invPublic === "true";
}
let invState = {
  selectedAgencies: [],
  allAgencyNames: [],
  search: "",
  compareYear: "ALL",
  categoryYearSelected: "ALL",
  categoryYearTrend: null,
  fundingYearSelected: 2026,
  fundingRatioByYear: null,
  page: 1,
  pageSize: 10,
  lastPayload: null,
};

function formatToKoreanWon(valueInMillions) {
  if (!valueInMillions) return "0원";
  const absoluteWon = Math.round(valueInMillions * 1000000);
  const jo = Math.floor(absoluteWon / 1000000000000);
  const eok = Math.floor((absoluteWon % 1000000000000) / 100000000);
  const man = Math.floor((absoluteWon % 100000000) / 10000);
  const won = absoluteWon % 10000;
  const parts = [];
  if (jo > 0) parts.push(`${jo.toLocaleString()}조`);
  if (eok > 0) parts.push(`${eok.toLocaleString()}억`);
  if (man > 0 && jo === 0) parts.push(`${man.toLocaleString()}만`);
  if (parts.length === 0 && won > 0) parts.push(`${won.toLocaleString()}`);
  return `${parts.join(" ")} 원`;
}

function formatToAbsoluteWon(valueInMillions) {
  if (!valueInMillions) return "0원";
  return `${Math.round(valueInMillions * 1000000).toLocaleString()}원`;
}

/** 백만원 단위 → 백억 원 표기 (1백억 = 10,000백만원) */
function formatBaekEok(amountMillion) {
  const value = (amountMillion || 0) / 10000;
  if (value >= 100) return `${Math.round(value).toLocaleString()}백억`;
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}백억`;
}

let invAgencyCompareRows = [];

function destroyInvChart(key) {
  if (invCharts[key]) {
    invCharts[key].destroy();
    delete invCharts[key];
  }
}

function buildQueryParams() {
  const params = new URLSearchParams();
  invState.selectedAgencies.forEach((name) => params.append("agencies", name));
  if (invState.search) params.set("search", invState.search);
  if (invState.compareYear !== "ALL") params.set("compareYear", invState.compareYear);
  params.set("page", String(invState.page));
  params.set("pageSize", String(invState.pageSize));
  return params.toString();
}

async function loadInvestmentDashboard() {
  const wrap = document.getElementById("inv-loading");
  if (wrap) wrap.classList.remove("hidden");
  try {
    const apiPath = isPublicInvestmentPage()
      ? `/api/public/investment-disclosure?${buildQueryParams()}`
      : `/api/investment-disclosure?${buildQueryParams()}`;
    const res = await apiFetch(apiPath, { auth: !isPublicInvestmentPage() });
    invState.lastPayload = res.data;
    renderInvestmentDashboard(res.data);
  } catch (error) {
    const empty = document.getElementById("inv-empty");
    if (empty) {
      empty.classList.remove("hidden");
      empty.textContent = `데이터를 불러오지 못했습니다: ${error.message}`;
    }
  } finally {
    if (wrap) wrap.classList.add("hidden");
  }
}

function updateAgencyToggleLabel() {
  const label = document.getElementById("inv-agency-toggle-label");
  if (!label) return;
  if (!invState.selectedAgencies.length) {
    label.textContent = "전체 운영사";
    return;
  }
  if (invState.selectedAgencies.length === 1) {
    label.textContent = invState.selectedAgencies[0];
    return;
  }
  label.textContent = `${invState.selectedAgencies.length}개 기관 선택`;
}

function renderAgencyCheckboxes(agencyNames) {
  const container = document.getElementById("inv-agency-checkboxes");
  const checkAll = document.getElementById("inv-agency-check-all");
  if (!container) return;

  invState.allAgencyNames = agencyNames ?? [];
  const selectedSet = new Set(invState.selectedAgencies);

  container.innerHTML = invState.allAgencyNames
    .map(
      (name) => `
    <label class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-gray-700 hover:bg-gray-50">
      <input
        type="checkbox"
        class="inv-agency-item rounded border-gray-300"
        value="${name.replace(/"/g, "&quot;")}"
        ${selectedSet.has(name) ? "checked" : ""}
      />
      <span class="truncate">${name}</span>
    </label>`,
    )
    .join("");

  if (checkAll) {
    const allChecked =
      invState.allAgencyNames.length > 0 &&
      invState.allAgencyNames.every((name) => selectedSet.has(name));
    const noneChecked = invState.selectedAgencies.length === 0;
    checkAll.checked = noneChecked || allChecked;
    checkAll.indeterminate = !noneChecked && !allChecked && invState.selectedAgencies.length > 0;
  }

  updateAgencyToggleLabel();
}

function readAgencyChecksFromPanel() {
  const items = document.querySelectorAll(".inv-agency-item:checked");
  return Array.from(items).map((el) => el.value);
}

function setAgencyPanelOpen(open) {
  const panel = document.getElementById("inv-agency-panel");
  const toggle = document.getElementById("inv-agency-toggle");
  if (!panel || !toggle) return;
  panel.classList.toggle("hidden", !open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function setupAgencyMultiSelect(meta) {
  const names = (meta?.agencies ?? []).filter((name) => name && name !== "ALL");
  renderAgencyCheckboxes(names);
}

function bindAgencyMultiSelectEvents() {
  const toggle = document.getElementById("inv-agency-toggle");
  const panel = document.getElementById("inv-agency-panel");
  const checkAll = document.getElementById("inv-agency-check-all");
  const applyBtn = document.getElementById("inv-agency-apply");
  const clearBtn = document.getElementById("inv-agency-clear");
  const container = document.getElementById("inv-agency-checkboxes");

  toggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = panel && !panel.classList.contains("hidden");
    setAgencyPanelOpen(!isOpen);
  });

  checkAll?.addEventListener("change", () => {
    const checked = checkAll.checked;
    document.querySelectorAll(".inv-agency-item").forEach((el) => {
      el.checked = checked;
    });
    checkAll.indeterminate = false;
  });

  container?.addEventListener("change", (e) => {
    if (!e.target.classList.contains("inv-agency-item")) return;
    const items = document.querySelectorAll(".inv-agency-item");
    const checkedCount = document.querySelectorAll(".inv-agency-item:checked").length;
    if (checkAll) {
      checkAll.checked = checkedCount === items.length;
      checkAll.indeterminate = checkedCount > 0 && checkedCount < items.length;
    }
  });

  clearBtn?.addEventListener("click", () => {
    invState.selectedAgencies = [];
    document.querySelectorAll(".inv-agency-item").forEach((el) => {
      el.checked = false;
    });
    if (checkAll) {
      checkAll.checked = true;
      checkAll.indeterminate = false;
    }
    updateAgencyToggleLabel();
  });

  applyBtn?.addEventListener("click", () => {
    const checked = readAgencyChecksFromPanel();
    invState.selectedAgencies =
      checked.length === 0 || checked.length === invState.allAgencyNames.length ? [] : checked;
    invState.page = 1;
    setAgencyPanelOpen(false);
    updateAgencyToggleLabel();
    loadInvestmentDashboard();
  });

  document.addEventListener("click", (e) => {
    if (!panel || panel.classList.contains("hidden")) return;
    if (panel.contains(e.target) || toggle?.contains(e.target)) return;
    setAgencyPanelOpen(false);
  });
}

function renderStats(analytics) {
  const stats = analytics.stats;
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText("inv-total-plan-desc", `${stats.totalPlanYearLabel ?? ""} 계획 소계 합산`);
  setText("inv-total-plan", formatToKoreanWon(stats.totalPlan));
  setText("inv-total-plan-abs", `(${formatToAbsoluteWon(stats.totalPlan)})`);
  setText("inv-execution-rate", `${stats.executionRate.toFixed(1)}%`);
  setText("inv-execution-actual", `실적: ${formatToKoreanWon(stats.actualSumForRate)}`);
  setText("inv-execution-plan", `계획: ${formatToKoreanWon(stats.planSumForRate)}`);
  setText("inv-self-rate", `${stats.selfRelianceRate.toFixed(1)}%`);

  const execNote = document.getElementById("inv-execution-note");
  if (execNote) {
    execNote.textContent =
      stats.executionRate >= 90 ? "이행 기준선을 충족 중입니다." : "계획 대비 실제 투자 지연이 관측됩니다.";
  }
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#6366f1", "#14b8a6"];

function renderTrendChart(data) {
  destroyInvChart("trend");
  const canvas = document.getElementById("inv-chart-trend");
  if (!canvas || !window.Chart) return;

  invCharts.trend = new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((d) => d.name),
      datasets: [
        {
          label: "계획",
          data: data.map((d) => d.plan),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.15)",
          fill: true,
          tension: 0.3,
        },
        {
          label: "실적",
          data: data.map((d) => d.actual ?? null),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.15)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatToKoreanWon(ctx.raw)}`,
          },
        },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function populateFundingYearDropdown(years, defaultYear) {
  const select = document.getElementById("inv-funding-year-select");
  if (!select) return;

  const list = years?.length ? years : [{ value: 2026, label: "2026년" }];
  select.innerHTML = list.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");

  const preferred = String(invState.fundingYearSelected || defaultYear);
  const hasPreferred = list.some((item) => String(item.value) === preferred);
  select.value = hasPreferred ? preferred : String(defaultYear);
  invState.fundingYearSelected = parseInt(select.value, 10) || defaultYear;
}

function renderFundingChartForYear(yearKey) {
  const data = invState.fundingRatioByYear?.byYear?.[String(yearKey)] ?? [];
  renderFundingChart(data);
}

function renderFundingChart(data) {
  destroyInvChart("funding");
  const canvas = document.getElementById("inv-chart-funding");
  const legend = document.getElementById("inv-funding-legend");
  if (!canvas || !window.Chart) return;

  if (!data.length) {
    if (legend) legend.innerHTML = '<p class="text-xs text-gray-500">선택 연도에 재원 비중 데이터가 없습니다.</p>';
    return;
  }

  invCharts.funding = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: data.map((d) => d.name),
      datasets: [{ data: data.map((d) => d.value), backgroundColor: PIE_COLORS }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatToKoreanWon(ctx.raw)}`,
          },
        },
      },
    },
  });

  if (legend) {
    legend.innerHTML = data
      .map(
        (entry, idx) => `
      <div class="flex items-center justify-between p-2 rounded border border-gray-200 bg-gray-50 text-xs">
        <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${PIE_COLORS[idx]}"></span>${entry.name.split(" ")[0]}</span>
        <span class="font-mono text-gray-600">${entry.percent}% (${formatToKoreanWon(entry.value)})</span>
      </div>`,
      )
      .join("");
  }
}

function populateCategoryYearDropdown(categories) {
  const select = document.getElementById("inv-category-year-select");
  if (!select) return;

  const list = categories?.length ? categories : [{ value: "ALL", label: "전체" }];
  select.innerHTML = list
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join("");

  const hasSelected = list.some((item) => item.value === invState.categoryYearSelected);
  select.value = hasSelected ? invState.categoryYearSelected : "ALL";
  invState.categoryYearSelected = select.value;
}

function renderCategoryYearChart(selectedKey) {
  destroyInvChart("category");
  const canvas = document.getElementById("inv-chart-category");
  if (!canvas || !window.Chart || !invState.categoryYearTrend) return;

  const trend = invState.categoryYearTrend;
  const isAll = selectedKey === "ALL";
  const categoryItems = trend.categories.filter((c) => c.value !== "ALL");

  let labels;
  let datasets;

  if (isAll) {
    labels = (trend.seriesByCategory.ALL ?? []).map((d) => d.label);
    datasets = categoryItems.map((cat, idx) => {
      const series = trend.seriesByCategory[cat.value] ?? [];
      return {
        label: cat.label,
        data: series.map((d) => d.amount),
        backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
        borderRadius: 4,
        stack: "category",
      };
    });
  } else {
    const series = trend.seriesByCategory[selectedKey] ?? [];
    const categoryLabel =
      trend.categories.find((c) => c.value === selectedKey)?.label ?? "전체";
    labels = series.map((d) => d.label);
    datasets = [
      {
        label: categoryLabel,
        data: series.map((d) => d.amount),
        backgroundColor: "#6366f1",
        borderRadius: 4,
      },
    ];
  }

  invCharts.category = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: isAll, position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              isAll
                ? `${ctx.dataset.label}: ${formatToKoreanWon(ctx.raw)} (${Number(ctx.raw).toLocaleString()}백만)`
                : `${formatToKoreanWon(ctx.raw)} (${Number(ctx.raw).toLocaleString()}백만)`,
          },
        },
      },
      scales: {
        x: {
          stacked: isAll,
          title: { display: true, text: "연도", font: { size: 11 } },
        },
        y: {
          stacked: isAll,
          beginAtZero: true,
          title: { display: true, text: "금액 (백만원)", font: { size: 11 } },
        },
      },
    },
  });
}

function renderAgencyChart(data) {
  destroyInvChart("agency");
  const canvas = document.getElementById("inv-chart-agency");
  const wrap = document.getElementById("inv-chart-agency-wrap");
  if (!canvas || !window.Chart || !wrap) return;

  invAgencyCompareRows = data ?? [];
  const height = Math.max(350, invAgencyCompareRows.length * 45);
  wrap.style.height = `${height}px`;

  const agencyTooltipRows = invAgencyCompareRows.map((d) => ({
    name: d.name,
    rate: d.rate ?? 0,
    planSum: Number(d.planSum) || 0,
    actualSum: Number(d.actualSum) || 0,
  }));

  invCharts.agency = new Chart(canvas, {
    type: "bar",
    data: {
      labels: agencyTooltipRows.map((d) => d.name),
      datasets: [
        {
          label: "집행률",
          data: agencyTooltipRows.map((d) => d.rate),
          backgroundColor: agencyTooltipRows.map((d) =>
            d.rate >= 95 ? "#10b981" : d.rate >= 85 ? "#3b82f6" : "#f59e0b",
          ),
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label ?? "",
            label: (ctx) => {
              const rows = ctx.chart.$agencyTooltipRows ?? agencyTooltipRows;
              const row = rows[ctx.dataIndex];
              if (!row) return null;
              const actual = formatBaekEok(row.actualSum);
              const plan = formatBaekEok(row.planSum);
              return `${actual} / ${plan} (${row.rate}%)`;
            },
          },
        },
      },
      scales: { x: { min: 0, max: 100 } },
    },
  });
  invCharts.agency.$agencyTooltipRows = agencyTooltipRows;
}

function renderTable(records, pagination) {
  const tbody = document.getElementById("inv-table-body");
  const countEl = document.getElementById("inv-record-count");
  if (countEl) countEl.textContent = String(pagination.totalRecords);

  if (!tbody) return;
  if (!records.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="py-10 text-center text-gray-500">조회 조건에 맞는 데이터가 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = records
    .map(
      (row) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
      <td class="py-2 px-3 font-semibold">${row.agencyName}</td>
      <td class="py-2 px-3">${row.disclosureYear}년</td>
      <td class="py-2 px-3 text-xs">${row.category1}</td>
      <td class="py-2 px-3"><span class="text-[10px] px-2 py-0.5 rounded-full border ${row.category2.includes("계획") ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}">${row.category2}</span></td>
      <td class="py-2 px-3 text-xs text-gray-600">${row.category3}</td>
      <td class="py-2 px-3 font-mono text-indigo-700">${row.yearLabel}년</td>
      <td class="py-2 px-3 text-right font-mono">${Math.round(row.amountMillion).toLocaleString()} 백만</td>
    </tr>`,
    )
    .join("");

  const pageInfo = document.getElementById("inv-page-info");
  const prevBtn = document.getElementById("inv-page-prev");
  const nextBtn = document.getElementById("inv-page-next");
  const pager = document.getElementById("inv-pager");

  if (pageInfo) {
    pageInfo.textContent = `페이지 ${pagination.page} / ${pagination.totalPages} (전체 ${pagination.totalRecords}건)`;
  }
  if (prevBtn) prevBtn.disabled = pagination.page <= 1;
  if (nextBtn) nextBtn.disabled = pagination.page >= pagination.totalPages;
  if (pager) pager.classList.toggle("hidden", pagination.totalPages <= 1);
}

function renderInvestmentDashboard(payload) {
  const mode = getInvPageMode();
  document.getElementById("inv-empty")?.classList.add("hidden");
  document.getElementById("inv-content")?.classList.remove("hidden");

  setupAgencyMultiSelect(payload.meta);

  if (mode === "dashboard") {
    renderStats(payload.analytics);
    renderTrendChart(payload.analytics.trendChart);
    invState.fundingRatioByYear = payload.analytics.fundingRatioByYear ?? null;
    populateFundingYearDropdown(
      invState.fundingRatioByYear?.years,
      invState.fundingRatioByYear?.defaultYear ?? 2026,
    );
    renderFundingChartForYear(invState.fundingYearSelected);
    invState.categoryYearTrend = payload.analytics.categoryYearTrend ?? null;
    populateCategoryYearDropdown(invState.categoryYearTrend?.categories);
    renderCategoryYearChart(invState.categoryYearSelected);
    renderAgencyChart(payload.analytics.agencyCompare);
    return;
  }

  renderTable(payload.records, payload.pagination);
}

function buildExportQueryParams() {
  const params = new URLSearchParams();
  invState.selectedAgencies.forEach((name) => params.append("agencies", name));
  if (invState.search) params.set("search", invState.search);
  return params;
}

async function exportFilteredCsv() {
  try {
    const res = await apiFetch(`/api/investment-disclosure/export-csv?${buildExportQueryParams()}`, { auth: true });
    const blob = new Blob(["\uFEFF" + (res.data || "")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "railway_safety_investment_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`보내기 실패: ${err.message}`);
  }
}

function buildInvestmentXlsxRows(records) {
  return records.map((row) => ({
    기관명: row.agencyName,
    공시년도: row.disclosureYear,
    구분1: row.category1,
    구분2: row.category2,
    구분3: row.category3,
    연도구분: row.yearLabel,
    "금액(백만원)": Math.round(row.amountMillion || 0),
  }));
}

async function exportInvestmentXlsx() {
  const btn = document.getElementById("inv-export-btn");
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 페이지를 새로고침해 주세요.");
    return;
  }

  const originalLabel = btn?.textContent ?? "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "다운로드 중...";
  }

  try {
    const res = await apiFetch(`/api/investment-disclosure/export-rows?${buildExportQueryParams()}`, { auth: true });
    const records = res.data ?? [];
    if (!records.length) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const rows = buildInvestmentXlsxRows(records);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0]);
    worksheet["!cols"] = headers.map((header) => ({
      wch: Math.min(
        48,
        Math.max(header.length + 2, ...rows.map((row) => String(row[header] ?? "").length + 2)),
      ),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "공시현황");
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(workbook, `공시현황_${stamp}.xlsx`);
  } catch (err) {
    alert(`다운로드 실패: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

function setupExportButton() {
  const btn = document.getElementById("inv-export-btn");
  if (!btn) return;

  btn.textContent = "공시현황(xlsx) 다운로드";
  btn.addEventListener("click", exportInvestmentXlsx);
}

function setupAdminCsvUpload() {
  const user = getUser();
  const wrap = document.getElementById("inv-admin-upload-wrap");
  if (!wrap || user?.role !== "ADMIN") return;

  wrap.classList.remove("hidden");

  const fileInput = document.getElementById("inv-admin-csv-file");
  const uploadBtn = document.getElementById("inv-admin-upload-btn");
  const status = document.getElementById("inv-admin-upload-status");

  uploadBtn?.addEventListener("click", () => fileInput?.click());

  document.querySelectorAll(".inv-portal-encoding-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      invPortalCsvEncoding = btn.getAttribute("data-inv-portal-encoding") || "UTF-8";
      document.querySelectorAll(".inv-portal-encoding-btn").forEach((b) => {
        const active = b.getAttribute("data-inv-portal-encoding") === invPortalCsvEncoding;
        b.className = active
          ? "inv-portal-encoding-btn rounded px-2 py-1 bg-navy-900 text-white"
          : "inv-portal-encoding-btn rounded px-2 py-1 text-gray-600";
      });
    });
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (status) {
      status.textContent = "업로드 중...";
      status.className = "text-xs text-gray-500";
    }

    try {
      const csv = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target?.result ?? "");
        reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
        reader.readAsText(file, invPortalCsvEncoding);
      });

      const res = await apiFetch("/api/admin/investment-disclosure/upload-csv", {
        auth: true,
        method: "POST",
        body: { csv },
      });

      const count = res.data?.importedCount ?? 0;
      if (status) {
        status.textContent = `${count}건 반영 완료`;
        status.className = "text-xs font-semibold text-emerald-700";
      }

      fileInput.value = "";
      invState.page = 1;
      await loadInvestmentDashboard();
    } catch (error) {
      if (status) {
        status.textContent = `실패: ${error.message}`;
        status.className = "text-xs font-semibold text-red-600";
      }
      fileInput.value = "";
    }
  });
}

function bindInvestmentEvents() {
  document.getElementById("inv-compare-year")?.addEventListener("change", (e) => {
    invState.compareYear = e.target.value;
    loadInvestmentDashboard();
  });
  document.getElementById("inv-category-year-select")?.addEventListener("change", (e) => {
    invState.categoryYearSelected = e.target.value;
    renderCategoryYearChart(invState.categoryYearSelected);
  });
  document.getElementById("inv-funding-year-select")?.addEventListener("change", (e) => {
    invState.fundingYearSelected = parseInt(e.target.value, 10) || 2026;
    renderFundingChartForYear(invState.fundingYearSelected);
  });
  document.getElementById("inv-page-prev")?.addEventListener("click", () => {
    if (invState.page > 1) {
      invState.page -= 1;
      loadInvestmentDashboard();
    }
  });
  document.getElementById("inv-page-next")?.addEventListener("click", () => {
    invState.page += 1;
    loadInvestmentDashboard();
  });
}

async function initInvestmentDisclosurePage() {
  const isPublic = isPublicInvestmentPage();
  if (!isPublic && !requireAuth()) return;

  const mode = getInvPageMode();
  if (!isPublic) {
    bindPortalHeader();
    if (mode === "db") {
      setupAdminCsvUpload();
      setupExportButton();
    }
  } else {
    initPublicBoardLayout();
  }

  bindAgencyMultiSelectEvents();
  bindInvestmentEvents();
  if (mode === "dashboard") {
    invState.pageSize = 1;
  }
  try {
    if (isPublic) {
      await loadPublicBranding();
    } else {
      await Promise.all([loadPortalBranding(), loadPortalMenus()]);
    }
    await loadInvestmentDashboard();
  } catch (error) {
    console.error("Investment disclosure init failed:", error);
  }
}
