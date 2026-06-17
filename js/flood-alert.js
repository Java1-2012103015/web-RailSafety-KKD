let floodState = {
  search: "",
  page: 1,
  pageSize: 10,
};
let floodPortalCsvEncoding = "EUC-KR";

function isFloodAdminUser() {
  return getUser()?.role === "ADMIN";
}

function updateFloodAdminControls() {
  const isAdmin = isFloodAdminUser();
  document.getElementById("flood-check-col")?.classList.toggle("hidden", !isAdmin);
  document.getElementById("flood-delete-selected-btn")?.classList.toggle("hidden", !isAdmin);
}

function formatFloodDate(value, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function downloadFloodCsv(filename, content) {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderFloodTable(records) {
  const body = document.getElementById("flood-table-body");
  if (!body) return;
  const isAdmin = isFloodAdminUser();
  const colSpan = isAdmin ? 12 : 11;

  if (!records.length) {
    body.innerHTML = `<tr><td colspan="${colSpan}" class="px-4 py-10 text-center text-gray-500">조회 결과가 없습니다.</td></tr>`;
    return;
  }

  body.innerHTML = records
    .map(
      (row) => `
        <tr>
          ${
            isAdmin
              ? `<td class="px-3 py-3"><input type="checkbox" class="flood-row-check rounded border-gray-400" data-id="${row.id}" /></td>`
              : ""
          }
          <td class="px-4 py-3 font-mono text-xs">${row.accidentNumber ?? "-"}</td>
          <td class="px-4 py-3">${row.agencyName}</td>
          <td class="px-4 py-3">${row.lineName}</td>
          <td class="px-4 py-3 font-medium">${row.siteName}</td>
          <td class="px-4 py-3">${row.location}</td>
          <td class="px-4 py-3 whitespace-nowrap">${row.accidentAtText || formatFloodDate(row.accidentAt)}</td>
          <td class="px-4 py-3">${row.rainfall15mMm ?? "-"}</td>
          <td class="px-4 py-3">${row.rainfall30mMm ?? "-"}</td>
          <td class="px-4 py-3">${row.rainfall60mMm ?? row.rainfallMm ?? "-"}</td>
          <td class="px-4 py-3">${row.rainfall360mMm ?? "-"}</td>
          <td class="px-4 py-3">${row.weatherStationCode ?? "-"}</td>
        </tr>
      `,
    )
    .join("");

  const checkAll = document.getElementById("flood-check-all");
  if (checkAll) checkAll.checked = false;
}

async function loadFloodAlertList() {
  const loading = document.getElementById("flood-loading");
  const content = document.getElementById("flood-content");
  if (loading) loading.classList.remove("hidden");
  if (content) content.classList.add("hidden");

  const params = new URLSearchParams({
    page: String(floodState.page),
    pageSize: String(floodState.pageSize),
  });
  if (floodState.search) params.set("search", floodState.search);

  const result = await apiFetch(`/api/flood-alert?${params.toString()}`, { auth: true });
  const { records, pagination } = result.data ?? { records: [], pagination: {} };

  renderFloodTable(records);
  const info = document.getElementById("flood-pagination-info");
  if (info) {
    info.textContent = `${pagination.page ?? 1} / ${pagination.totalPages ?? 1} 페이지 · 총 ${pagination.totalRecords ?? 0}건`;
  }
  document.getElementById("flood-prev-page")?.toggleAttribute("disabled", (pagination.page ?? 1) <= 1);
  document.getElementById("flood-next-page")?.toggleAttribute("disabled", (pagination.page ?? 1) >= (pagination.totalPages ?? 1));

  if (loading) loading.classList.add("hidden");
  if (content) content.classList.remove("hidden");
}

function getSelectedFloodIds() {
  return Array.from(document.querySelectorAll(".flood-row-check:checked"))
    .map((el) => Number(el.dataset.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function deleteSelectedFloodRecords() {
  const selectedIds = getSelectedFloodIds();
  if (!selectedIds.length) {
    alert("삭제할 데이터를 먼저 선택해 주세요.");
    return;
  }

  const confirmed = window.confirm(`선택한 ${selectedIds.length}건을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);
  if (!confirmed) return;

  const btn = document.getElementById("flood-delete-selected-btn");
  const originalLabel = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "삭제 중...";
  }

  try {
    const result = await apiFetch("/api/flood-alert", {
      auth: true,
      method: "DELETE",
      body: { ids: selectedIds },
    });
    const deleted = result.data?.deleted ?? 0;
    alert(`${deleted}건 삭제되었습니다.`);
    floodState.page = 1;
    await loadFloodAlertList();
    const checkAll = document.getElementById("flood-check-all");
    if (checkAll) checkAll.checked = false;
  } catch (error) {
    console.error(error);
    alert(error.message ?? "삭제에 실패했습니다.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

function readFloodPortalCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result ?? "");
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsText(file, floodPortalCsvEncoding);
  });
}

async function downloadFloodSampleCsv() {
  const res = await apiFetch("/api/flood-alert/sample-csv", { auth: true });
  downloadFloodCsv("flood-alert-sample.csv", res.data);
}

async function downloadFloodCurrentCsv() {
  const res = await apiFetch("/api/flood-alert/export-csv", { auth: true });
  downloadFloodCsv("flood-alert-current.csv", res.data);
}

function setupFloodAdminCsvUpload() {
  const user = getUser();
  const wrap = document.getElementById("flood-admin-upload-wrap");
  if (!wrap || user?.role !== "ADMIN") return;

  wrap.classList.remove("hidden");

  const fileInput = document.getElementById("flood-admin-csv-file");
  const uploadBtn = document.getElementById("flood-admin-upload-btn");
  const status = document.getElementById("flood-admin-upload-status");

  uploadBtn?.addEventListener("click", () => fileInput?.click());

  document.querySelectorAll(".flood-portal-encoding-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      floodPortalCsvEncoding = btn.getAttribute("data-flood-portal-encoding") || "UTF-8";
      document.querySelectorAll(".flood-portal-encoding-btn").forEach((item) => {
        const active = item.getAttribute("data-flood-portal-encoding") === floodPortalCsvEncoding;
        item.className = active
          ? "flood-portal-encoding-btn rounded px-2 py-1 bg-navy-900 text-white"
          : "flood-portal-encoding-btn rounded px-2 py-1 text-gray-600";
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
      const csv = await readFloodPortalCsvFile(file);
      const res = await apiFetch("/api/admin/flood-alert/upload-csv", {
        auth: true,
        method: "POST",
        body: { csv },
      });
      const { processedCount = 0, createdCount = 0, updatedCount = 0, stationMappedCount = 0 } = res.data ?? {};
      if (status) {
        status.textContent = `완료 ${processedCount}건 (신규 ${createdCount}, 갱신 ${updatedCount}, 지점매핑 ${stationMappedCount})`;
        status.className = "text-xs text-green-600";
      }
      fileInput.value = "";
      floodState.page = 1;
      await loadFloodAlertList();
    } catch (error) {
      if (status) {
        status.textContent = `업로드 실패: ${error.message}`;
        status.className = "text-xs text-red-600";
      }
    }
  });
}

function bindFloodAlertEvents() {
  document.getElementById("flood-download-sample-btn")?.addEventListener("click", () => {
    downloadFloodSampleCsv().catch((error) => alert(error.message));
  });
  document.getElementById("flood-download-current-btn")?.addEventListener("click", () => {
    downloadFloodCurrentCsv().catch((error) => alert(error.message));
  });
  document.getElementById("flood-search-btn")?.addEventListener("click", () => {
    floodState.search = document.getElementById("flood-search")?.value.trim() ?? "";
    floodState.page = 1;
    loadFloodAlertList().catch(console.error);
  });
  document.getElementById("flood-search")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    floodState.search = event.currentTarget.value.trim();
    floodState.page = 1;
    loadFloodAlertList().catch(console.error);
  });
  document.getElementById("flood-prev-page")?.addEventListener("click", () => {
    floodState.page = Math.max(1, floodState.page - 1);
    loadFloodAlertList().catch(console.error);
  });
  document.getElementById("flood-next-page")?.addEventListener("click", () => {
    floodState.page += 1;
    loadFloodAlertList().catch(console.error);
  });
  document.getElementById("flood-check-all")?.addEventListener("change", (event) => {
    const checked = event.currentTarget.checked;
    document.querySelectorAll(".flood-row-check").forEach((el) => {
      el.checked = checked;
    });
  });
  document.getElementById("flood-delete-selected-btn")?.addEventListener("click", () => {
    deleteSelectedFloodRecords();
  });
}

async function initFloodAlertPage() {
  if (!requireAuth()) return;
  bindPortalHeader();
  bindFloodAlertEvents();
  updateFloodAdminControls();
  setupFloodAdminCsvUpload();
  try {
    await Promise.all([loadPortalBranding(), loadPortalMenus()]);
    await loadFloodAlertList();
  } catch (error) {
    console.error("Flood alert page init failed:", error);
    const loading = document.getElementById("flood-loading");
    if (loading) loading.textContent = "데이터를 불러오지 못했습니다.";
  }
}
