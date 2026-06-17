let brandingList = [];
let selectedKey = "GLOBAL";

function requireAdmin() {
  if (!requireAuth("/login")) return false;
  const user = getUser();
  if (!user || user.role !== "ADMIN") {
    alert("관리자만 접근할 수 있습니다.");
    window.location.href = "/portal";
    return false;
  }
  return true;
}

function scopeKey(item) {
  return item.scope === "GLOBAL" ? "GLOBAL" : `ROLE:${item.roleId}`;
}

function findSelected() {
  return brandingList.find((item) => scopeKey(item) === selectedKey);
}

function renderRoleTabs() {
  const container = document.getElementById("branding-role-tabs");
  container.innerHTML = brandingList
    .map((item) => {
      const key = scopeKey(item);
      const label = item.scope === "GLOBAL" ? "공개(기본)" : item.roleName;
      const active = key === selectedKey;
      return `
        <button
          type="button"
          data-key="${key}"
          class="rounded px-3 py-1.5 text-sm font-medium transition ${
            active ? "bg-navy-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
          }"
        >
          ${label}
        </button>
      `;
    })
    .join("");

  container.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedKey = btn.dataset.key;
      renderRoleTabs();
      fillForm(findSelected());
      renderPreview(findSelected());
    });
  });
}

function fillForm(item) {
  if (!item) return;
  document.getElementById("field-pageTitle").value = item.pageTitle ?? "";
  document.getElementById("field-systemName").value = item.systemName ?? "";
  document.getElementById("field-heroTitle").value = item.heroTitle ?? "";
  document.getElementById("field-heroSubtitle").value = item.heroSubtitle ?? "";
  document.getElementById("field-logoUrl").value = item.logoUrl ?? "";
  document.getElementById("field-ciMarkLabel").value = item.ciMarkLabel ?? "";
  document.getElementById("field-showLogo").checked = Boolean(item.showLogo);
  document.getElementById("field-showCiMark").checked = Boolean(item.showCiMark);
  document.getElementById("field-showHero").checked = Boolean(item.showHero);
  document.getElementById("field-showFooter").checked = Boolean(item.showFooter);
}

function readForm() {
  return {
    pageTitle: document.getElementById("field-pageTitle").value.trim(),
    systemName: document.getElementById("field-systemName").value.trim(),
    heroTitle: document.getElementById("field-heroTitle").value.trim() || null,
    heroSubtitle: document.getElementById("field-heroSubtitle").value.trim() || null,
    logoUrl: document.getElementById("field-logoUrl").value.trim() || null,
    ciMarkLabel: document.getElementById("field-ciMarkLabel").value.trim() || null,
    showLogo: document.getElementById("field-showLogo").checked,
    showCiMark: document.getElementById("field-showCiMark").checked,
    showHero: document.getElementById("field-showHero").checked,
    showFooter: document.getElementById("field-showFooter").checked,
  };
}

function renderPreview(item) {
  const preview = document.getElementById("branding-preview");
  if (!item) return;

  const logoHtml =
    item.showLogo && item.logoUrl
      ? `<img src="${item.logoUrl}" alt="logo" class="h-8 w-8 object-contain" />`
      : "";
  const ciHtml =
    item.showCiMark && item.ciMarkLabel
      ? `<span class="rounded bg-white/15 px-2 py-0.5 text-[11px]">${item.ciMarkLabel}</span>`
      : "";

  preview.innerHTML = `
    <div class="rounded bg-navy-900 p-4 text-white">
      <div class="flex items-center gap-2">${logoHtml}${ciHtml}<strong>${item.systemName}</strong></div>
      <p class="mt-2 text-xs text-gray-300">브라우저 타이틀: ${item.pageTitle}</p>
    </div>
    ${
      item.showHero
        ? `<div class="mt-3 rounded border border-gray-200 bg-gray-50 p-4">
            <p class="font-bold text-gray-900">${item.heroTitle ?? ""}</p>
            <p class="mt-1 text-sm text-gray-600">${item.heroSubtitle ?? ""}</p>
          </div>`
        : `<p class="mt-3 text-xs text-gray-500">히어로 영역: 숨김</p>`
    }
    <p class="mt-2 text-xs text-gray-500">푸터: ${item.showFooter ? "표시" : "숨김"}</p>
  `;
}

async function loadBrandingList() {
  const result = await apiFetch("/api/admin/branding", { auth: true });
  brandingList = result.data;
  if (!brandingList.some((item) => scopeKey(item) === selectedKey)) {
    selectedKey = "GLOBAL";
  }
  renderRoleTabs();
  fillForm(findSelected());
  renderPreview(findSelected());
}

async function saveBranding() {
  const payload = readForm();
  const selected = findSelected();
  if (!selected) return;

  const statusEl = document.getElementById("save-status");
  statusEl.textContent = "저장 중...";
  statusEl.className = "text-sm text-gray-500";

  try {
    let result;
    if (selected.scope === "GLOBAL") {
      result = await apiFetch("/api/admin/branding/global", {
        auth: true,
        method: "PUT",
        body: payload,
      });
    } else {
      result = await apiFetch(`/api/admin/branding/roles/${selected.roleId}`, {
        auth: true,
        method: "PUT",
        body: payload,
      });
    }

    const updated = result.data;
    brandingList = brandingList.map((item) => (scopeKey(item) === scopeKey(updated) ? updated : item));
    fillForm(updated);
    renderPreview(updated);
    statusEl.textContent = "저장되었습니다.";
    statusEl.className = "text-sm text-green-700";
  } catch (error) {
    statusEl.textContent = error.message || "저장 실패";
    statusEl.className = "text-sm text-red-600";
  }
}

function bindPreviewOnInput() {
  document.getElementById("branding-form").addEventListener("input", () => {
    const selected = findSelected();
    if (!selected) return;
    renderPreview({ ...selected, ...readForm() });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAdmin()) return;

  const user = getUser();
  document.getElementById("admin-user-name").textContent = `${user.name}님`;

  document.getElementById("admin-logout-btn").addEventListener("click", logout);
  document.getElementById("admin-back-portal").addEventListener("click", () => {
    window.location.href = "/portal";
  });
  document.getElementById("branding-save-btn").addEventListener("click", saveBranding);

  bindPreviewOnInput();

  try {
    await loadBrandingList();
  } catch (error) {
    document.getElementById("save-status").textContent = error.message || "목록 로드 실패";
    document.getElementById("save-status").className = "text-sm text-red-600";
  }
});
