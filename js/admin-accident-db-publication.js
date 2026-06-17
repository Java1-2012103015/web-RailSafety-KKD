let adbPubState = {
  roles: [],
  catalog: null,
  selectedRoleId: null,
  visibleKeys: new Set(),
  activeGroupId: null,
};
let adbPubSaveBound = false;

function adbPubColumnMap() {
  const map = new Map();
  if (typeof ACCIDENT_DB_COLUMNS !== "undefined") {
    ACCIDENT_DB_COLUMNS.forEach((col) => map.set(col.key, col.header));
  }
  return map;
}

function adbPubGetSelectedRole() {
  return adbPubState.roles.find((role) => role.roleId === adbPubState.selectedRoleId) ?? null;
}

function renderApprovedGroups() {
  const wrap = document.getElementById("adbpub-approved-groups");
  if (!wrap) return;

  const catalog = adbPubState.catalog;
  if (!catalog?.groups) {
    wrap.innerHTML = '<span class="text-gray-400">-</span>';
    return;
  }

  const approved = catalog.groups
    .filter((group) => group.keys.some((key) => adbPubState.visibleKeys.has(key)))
    .map((group) => group.title);

  if (!approved.length) {
    wrap.innerHTML = '<span class="text-amber-700 text-sm">승인된 컬럼 없음</span>';
    return;
  }

  wrap.innerHTML = approved
    .map(
      (title) =>
        `<span class="inline-flex items-center rounded-full border border-navy-700/30 bg-navy-900/5 px-2.5 py-0.5 text-xs font-semibold text-navy-900">${title}</span>`,
    )
    .join("");
}

function renderGroupTabs() {
  const tabs = document.getElementById("adbpub-group-tabs");
  if (!tabs || !adbPubState.catalog) return;

  const groups = adbPubState.catalog.groups;
  if (!adbPubState.activeGroupId && groups.length) {
    adbPubState.activeGroupId = groups[0].id;
  }

  tabs.innerHTML = groups
    .map((group) => {
      const active = group.id === adbPubState.activeGroupId;
      const visibleCount = group.keys.filter((key) => adbPubState.visibleKeys.has(key)).length;
      return `<button type="button" data-adbpub-group="${group.id}" class="adbpub-tab-btn ${active ? "active" : ""}">${group.title} <span class="text-[10px] text-gray-500">(${visibleCount}/${group.keys.length})</span></button>`;
    })
    .join("");

  tabs.querySelectorAll("[data-adbpub-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      adbPubState.activeGroupId = btn.getAttribute("data-adbpub-group");
      renderGroupTabs();
      renderGroupPanel();
    });
  });
}

function renderGroupPanel() {
  const panel = document.getElementById("adbpub-group-panel");
  if (!panel || !adbPubState.catalog) return;

  const group = adbPubState.catalog.groups.find((g) => g.id === adbPubState.activeGroupId);
  if (!group) {
    panel.innerHTML = "";
    return;
  }

  const headerMap = adbPubColumnMap();
  const allChecked = group.keys.every((key) => adbPubState.visibleKeys.has(key));

  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <p class="text-sm font-bold text-gray-900">${group.title} 항목</p>
      <label class="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
        <input type="checkbox" id="adbpub-group-check-all" ${allChecked ? "checked" : ""} class="rounded border-gray-300" />
        이 구역 전체 선택
      </label>
    </div>
    <table class="adbpub-detail-table w-full">
      <tbody>
        ${group.keys
          .map((key) => {
            const checked = adbPubState.visibleKeys.has(key);
            const label = headerMap.get(key) ?? key;
            return `
              <tr class="${checked ? "" : "opacity-60"}">
                <td class="w-10 text-center align-middle">
                  <input type="checkbox" class="adbpub-col-check rounded border-gray-300" data-col-key="${key}" ${checked ? "checked" : ""} />
                </td>
                <th class="w-48">${label}</th>
                <td><input class="adbpub-detail-input" value="(미리보기)" readonly tabindex="-1" /></td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  panel.querySelector("#adbpub-group-check-all")?.addEventListener("change", (e) => {
    const on = e.target.checked;
    group.keys.forEach((key) => {
      if (on) adbPubState.visibleKeys.add(key);
      else adbPubState.visibleKeys.delete(key);
    });
    renderApprovedGroups();
    renderGroupTabs();
    renderGroupPanel();
  });

  panel.querySelectorAll(".adbpub-col-check").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.getAttribute("data-col-key");
      if (!key) return;
      if (input.checked) adbPubState.visibleKeys.add(key);
      else adbPubState.visibleKeys.delete(key);
      renderApprovedGroups();
      renderGroupTabs();
      const row = input.closest("tr");
      if (row) row.classList.toggle("opacity-60", !input.checked);
    });
  });
}

function bindRoleSelect() {
  const select = document.getElementById("adbpub-role-select");
  if (!select) return;

  select.innerHTML = adbPubState.roles
    .map(
      (role) =>
        `<option value="${role.roleId}" ${role.roleId === adbPubState.selectedRoleId ? "selected" : ""}>${role.roleName}</option>`,
    )
    .join("");

  if (select.dataset.adbpubBound === "1") return;
  select.dataset.adbpubBound = "1";

  select.addEventListener("change", () => {
    const roleId = Number(select.value);
    const role = adbPubState.roles.find((r) => r.roleId === roleId);
    adbPubState.selectedRoleId = roleId;
    adbPubState.visibleKeys = new Set(role?.visibleColumnKeys ?? []);
    renderApprovedGroups();
    renderGroupTabs();
    renderGroupPanel();
  });
}

async function savePublication() {
  const status = document.getElementById("adbpub-save-status");
  const btn = document.getElementById("adbpub-save-btn");
  if (!adbPubState.selectedRoleId) return;

  if (btn) btn.disabled = true;
  if (status) status.textContent = "저장 중...";

  try {
    const res = await apiFetch(`/api/admin/accident-db-publication/${adbPubState.selectedRoleId}`, {
      auth: true,
      method: "PUT",
      body: { visibleColumnKeys: Array.from(adbPubState.visibleKeys) },
    });

    const idx = adbPubState.roles.findIndex((r) => r.roleId === adbPubState.selectedRoleId);
    if (idx >= 0) {
      adbPubState.roles[idx] = {
        ...adbPubState.roles[idx],
        ...res.data,
        visibleColumnKeys: res.data.visibleColumnKeys,
      };
    }

    adbPubState.visibleKeys = new Set(res.data.visibleColumnKeys ?? []);
    renderApprovedGroups();
    renderGroupTabs();
    renderGroupPanel();

    if (status) {
      status.textContent = "저장되었습니다.";
      status.className = "text-xs font-semibold text-emerald-700";
    }
  } catch (error) {
    if (status) {
      status.textContent = `저장 실패: ${error.message}`;
      status.className = "text-xs font-semibold text-red-600";
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function adbPubShowLoadError(message) {
  const status = document.getElementById("adbpub-save-status");
  if (status) {
    status.textContent = message;
    status.className = "text-xs font-semibold text-red-600";
  }
  const panel = document.getElementById("adbpub-group-panel");
  if (panel) {
    panel.innerHTML = `<p class="text-sm text-red-600">${message}</p>`;
  }
}

async function loadAccidentDbPublicationTab() {
  const status = document.getElementById("adbpub-save-status");
  if (status) {
    status.textContent = "불러오는 중...";
    status.className = "text-xs text-gray-500";
  }

  let res;
  try {
    res = await apiFetch("/api/admin/accident-db-publication", { auth: true });
  } catch (error) {
    adbPubShowLoadError(
      `설정을 불러오지 못했습니다. (${error.message ?? "오류"}) 개발 서버를 재시작한 뒤 prisma generate를 실행해 보세요.`,
    );
    throw error;
  }

  if (!res?.data?.catalog?.groups?.length) {
    adbPubShowLoadError("컬럼 목록이 비어 있습니다. 서버를 재시작한 뒤 다시 시도해 주세요.");
    return;
  }

  adbPubState.catalog = res.data.catalog;
  adbPubState.roles = res.data.roles ?? [];
  adbPubState.selectedRoleId = adbPubState.roles[0]?.roleId ?? null;
  adbPubState.visibleKeys = new Set(adbPubGetSelectedRole()?.visibleColumnKeys ?? []);
  adbPubState.activeGroupId = adbPubState.catalog?.groups?.[0]?.id ?? null;

  bindRoleSelect();
  renderApprovedGroups();
  renderGroupTabs();
  renderGroupPanel();

  if (!adbPubSaveBound) {
    document.getElementById("adbpub-save-btn")?.addEventListener("click", savePublication);
    adbPubSaveBound = true;
  }
}
