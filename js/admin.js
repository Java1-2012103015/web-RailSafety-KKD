// Unified Admin Panel Router and Controller
let brandingList = [];
let selectedKey = "GLOBAL"; // for branding settings role selector
let pendingLogoFile = null;
let pendingLogoPreviewUrl = null;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
let rolesList = [];
let allMenusList = []; // flat menus list for parent select dropdown
let selectedRoleId = null; // for permissions tab
let selectedManageRoleId = null; // for role rename/delete
let codeTreePreviewInstFilter = "";
let codeTreePreviewLineFilter = "";
let selectedAllowedLineNames = [];
let selectedAllowedLocationScope = [];
let activeCodeEditorType = "기관";
let codeEditorTables = {};
let relationAllLines = [];
let relationAllStations = [];
let relationLineToInstitution = {};
let relationStationToLine = {};
let relationExpandedInstitutions = new Set();
let relationExpandedLines = new Set();
let relationSelectedStationCodes = new Set();
let relationDraggedPayload = null;
let relationSearchTerm = "";
let relationRightLayer = "station";
let relationRightCompanyFilter = "";
let relationRightLineFilter = "";

const MENU_ACTION_PATHS = ["/notices", "/archive"];
const MENU_ACTION_FIELDS = [
  { key: "canRead", label: "열람" },
  { key: "canCreate", label: "등록" },
  { key: "canUpdate", label: "수정" },
  { key: "canDelete", label: "삭제" },
];

function codeTreeToEditorTables(tree) {
  return {
    기관: tree.map((inst) => ({ codeType: "기관", code: inst.code, value: inst.name })),
    노선: tree.flatMap((inst) =>
      (inst.lines ?? []).map((line) => ({ codeType: "노선", code: line.code, value: line.name })),
    ),
    역: tree.flatMap((inst) =>
      (inst.lines ?? []).flatMap((line) =>
        (line.stations ?? []).map((station) => ({ codeType: "역", code: station.code, value: station.name })),
      ),
    ),
  };
}

function createDefaultCodeEditorTables() {
  const tree = typeof GYEONGGI_QUERY_TREE !== "undefined" ? GYEONGGI_QUERY_TREE : [];
  if (tree.length) {
    return codeTreeToEditorTables(tree);
  }

  return {
    기관: [
      { codeType: "기관", code: "com0001", value: "한국철도공사" },
      { codeType: "기관", code: "com0002", value: "서울교통공사" },
    ],
    노선: [
      { codeType: "노선", code: "line0001", value: "경부선" },
      { codeType: "노선", code: "line0002", value: "수도권전철1호선" },
    ],
    역: [
      { codeType: "역", code: "stn0001", value: "서울역" },
      { codeType: "역", code: "stn0002", value: "용산역" },
    ],
  };
}

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

// ==========================================
// SPA ROUTER
// ==========================================
function routeToPanel() {
  const path = window.location.pathname.replace(/\/$/, "");
  
  // Hide all panels
  document.getElementById("panel-branding").classList.add("hidden");
  document.getElementById("panel-users").classList.add("hidden");
  document.getElementById("panel-menus").classList.add("hidden");
  document.getElementById("panel-roles").classList.add("hidden");
  document.getElementById("panel-codes").classList.add("hidden");
  document.getElementById("panel-code-relations").classList.add("hidden");
  document.getElementById("panel-external-apis").classList.add("hidden");
  document.getElementById("panel-investment-disclosure").classList.add("hidden");
  document.getElementById("panel-accident-db-publication").classList.add("hidden");
  document.getElementById("panel-registrations").classList.add("hidden");
  document.getElementById("panel-login-logs").classList.add("hidden");

  // Remove active styling from all links
  document.getElementById("tab-link-branding").classList.remove("active-tab");
  document.getElementById("tab-link-users").classList.remove("active-tab");
  document.getElementById("tab-link-registrations").classList.remove("active-tab");
  document.getElementById("tab-link-menus").classList.remove("active-tab");
  document.getElementById("tab-link-roles").classList.remove("active-tab");
  document.getElementById("tab-link-codes").classList.remove("active-tab");
  document.getElementById("tab-link-code-relations").classList.remove("active-tab");
  document.getElementById("tab-link-external-apis").classList.remove("active-tab");
  document.getElementById("tab-link-investment-disclosure").classList.remove("active-tab");
  document.getElementById("tab-link-accident-db-publication").classList.remove("active-tab");
  document.getElementById("tab-link-login-logs").classList.remove("active-tab");

  // Switch panel
  if (path === "/admin/users") {
    document.getElementById("panel-users").classList.remove("hidden");
    document.getElementById("tab-link-users").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 회원 관리";
    loadUsersTab();
  } else if (path === "/admin/login-logs") {
    document.getElementById("panel-login-logs").classList.remove("hidden");
    document.getElementById("tab-link-login-logs").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 로그인 기록";
    loadLoginLogsTab();
  } else if (path === "/admin/registrations") {
    document.getElementById("panel-registrations").classList.remove("hidden");
    document.getElementById("tab-link-registrations").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 사용등록 신청";
    loadRegistrationsTab();
  } else if (path === "/admin/menus") {
    document.getElementById("panel-menus").classList.remove("hidden");
    document.getElementById("tab-link-menus").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 메뉴 관리";
    loadMenusTab();
  } else if (path === "/admin/roles") {
    document.getElementById("panel-roles").classList.remove("hidden");
    document.getElementById("tab-link-roles").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 권한 관리";
    loadRolesTab();
  } else if (path === "/admin/codes") {
    document.getElementById("panel-codes").classList.remove("hidden");
    document.getElementById("tab-link-codes").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 코드 관리";
    loadCodeManagementTab();
  } else if (path === "/admin/code-relations") {
    document.getElementById("panel-code-relations").classList.remove("hidden");
    document.getElementById("tab-link-code-relations").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 코드 종속관계 설정";
    loadCodeRelationsTab();
  } else if (path === "/admin/accident-db-publication") {
    document.getElementById("panel-accident-db-publication").classList.remove("hidden");
    document.getElementById("tab-link-accident-db-publication").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 철도사고 DB 공개";
    loadAccidentDbPublicationTab().catch((error) => {
      console.error(error);
      if (typeof adbPubShowLoadError === "function") {
        adbPubShowLoadError(error?.message ?? "철도사고 DB 공개 설정을 불러오지 못했습니다.");
      }
    });
  } else if (path === "/admin/investment-disclosure") {
    document.getElementById("panel-investment-disclosure").classList.remove("hidden");
    document.getElementById("tab-link-investment-disclosure").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 철도안전 투자공시";
    loadInvestmentDisclosureTab();
  } else if (path === "/admin/external-apis") {
    document.getElementById("panel-external-apis").classList.remove("hidden");
    document.getElementById("tab-link-external-apis").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · 외부 API 관리";
    loadExternalApisTab();
  } else {
    // default/branding settings
    document.getElementById("panel-branding").classList.remove("hidden");
    document.getElementById("tab-link-branding").classList.add("active-tab");
    document.getElementById("admin-header-title").textContent = "관리자 포털 · CI·타이틀 설정";
    loadBrandingTab();
  }
}

// Bind navigation click intercepts
function initRouter() {
  const links = ["tab-link-branding", "tab-link-users", "tab-link-login-logs", "tab-link-registrations", "tab-link-menus", "tab-link-roles", "tab-link-codes", "tab-link-code-relations", "tab-link-accident-db-publication", "tab-link-investment-disclosure", "tab-link-external-apis"];
  links.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const href = el.getAttribute("href");
        history.pushState(null, "", href);
        routeToPanel();
      });
    }
  });

  window.addEventListener("popstate", routeToPanel);
}

// ==========================================
// TAB 1: CI/BRANDING SETTINGS
// ==========================================
function scopeKey(item) {
  return item.scope === "GLOBAL" ? "GLOBAL" : `ROLE:${item.roleId}`;
}

function findSelectedBranding() {
  return brandingList.find((item) => scopeKey(item) === selectedKey);
}

function renderRoleTabs() {
  const select = document.getElementById("branding-role-select");
  if (!select) return;

  select.innerHTML = brandingList
    .map((item) => {
      const key = scopeKey(item);
      const label = item.scope === "GLOBAL" ? "공개(기본)" : item.roleName;
      const selected = key === selectedKey ? "selected" : "";
      return `<option value="${key}" ${selected}>${label}</option>`;
    })
    .join("");

  select.onchange = () => {
    selectedKey = select.value;
    fillBrandingForm(findSelectedBranding());
    renderBrandingPreview(findSelectedBranding());
  };
}

function buildBrandingLogoHtml(logoUrl, altText = "logo") {
  if (!logoUrl) return "";
  return `<span class="branding-logo-box"><img src="${logoUrl}" alt="${altText}" /></span>`;
}

function updateLogoFormPreview(logoUrl) {
  const wrap = document.getElementById("field-logo-preview-wrap");
  const img = document.getElementById("field-logo-preview");
  if (!wrap || !img) return;

  const previewUrl = pendingLogoPreviewUrl || logoUrl;
  if (previewUrl) {
    wrap.classList.remove("hidden");
    img.src = previewUrl;
  } else {
    wrap.classList.add("hidden");
    img.removeAttribute("src");
  }
}

function clearPendingLogoPreview() {
  if (pendingLogoPreviewUrl) {
    URL.revokeObjectURL(pendingLogoPreviewUrl);
    pendingLogoPreviewUrl = null;
  }
  pendingLogoFile = null;
}

function readLogoFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("로고 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function uploadPendingLogoFile(selected) {
  if (!pendingLogoFile) {
    return document.getElementById("field-logoUrl")?.value.trim() || null;
  }

  const logoData = await readLogoFileAsDataUrl(pendingLogoFile);
  const result = await apiFetch("/api/admin/branding/logo", {
    auth: true,
    method: "POST",
    body: {
      scope: selected.scope,
      roleId: selected.roleId,
      logoData,
    },
  });

  clearPendingLogoPreview();
  const logoInput = document.getElementById("field-logoFile");
  if (logoInput) logoInput.value = "";
  return result.data?.logoUrl ?? null;
}

function handleLogoFileSelect(file) {
  if (!file) return;

  if (file.type !== "image/png") {
    alert("PNG 파일만 업로드할 수 있습니다.");
    return;
  }
  if (file.size > MAX_LOGO_BYTES) {
    alert("로고 파일은 2MB 이하여야 합니다.");
    return;
  }

  clearPendingLogoPreview();
  pendingLogoFile = file;
  pendingLogoPreviewUrl = URL.createObjectURL(file);
  updateLogoFormPreview(document.getElementById("field-logoUrl")?.value ?? "");
  renderBrandingPreview({ ...findSelectedBranding(), ...readBrandingForm(), logoUrl: pendingLogoPreviewUrl });
}

function removeBrandingLogo() {
  clearPendingLogoPreview();
  const logoInput = document.getElementById("field-logoFile");
  if (logoInput) logoInput.value = "";
  const logoUrlInput = document.getElementById("field-logoUrl");
  if (logoUrlInput) logoUrlInput.value = "";
  updateLogoFormPreview(null);
  renderBrandingPreview({ ...findSelectedBranding(), ...readBrandingForm(), logoUrl: null });
}

function fillBrandingForm(item) {
  if (!item) return;
  clearPendingLogoPreview();
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
  const logoInput = document.getElementById("field-logoFile");
  if (logoInput) logoInput.value = "";
  updateLogoFormPreview(item.logoUrl ?? null);
}

function readBrandingForm() {
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

function renderBrandingPreview(item) {
  const preview = document.getElementById("branding-preview");
  if (!preview) return;
  if (!item) return;

  const logoHtml =
    item.showLogo && (pendingLogoPreviewUrl || item.logoUrl)
      ? buildBrandingLogoHtml(pendingLogoPreviewUrl || item.logoUrl)
      : "";
  const ciHtml =
    item.showCiMark && item.ciMarkLabel
      ? `<span class="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold">${item.ciMarkLabel}</span>`
      : "";

  preview.innerHTML = `
    <div class="rounded bg-navy-900 p-4 text-white">
      <div class="flex items-center gap-2">${logoHtml}${ciHtml}<strong class="text-sm">${item.systemName}</strong></div>
      <p class="mt-2 text-[11px] text-gray-300">브라우저 타이틀: ${item.pageTitle}</p>
    </div>
    ${
      item.showHero
        ? `<div class="mt-3 rounded border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <p class="font-bold text-gray-900 text-sm">${item.heroTitle ?? ""}</p>
            <p class="mt-1 text-xs text-gray-600 leading-relaxed">${item.heroSubtitle ?? ""}</p>
          </div>`
        : `<p class="mt-3 text-[11px] text-gray-500 font-medium">히어로 영역: 숨김</p>`
    }
    <p class="mt-2 text-[11px] text-gray-500 font-medium">푸터: ${item.showFooter ? "표시" : "숨김"}</p>
  `;
}

async function saveBranding() {
  const selected = findSelectedBranding();
  if (!selected) return;

  const payload = readBrandingForm();
  const statusEl = document.getElementById("save-status");
  statusEl.textContent = "저장 중...";
  statusEl.className = "text-sm text-gray-500";

  try {
    payload.logoUrl = await uploadPendingLogoFile(selected);

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
    fillBrandingForm(updated);
    renderBrandingPreview(updated);
    statusEl.textContent = "저장되었습니다.";
    statusEl.className = "text-sm font-semibold text-green-600";
  } catch (error) {
    statusEl.textContent = error.message || "저장 실패";
    statusEl.className = "text-sm font-semibold text-red-600";
  }
}

function bindPreviewOnInput() {
  document.getElementById("branding-form").addEventListener("input", () => {
    const selected = findSelectedBranding();
    if (!selected) return;
    const form = readBrandingForm();
    renderBrandingPreview({
      ...selected,
      ...form,
      logoUrl: pendingLogoPreviewUrl || form.logoUrl,
    });
  });

  document.getElementById("field-logoFile")?.addEventListener("change", (event) => {
    handleLogoFileSelect(event.target.files?.[0] ?? null);
  });

  document.getElementById("field-logo-remove-btn")?.addEventListener("click", removeBrandingLogo);
}

async function loadBrandingTab() {
  try {
    const result = await apiFetch("/api/admin/branding", { auth: true });
    brandingList = result.data;
    if (!brandingList.some((item) => scopeKey(item) === selectedKey)) {
      selectedKey = "GLOBAL";
    }
    renderRoleTabs();
    fillBrandingForm(findSelectedBranding());
    renderBrandingPreview(findSelectedBranding());
  } catch (error) {
    document.getElementById("save-status").textContent = error.message || "브랜딩 정보 로드 실패";
    document.getElementById("save-status").className = "text-sm text-red-600";
  }
}

// ==========================================
// TAB 2: USER MANAGEMENT
// ==========================================
let usersList = [];

async function loadUsersTab() {
  const tbody = document.getElementById("users-table-body");
  tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">사용자 목록을 불러오는 중...</td></tr>`;
  
  try {
    // Load roles list if not already loaded
    if (rolesList.length === 0) {
      const rolesRes = await apiFetch("/api/admin/roles", { auth: true });
      rolesList = rolesRes.data;
      
      const roleSelect = document.getElementById("field-user-role");
      roleSelect.innerHTML = rolesList.map(r => `<option value="${r.id}">${r.name}</option>`).join("");
    }

    const res = await apiFetch("/api/admin/users", { auth: true });
    usersList = res.data;

    if (usersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">등록된 사용자가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = usersList.map(user => {
      const createdDate = new Date(user.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      const ipLabel = user.ipRestrictionEnabled
        ? `<span class="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">${user.allowedIp ?? "-"}</span>`
        : `<span class="text-xs text-gray-400">미사용</span>`;
      return `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 font-medium text-gray-900">${user.id}</td>
          <td class="px-6 py-4 font-semibold">${user.name}</td>
          <td class="px-6 py-4 text-gray-600">${user.email}</td>
          <td class="px-6 py-4">
            <span class="rounded-full bg-navy-100 text-navy-800 px-2.5 py-0.5 text-xs font-semibold">
              ${user.role.name}
            </span>
          </td>
          <td class="px-6 py-4">${ipLabel}</td>
          <td class="px-6 py-4 text-gray-500 text-xs">${createdDate}</td>
          <td class="px-6 py-4 text-center">
            <button
              data-id="${user.id}"
              class="btn-edit-user rounded bg-amber-500 px-2 py-1 text-xs font-bold text-white hover:bg-amber-600 transition mr-2"
            >
              수정
            </button>
            <button
              data-id="${user.id}"
              class="btn-delete-user rounded bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700 transition"
            >
              삭제
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Bind Edit/Delete handlers
    tbody.querySelectorAll(".btn-edit-user").forEach(btn => {
      btn.addEventListener("click", () => openUserModal(Number(btn.dataset.id)));
    });
    tbody.querySelectorAll(".btn-delete-user").forEach(btn => {
      btn.addEventListener("click", () => deleteUser(Number(btn.dataset.id)));
    });

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500 font-semibold">로드 실패: ${error.message}</td></tr>`;
  }
}

function syncUserIpFields() {
  const enabled = document.getElementById("field-user-ip-restriction")?.checked ?? false;
  const ipInput = document.getElementById("field-user-allowed-ip");
  if (!ipInput) return;
  ipInput.disabled = !enabled;
  if (!enabled) {
    ipInput.value = "";
  }
}

function readUserIpSettings() {
  const ipRestrictionEnabled = Boolean(document.getElementById("field-user-ip-restriction")?.checked);
  const allowedIp = document.getElementById("field-user-allowed-ip")?.value.trim() || null;
  return { ipRestrictionEnabled, allowedIp };
}

function openUserModal(userId = null) {
  const modal = document.getElementById("modal-user");
  const form = document.getElementById("form-user");
  const title = document.getElementById("modal-user-title");
  const emailInput = document.getElementById("field-user-email");
  const pwdInput = document.getElementById("field-user-password");
  const pwdHint = document.getElementById("field-user-password-hint");
  const status = document.getElementById("modal-user-status");

  form.reset();
  status.textContent = "";
  modal.classList.remove("hidden");

  if (userId) {
    // Edit Mode
    title.textContent = "회원 정보 수정";
    emailInput.disabled = true;
    pwdHint.classList.remove("hidden");
    pwdInput.placeholder = "변경할 경우에만 새 비밀번호 입력";
    
    const user = usersList.find(u => u.id === userId);
    if (user) {
      document.getElementById("field-user-id").value = user.id;
      emailInput.value = user.email;
      document.getElementById("field-user-name").value = user.name;
      document.getElementById("field-user-role").value = user.roleId;
      document.getElementById("field-user-ip-restriction").checked = Boolean(user.ipRestrictionEnabled);
      document.getElementById("field-user-allowed-ip").value = user.allowedIp ?? "";
    }
  } else {
    // Create Mode
    title.textContent = "신규 회원 등록";
    emailInput.disabled = false;
    pwdHint.classList.add("hidden");
    pwdInput.placeholder = "비밀번호 입력";
    document.getElementById("field-user-id").value = "";
  }

  syncUserIpFields();
}

function closeUserModal() {
  document.getElementById("modal-user").classList.add("hidden");
}

async function saveUserSubmit() {
  const idVal = document.getElementById("field-user-id").value;
  const email = document.getElementById("field-user-email").value.trim();
  const name = document.getElementById("field-user-name").value.trim();
  const password = document.getElementById("field-user-password").value;
  const roleId = Number(document.getElementById("field-user-role").value);
  const { ipRestrictionEnabled, allowedIp } = readUserIpSettings();
  const status = document.getElementById("modal-user-status");

  if (!email || !name) {
    status.textContent = "이메일과 이름을 입력해주세요.";
    status.className = "text-xs text-red-600 font-semibold";
    return;
  }

  if (ipRestrictionEnabled && !allowedIp) {
    status.textContent = "IP 고정 사용 시 허용 IP를 입력해주세요.";
    status.className = "text-xs text-red-600 font-semibold";
    return;
  }

  status.textContent = "저장 중...";
  status.className = "text-xs text-gray-500";

  try {
    if (idVal) {
      // Update
      const id = Number(idVal);
      await apiFetch(`/api/admin/users/${id}`, {
        auth: true,
        method: "PUT",
        body: { name, roleId, password: password || undefined, ipRestrictionEnabled, allowedIp }
      });
    } else {
      // Create / Sign up
      if (!password) {
        status.textContent = "신규 회원은 비밀번호가 필수입니다.";
        status.className = "text-xs text-red-600 font-semibold";
        return;
      }
      
      await apiFetch("/api/admin/users", {
        auth: true,
        method: "POST",
        body: { email, password, name, roleId, ipRestrictionEnabled, allowedIp },
      });
    }

    closeUserModal();
    loadUsersTab();
  } catch (error) {
    status.textContent = error.message || "작업 실패";
    status.className = "text-xs text-red-600 font-semibold";
  }
}

async function deleteUser(userId) {
  const me = getUser();
  const target = usersList.find(u => u.id === userId);
  if (target && target.email === me.email) {
    alert("자기 자신은 삭제할 수 없습니다.");
    return;
  }

  if (!confirm(`사용자 '${target?.name || userId}' 계정을 정말 삭제하시겠습니까?`)) {
    return;
  }

  try {
    await apiFetch(`/api/admin/users/${userId}`, {
      auth: true,
      method: "DELETE"
    });
    loadUsersTab();
  } catch (error) {
    alert(`삭제 실패: ${error.message}`);
  }
}

// ==========================================
// TAB 3: MENU MANAGEMENT
// ==========================================
async function loadMenusTab() {
  const container = document.getElementById("menus-tree-container");
  container.innerHTML = `<p class="text-xs text-gray-500 py-4 text-center">로딩 중...</p>`;
  resetMenuForm();

  try {
    const res = await apiFetch("/api/menus", { auth: true });
    const menuTree = res.data;

    // Save a flat list for select dropdown options
    allMenusList = [];
    function flatten(nodes) {
      nodes.forEach(n => {
        allMenusList.push({ id: n.id, title: n.title });
        if (n.children && n.children.length > 0) {
          flatten(n.children);
        }
      });
    }
    flatten(menuTree);

    // Populate Parent Menu dropdown options
    const parentSelect = document.getElementById("field-menu-parent");
    parentSelect.innerHTML = `<option value="">없음 (최상위 메뉴)</option>` + 
      allMenusList.map(m => `<option value="${m.id}">${m.title}</option>`).join("");

    if (menuTree.length === 0) {
      container.innerHTML = `<p class="text-xs text-gray-500 py-4 text-center">등록된 메뉴가 없습니다.</p>`;
      return;
    }

    // Render tree representation HTML
    function buildTreeHtml(nodes, depth = 0) {
      return `
        <ul class="space-y-1 ${depth > 0 ? "ml-6 pl-2 border-l border-gray-300 mt-1" : ""}">
          ${nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            return `
              <li class="group/item">
                <div class="flex items-center justify-between rounded bg-white hover:bg-gray-100 p-2 border border-gray-200 shadow-sm transition">
                  <div class="flex items-center gap-2">
                    <span class="text-gray-400 font-bold select-none">${depth > 0 ? "└" : "■"}</span>
                    <strong class="text-gray-900">${node.title}</strong>
                    ${node.path ? `<code class="rounded bg-gray-100 text-[10px] text-gray-600 px-1.5 py-0.5">${node.path}</code>` : `<span class="text-[10px] text-gray-400 font-semibold">(경로 없음)</span>`}
                    <span class="text-[10px] bg-amber-100 text-amber-800 rounded font-bold px-1.5 py-0.2">순서: ${node.sequence}</span>
                  </div>
                  <div class="flex gap-2">
                    <button
                      data-id="${node.id}"
                      class="btn-edit-menu text-xs font-semibold text-amber-600 hover:text-amber-800"
                    >
                      수정
                    </button>
                    <button
                      data-id="${node.id}"
                      class="btn-delete-menu text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                ${hasChildren ? buildTreeHtml(node.children, depth + 1) : ""}
              </li>
            `;
          }).join("")}
        </ul>
      `;
    }

    container.innerHTML = buildTreeHtml(menuTree);

    // Bind edit/delete click handlers
    container.querySelectorAll(".btn-edit-menu").forEach(btn => {
      btn.addEventListener("click", () => editMenu(Number(btn.dataset.id)));
    });
    container.querySelectorAll(".btn-delete-menu").forEach(btn => {
      btn.addEventListener("click", () => deleteMenu(Number(btn.dataset.id)));
    });

  } catch (error) {
    container.innerHTML = `<p class="text-xs text-red-500 py-4 text-center font-bold">로드 실패: ${error.message}</p>`;
  }
}

function resetMenuForm() {
  const form = document.getElementById("menu-form");
  form.reset();
  document.getElementById("field-menu-id").value = "";
  document.getElementById("menu-form-title").textContent = "새 메뉴 추가";
  document.getElementById("field-menu-parent-wrap").classList.remove("hidden");
  document.getElementById("menu-submit-status").textContent = "";
}

async function editMenu(id) {
  resetMenuForm();
  document.getElementById("menu-form-title").textContent = "메뉴 정보 수정";
  // Parent dropdown change is dangerous during edits, hide it
  document.getElementById("field-menu-parent-wrap").classList.add("hidden");

  try {
    // Fetch all flat menus from API to find details (using apiFetch)
    // We already have flat allMenusList loaded, let's find it.
    // Wait, the API doesn't give details directly, let's find details from allMenusList, or fetch menus tree and search.
    // Let's search inside allMenusList first.
    // But allMenusList doesn't have parentId or path, let's call API or find in tree.
    const res = await apiFetch("/api/menus", { auth: true });
    const menuTree = res.data;
    
    let target = null;
    function findInTree(nodes) {
      for (const n of nodes) {
        if (n.id === id) {
          target = n;
          return;
        }
        if (n.children && n.children.length > 0) {
          findInTree(n.children);
        }
      }
    }
    findInTree(menuTree);

    if (target) {
      document.getElementById("field-menu-id").value = target.id;
      document.getElementById("field-menu-title").value = target.title;
      document.getElementById("field-menu-path").value = target.path ?? "";
      document.getElementById("field-menu-sequence").value = target.sequence;
    }
  } catch (error) {
    alert("세부 정보를 불러오지 못했습니다: " + error.message);
  }
}

async function saveMenuSubmit() {
  const idVal = document.getElementById("field-menu-id").value;
  const title = document.getElementById("field-menu-title").value.trim();
  const path = document.getElementById("field-menu-path").value.trim() || null;
  const sequence = Number(document.getElementById("field-menu-sequence").value);
  const parentIdVal = document.getElementById("field-menu-parent").value;
  const parentId = parentIdVal ? Number(parentIdVal) : null;
  const status = document.getElementById("menu-submit-status");

  if (!title) return;

  status.textContent = "저장 중...";
  status.className = "text-xs text-gray-500 mt-2";

  try {
    if (idVal) {
      // Update
      const id = Number(idVal);
      await apiFetch(`/api/admin/menus/${id}`, {
        auth: true,
        method: "PUT",
        body: { title, path, sequence }
      });
    } else {
      // Create
      await apiFetch("/api/admin/menus", {
        auth: true,
        method: "POST",
        body: { title, path, sequence, parentId }
      });
    }

    loadMenusTab();
  } catch (error) {
    status.textContent = error.message || "작업 실패";
    status.className = "text-xs text-red-600 font-semibold mt-2";
  }
}

async function deleteMenu(id) {
  if (!confirm("이 메뉴와 하위 메뉴들을 모두 정말 삭제하시겠습니까?")) {
    return;
  }

  try {
    await apiFetch(`/api/admin/menus/${id}`, {
      auth: true,
      method: "DELETE"
    });
    loadMenusTab();
  } catch (error) {
    alert("삭제 실패: " + error.message);
  }
}

// ==========================================
// TAB 4: PERMISSIONS MANAGEMENT
// ==========================================
async function loadRolesTab() {
  const roleSelect = document.getElementById("select-permission-role");
  const wrap = document.getElementById("role-permissions-config-wrap");
  
  wrap.classList.add("hidden");
  document.getElementById("role-load-status").textContent = "";

  try {
    const res = await apiFetch("/api/admin/roles", { auth: true });
    rolesList = res.data;
    const usersRes = await apiFetch("/api/admin/users", { auth: true });
    usersList = usersRes.data;
    try {
      const codeRes = await apiFetch("/api/admin/codes/tree", { auth: true });
      codeTree = codeRes.data ?? [];
    } catch (_error) {
      // 코드 관리 테이블/마이그레이션 미적용 상태에서도 권한 탭은 동작해야 함
      codeTree = [];
    }

    // Exclude Admin from permission editing (Admin always has everything)
    const editableRoles = rolesList.filter(r => r.name !== "ADMIN");

    roleSelect.innerHTML = `<option value="">-- 역할을 선택하세요 --</option>` +
      editableRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join("");

    renderRolesOverview();
    renderQueryLocationSelectors();

  } catch (error) {
    document.getElementById("role-load-status").textContent = "역할 목록 로드 실패: " + error.message;
    document.getElementById("role-load-status").className = "text-xs text-red-600";
  }
}

function buildLocationScopeFromChecks() {
  const scope = [];

  document.querySelectorAll('.query-location-checkbox[data-node-type="institution"]').forEach((instCheckbox) => {
    const institutionName = instCheckbox.dataset.institutionName;
    const instCode = instCheckbox.dataset.nodeCode;
    if (!institutionName || !instCode) return;

    const stationInputs = Array.from(
      document.querySelectorAll(
        `.query-location-checkbox[data-node-type="station"][data-ancestor-codes*="|${instCode}|"]`,
      ),
    );

    if (!stationInputs.length) {
      if (instCheckbox.checked) {
        scope.push({ institutionName });
      }
      return;
    }

    const checkedStations = stationInputs
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.dataset.stationName)
      .filter(Boolean);

    if (checkedStations.length > 0) {
      scope.push({ institutionName, stationNames: checkedStations });
    }
  });

  return scope;
}

function applyLocationScopeToChecks(scope) {
  document.querySelectorAll(".query-location-checkbox").forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.indeterminate = false;
  });

  const normalizedScope = normalizeLocationScope(scope);
  normalizedScope.forEach((rule) => {
    const institutionVariants = expandScopeAliases(rule.institutionName, INSTITUTION_SCOPE_ALIASES);
    const stationInputs = Array.from(
      document.querySelectorAll('.query-location-checkbox[data-node-type="station"]'),
    ).filter((checkbox) => institutionVariants.includes(checkbox.dataset.institutionName ?? ""));

    if (!rule.stationNames?.length) {
      for (const institutionName of institutionVariants) {
        const instCheckbox = document.querySelector(
          `.query-location-checkbox[data-node-type="institution"][data-institution-name="${institutionName}"]`,
        );
        if (instCheckbox) {
          instCheckbox.checked = true;
          onQueryLocationCheckboxChange(instCheckbox);
          break;
        }
      }
      return;
    }

    const checkedStationNodes = new Set();
    rule.stationNames.forEach((stationName) => {
      const stationVariants = expandScopeAliases(stationName, STATION_SCOPE_ALIASES);
      for (const variant of stationVariants) {
        const stationCheckbox = stationInputs.find((checkbox) => checkbox.dataset.stationName === variant);
        if (stationCheckbox) {
          stationCheckbox.checked = true;
          checkedStationNodes.add(stationCheckbox);
          break;
        }
      }
    });

    checkedStationNodes.forEach((checkbox) => updateParentState(checkbox));
  });
}

function applyAllowedLineNamesToChecks(lineNames) {
  if (!Array.isArray(lineNames) || !lineNames.length) return;

  const lineCheckboxes = Array.from(
    document.querySelectorAll('.query-location-checkbox[data-node-type="line"]'),
  );

  lineNames.forEach((lineName) => {
    const trimmed = String(lineName).trim();
    if (!trimmed) return;

    const exactMatches = lineCheckboxes.filter((checkbox) => checkbox.dataset.lineName === trimmed);
    if (exactMatches.length) {
      exactMatches.forEach((checkbox) => {
        checkbox.checked = true;
      });
      return;
    }

    const aliases = expandScopeAliases(trimmed, LINE_SCOPE_ALIASES);
    lineCheckboxes.forEach((checkbox) => {
      if (aliases.includes(checkbox.dataset.lineName ?? "")) {
        checkbox.checked = true;
      }
    });
  });

  document.querySelectorAll('.query-location-checkbox[data-node-type="station"]:checked').forEach((checkbox) => {
    updateParentState(checkbox);
  });
  document.querySelectorAll('.query-location-checkbox[data-node-type="line"]:checked').forEach((checkbox) => {
    updateParentState(checkbox);
  });
}

function updateParentState(checkbox) {
  const parentCode = checkbox.dataset.parentCode;
  if (!parentCode) return;
  const parent = document.querySelector(`.query-location-checkbox[data-node-code="${parentCode}"]`);
  if (!parent) return;

  const children = Array.from(document.querySelectorAll(`.query-location-checkbox[data-parent-code="${parentCode}"]`));
  if (!children.length) return;
  const checkedCount = children.filter((child) => child.checked).length;
  parent.checked = checkedCount === children.length;
  parent.indeterminate = checkedCount > 0 && checkedCount < children.length;
  updateParentState(parent);
}

function updateSelectedAllowedLinesFromChecks() {
  const checkedLineInputs = Array.from(document.querySelectorAll('.query-location-checkbox[data-node-type="line"]:checked'));
  selectedAllowedLineNames = Array.from(
    new Set(checkedLineInputs.map((el) => el.dataset.lineName).filter(Boolean)),
  );
}

function syncLineChecksFromSelection() {
  const lineInputs = Array.from(document.querySelectorAll('.query-location-checkbox[data-node-type="line"]'));
  lineInputs.forEach((el) => {
    el.checked = selectedAllowedLineNames.includes(el.dataset.lineName);
  });

  // line 하위 역 체크를 line 상태와 동기화
  lineInputs.forEach((lineInput) => {
    const stationInputs = document.querySelectorAll(
      `.query-location-checkbox[data-node-type="station"][data-parent-code="${lineInput.dataset.nodeCode}"]`,
    );
    stationInputs.forEach((stationInput) => {
      stationInput.checked = lineInput.checked;
      stationInput.indeterminate = false;
    });
  });

  // 상위(기관) 상태 재계산
  Array.from(document.querySelectorAll('.query-location-checkbox[data-node-type="station"]')).forEach((stationInput) => {
    updateParentState(stationInput);
  });
}

function onQueryLocationCheckboxChange(target) {
  const nodeCode = target.dataset.nodeCode;
  const descendants = document.querySelectorAll(`.query-location-checkbox[data-ancestor-codes*="|${nodeCode}|"]`);
  descendants.forEach((child) => {
    child.checked = target.checked;
    child.indeterminate = false;
  });
  target.indeterminate = false;
  updateParentState(target);
  updateSelectedAllowedLinesFromChecks();
}

function buildQueryLocationToggleButton(targetKey, hasChildren) {
  if (!hasChildren) {
    return `<span class="inline-block h-5 w-5 shrink-0" aria-hidden="true"></span>`;
  }
  return `
    <button
      type="button"
      class="query-location-toggle inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-[11px] font-bold leading-none text-gray-700 hover:bg-gray-50"
      data-target="${targetKey}"
      data-expanded="false"
      aria-label="하위 항목 펼치기"
    >+</button>
  `;
}

function setQueryLocationBranchExpanded(targetKey, expanded) {
  const container = document.getElementById("query-location-tree");
  if (!container) return;

  const toggle = container.querySelector(`.query-location-toggle[data-target="${targetKey}"]`);
  const children = container.querySelector(`.query-location-children[data-children-of="${targetKey}"]`);
  if (!toggle || !children) return;

  toggle.dataset.expanded = expanded ? "true" : "false";
  toggle.textContent = expanded ? "−" : "+";
  toggle.setAttribute("aria-label", expanded ? "하위 항목 접기" : "하위 항목 펼치기");
  children.classList.toggle("hidden", !expanded);
}

function toggleQueryLocationBranch(targetKey) {
  const container = document.getElementById("query-location-tree");
  if (!container) return;

  const toggle = container.querySelector(`.query-location-toggle[data-target="${targetKey}"]`);
  if (!toggle) return;
  setQueryLocationBranchExpanded(targetKey, toggle.dataset.expanded !== "true");
}

function buildStationNodes(stations, lineCode, instCode, institutionName) {
  if (!stations?.length) {
    return `<li class="py-0.5 pl-4 text-[11px] text-gray-400">역 없음</li>`;
  }

  return stations
    .map(
      (station) => `
        <li class="py-0.5">
          <label class="flex items-center gap-2 cursor-pointer py-0.5">
            <input
              type="checkbox"
              class="query-location-checkbox h-4 w-4 rounded border-gray-300 text-navy-700"
              data-node-type="station"
              data-node-code="station:${station.code}"
              data-parent-code="line:${lineCode}"
              data-institution-name="${institutionName}"
              data-station-name="${station.name}"
              data-ancestor-codes="|inst:${instCode}||line:${lineCode}|"
              value="${station.code}"
            />
            <span class="text-gray-800">${station.name}</span>
          </label>
        </li>
      `,
    )
    .join("");
}

function buildLineNodes(lines, instCode, institutionName) {
  if (!lines?.length) {
    return `<li class="py-0.5 pl-4 text-[11px] text-gray-400">노선 없음</li>`;
  }

  return lines
    .map(
      (line) => {
        const lineKey = `line:${line.code}`;
        const hasStations = Boolean(line.stations?.length);
        return `
        <li class="py-0.5">
          <div class="flex items-center gap-1">
            ${buildQueryLocationToggleButton(lineKey, hasStations)}
            <label class="flex flex-1 items-center gap-2 cursor-pointer py-0.5">
              <input
                type="checkbox"
                class="query-location-checkbox h-4 w-4 rounded border-gray-300 text-navy-700"
                data-node-type="line"
                data-node-code="${lineKey}"
                data-parent-code="inst:${instCode}"
                data-institution-name="${institutionName}"
                data-ancestor-codes="|inst:${instCode}|"
                data-line-name="${line.name}"
                value="${line.code}"
              />
              <span class="font-medium text-gray-900">${line.name}</span>
            </label>
          </div>
          <ul class="query-location-children hidden space-y-1 pl-4 border-l border-gray-200 mt-1 ml-6" data-children-of="${lineKey}">${buildStationNodes(line.stations, line.code, instCode, institutionName)}</ul>
        </li>
      `;
      },
    )
    .join("");
}

function renderQueryLocationSelectors() {
  const container = document.getElementById("query-location-tree");
  if (!container) return;

  const selectedRole = rolesList.find((role) => role.id === selectedRoleId);
  const tree = getQueryLocationTreeForRole(selectedRole?.name ?? "", codeTree);
  if (!tree.length) {
    container.innerHTML = `<p class="text-[11px] text-gray-500">코드 없음</p>`;
    return;
  }

  container.innerHTML = `
    <ul class="space-y-1">
      ${tree
        .map(
          (inst) => {
            const instKey = `inst:${inst.code}`;
            const hasLines = Boolean(inst.lines?.length);
            return `
            <li class="py-0.5">
              <div class="flex items-center gap-1">
                ${buildQueryLocationToggleButton(instKey, hasLines)}
                <label class="flex flex-1 items-center gap-2 cursor-pointer py-1 font-bold">
                  <input
                    type="checkbox"
                    class="query-location-checkbox h-4 w-4 rounded border-gray-300 text-navy-700"
                    data-node-type="institution"
                    data-node-code="${instKey}"
                    data-institution-name="${inst.name}"
                    value="${inst.code}"
                  />
                  <span class="text-gray-900">${inst.name}</span>
                </label>
              </div>
              <ul class="query-location-children hidden space-y-1 pl-4 border-l border-gray-200 mt-1 ml-6" data-children-of="${instKey}">${buildLineNodes(inst.lines, inst.code, inst.name)}</ul>
            </li>
          `;
          },
        )
        .join("")}
    </ul>
  `;

  applyLocationScopeToChecks(selectedAllowedLocationScope);
  applyAllowedLineNamesToChecks(selectedAllowedLineNames);
  updateSelectedAllowedLinesFromChecks();

  if (!container.dataset.bound) {
    container.addEventListener("click", (event) => {
      const toggle = event.target.closest(".query-location-toggle");
      if (toggle?.dataset.target) {
        event.preventDefault();
        toggleQueryLocationBranch(toggle.dataset.target);
      }
    });
    container.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".query-location-checkbox");
      if (!checkbox) return;
      onQueryLocationCheckboxChange(checkbox);
    });
    container.dataset.bound = "true";
  }
}

function renderRolesOverview() {
  const select = document.getElementById("roles-overview-select");
  if (!select) return;

  if (!rolesList.length) {
    select.innerHTML = `<option value="">등록된 권한이 없습니다.</option>`;
    return;
  }

  const countMap = new Map();
  for (const user of usersList) {
    countMap.set(user.roleId, (countMap.get(user.roleId) ?? 0) + 1);
  }

  select.innerHTML =
    `<option value="">-- 권한을 선택하세요 --</option>` +
    rolesList
    .map((role) => {
      const count = countMap.get(role.id) ?? 0;
      return `<option value="${role.id}">${role.name} (사용자 ${count}명)</option>`;
    })
    .join("");

  select.onchange = () => {
    const roleId = Number(select.value);
    if (!roleId) {
      selectedManageRoleId = null;
      document.getElementById("role-members-title").textContent = "권한을 선택하세요";
      document.getElementById("role-members-list").innerHTML =
        `<p class="text-xs text-gray-500">권한 리스트에서 역할을 선택하면 사용자 목록이 표시됩니다.</p>`;
      syncManageRoleForm();
      return;
    }

    selectedManageRoleId = roleId;
    showRoleMembers(roleId);
    syncManageRoleForm();

    const role = rolesList.find((r) => r.id === roleId);
    if (role && role.name !== "ADMIN") {
      const permissionSelect = document.getElementById("select-permission-role");
      permissionSelect.value = String(roleId);
      onPermissionRoleChange();
    } else {
      selectedRoleId = null;
      const permissionSelect = document.getElementById("select-permission-role");
      const permissionWrap = document.getElementById("role-permissions-config-wrap");
      const roleLoadStatus = document.getElementById("role-load-status");
      if (permissionSelect) permissionSelect.value = "";
      if (permissionWrap) permissionWrap.classList.add("hidden");
      if (roleLoadStatus) {
        roleLoadStatus.textContent = "ADMIN은 전체 권한(고정)입니다.";
        roleLoadStatus.className = "text-xs text-gray-500";
      }
    }
  };
}

function showRoleMembers(roleId) {
  const role = rolesList.find((r) => r.id === roleId);
  const titleEl = document.getElementById("role-members-title");
  const listEl = document.getElementById("role-members-list");
  if (!titleEl || !listEl) return;

  const members = usersList.filter((u) => u.roleId === roleId);
  titleEl.textContent = role ? `${role.name} (${members.length}명)` : "선택 권한";

  if (!members.length) {
    listEl.innerHTML = `<p class="text-xs text-gray-500">해당 권한 사용자가 없습니다.</p>`;
    return;
  }

  listEl.innerHTML = members
    .map(
      (u) => `
      <div class="rounded border border-gray-200 bg-gray-50 px-3 py-2">
        <p class="text-sm font-medium text-gray-900">${u.name}</p>
        <p class="text-xs text-gray-500">${u.email}</p>
      </div>
    `,
    )
    .join("");
}

function syncManageRoleForm() {
  const input = document.getElementById("field-edit-role-name");
  const status = document.getElementById("edit-role-status");
  if (!input || !status) return;

  if (!selectedManageRoleId) {
    input.value = "";
    input.placeholder = "권한을 선택하세요";
    status.textContent = "";
    return;
  }

  const role = rolesList.find((r) => r.id === selectedManageRoleId);
  input.value = role?.name ?? "";
  input.placeholder = role?.name ?? "권한명";
  status.textContent = "";
}

async function createRole() {
  const input = document.getElementById("field-new-role-name");
  const status = document.getElementById("create-role-status");
  const roleName = input.value.trim();

  if (!roleName) {
    status.textContent = "역할명을 입력하세요.";
    status.className = "text-xs text-red-600";
    return;
  }

  status.textContent = "생성 중...";
  status.className = "text-xs text-gray-500";

  try {
    await apiFetch("/api/admin/roles", {
      auth: true,
      method: "POST",
      body: { name: roleName },
    });

    input.value = "";
    status.textContent = `${roleName} 역할이 추가되었습니다.`;
    status.className = "text-xs text-green-600";
    selectedRoleId = null;
    selectedManageRoleId = null;
    document.getElementById("select-permission-role").value = "";
    document.getElementById("role-permissions-config-wrap").classList.add("hidden");
    await loadRolesTab();
    syncManageRoleForm();
  } catch (error) {
    status.textContent = "생성 실패: " + error.message;
    status.className = "text-xs text-red-600";
  }
}

async function updateRoleName() {
  const input = document.getElementById("field-edit-role-name");
  const status = document.getElementById("edit-role-status");
  if (!selectedManageRoleId) {
    status.textContent = "먼저 수정할 권한을 선택하세요.";
    status.className = "text-xs text-red-600";
    return;
  }

  const roleName = input.value.trim();
  if (!roleName) {
    status.textContent = "권한명을 입력하세요.";
    status.className = "text-xs text-red-600";
    return;
  }

  status.textContent = "수정 중...";
  status.className = "text-xs text-gray-500";

  try {
    await apiFetch(`/api/admin/roles/${selectedManageRoleId}`, {
      auth: true,
      method: "PUT",
      body: { name: roleName },
    });

    status.textContent = "권한명이 수정되었습니다.";
    status.className = "text-xs text-green-600";
    await loadRolesTab();
    const overviewSelect = document.getElementById("roles-overview-select");
    overviewSelect.value = String(selectedManageRoleId);
    overviewSelect.dispatchEvent(new Event("change"));
  } catch (error) {
    status.textContent = "수정 실패: " + error.message;
    status.className = "text-xs text-red-600";
  }
}

async function deleteRole() {
  const status = document.getElementById("edit-role-status");
  if (!selectedManageRoleId) {
    status.textContent = "먼저 삭제할 권한을 선택하세요.";
    status.className = "text-xs text-red-600";
    return;
  }

  const role = rolesList.find((r) => r.id === selectedManageRoleId);
  if (!role) return;

  if (!confirm(`권한 '${role.name}' 을(를) 삭제하시겠습니까?`)) {
    return;
  }

  status.textContent = "삭제 중...";
  status.className = "text-xs text-gray-500";

  try {
    await apiFetch(`/api/admin/roles/${selectedManageRoleId}`, {
      auth: true,
      method: "DELETE",
    });

    status.textContent = "권한이 삭제되었습니다.";
    status.className = "text-xs text-green-600";
    selectedManageRoleId = null;
    selectedRoleId = null;
    document.getElementById("select-permission-role").value = "";
    document.getElementById("role-permissions-config-wrap").classList.add("hidden");
    await loadRolesTab();
    syncManageRoleForm();
  } catch (error) {
    status.textContent = "삭제 실패: " + error.message;
    status.className = "text-xs text-red-600";
  }
}

function getMenuPermCheckboxLi(checkbox) {
  return checkbox.closest("li");
}

function getDescendantMenuPermCheckboxes(checkbox) {
  const li = getMenuPermCheckboxLi(checkbox);
  const nestedUl = li?.querySelector(":scope > ul");
  if (!nestedUl) return [];
  return Array.from(nestedUl.querySelectorAll(".menu-perm-checkbox"));
}

function getParentMenuPermCheckbox(checkbox) {
  const li = getMenuPermCheckboxLi(checkbox);
  const parentLi = li?.parentElement?.closest("li");
  return parentLi?.querySelector(":scope > label .menu-perm-checkbox") ?? null;
}

function getSiblingMenuPermCheckboxes(checkbox) {
  const li = getMenuPermCheckboxLi(checkbox);
  if (!li?.parentElement) return [];
  return Array.from(li.parentElement.children)
    .map((childLi) => childLi.querySelector(":scope > label .menu-perm-checkbox"))
    .filter(Boolean);
}

function syncMenuPermAncestors(checkbox) {
  let current = checkbox;
  let parent = getParentMenuPermCheckbox(current);
  while (parent) {
    const siblings = getSiblingMenuPermCheckboxes(current);
    if (!siblings.every((cb) => cb.checked)) break;
    parent.checked = true;
    current = parent;
    parent = getParentMenuPermCheckbox(current);
  }
}

function syncMenuPermAncestorsUncheck(checkbox) {
  let parent = getParentMenuPermCheckbox(checkbox);
  while (parent) {
    parent.checked = false;
    parent = getParentMenuPermCheckbox(parent);
  }
}

function handleMenuPermCheckboxChange(checkbox) {
  const descendants = getDescendantMenuPermCheckboxes(checkbox);

  if (checkbox.checked) {
    descendants.forEach((cb) => {
      cb.checked = true;
    });
    syncMenuPermAncestors(checkbox);
    return;
  }

  descendants.forEach((cb) => {
    cb.checked = false;
    uncheckMenuActionsForCheckbox(cb);
  });
  uncheckMenuActionsForCheckbox(checkbox);
  syncMenuPermAncestorsUncheck(checkbox);
}

function uncheckMenuActionsForCheckbox(checkbox) {
  const li = getMenuPermCheckboxLi(checkbox);
  const pathEl = li?.querySelector(":scope > label code");
  const menuPath = pathEl?.textContent?.trim();
  if (!menuPath || !MENU_ACTION_PATHS.includes(menuPath)) return;
  li.querySelectorAll(".menu-action-checkbox").forEach((actionCheckbox) => {
    actionCheckbox.checked = false;
  });
}

function getMenuActionState(actionMap, menuPath) {
  const record = actionMap.get(menuPath);
  return {
    canRead: record?.canRead ?? true,
    canCreate: record?.canCreate ?? false,
    canUpdate: record?.canUpdate ?? false,
    canDelete: record?.canDelete ?? false,
  };
}

function buildMenuActionCheckboxesHtml(menuPath, actionMap) {
  if (!MENU_ACTION_PATHS.includes(menuPath)) return "";
  const state = getMenuActionState(actionMap, menuPath);

  return `
    <ul class="mt-1 space-y-0.5 border-l border-dashed border-gray-200 pl-7">
      ${MENU_ACTION_FIELDS.map(({ key, label }) => `
        <li>
          <label class="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-gray-700">
            <input
              type="checkbox"
              class="menu-action-checkbox h-3.5 w-3.5 rounded border-gray-300 text-navy-700"
              data-path="${menuPath}"
              data-action="${key}"
              ${state[key] ? "checked" : ""}
            />
            <span>${label}</span>
          </label>
        </li>
      `).join("")}
    </ul>
  `;
}

function collectMenuActionPermissions() {
  return MENU_ACTION_PATHS.map((menuPath) => {
    const record = { menuPath };
    document.querySelectorAll(`.menu-action-checkbox[data-path="${menuPath}"]`).forEach((checkbox) => {
      record[checkbox.dataset.action] = checkbox.checked;
    });
    return record;
  });
}

function bindMenuPermCheckboxTree(container) {
  container.querySelectorAll(".menu-perm-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      handleMenuPermCheckboxChange(checkbox);
    });
  });
}

async function onPermissionRoleChange() {
  const select = document.getElementById("select-permission-role");
  const roleIdVal = select.value;
  const wrap = document.getElementById("role-permissions-config-wrap");
  const status = document.getElementById("role-load-status");

  if (!roleIdVal) {
    wrap.classList.add("hidden");
    status.textContent = "";
    selectedRoleId = null;
    syncManageRoleForm();
    return;
  }

  selectedRoleId = Number(roleIdVal);
  selectedManageRoleId = selectedRoleId;
  const overviewSelect = document.getElementById("roles-overview-select");
  if (overviewSelect) {
    overviewSelect.value = String(selectedRoleId);
  }
  syncManageRoleForm();
  status.textContent = "조회 중...";
  status.className = "text-xs text-gray-500";

  try {
    // 1. Fetch all menu items tree
    const menuTreeRes = await apiFetch("/api/menus", { auth: true });
    const fullMenuTree = menuTreeRes.data;

    // 2. Fetch specific role permissions
    const permRes = await apiFetch(`/api/admin/roles/${selectedRoleId}/permissions`, { auth: true });
    const permissions = permRes.data;

    wrap.classList.remove("hidden");
    status.textContent = "";

    // 3. Render menus checklist tree
    const container = document.getElementById("menu-permissions-tree");
    const allowedMenuIds = new Set(permissions.menuIds ?? []);
    const actionMap = new Map(
      (permissions.menuActionPermissions ?? []).map((record) => [record.menuPath, record]),
    );

    function buildCheckboxTreeHtml(nodes) {
      return `
        <ul class="space-y-1 pl-4 border-l border-gray-200 mt-1">
          ${nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const checked = allowedMenuIds.has(node.id) ? "checked" : "";
            const actionHtml = node.path ? buildMenuActionCheckboxesHtml(node.path, actionMap) : "";
            return `
              <li>
                <label class="flex items-center gap-2 cursor-pointer py-0.5">
                  <input type="checkbox" value="${node.id}" ${checked} class="menu-perm-checkbox h-4 w-4 rounded text-navy-700 border-gray-300" />
                  <span class="font-medium text-gray-900">${node.title}</span>
                  ${node.path ? `<code class="text-[10px] text-gray-500">${node.path}</code>` : ""}
                </label>
                ${actionHtml}
                ${hasChildren ? buildCheckboxTreeHtml(node.children) : ""}
              </li>
            `;
          }).join("")}
        </ul>
      `;
    }
    // Remove outer border-l/pl-4 for top level roots
    container.innerHTML = `
      <ul class="space-y-1">
        ${fullMenuTree.map(node => {
          const hasChildren = node.children && node.children.length > 0;
          const checked = allowedMenuIds.has(node.id) ? "checked" : "";
          const actionHtml = node.path ? buildMenuActionCheckboxesHtml(node.path, actionMap) : "";
          return `
            <li>
              <label class="flex items-center gap-2 cursor-pointer py-1 font-bold">
                <input type="checkbox" value="${node.id}" ${checked} class="menu-perm-checkbox h-4 w-4 rounded text-navy-700 border-gray-300" />
                <span class="text-gray-900">${node.title}</span>
                ${node.path ? `<code class="text-[10px] text-gray-500 font-normal">${node.path}</code>` : ""}
              </label>
              ${actionHtml}
              ${hasChildren ? buildCheckboxTreeHtml(node.children) : ""}
            </li>
          `;
        }).join("")}
      </ul>
    `;
    bindMenuPermCheckboxTree(container);

    // 4. Fill query filters permissions form
    const qp = permissions.queryPermission;
    
    // Reset radios
    const overwriteRadio = document.querySelector('input[name="query-enforcement"][value="OVERWRITE"]');
    const blockRadio = document.querySelector('input[name="query-enforcement"][value="BLOCK"]');
    if (qp?.enforcementMode === "BLOCK") {
      blockRadio.checked = true;
    } else {
      overwriteRadio.checked = true; // default OVERWRITE
    }

    // Set date limits (format to YYYY-MM-DD for date input)
    const minEl = document.getElementById("field-query-minDate");
    const maxEl = document.getElementById("field-query-maxDate");
    minEl.value = qp?.minAccidentAt ? qp.minAccidentAt.substring(0, 10) : "";
    maxEl.value = qp?.maxAccidentAt ? qp.maxAccidentAt.substring(0, 10) : "";

    selectedAllowedLineNames = Array.isArray(qp?.allowedLineNames) ? [...qp.allowedLineNames] : [];
    selectedAllowedLocationScope = normalizeLocationScope(qp?.allowedLocationScope);
    const selectedRole = rolesList.find((role) => role.id === selectedRoleId);
    if (!selectedAllowedLocationScope.length) {
      selectedAllowedLocationScope = getDefaultLocationScopeForRole(selectedRole?.name ?? "");
    }
    renderQueryLocationSelectors();

    // Set accident types checkboxes
    const LEGACY_TYPE_TO_CATEGORY = {
      COLLISION: "사고",
      DERAILMENT: "사고",
      FIRE: "사고",
      HUMAN_ERROR: "준사고",
      OTHER: "준사고",
      SIGNAL_FAILURE: "운행장애",
      TRACK_DEFECT: "운행장애(관리)",
    };
    const allowedTypes = new Set(
      (Array.isArray(qp?.allowedTypes) ? qp.allowedTypes : []).map(
        (value) => LEGACY_TYPE_TO_CATEGORY[value] ?? value,
      ),
    );
    const typeCheckboxes = document.querySelectorAll("#accident-types-checklist input[type='checkbox']");
    typeCheckboxes.forEach(cb => {
      cb.checked = allowedTypes.has(cb.value);
    });

  } catch (error) {
    status.textContent = "권한 조회 실패: " + error.message;
    status.className = "text-xs text-red-600 font-semibold";
  }
}

async function saveMenuPermissions() {
  if (!selectedRoleId) return;
  const status = document.getElementById("menu-perms-status");
  status.textContent = "저장 중...";
  status.className = "text-xs text-gray-500";

  try {
    const checkboxes = document.querySelectorAll(".menu-perm-checkbox:checked");
    const menuIds = Array.from(checkboxes).map(cb => Number(cb.value));
    const menuActionPermissions = collectMenuActionPermissions();

    await apiFetch(`/api/admin/roles/${selectedRoleId}/menu-permissions`, {
      auth: true,
      method: "PUT",
      body: { menuIds, menuActionPermissions }
    });

    status.textContent = "저장 완료!";
    status.className = "text-xs text-green-600 font-semibold";
  } catch (error) {
    status.textContent = "저장 실패: " + error.message;
    status.className = "text-xs text-red-600 font-semibold";
  }
}

async function saveQueryPermissions() {
  if (!selectedRoleId) return;
  const status = document.getElementById("query-perms-status");
  status.textContent = "저장 중...";
  status.className = "text-xs text-gray-500";

  try {
    const enforcementMode = document.querySelector('input[name="query-enforcement"]:checked').value;
    const minAccidentAtVal = document.getElementById("field-query-minDate").value;
    const maxAccidentAtVal = document.getElementById("field-query-maxDate").value;
    const allowedLineNames = selectedAllowedLineNames.length > 0 ? [...selectedAllowedLineNames] : null;
    const allowedLocationScope = buildLocationScopeFromChecks();

    const checkedTypes = document.querySelectorAll("#accident-types-checklist input[type='checkbox']:checked");
    const allowedTypes = checkedTypes.length > 0 ? Array.from(checkedTypes).map(cb => cb.value) : null;

    const payload = {
      enforcementMode,
      minAccidentAt: minAccidentAtVal ? new Date(minAccidentAtVal).toISOString() : null,
      maxAccidentAt: maxAccidentAtVal ? new Date(maxAccidentAtVal).toISOString() : null,
      allowedLineNames,
      allowedLocationScope: allowedLocationScope.length > 0 ? allowedLocationScope : null,
      allowedTypes,
      enforcedLineName: null
    };

    await apiFetch(`/api/admin/roles/${selectedRoleId}/query-permission`, {
      auth: true,
      method: "PUT",
      body: payload
    });

    status.textContent = "저장 완료!";
    status.className = "text-xs text-green-600 font-semibold";
    selectedAllowedLocationScope = allowedLocationScope;
  } catch (error) {
    status.textContent = "저장 실패: " + error.message;
    status.className = "text-xs text-red-600 font-semibold";
  }
}

// ==========================================
// TAB 5: CODE MANAGEMENT
// ==========================================
function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildCodeTreeFlatRows(tree) {
  const rows = [];

  tree.forEach((inst) => {
    const lines = inst.lines ?? [];
    if (!lines.length) {
      rows.push({
        기관코드: inst.code,
        기관명: inst.name,
        노선코드: "",
        노선명: "",
        역코드: "",
        역명: "",
      });
      return;
    }

    lines.forEach((line) => {
      const stations = line.stations ?? [];
      if (!stations.length) {
        rows.push({
          기관코드: inst.code,
          기관명: inst.name,
          노선코드: line.code,
          노선명: line.name,
          역코드: "",
          역명: "",
        });
        return;
      }

      stations.forEach((station) => {
        rows.push({
          기관코드: inst.code,
          기관명: inst.name,
          노선코드: line.code,
          노선명: line.name,
          역코드: station.code,
          역명: station.name,
        });
      });
    });
  });

  return rows;
}

function downloadCodeTreeXlsx() {
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    return;
  }

  if (!codeTree.length) {
    alert("다운로드할 코드 트리가 없습니다.");
    return;
  }

  const tree = getFilteredCodeTreeForPreview();
  if (!tree.length) {
    alert("필터 조건에 맞는 코드가 없습니다.");
    return;
  }

  const rows = buildCodeTreeFlatRows(tree);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ 안내: "등록된 데이터가 없습니다." }],
  );
  applyWorksheetColumnWidths(worksheet, rows.length ? rows : [{ 안내: "등록된 데이터가 없습니다." }]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "코드트리");

  const suffix =
    codeTreePreviewInstFilter || codeTreePreviewLineFilter ? "filtered" : "full";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(workbook, `code-tree-${suffix}_${stamp}.xlsx`);
}

function buildCodeTreeToggleButton(targetKey, hasChildren) {
  if (!hasChildren) {
    return `<span class="inline-block h-5 w-5 shrink-0" aria-hidden="true"></span>`;
  }
  return `
    <button
      type="button"
      class="code-tree-toggle inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-[11px] font-bold leading-none text-gray-700 hover:bg-gray-50"
      data-target="${targetKey}"
      data-expanded="false"
      aria-label="하위 항목 펼치기"
    >+</button>
  `;
}

function setCodeTreeBranchExpanded(targetKey, expanded) {
  const container = document.getElementById("code-tree-preview");
  if (!container) return;

  const toggle = container.querySelector(`.code-tree-toggle[data-target="${targetKey}"]`);
  const children = container.querySelector(`.code-tree-children[data-children-of="${targetKey}"]`);
  if (!toggle || !children) return;

  toggle.dataset.expanded = expanded ? "true" : "false";
  toggle.textContent = expanded ? "−" : "+";
  toggle.setAttribute("aria-label", expanded ? "하위 항목 접기" : "하위 항목 펼치기");
  children.classList.toggle("hidden", !expanded);
}

function toggleCodeTreeBranch(targetKey) {
  const container = document.getElementById("code-tree-preview");
  if (!container) return;

  const toggle = container.querySelector(`.code-tree-toggle[data-target="${targetKey}"]`);
  if (!toggle) return;
  setCodeTreeBranchExpanded(targetKey, toggle.dataset.expanded !== "true");
}

function buildCodeTreePreviewStationNodes(stations) {
  if (!stations?.length) {
    return `<li class="py-0.5 pl-4 text-[11px] text-gray-400">역 없음</li>`;
  }

  return stations
    .map(
      (station) => `
        <li class="py-0.5 pl-4">
          <span class="text-gray-800">${escapeHtml(station.name)}</span>
          <span class="ml-1 text-[10px] text-gray-500">(${escapeHtml(station.code)})</span>
        </li>
      `,
    )
    .join("");
}

function buildCodeTreePreviewLineNodes(lines, instCode) {
  if (!lines?.length) {
    return `<li class="py-0.5 pl-4 text-[11px] text-gray-400">노선 없음</li>`;
  }

  return lines
    .map((line) => {
      const lineKey = `line:${line.code}`;
      const hasStations = Boolean(line.stations?.length);
      return `
        <li class="py-0.5">
          <div class="flex items-center gap-1">
            ${buildCodeTreeToggleButton(lineKey, hasStations)}
            <span class="font-medium text-gray-900">[노선] ${escapeHtml(line.name)}</span>
            <span class="ml-1 text-[10px] text-gray-500">(${escapeHtml(line.code)})</span>
          </div>
          <ul class="code-tree-children hidden space-y-1 pl-4 border-l border-gray-200 mt-1 ml-6" data-children-of="${lineKey}">${buildCodeTreePreviewStationNodes(line.stations)}</ul>
        </li>
      `;
    })
    .join("");
}

function getFilteredCodeTreeForPreview() {
  const instFilter = codeTreePreviewInstFilter;
  const lineFilter = codeTreePreviewLineFilter;

  return codeTree
    .filter((inst) => !instFilter || inst.code === instFilter)
    .map((inst) => ({
      ...inst,
      lines: (inst.lines ?? []).filter((line) => !lineFilter || line.code === lineFilter),
    }))
    .filter((inst) => !lineFilter || inst.lines.length > 0);
}

function renderCodeTreePreviewFilterOptions() {
  const instSelect = document.getElementById("code-tree-inst-filter");
  const lineSelect = document.getElementById("code-tree-line-filter");
  if (!instSelect || !lineSelect) return;

  instSelect.innerHTML =
    `<option value="">전체</option>` +
    codeTree
      .map(
        (inst) =>
          `<option value="${escapeHtml(inst.code)}">${escapeHtml(inst.name)} (${escapeHtml(inst.code)})</option>`,
      )
      .join("");
  instSelect.value =
    codeTreePreviewInstFilter && codeTree.some((inst) => inst.code === codeTreePreviewInstFilter)
      ? codeTreePreviewInstFilter
      : "";

  const lineOptions = [{ code: "", label: "전체" }];
  codeTree.forEach((inst) => {
    if (instSelect.value && inst.code !== instSelect.value) return;
    (inst.lines ?? []).forEach((line) => {
      lineOptions.push({
        code: line.code,
        label: instSelect.value
          ? `${line.name} (${line.code})`
          : `${inst.name} · ${line.name} (${line.code})`,
      });
    });
  });

  lineSelect.innerHTML = lineOptions
    .map((option) => `<option value="${escapeHtml(option.code)}">${escapeHtml(option.label)}</option>`)
    .join("");
  lineSelect.value =
    codeTreePreviewLineFilter && lineOptions.some((option) => option.code === codeTreePreviewLineFilter)
      ? codeTreePreviewLineFilter
      : "";
}

function renderCodeTreePreview() {
  const container = document.getElementById("code-tree-preview");
  if (!container) return;
  if (!codeTree.length) {
    renderCodeTreePreviewFilterOptions();
    container.innerHTML = `<p class="text-xs text-gray-500">등록된 코드가 없습니다.</p>`;
    return;
  }

  renderCodeTreePreviewFilterOptions();
  const tree = getFilteredCodeTreeForPreview();
  if (!tree.length) {
    container.innerHTML = `<p class="text-xs text-gray-500">필터 조건에 맞는 코드가 없습니다.</p>`;
    return;
  }

  container.innerHTML = `
    <ul class="space-y-1">
      ${tree
        .map((inst) => {
          const instKey = `inst:${inst.code}`;
          const hasLines = Boolean(inst.lines?.length);
          return `
            <li class="py-0.5">
              <div class="flex items-center gap-1">
                ${buildCodeTreeToggleButton(instKey, hasLines)}
                <span class="font-bold text-gray-900">[기관] ${escapeHtml(inst.name)}</span>
                <span class="ml-1 text-[10px] text-gray-500">(${escapeHtml(inst.code)})</span>
              </div>
              <ul class="code-tree-children hidden space-y-1 pl-4 border-l border-gray-200 mt-1 ml-6" data-children-of="${instKey}">${buildCodeTreePreviewLineNodes(inst.lines, inst.code)}</ul>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function bindCodeTreePreviewEvents() {
  const instSelect = document.getElementById("code-tree-inst-filter");
  const lineSelect = document.getElementById("code-tree-line-filter");
  const container = document.getElementById("code-tree-preview");

  if (instSelect && !instSelect.dataset.bound) {
    instSelect.dataset.bound = "true";
    instSelect.addEventListener("change", () => {
      codeTreePreviewInstFilter = instSelect.value;
      if (codeTreePreviewLineFilter) {
        const stillValid = codeTree.some(
          (inst) =>
            (!codeTreePreviewInstFilter || inst.code === codeTreePreviewInstFilter) &&
            (inst.lines ?? []).some((line) => line.code === codeTreePreviewLineFilter),
        );
        if (!stillValid) {
          codeTreePreviewLineFilter = "";
        }
      }
      renderCodeTreePreview();
    });
  }

  if (lineSelect && !lineSelect.dataset.bound) {
    lineSelect.dataset.bound = "true";
    lineSelect.addEventListener("change", () => {
      codeTreePreviewLineFilter = lineSelect.value;
      if (codeTreePreviewLineFilter && !codeTreePreviewInstFilter) {
        for (const inst of codeTree) {
          if ((inst.lines ?? []).some((line) => line.code === codeTreePreviewLineFilter)) {
            codeTreePreviewInstFilter = inst.code;
            break;
          }
        }
      }
      renderCodeTreePreview();
    });
  }

  if (container && !container.dataset.bound) {
    container.dataset.bound = "true";
    container.addEventListener("click", (event) => {
      const toggle = event.target.closest(".code-tree-toggle");
      if (toggle?.dataset.target) {
        event.preventDefault();
        toggleCodeTreeBranch(toggle.dataset.target);
      }
    });
  }
}

function renderCodeEditorTabs() {
  const map = {
    기관: "btn-code-table-org",
    노선: "btn-code-table-line",
    역: "btn-code-table-station",
  };
  Object.entries(map).forEach(([type, buttonId]) => {
    const button = document.getElementById(buttonId);
    if (!button) return;
    const active = type === activeCodeEditorType;
    button.className = active
      ? "code-table-tab rounded border border-navy-700 bg-navy-700 px-3 py-1 text-xs font-semibold text-white"
      : "code-table-tab rounded border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700";
  });
}

function renderCodeEditorTable() {
  const tbody = document.getElementById("code-editor-table-body");
  if (!tbody) return;
  const rows = codeEditorTables[activeCodeEditorType] ?? [];

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="border border-gray-200 px-3 py-3 text-center text-gray-500">데이터 없음</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row, index) => `
        <tr>
          <td class="border border-gray-200 px-2 py-1">
            <input type="text" class="w-full rounded border border-gray-300 px-2 py-1 text-xs bg-gray-50" value="${row.codeType}" readonly />
          </td>
          <td class="border border-gray-200 px-2 py-1">
            <input type="text" data-field="code" data-index="${index}" class="code-editor-input w-full rounded border border-gray-300 px-2 py-1 text-xs" value="${row.code}" />
          </td>
          <td class="border border-gray-200 px-2 py-1">
            <input type="text" data-field="value" data-index="${index}" class="code-editor-input w-full rounded border border-gray-300 px-2 py-1 text-xs" value="${row.value}" />
          </td>
          <td class="border border-gray-200 px-2 py-1 text-center">
            <button type="button" class="code-editor-remove rounded border border-red-300 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50" data-index="${index}">삭제</button>
          </td>
        </tr>
      `,
    )
    .join("");
}

function bindCodeEditorEvents() {
  const tbody = document.getElementById("code-editor-table-body");
  if (!tbody || tbody.dataset.bound) return;
  tbody.dataset.bound = "true";

  tbody.addEventListener("input", (event) => {
    const target = event.target.closest(".code-editor-input");
    if (!target) return;
    const field = target.dataset.field;
    const index = Number(target.dataset.index);
    if (!field || !Number.isInteger(index)) return;
    if (!codeEditorTables[activeCodeEditorType] || !codeEditorTables[activeCodeEditorType][index]) return;
    codeEditorTables[activeCodeEditorType][index][field] = target.value;
  });

  tbody.addEventListener("click", (event) => {
    const button = event.target.closest(".code-editor-remove");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!Number.isInteger(index)) return;
    codeEditorTables[activeCodeEditorType].splice(index, 1);
    renderCodeEditorTable();
  });
}

function switchCodeEditorType(type) {
  activeCodeEditorType = type;
  renderCodeEditorTabs();
  renderCodeEditorTable();
}

async function loadCodeManagementTab() {
  try {
    const codeRes = await apiFetch("/api/admin/codes/tree", { auth: true });
    codeTree = codeRes.data ?? [];
    bindCodeTreePreviewEvents();
    renderCodeTreePreview();
    if (document.getElementById("panel-roles") && !document.getElementById("panel-roles").classList.contains("hidden")) {
      renderQueryLocationSelectors();
    }

    if (codeTree.length > 0) {
      codeEditorTables = codeTreeToEditorTables(codeTree);
    } else if (!Object.keys(codeEditorTables).length) {
      codeEditorTables = createDefaultCodeEditorTables();
    }
    renderCodeEditorTabs();
    renderCodeEditorTable();
    bindCodeEditorEvents();
  } catch (error) {
    const container = document.getElementById("code-tree-preview");
    if (container) {
      container.innerHTML = `<p class="text-xs text-red-600">코드 로드 실패: ${error.message}</p>`;
    }
  }
}

function escapeCsvValue(value) {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildCsv(header, rows) {
  const body = rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")).join("\n");
  return `${header}\n${body}${body ? "\n" : ""}`;
}

function getEditorRowsByType(typeLabel) {
  const rows = Array.isArray(codeEditorTables?.[typeLabel]) ? codeEditorTables[typeLabel] : [];
  return rows
    .map((row) => ({
      code: String(row?.code ?? "").trim(),
      name: String(row?.value ?? "").trim(),
    }))
    .filter((row) => row.code)
    .map((row) => ({
      code: row.code,
      name: row.name || row.code,
    }));
}

function initializeCodeRelationState() {
  const lineMap = new Map();
  const stationMap = new Map();
  const lineOwner = {};
  const stationOwner = {};

  codeTree.forEach((inst) => {
    (inst.lines ?? []).forEach((line) => {
      lineMap.set(line.code, { code: line.code, name: line.name });
      lineOwner[line.code] = inst.code;
      (line.stations ?? []).forEach((station) => {
        stationMap.set(station.code, { code: station.code, name: station.name });
        stationOwner[station.code] = line.code;
      });
    });
  });

  const editorInstitutions = getEditorRowsByType("기관");
  const editorLines = getEditorRowsByType("노선");
  const editorStations = getEditorRowsByType("역");

  const existingInstCodes = new Set(codeTree.map((inst) => inst.code));
  editorInstitutions.forEach((inst) => {
    if (existingInstCodes.has(inst.code)) return;
    codeTree.push({
      code: inst.code,
      name: inst.name,
      lines: [],
    });
    existingInstCodes.add(inst.code);
  });

  editorLines.forEach((line) => {
    if (!lineMap.has(line.code)) {
      lineMap.set(line.code, { code: line.code, name: line.name });
    }
  });

  editorStations.forEach((station) => {
    if (!stationMap.has(station.code)) {
      stationMap.set(station.code, { code: station.code, name: station.name });
    }
  });

  relationAllLines = Array.from(lineMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  relationAllStations = Array.from(stationMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  relationLineToInstitution = lineOwner;
  relationStationToLine = stationOwner;
  relationExpandedInstitutions = new Set(codeTree.map((inst) => inst.code));
  relationExpandedLines = new Set(relationAllLines.map((line) => line.code));
  relationSelectedStationCodes = new Set();
  relationDraggedPayload = null;
  relationSearchTerm = "";
  relationRightLayer = "station";
  relationRightCompanyFilter = "";
  relationRightLineFilter = "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLineByCode(code) {
  return relationAllLines.find((line) => line.code === code);
}

function getInstitutionByCode(code) {
  return codeTree.find((inst) => inst.code === code);
}

function getStationsForLine(lineCode) {
  return relationAllStations
    .filter((station) => relationStationToLine[station.code] === lineCode)
    .sort((a, b) => a.code.localeCompare(b.code));
}

function buildRightPanelRows() {
  const term = relationSearchTerm.trim().toLowerCase();
  if (relationRightLayer === "institution") {
    return codeTree
      .filter((inst) => !term || inst.code.toLowerCase().includes(term) || inst.name.toLowerCase().includes(term))
      .map((inst) => ({ nodeType: "institution", code: inst.code, name: inst.name }));
  }

  if (relationRightLayer === "line") {
    return relationAllLines
      .filter((line) => {
        const ownerCode = relationLineToInstitution[line.code] ?? "";
        if (relationRightCompanyFilter && ownerCode !== relationRightCompanyFilter) return false;
        if (!term) return true;
        return line.code.toLowerCase().includes(term) || line.name.toLowerCase().includes(term);
      })
      .map((line) => ({ nodeType: "line", code: line.code, name: line.name }));
  }

  return relationAllStations
    .filter((station) => {
      const ownerLineCode = relationStationToLine[station.code] ?? "";
      if (relationRightLineFilter && ownerLineCode !== relationRightLineFilter) return false;
      if (relationRightCompanyFilter) {
        const lineOwnerInst = relationLineToInstitution[ownerLineCode];
        if (lineOwnerInst !== relationRightCompanyFilter) return false;
      }
      if (!term) return true;
      return station.code.toLowerCase().includes(term) || station.name.toLowerCase().includes(term);
    })
    .map((station) => ({ nodeType: "station", code: station.code, name: station.name }));
}

function renderCodeRelationTreePanel() {
  const container = document.getElementById("code-relation-tree-panel");
  if (!container) return;
  if (!codeTree.length) {
    container.innerHTML = `<p class="text-[11px] text-gray-500">코드 없음</p>`;
    return;
  }

  container.innerHTML = `
    <ul class="space-y-1">
      ${codeTree
        .map((inst) => {
          const instExpanded = relationExpandedInstitutions.has(inst.code);
          const instLines = relationAllLines.filter((line) => relationLineToInstitution[line.code] === inst.code);
          return `
            <li>
              <div class="relation-drop-inst flex items-center gap-2 rounded px-1 py-0.5" data-inst-code="${escapeHtml(inst.code)}">
                <button
                  type="button"
                  class="relation-toggle h-5 w-5 rounded border border-gray-300 bg-white text-[10px] text-gray-700"
                  data-node-type="institution"
                  data-code="${escapeHtml(inst.code)}"
                >${instExpanded ? "▼" : "▶"}</button>
                <span class="font-semibold text-gray-900">${escapeHtml(inst.name)}</span>
                <span class="text-[10px] text-gray-500">(${escapeHtml(inst.code)})</span>
              </div>
              <ul class="${instExpanded ? "mt-1 space-y-1 pl-5 border-l border-gray-200" : "hidden"}">
                ${instLines
                  .map((line) => {
                    const lineExpanded = relationExpandedLines.has(line.code);
                    const stations = getStationsForLine(line.code);
                    return `
                      <li>
                        <div
                          class="relation-drop-line relation-tree-line-draggable flex items-center gap-2 rounded px-1 py-0.5 transition-colors"
                          data-line-code="${escapeHtml(line.code)}"
                          data-node-type="line"
                          draggable="true"
                        >
                          <button
                            type="button"
                            class="relation-toggle h-5 w-5 rounded border border-gray-300 bg-white text-[10px] text-gray-700"
                            data-node-type="line"
                            data-code="${escapeHtml(line.code)}"
                          >${lineExpanded ? "▼" : "▶"}</button>
                          <span class="font-medium text-gray-800">${escapeHtml(line.name)}</span>
                          <span class="text-[10px] text-gray-500">(${escapeHtml(line.code)})</span>
                        </div>
                        <ul class="${lineExpanded ? "mt-1 space-y-1 pl-5 border-l border-gray-200" : "hidden"}">
                          ${
                            stations.length
                              ? stations
                                  .map((station) => {
                                    const selected = relationSelectedStationCodes.has(station.code);
                                    return `
                                      <li
                                        class="relation-tree-station cursor-pointer rounded px-1 py-0.5 ${
                                          selected ? "bg-navy-100 text-navy-900" : "hover:bg-gray-100 text-gray-800"
                                        }"
                                        draggable="true"
                                        data-station-code="${escapeHtml(station.code)}"
                                        data-node-type="station"
                                        data-source="tree"
                                      >
                                        <span class="inline-block w-4 text-center text-gray-400">·</span>
                                        ${escapeHtml(station.name)}
                                        <span class="ml-1 text-[10px] text-gray-500">(${escapeHtml(station.code)})</span>
                                      </li>
                                    `;
                                  })
                                  .join("")
                              : `<li class="px-1 py-0.5 text-[11px] text-gray-400">배치된 역 없음</li>`
                          }
                        </ul>
                      </li>
                    `;
                  })
                  .join("")}
              </ul>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function renderCodeRelationRightList() {
  const container = document.getElementById("code-relation-right-list");
  if (!container) return;
  const rows = buildRightPanelRows();

  if (!rows.length) {
    container.innerHTML = `<div class="rounded border border-dashed border-gray-300 bg-white p-3 text-[11px] text-gray-500">조건에 맞는 코드가 없습니다.</div>`;
    return;
  }

  container.innerHTML = `
    <ul class="space-y-1 rounded border border-gray-200 bg-white p-2">
      ${rows
        .map(
          (row) => `
            <li
              class="relation-right-item cursor-move rounded border border-gray-200 px-2 py-1 hover:bg-gray-50"
              draggable="true"
              data-node-type="${escapeHtml(row.nodeType)}"
              data-code="${escapeHtml(row.code)}"
            >
              <span class="font-medium text-gray-800">${escapeHtml(row.name)}</span>
              <span class="ml-1 text-[10px] text-gray-500">(${escapeHtml(row.code)})</span>
              <span class="ml-2 text-[10px] text-gray-400">${row.nodeType === "institution" ? "회사" : row.nodeType === "line" ? "노선" : "역"}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderCodeRelationViews() {
  renderCodeRelationTreePanel();
  renderCodeRelationRightList();
}

function applyStationMove(stationCodes, targetLineCode) {
  if (!targetLineCode || !getLineByCode(targetLineCode)) return;
  stationCodes.forEach((code) => {
    relationStationToLine[code] = targetLineCode;
  });
  relationSelectedStationCodes = new Set(stationCodes);
  renderCodeRelationViews();
}

function applyLineMove(lineCodes, targetInstitutionCode) {
  if (!targetInstitutionCode || !getInstitutionByCode(targetInstitutionCode)) return;
  lineCodes.forEach((lineCode) => {
    relationLineToInstitution[lineCode] = targetInstitutionCode;
  });
  renderCodeRelationViews();
}

function unassignStations(stationCodes) {
  stationCodes.forEach((code) => {
    delete relationStationToLine[code];
  });
  relationSelectedStationCodes = new Set();
  renderCodeRelationViews();
}

function parseDragPayload(event) {
  try {
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.nodeType || !Array.isArray(parsed.codes) || !parsed.codes.length) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

function bindCodeRelationTreeEvents() {
  const treeContainer = document.getElementById("code-relation-tree-panel");
  const listContainer = document.getElementById("code-relation-right-list");
  const searchInput = document.getElementById("code-relation-search-input");
  const rightLayerSelect = document.getElementById("code-relation-right-layer-select");
  const companyFilterSelect = document.getElementById("code-relation-right-company-filter");
  const lineFilterSelect = document.getElementById("code-relation-right-line-filter");
  const unassignButton = document.getElementById("btn-code-relations-unassign");

  const renderRightFilterOptions = () => {
    if (companyFilterSelect) {
      companyFilterSelect.innerHTML =
        `<option value="">전체 회사</option>` +
        codeTree.map((inst) => `<option value="${inst.code}">${inst.name} (${inst.code})</option>`).join("");
      companyFilterSelect.value = relationRightCompanyFilter;
    }
    if (lineFilterSelect) {
      const lineRows = relationAllLines.filter((line) => {
        if (!relationRightCompanyFilter) return true;
        return relationLineToInstitution[line.code] === relationRightCompanyFilter;
      });
      lineFilterSelect.innerHTML =
        `<option value="">전체 노선</option>` +
        lineRows.map((line) => `<option value="${line.code}">${line.name} (${line.code})</option>`).join("");
      if (relationRightLineFilter && !lineRows.some((line) => line.code === relationRightLineFilter)) {
        relationRightLineFilter = "";
      }
      lineFilterSelect.value = relationRightLineFilter;
      lineFilterSelect.disabled = relationRightLayer !== "station";
    }
  };

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener("input", (event) => {
      relationSearchTerm = event.target.value ?? "";
      renderCodeRelationRightList();
    });
    searchInput.dataset.bound = "true";
  }

  if (rightLayerSelect && !rightLayerSelect.dataset.bound) {
    rightLayerSelect.addEventListener("change", (event) => {
      relationRightLayer = event.target.value;
      renderRightFilterOptions();
      renderCodeRelationRightList();
    });
    rightLayerSelect.dataset.bound = "true";
  }

  if (companyFilterSelect && !companyFilterSelect.dataset.bound) {
    companyFilterSelect.addEventListener("change", (event) => {
      relationRightCompanyFilter = event.target.value;
      renderRightFilterOptions();
      renderCodeRelationRightList();
    });
    companyFilterSelect.dataset.bound = "true";
  }

  if (lineFilterSelect && !lineFilterSelect.dataset.bound) {
    lineFilterSelect.addEventListener("change", (event) => {
      relationRightLineFilter = event.target.value;
      renderCodeRelationRightList();
    });
    lineFilterSelect.dataset.bound = "true";
  }

  if (unassignButton && !unassignButton.dataset.bound) {
    unassignButton.addEventListener("click", () => {
      if (!relationSelectedStationCodes.size) return;
      unassignStations(Array.from(relationSelectedStationCodes));
    });
    unassignButton.dataset.bound = "true";
  }

  if (treeContainer && !treeContainer.dataset.bound) {
    treeContainer.addEventListener("click", (event) => {
      const toggleBtn = event.target.closest(".relation-toggle");
      if (toggleBtn) {
        const nodeType = toggleBtn.dataset.nodeType;
        const code = toggleBtn.dataset.code;
        if (!code) return;
        if (nodeType === "institution") {
          if (relationExpandedInstitutions.has(code)) relationExpandedInstitutions.delete(code);
          else relationExpandedInstitutions.add(code);
        } else if (nodeType === "line") {
          if (relationExpandedLines.has(code)) relationExpandedLines.delete(code);
          else relationExpandedLines.add(code);
        }
        renderCodeRelationTreePanel();
        return;
      }

      const stationItem = event.target.closest(".relation-tree-station");
      if (!stationItem) return;
      const code = stationItem.dataset.stationCode;
      if (!code) return;
      if (event.shiftKey) {
        if (relationSelectedStationCodes.has(code)) relationSelectedStationCodes.delete(code);
        else relationSelectedStationCodes.add(code);
      } else {
        relationSelectedStationCodes = new Set([code]);
      }
      renderCodeRelationTreePanel();
    });

    treeContainer.addEventListener("dragstart", (event) => {
      const stationItem = event.target.closest(".relation-tree-station");
      const lineItem = event.target.closest(".relation-tree-line-draggable");
      if (stationItem) {
        const code = stationItem.dataset.stationCode;
        if (!code) return;
        const stationCodes = relationSelectedStationCodes.has(code) ? Array.from(relationSelectedStationCodes) : [code];
        relationDraggedPayload = { nodeType: "station", codes: stationCodes };
      } else if (lineItem) {
        const lineCode = lineItem.dataset.lineCode;
        if (!lineCode) return;
        relationDraggedPayload = { nodeType: "line", codes: [lineCode] };
      } else {
        return;
      }
      event.dataTransfer.setData(
        "text/plain",
        JSON.stringify(relationDraggedPayload),
      );
      event.dataTransfer.effectAllowed = "move";
    });

    treeContainer.addEventListener("dragover", (event) => {
      const lineDrop = event.target.closest(".relation-drop-line");
      const instDrop = event.target.closest(".relation-drop-inst");
      const payload = parseDragPayload(event) || relationDraggedPayload;
      if (!payload) return;
      if (lineDrop && payload.nodeType === "station") {
        event.preventDefault();
        lineDrop.classList.add("bg-amber-100", "ring-1", "ring-amber-300");
        event.dataTransfer.dropEffect = "move";
      } else if (instDrop && payload.nodeType === "line") {
        event.preventDefault();
        instDrop.classList.add("bg-amber-100", "ring-1", "ring-amber-300");
        event.dataTransfer.dropEffect = "move";
      }
    });

    treeContainer.addEventListener("dragleave", (event) => {
      const lineDrop = event.target.closest(".relation-drop-line");
      const instDrop = event.target.closest(".relation-drop-inst");
      if (lineDrop) lineDrop.classList.remove("bg-amber-100", "ring-1", "ring-amber-300");
      if (instDrop) instDrop.classList.remove("bg-amber-100", "ring-1", "ring-amber-300");
    });

    treeContainer.addEventListener("drop", (event) => {
      const lineDrop = event.target.closest(".relation-drop-line");
      const instDrop = event.target.closest(".relation-drop-inst");
      const payload = parseDragPayload(event) || relationDraggedPayload;
      if (lineDrop) lineDrop.classList.remove("bg-amber-100", "ring-1", "ring-amber-300");
      if (instDrop) instDrop.classList.remove("bg-amber-100", "ring-1", "ring-amber-300");
      if (!payload?.codes?.length) return;

      if (lineDrop && payload.nodeType === "station") {
        const targetLineCode = lineDrop.dataset.lineCode;
        if (!targetLineCode) return;
        event.preventDefault();
        applyStationMove(payload.codes, targetLineCode);
      } else if (instDrop && payload.nodeType === "line") {
        const targetInstCode = instDrop.dataset.instCode;
        if (!targetInstCode) return;
        event.preventDefault();
        applyLineMove(payload.codes, targetInstCode);
      }
    });

    treeContainer.addEventListener("dragend", () => {
      relationDraggedPayload = null;
    });

    treeContainer.dataset.bound = "true";
  }

  if (listContainer && !listContainer.dataset.bound) {
    listContainer.addEventListener("dragstart", (event) => {
      const item = event.target.closest(".relation-right-item");
      if (!item) return;
      const nodeType = item.dataset.nodeType;
      const code = item.dataset.code;
      if (!nodeType || !code) return;
      relationDraggedPayload = { nodeType, codes: [code] };
      event.dataTransfer.setData(
        "text/plain",
        JSON.stringify(relationDraggedPayload),
      );
      event.dataTransfer.effectAllowed = "move";
    });

    listContainer.addEventListener("dragover", (event) => {
      const payload = parseDragPayload(event) || relationDraggedPayload;
      if (!payload) return;
      event.preventDefault();
      listContainer.classList.add("bg-amber-50", "ring-1", "ring-amber-300");
      event.dataTransfer.dropEffect = "move";
    });

    listContainer.addEventListener("dragleave", () => {
      listContainer.classList.remove("bg-amber-50", "ring-1", "ring-amber-300");
    });

    listContainer.addEventListener("drop", (event) => {
      const payload = parseDragPayload(event) || relationDraggedPayload;
      listContainer.classList.remove("bg-amber-50", "ring-1", "ring-amber-300");
      if (!payload?.codes?.length) return;
      const targetItem = event.target.closest(".relation-right-item");
      event.preventDefault();
      if (!targetItem) {
        if (payload.nodeType === "station") {
          unassignStations(payload.codes);
        }
        return;
      }

      const targetType = targetItem.dataset.nodeType;
      const targetCode = targetItem.dataset.code;
      if (!targetType || !targetCode) return;

      if (payload.nodeType === "station" && targetType === "line") {
        applyStationMove(payload.codes, targetCode);
      } else if (payload.nodeType === "line" && targetType === "institution") {
        applyLineMove(payload.codes, targetCode);
      } else if (payload.nodeType === "station" && targetType === "station") {
        const targetLineCode = relationStationToLine[targetCode];
        if (targetLineCode) {
          applyStationMove(payload.codes, targetLineCode);
        }
      } else if (payload.nodeType === "line" && targetType === "line") {
        const targetInstCode = relationLineToInstitution[targetCode];
        if (targetInstCode) {
          applyLineMove(payload.codes, targetInstCode);
        }
      }
    });

    listContainer.addEventListener("dragend", () => {
      relationDraggedPayload = null;
    });

    listContainer.dataset.bound = "true";
  }

  renderRightFilterOptions();
  if (rightLayerSelect) rightLayerSelect.value = relationRightLayer;
}

function applyWorksheetColumnWidths(worksheet, rows) {
  if (!rows.length) return;
  worksheet["!cols"] = Object.keys(rows[0]).map((key) => ({
    wch: Math.min(40, Math.max(key.length + 2, ...rows.map((row) => String(row[key] ?? "").length + 2))),
  }));
}

function buildCodeRelationFlatRows() {
  const rows = [];
  const institutions = [...codeTree].sort((a, b) => a.code.localeCompare(b.code));

  const pushRow = (inst, line, station) => {
    rows.push({
      기관코드: inst?.code ?? "",
      기관명: inst?.name ?? "",
      노선코드: line?.code ?? "",
      노선명: line?.name ?? "",
      역코드: station?.code ?? "",
      역명: station?.name ?? "",
    });
  };

  for (const inst of institutions) {
    const instLines = relationAllLines
      .filter((line) => relationLineToInstitution[line.code] === inst.code)
      .sort((a, b) => a.code.localeCompare(b.code));

    if (!instLines.length) {
      pushRow(inst, null, null);
      continue;
    }

    for (const line of instLines) {
      const stations = getStationsForLine(line.code);
      if (!stations.length) {
        pushRow(inst, line, null);
        continue;
      }
      for (const station of stations) {
        pushRow(inst, line, station);
      }
    }
  }

  const unassignedLines = relationAllLines
    .filter((line) => !relationLineToInstitution[line.code])
    .sort((a, b) => a.code.localeCompare(b.code));
  for (const line of unassignedLines) {
    const stations = getStationsForLine(line.code);
    if (!stations.length) {
      pushRow(null, line, null);
      continue;
    }
    for (const station of stations) {
      pushRow(null, line, station);
    }
  }

  const unassignedStations = relationAllStations
    .filter((station) => !relationStationToLine[station.code])
    .sort((a, b) => a.code.localeCompare(b.code));
  for (const station of unassignedStations) {
    pushRow(null, null, station);
  }

  return rows;
}

function downloadCodeRelationsXlsx() {
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    return;
  }

  const status = document.getElementById("code-relations-status");
  if (status) {
    status.textContent = "엑셀 생성 중...";
    status.className = "text-xs text-gray-500";
  }

  try {
    const institutionRows = [...codeTree]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((inst) => ({ code: inst.code, name: inst.name }));
    const lineRows = relationAllLines
      .map((line) => ({
        institutionCode: relationLineToInstitution[line.code] ?? "",
        code: line.code,
        name: line.name,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
    const stationRows = relationAllStations
      .map((station) => ({
        lineCode: relationStationToLine[station.code] ?? "",
        code: station.code,
        name: station.name,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
    const treeRows = buildCodeRelationFlatRows();

    const workbook = XLSX.utils.book_new();
    const sheets = [
      { name: "종속관계", rows: treeRows },
      { name: "기관", rows: institutionRows },
      { name: "노선", rows: lineRows },
      { name: "역", rows: stationRows },
    ];

    for (const sheet of sheets) {
      const worksheet = XLSX.utils.json_to_sheet(
        sheet.rows.length ? sheet.rows : [{ 안내: "등록된 데이터가 없습니다." }],
      );
      applyWorksheetColumnWidths(worksheet, sheet.rows.length ? sheet.rows : [{ 안내: "등록된 데이터가 없습니다." }]);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(workbook, `code-relations_${stamp}.xlsx`);

    if (status) {
      status.textContent = "엑셀 다운로드 완료";
      status.className = "text-xs text-green-600 font-semibold";
    }
  } catch (error) {
    if (status) {
      status.textContent = `엑셀 다운로드 실패: ${error.message}`;
      status.className = "text-xs text-red-600 font-semibold";
    }
  }
}

async function saveCodeRelations() {
  const status = document.getElementById("code-relations-status");
  status.textContent = "저장 중...";
  status.className = "text-xs text-gray-500";

  try {
    const lineRows = relationAllLines
      .map((line) => ({
        institutionCode: relationLineToInstitution[line.code],
        code: line.code,
        name: line.name,
      }))
      .filter((row) => row.institutionCode);

    const lineCsv = buildCsv(
      "institutionCode,code,name",
      lineRows.map((row) => [row.institutionCode, row.code, row.name]),
    );
    await apiFetch("/api/admin/codes/upload-csv/lines", {
      auth: true,
      method: "POST",
      body: { csv: lineCsv },
    });

    const lineCodeSet = new Set(lineRows.map((row) => row.code));
    const stationRows = relationAllStations
      .map((station) => ({
        lineCode: relationStationToLine[station.code],
        code: station.code,
        name: station.name,
      }))
      .filter((row) => row.lineCode && lineCodeSet.has(row.lineCode));

    const stationCsv = buildCsv(
      "lineCode,code,name",
      stationRows.map((row) => [row.lineCode, row.code, row.name]),
    );
    await apiFetch("/api/admin/codes/upload-csv/stations", {
      auth: true,
      method: "POST",
      body: { csv: stationCsv },
    });

    status.textContent = "저장 완료";
    status.className = "text-xs text-green-600 font-semibold";
    await loadCodeRelationsTab();
  } catch (error) {
    status.textContent = `저장 실패: ${error.message}`;
    status.className = "text-xs text-red-600 font-semibold";
  }
}

async function loadCodeRelationsTab() {
  const status = document.getElementById("code-relations-status");
  const searchInput = document.getElementById("code-relation-search-input");
  status.textContent = "로드 중...";
  status.className = "text-xs text-gray-500";
  try {
    const codeRes = await apiFetch("/api/admin/codes/tree", { auth: true });
    codeTree = codeRes.data ?? [];
    initializeCodeRelationState();
    if (searchInput) {
      searchInput.value = "";
    }
    renderCodeRelationViews();
    bindCodeRelationTreeEvents();
    status.textContent = "로드 완료";
    status.className = "text-xs text-green-600";
  } catch (error) {
    status.textContent = `로드 실패: ${error.message}`;
    status.className = "text-xs text-red-600";
  }
}

async function downloadSampleCsv() {
  const type = document.getElementById("code-csv-type").value;
  const res = await apiFetch(`/api/admin/codes/sample-csv/${type}`, { auth: true });
  downloadCsv(`${type}-sample.csv`, res.data);
}

async function downloadCurrentCsv() {
  const type = document.getElementById("code-csv-type").value;
  const res = await apiFetch(`/api/admin/codes/export-csv/${type}`, { auth: true });
  downloadCsv(`${type}-current.csv`, res.data);
}

async function uploadCodeCsv() {
  const type = document.getElementById("code-csv-type").value;
  const fileInput = document.getElementById("code-csv-file");
  const status = document.getElementById("code-upload-status");
  const file = fileInput.files?.[0];
  if (!file) {
    status.textContent = "CSV 파일을 선택하세요.";
    status.className = "ml-3 text-xs text-red-600";
    return;
  }

  status.textContent = "업로드 중...";
  status.className = "ml-3 text-xs text-gray-500";

  try {
    const csv = await file.text();
    await apiFetch(`/api/admin/codes/upload-csv/${type}`, {
      auth: true,
      method: "POST",
      body: { csv },
    });
    status.textContent = "업로드 완료";
    status.className = "ml-3 text-xs text-green-600";
    fileInput.value = "";
    await loadCodeManagementTab();
  } catch (error) {
    status.textContent = `업로드 실패: ${error.message}`;
    status.className = "ml-3 text-xs text-red-600";
  }
}

// ==========================================
// TAB: INVESTMENT DISCLOSURE
// ==========================================
let invAdminEncoding = "EUC-KR";

async function loadInvestmentDisclosureTab() {
  const info = document.getElementById("inv-admin-info");
  if (!info) return;
  try {
    const res = await apiFetch("/api/admin/investment-disclosure/info", { auth: true });
    const { recordCount, agencies } = res.data ?? {};
    info.textContent = `저장 레코드 ${recordCount ?? 0}건 · 기관 ${(agencies ?? []).length}개${agencies?.length ? ` (${agencies.join(", ")})` : ""}`;
  } catch (error) {
    info.textContent = `현황 조회 실패: ${error.message}`;
  }
}

function readInvCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => resolve(evt.target?.result ?? "");
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsText(file, invAdminEncoding);
  });
}

async function downloadInvSampleCsv() {
  const res = await apiFetch("/api/admin/investment-disclosure/sample-csv", { auth: true });
  downloadCsv("investment-disclosure-sample.csv", res.data);
}

async function downloadInvCurrentCsv() {
  const res = await apiFetch("/api/admin/investment-disclosure/export-csv", { auth: true });
  downloadCsv("investment-disclosure-current.csv", res.data);
}

async function uploadInvestmentDisclosureCsv() {
  const fileInput = document.getElementById("inv-csv-file");
  const status = document.getElementById("inv-upload-status");
  const file = fileInput?.files?.[0];
  if (!file) {
    status.textContent = "CSV 파일을 선택하세요.";
    status.className = "ml-3 text-xs text-red-600";
    return;
  }
  status.textContent = "업로드 중...";
  status.className = "ml-3 text-xs text-gray-500";
  try {
    const csv = await readInvCsvFile(file);
    const res = await apiFetch("/api/admin/investment-disclosure/upload-csv", {
      auth: true,
      method: "POST",
      body: { csv },
    });
    status.textContent = `업로드 완료 (${res.data?.importedCount ?? 0}건)`;
    status.className = "ml-3 text-xs text-green-600";
    fileInput.value = "";
    await loadInvestmentDisclosureTab();
  } catch (error) {
    status.textContent = `업로드 실패: ${error.message}`;
    status.className = "ml-3 text-xs text-red-600";
  }
}

function bindInvestmentDisclosureAdminEvents() {
  document.getElementById("btn-inv-download-sample")?.addEventListener("click", downloadInvSampleCsv);
  document.getElementById("btn-inv-download-current")?.addEventListener("click", downloadInvCurrentCsv);
  document.getElementById("btn-inv-upload")?.addEventListener("click", uploadInvestmentDisclosureCsv);
  document.querySelectorAll(".inv-encoding-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      invAdminEncoding = btn.getAttribute("data-inv-encoding") || "UTF-8";
      document.querySelectorAll(".inv-encoding-btn").forEach((b) => {
        const active = b.getAttribute("data-inv-encoding") === invAdminEncoding;
        b.className = active
          ? "inv-encoding-btn rounded px-3 py-1.5 text-xs font-bold bg-navy-900 text-white"
          : "inv-encoding-btn rounded px-3 py-1.5 text-xs font-bold border border-gray-300";
      });
    });
  });
}

// ==========================================
// TAB: LOGIN LOGS
// ==========================================
let loginLogsState = { page: 1, pageSize: 30, email: "", status: "" };

function formatLoginLogDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function truncateLoginLogText(value, max = 48) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function renderLoginLogStatusBadge(status) {
  if (status === "SUCCESS") {
    return `<span class="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">성공</span>`;
  }
  return `<span class="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">실패</span>`;
}

async function loadLoginLogsTab() {
  const tbody = document.getElementById("login-logs-table-body");
  const summary = document.getElementById("login-logs-summary");
  const pageInfo = document.getElementById("login-logs-page-info");
  const prevBtn = document.getElementById("login-logs-prev");
  const nextBtn = document.getElementById("login-logs-next");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">기록을 불러오는 중...</td></tr>`;

  try {
    const params = new URLSearchParams();
    params.set("page", String(loginLogsState.page));
    params.set("pageSize", String(loginLogsState.pageSize));
    if (loginLogsState.email) params.set("email", loginLogsState.email);
    if (loginLogsState.status) params.set("status", loginLogsState.status);

    const res = await apiFetch(`/api/admin/login-logs?${params.toString()}`, { auth: true });
    const { items = [], total = 0, page = 1, pageSize = 30 } = res.data ?? {};
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (summary) {
      summary.textContent = `총 ${total.toLocaleString("ko-KR")}건 · ${page} / ${totalPages} 페이지`;
    }
    if (pageInfo) {
      pageInfo.textContent = `${page} / ${totalPages}`;
    }
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">조회된 로그인 기록이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map(
        (row) => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-600">${formatLoginLogDateTime(row.createdAt)}</td>
          <td class="px-4 py-3 text-gray-800">${escapeAdminHtml(row.email)}</td>
          <td class="px-4 py-3">${escapeAdminHtml(row.name ?? "-")}</td>
          <td class="px-4 py-3 text-gray-600">${escapeAdminHtml(row.roleName ?? "-")}</td>
          <td class="px-4 py-3 text-center">${renderLoginLogStatusBadge(row.status)}</td>
          <td class="px-4 py-3 font-mono text-xs text-gray-600">${escapeAdminHtml(row.ipAddress ?? "-")}</td>
          <td class="px-4 py-3 text-xs text-red-700">${escapeAdminHtml(row.failReason ?? "-")}</td>
          <td class="px-4 py-3 text-xs text-gray-500" title="${escapeAdminHtml(row.userAgent ?? "")}">${escapeAdminHtml(truncateLoginLogText(row.userAgent, 56))}</td>
        </tr>
      `,
      )
      .join("");
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center font-semibold text-red-500">로드 실패: ${escapeAdminHtml(error.message)}</td></tr>`;
    if (summary) summary.textContent = "-";
  }
}

function bindLoginLogsTabEvents() {
  const form = document.getElementById("login-logs-filter-form");
  const resetBtn = document.getElementById("login-logs-filter-reset");
  const prevBtn = document.getElementById("login-logs-prev");
  const nextBtn = document.getElementById("login-logs-next");

  if (form && !form.dataset.bound) {
    form.dataset.bound = "1";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      loginLogsState.page = 1;
      loginLogsState.email = document.getElementById("login-logs-filter-email")?.value?.trim() ?? "";
      loginLogsState.status = document.getElementById("login-logs-filter-status")?.value ?? "";
      loadLoginLogsTab();
    });
  }

  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = "1";
    resetBtn.addEventListener("click", () => {
      loginLogsState = { page: 1, pageSize: 30, email: "", status: "" };
      const emailInput = document.getElementById("login-logs-filter-email");
      const statusSelect = document.getElementById("login-logs-filter-status");
      if (emailInput) emailInput.value = "";
      if (statusSelect) statusSelect.value = "";
      loadLoginLogsTab();
    });
  }

  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.dataset.bound = "1";
    prevBtn.addEventListener("click", () => {
      if (loginLogsState.page > 1) {
        loginLogsState.page -= 1;
        loadLoginLogsTab();
      }
    });
  }

  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = "1";
    nextBtn.addEventListener("click", () => {
      loginLogsState.page += 1;
      loadLoginLogsTab();
    });
  }
}

// ==========================================
// TAB: REGISTRATION REQUESTS
// ==========================================
async function loadRegistrationsTab() {
  const tbody = document.getElementById("registrations-table-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">신청 목록을 불러오는 중...</td></tr>`;

  try {
    if (rolesList.length === 0) {
      const rolesRes = await apiFetch("/api/admin/roles", { auth: true });
      rolesList = rolesRes.data ?? [];
    }

    const assignableRoles = rolesList.filter((role) => role.name !== "ADMIN");
    const roleOptions = assignableRoles
      .map((role) => `<option value="${role.id}">${role.name}</option>`)
      .join("");

    const res = await apiFetch("/api/admin/registration-requests", { auth: true });
    const items = res.data ?? [];

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">대기 중인 사용등록 신청이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((item) => {
        const appliedAt = new Date(item.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
        return `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-4 font-medium text-gray-900">${item.id}</td>
          <td class="px-4 py-4 text-gray-800">${escapeAdminHtml(item.email)}</td>
          <td class="px-4 py-4">${escapeAdminHtml(item.name)}</td>
          <td class="px-4 py-4">${escapeAdminHtml(item.affiliation)}</td>
          <td class="px-4 py-4 text-xs text-gray-500">${appliedAt}</td>
          <td class="px-4 py-4">
            <select id="reg-role-${item.id}" class="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-navy-700">
              <option value="">권한 선택</option>
              ${roleOptions}
            </select>
          </td>
          <td class="px-4 py-4 text-center whitespace-nowrap">
            <button data-id="${item.id}" class="btn-approve-registration mr-2 rounded bg-navy-900 px-2 py-1 text-xs font-bold text-white transition hover:bg-navy-800">
              승인
            </button>
            <button data-id="${item.id}" class="btn-reject-registration rounded bg-red-600 px-2 py-1 text-xs font-bold text-white transition hover:bg-red-700">
              반려
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    tbody.querySelectorAll(".btn-approve-registration").forEach((button) => {
      button.addEventListener("click", () => approveRegistration(Number(button.dataset.id)));
    });
    tbody.querySelectorAll(".btn-reject-registration").forEach((button) => {
      button.addEventListener("click", () => rejectRegistration(Number(button.dataset.id)));
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center font-semibold text-red-500">로드 실패: ${error.message}</td></tr>`;
  }
}

async function approveRegistration(requestId) {
  const roleSelect = document.getElementById(`reg-role-${requestId}`);
  const roleId = Number(roleSelect?.value);
  if (!roleId) {
    alert("승인할 권한(역할)을 선택해 주세요.");
    return;
  }

  if (!confirm("선택한 권한으로 사용등록을 승인하시겠습니까?")) return;

  try {
    await apiFetch(`/api/admin/registration-requests/${requestId}/approve`, {
      auth: true,
      method: "POST",
      body: { roleId },
    });
    alert("승인되었습니다.");
    await loadRegistrationsTab();
  } catch (error) {
    alert(error.message || "승인에 실패했습니다.");
  }
}

async function rejectRegistration(requestId) {
  if (!confirm("이 사용등록 신청을 반려하시겠습니까?")) return;

  try {
    await apiFetch(`/api/admin/registration-requests/${requestId}/reject`, {
      auth: true,
      method: "POST",
    });
    alert("반려되었습니다.");
    await loadRegistrationsTab();
  } catch (error) {
    alert(error.message || "반려에 실패했습니다.");
  }
}

function escapeAdminHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateExternalApiStatusBadge(apiType, config) {
  const badge = document.getElementById(`external-api-status-${apiType}`);
  if (!badge) return;

  const configured = Boolean(config?.enabled && config?.endpointUrl?.trim() && config?.apiKey?.trim());
  if (configured) {
    badge.textContent = "사용 중";
    badge.className = "shrink-0 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800";
    return;
  }

  if (config?.endpointUrl?.trim() || config?.apiKey?.trim()) {
    badge.textContent = "설정됨";
    badge.className = "shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800";
    return;
  }

  badge.textContent = "미설정";
  badge.className = "shrink-0 rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700";
}

function fillExternalApiForm(config) {
  const apiType = config.apiType;
  document.getElementById(`external-api-enabled-${apiType}`).checked = Boolean(config.enabled);
  document.getElementById(`external-api-endpoint-${apiType}`).value = config.endpointUrl ?? "";
  document.getElementById(`external-api-key-${apiType}`).value = config.apiKey ?? "";
  updateExternalApiStatusBadge(apiType, config);
}

async function loadExternalApisTab() {
  try {
    const result = await apiFetch("/api/admin/external-apis", { auth: true });
    (result.data ?? []).forEach((config) => fillExternalApiForm(config));
  } catch (error) {
    console.error(error);
    alert(error.message || "외부 API 설정을 불러오지 못했습니다.");
  }
}

async function saveExternalApiConfig(apiType, event) {
  event.preventDefault();

  const messageEl = document.getElementById(`external-api-message-${apiType}`);
  const endpointUrl = document.getElementById(`external-api-endpoint-${apiType}`)?.value.trim() ?? "";
  const apiKey = document.getElementById(`external-api-key-${apiType}`)?.value.trim() ?? "";
  const enabled = document.getElementById(`external-api-enabled-${apiType}`)?.checked ?? false;

  if (messageEl) {
    messageEl.textContent = "저장 중...";
    messageEl.className = "text-xs text-gray-500";
  }

  try {
    const result = await apiFetch(`/api/admin/external-apis/${apiType}`, {
      auth: true,
      method: "PUT",
      body: { endpointUrl, apiKey, enabled },
    });

    fillExternalApiForm(result.data);
    if (messageEl) {
      messageEl.textContent = "저장되었습니다.";
      messageEl.className = "text-xs text-green-600";
    }
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = error.message || "저장에 실패했습니다.";
      messageEl.className = "text-xs text-red-600";
    }
  }
}

// ==========================================
// DOM INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  if (!requireAdmin()) return;

  const user = getUser();
  document.getElementById("admin-user-name").textContent = `${user.name}님`;

  // Bind top navbar controls
  document.getElementById("admin-logout-btn").addEventListener("click", logout);
  document.getElementById("admin-back-portal").addEventListener("click", () => {
    window.location.href = "/portal";
  });
  if (typeof loadPortalMenus === "function") {
    loadPortalMenus();
  }

  // Bind Router
  initRouter();
  bindLoginLogsTabEvents();
  routeToPanel();

  // Bind Tab 1: Branding settings input previews and save button
  bindPreviewOnInput();
  document.getElementById("branding-save-btn").addEventListener("click", saveBranding);

  // Bind Tab 2: User management save and close modals
  document.getElementById("btn-create-user").addEventListener("click", () => openUserModal(null));
  document.getElementById("btn-user-close").addEventListener("click", closeUserModal);
  document.getElementById("form-user").addEventListener("submit", saveUserSubmit);
  document.getElementById("field-user-ip-restriction")?.addEventListener("change", syncUserIpFields);

  // Bind Tab 3: Menu management submit and cancel actions
  document.getElementById("menu-form").addEventListener("submit", saveMenuSubmit);
  document.getElementById("btn-menu-cancel").addEventListener("click", resetMenuForm);
  document.getElementById("btn-refresh-menus").addEventListener("click", loadMenusTab);

  // Bind Tab 4: Permission management role change and saves
  document.getElementById("select-permission-role").addEventListener("change", onPermissionRoleChange);
  document.getElementById("btn-save-menu-perms").addEventListener("click", saveMenuPermissions);
  document.getElementById("btn-save-query-perms").addEventListener("click", saveQueryPermissions);
  document.getElementById("btn-create-role").addEventListener("click", createRole);
  document.getElementById("btn-update-role").addEventListener("click", updateRoleName);
  document.getElementById("btn-delete-role").addEventListener("click", deleteRole);
  document.getElementById("field-new-role-name").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      createRole();
    }
  });
  document.getElementById("field-edit-role-name").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      updateRoleName();
    }
  });

  document.getElementById("btn-code-download-sample").addEventListener("click", downloadSampleCsv);
  document.getElementById("btn-code-download-current").addEventListener("click", downloadCurrentCsv);
  document.getElementById("btn-code-upload").addEventListener("click", uploadCodeCsv);
  bindCodeTreePreviewEvents();
  document.getElementById("btn-code-tree-download-xlsx").addEventListener("click", downloadCodeTreeXlsx);

  document.getElementById("btn-code-table-org").addEventListener("click", () => switchCodeEditorType("기관"));
  document.getElementById("btn-code-table-line").addEventListener("click", () => switchCodeEditorType("노선"));
  document.getElementById("btn-code-table-station").addEventListener("click", () => switchCodeEditorType("역"));
  document.getElementById("btn-code-row-add").addEventListener("click", () => {
    if (!codeEditorTables[activeCodeEditorType]) codeEditorTables[activeCodeEditorType] = [];
    codeEditorTables[activeCodeEditorType].push({ codeType: activeCodeEditorType, code: "", value: "" });
    renderCodeEditorTable();
  });
  document.getElementById("btn-code-table-reset").addEventListener("click", () => {
    codeEditorTables = createDefaultCodeEditorTables();
    renderCodeEditorTabs();
    renderCodeEditorTable();
  });
  document.getElementById("btn-code-relations-save").addEventListener("click", saveCodeRelations);
  document.getElementById("btn-code-relations-reload").addEventListener("click", loadCodeRelationsTab);
  document.getElementById("btn-code-relations-download-xlsx").addEventListener("click", downloadCodeRelationsXlsx);

  bindInvestmentDisclosureAdminEvents();

  document.querySelectorAll(".external-api-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const apiType = form.dataset.apiType;
      if (apiType) saveExternalApiConfig(apiType, event);
    });
  });
});
