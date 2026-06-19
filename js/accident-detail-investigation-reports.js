let investigationReportState = {
  accidentId: null,
  links: [],
  isAdmin: false,
  visible: true,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseInvestigationReportLinks(raw) {
  if (raw == null || raw === "") return [];
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const url = String(item.url ?? "").trim();
      if (!url) return null;
      return {
        id: String(item.id ?? "").trim() || `link-${index + 1}`,
        title: String(item.title ?? "").trim() || `조사보고서 ${index + 1}`,
        url,
        createdAt: String(item.createdAt ?? "").trim() || new Date(0).toISOString(),
      };
    })
    .filter(Boolean);
}

function setInvestigationReportStatus(message, isError = false) {
  const statusEl = document.getElementById("investigation-report-status");
  if (!statusEl) return;
  statusEl.textContent = message ?? "";
  statusEl.classList.toggle("text-red-600", Boolean(isError));
  statusEl.classList.toggle("text-gray-500", !isError);
}

function toggleInvestigationReportForm(show) {
  const form = document.getElementById("investigation-report-form");
  const addBtn = document.getElementById("investigation-report-add-btn");
  if (form) form.classList.toggle("hidden", !show);
  if (addBtn) addBtn.classList.toggle("hidden", show);
}

function clearInvestigationReportFormFields(message = "") {
  const titleEl = document.getElementById("investigation-report-title");
  const urlEl = document.getElementById("investigation-report-url");
  if (titleEl) titleEl.value = "";
  if (urlEl) urlEl.value = "";
  setInvestigationReportStatus(message);
}

function resetInvestigationReportForm() {
  clearInvestigationReportFormFields("");
  toggleInvestigationReportForm(false);
}

function buildInvestigationReportDownloadButton(accidentId, link, { compact = false } = {}) {
  const className = compact
    ? "investigation-report-download-btn inline-block text-base leading-none hover:opacity-80"
    : "investigation-report-download-btn inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-base leading-none hover:bg-gray-50";
  return `<button
    type="button"
    class="${className}"
    title="${escapeHtml(link.title)} 열기"
    aria-label="${escapeHtml(link.title)} 열기"
    data-accident-id="${escapeHtml(String(accidentId))}"
    data-link-id="${escapeHtml(link.id)}"
    data-link-url="${escapeHtml(link.url)}"
    data-link-title="${escapeHtml(link.title)}"
  >💾</button>`;
}

function openInvestigationReportLink(url) {
  const targetUrl = String(url ?? "").trim();
  if (!targetUrl) {
    alert("조사보고서 링크가 없습니다.");
    return;
  }
  window.open(targetUrl, "_blank", "noopener,noreferrer");
}

function bindInvestigationReportDownloadButtons(root = document) {
  root.querySelectorAll(".investigation-report-download-btn").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      openInvestigationReportLink(button.dataset.linkUrl);
    });
  });
}

function renderInvestigationReportList() {
  const listEl = document.getElementById("investigation-report-list");
  const emptyEl = document.getElementById("investigation-report-empty");
  const adminTools = document.getElementById("investigation-report-admin-tools");
  if (!listEl || !emptyEl) return;

  if (!investigationReportState.visible) {
    listEl.innerHTML = "";
    emptyEl.classList.add("hidden");
    if (adminTools) adminTools.classList.add("hidden");
    return;
  }

  const { links, isAdmin } = investigationReportState;
  emptyEl.classList.toggle("hidden", links.length > 0);
  if (adminTools) adminTools.classList.toggle("hidden", !isAdmin);

  const countEl = document.getElementById("investigation-report-count");
  if (countEl) {
    countEl.textContent = links.length ? `등록된 링크 ${links.length}개` : "";
    countEl.classList.toggle("hidden", links.length === 0);
  }

  if (!links.length) {
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = links
    .map(
      (link, index) => `
        <div class="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2">
          <div class="flex min-w-0 items-center gap-2">
            ${buildInvestigationReportDownloadButton(investigationReportState.accidentId, link)}
            <span class="text-xs text-gray-500">${index + 1}.</span>
            ${
              isAdmin
                ? `<a
                    href="${escapeHtml(link.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="truncate text-sm font-medium text-navy-800 underline-offset-2 hover:underline"
                  >
                    ${escapeHtml(link.title)}
                  </a>`
                : `<span class="truncate text-sm font-medium text-gray-800">${escapeHtml(link.title)}</span>`
            }
          </div>
          ${
            isAdmin
              ? `<button
                  type="button"
                  class="investigation-report-delete-btn shrink-0 rounded border border-red-300 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                  data-link-id="${escapeHtml(link.id)}"
                >
                  삭제
                </button>`
              : ""
          }
        </div>
      `,
    )
    .join("");

  bindInvestigationReportDownloadButtons(listEl);

  listEl.querySelectorAll(".investigation-report-delete-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const linkId = button.dataset.linkId;
      if (!linkId) return;
      if (!window.confirm("이 조사보고서 링크를 삭제하시겠습니까?")) return;
      const nextLinks = investigationReportState.links.filter((link) => link.id !== linkId);
      await saveInvestigationReportLinks(nextLinks);
    });
  });
}

async function saveInvestigationReportLinks(nextLinks, { keepFormOpen = false } = {}) {
  if (!investigationReportState.accidentId) return;

  setInvestigationReportStatus("저장 중...");
  try {
    const result = await apiFetch(
      `/api/accidents/${investigationReportState.accidentId}/investigation-reports`,
      {
        auth: true,
        method: "PATCH",
        body: { links: nextLinks },
      },
    );

    investigationReportState.links = parseInvestigationReportLinks(result.data?.investigationReportLinks);
    renderInvestigationReportList();

    if (keepFormOpen && investigationReportState.isAdmin) {
      clearInvestigationReportFormFields("링크가 추가되었습니다. 계속 추가할 수 있습니다.");
      toggleInvestigationReportForm(true);
      document.getElementById("investigation-report-url")?.focus();
    } else {
      resetInvestigationReportForm();
    }

    const updatedEl = document.getElementById("f-report-updated");
    if (updatedEl && result.data?.savedAtText) {
      updatedEl.value = result.data.savedAtText;
    }
  } catch (error) {
    console.error(error);
    setInvestigationReportStatus(error.message ?? "저장에 실패했습니다.", true);
  }
}

function bindInvestigationReportEvents() {
  const addBtn = document.getElementById("investigation-report-add-btn");
  const saveBtn = document.getElementById("investigation-report-save-btn");
  const cancelBtn = document.getElementById("investigation-report-cancel-btn");

  if (addBtn && !addBtn.dataset.bound) {
    addBtn.dataset.bound = "true";
    addBtn.addEventListener("click", () => {
      toggleInvestigationReportForm(true);
      document.getElementById("investigation-report-url")?.focus();
    });
  }

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.dataset.bound = "true";
    cancelBtn.addEventListener("click", resetInvestigationReportForm);
  }

  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "true";
    saveBtn.addEventListener("click", async () => {
      const title = document.getElementById("investigation-report-title")?.value.trim() || "";
      const url = document.getElementById("investigation-report-url")?.value.trim() || "";

      if (!url) {
        setInvestigationReportStatus("URL을 입력해 주세요.", true);
        return;
      }
      if (!/^https?:\/\/.+/i.test(url)) {
        setInvestigationReportStatus("URL은 http:// 또는 https://로 시작해야 합니다.", true);
        return;
      }

      const nextLinks = [
        ...investigationReportState.links,
        {
          id: `link-${Date.now()}`,
          title: title || `조사보고서 ${investigationReportState.links.length + 1}`,
          url,
          createdAt: new Date().toISOString(),
        },
      ];

      await saveInvestigationReportLinks(nextLinks, { keepFormOpen: true });
    });
  }
}

function initInvestigationReports({ accidentId, linksRaw, isAdmin = false, visible = true }) {
  investigationReportState = {
    accidentId,
    links: parseInvestigationReportLinks(linksRaw),
    isAdmin: Boolean(isAdmin),
    visible: Boolean(visible),
  };

  bindInvestigationReportEvents();
  resetInvestigationReportForm();
  renderInvestigationReportList();
}

window.initInvestigationReports = initInvestigationReports;
window.parseInvestigationReportLinks = parseInvestigationReportLinks;
window.openInvestigationReportLink = openInvestigationReportLink;
window.bindInvestigationReportDownloadButtons = bindInvestigationReportDownloadButtons;
window.buildInvestigationReportDownloadButton = buildInvestigationReportDownloadButton;
