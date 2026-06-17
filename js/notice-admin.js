let noticeFormCurrentId = null;
let noticeFormDefaultBoardType = "NOTICE";

const BOARD_MENU_PATHS = {
  NOTICE: "/notices",
  ARCHIVE: "/archive",
};

function getBoardMenuActions(boardType) {
  const path = BOARD_MENU_PATHS[boardType] ?? BOARD_MENU_PATHS.NOTICE;
  return getUser()?.menuActions?.[path] ?? null;
}

function canBoardAction(boardType, action) {
  const user = getUser();
  if (user?.role === "ADMIN") return true;
  const actions = getBoardMenuActions(boardType);
  return Boolean(actions?.[action]);
}

function canCreateAnyBoardPost() {
  return canBoardAction("NOTICE", "create") || canBoardAction("ARCHIVE", "create");
}

function toDateInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayDateInputValue() {
  return toDateInputValue(new Date());
}

function ensureNoticeAdminModal() {
  if (document.getElementById("notice-admin-modal")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="notice-admin-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 id="notice-admin-modal-title" class="border-b border-gray-100 pb-2 text-base font-bold text-gray-900">게시물 등록</h3>
        <form id="notice-admin-form" class="mt-4 space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-gray-700" for="notice-admin-board-type">게시 구분</label>
            <select id="notice-admin-board-type" class="w-full max-w-xs rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-navy-700">
              <option value="NOTICE">공지사항</option>
              <option value="ARCHIVE">자료실</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-gray-700" for="notice-admin-posted-at">등록일자</label>
            <input id="notice-admin-posted-at" type="date" required class="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-navy-700" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-gray-700" for="notice-admin-title">제목</label>
            <input id="notice-admin-title" type="text" required class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-navy-700" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-gray-700" for="notice-admin-content">내용</label>
            <textarea id="notice-admin-content" rows="10" required class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-navy-700"></textarea>
          </div>
          <div>
            <label class="inline-flex items-center gap-2 text-sm text-gray-700">
              <input id="notice-admin-visible" type="checkbox" class="rounded border-gray-300 text-navy-700" checked />
              게시물 표시 (체크 해제 시 숨김)
            </label>
          </div>
          <div class="flex justify-end gap-2 border-t border-gray-100 pt-2">
            <button type="submit" id="notice-admin-submit" class="rounded bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800">저장</button>
            <button type="button" id="notice-admin-cancel" class="rounded border border-gray-300 px-4 py-2 text-xs font-medium hover:bg-gray-50">닫기</button>
          </div>
          <p id="notice-admin-status" class="text-center text-xs"></p>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper.firstElementChild);

  document.getElementById("notice-admin-cancel")?.addEventListener("click", closeNoticeAdminModal);
  document.getElementById("notice-admin-form")?.addEventListener("submit", submitNoticeAdminForm);
}

function setBoardTypeSelect(boardType) {
  const select = document.getElementById("notice-admin-board-type");
  if (!select) return;

  const action = noticeFormCurrentId ? "update" : "create";
  const noticeAllowed = canBoardAction("NOTICE", action);
  const archiveAllowed = canBoardAction("ARCHIVE", action);

  select.querySelectorAll("option").forEach((option) => {
    const allowed = option.value === "ARCHIVE" ? archiveAllowed : noticeAllowed;
    option.disabled = !allowed;
    option.hidden = !allowed;
  });

  const preferred = boardType === "ARCHIVE" && archiveAllowed ? "ARCHIVE" : "NOTICE";
  const fallback = archiveAllowed && !noticeAllowed ? "ARCHIVE" : "NOTICE";
  select.value = (preferred === "ARCHIVE" ? archiveAllowed : noticeAllowed) ? preferred : fallback;
}

function openNoticeAdminModal(notice = null, { defaultBoardType = "NOTICE" } = {}) {
  ensureNoticeAdminModal();
  noticeFormCurrentId = notice?.id ?? null;
  noticeFormDefaultBoardType = notice?.boardType ?? defaultBoardType;

  document.getElementById("notice-admin-modal-title").textContent = notice ? "게시물 수정" : "게시물 등록";
  document.getElementById("notice-admin-title").value = notice?.title ?? "";
  document.getElementById("notice-admin-content").value = notice?.content ?? "";
  document.getElementById("notice-admin-posted-at").value = toDateInputValue(notice?.postedAt ?? new Date());
  document.getElementById("notice-admin-visible").checked = notice ? notice.visible !== false : true;
  document.getElementById("notice-admin-status").textContent = "";

  setBoardTypeSelect(noticeFormDefaultBoardType);

  const modal = document.getElementById("notice-admin-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.getElementById("notice-admin-title")?.focus();
}

function closeNoticeAdminModal() {
  const modal = document.getElementById("notice-admin-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  noticeFormCurrentId = null;
}

function readSelectedBoardType() {
  const select = document.getElementById("notice-admin-board-type");
  return select?.value === "ARCHIVE" ? "ARCHIVE" : "NOTICE";
}

async function submitNoticeAdminForm(event) {
  event.preventDefault();
  const statusEl = document.getElementById("notice-admin-status");
  const title = document.getElementById("notice-admin-title")?.value.trim();
  const content = document.getElementById("notice-admin-content")?.value.trim();
  const postedAt = document.getElementById("notice-admin-posted-at")?.value;
  const boardType = readSelectedBoardType();
  const visible = document.getElementById("notice-admin-visible")?.checked !== false;

  if (!title || !content || !postedAt) {
    statusEl.textContent = "게시 구분, 등록일자, 제목, 내용을 입력해 주세요.";
    statusEl.className = "text-center text-xs text-red-600";
    return;
  }

  const body = { title, content, boardType, postedAt, visible };

  try {
    if (noticeFormCurrentId) {
      await apiFetch(`/api/notices/${noticeFormCurrentId}`, {
        auth: true,
        method: "PUT",
        body,
      });
    } else {
      await apiFetch("/api/notices", {
        auth: true,
        method: "POST",
        body,
      });
    }

    const savedId = noticeFormCurrentId;
    closeNoticeAdminModal();
    if (typeof onNoticeAdminSaved === "function") {
      await onNoticeAdminSaved(savedId);
    }
  } catch (error) {
    statusEl.textContent = error.message || "저장에 실패했습니다.";
    statusEl.className = "text-center text-xs text-red-600";
  }
}

async function toggleNoticeVisibility(notice) {
  if (!notice?.id) return;
  if (!canBoardAction(notice.boardType, "update")) return;

  const nextVisible = !notice.visible;
  const actionLabel = nextVisible ? "보이기" : "숨기기";
  if (!confirm(`이 게시물을 ${actionLabel} 처리하시겠습니까?`)) return;

  try {
    await apiFetch(`/api/notices/${notice.id}`, {
      auth: true,
      method: "PUT",
      body: { visible: nextVisible },
    });
    if (typeof onNoticeAdminSaved === "function") {
      await onNoticeAdminSaved(notice.id);
    }
  } catch (error) {
    alert(error.message || "상태 변경에 실패했습니다.");
  }
}

async function deleteNoticeAdmin(noticeId, { redirectTo = null, boardType = "NOTICE" } = {}) {
  if (!confirm("이 게시물을 삭제하시겠습니까?")) return;

  try {
    await apiFetch(`/api/notices/${noticeId}`, { auth: true, method: "DELETE" });
    if (redirectTo) {
      window.location.href = redirectTo;
      return;
    }
    if (typeof onNoticeAdminSaved === "function") {
      await onNoticeAdminSaved(null);
    }
  } catch (error) {
    alert(error.message || "삭제에 실패했습니다.");
  }
}

function bindNoticeAdminCreateButton(buttonId, { defaultBoardType = "NOTICE" } = {}) {
  const btn = document.getElementById(buttonId);
  if (!btn || !canCreateAnyBoardPost()) return;
  btn.classList.remove("hidden");
  btn.addEventListener("click", () => openNoticeAdminModal(null, { defaultBoardType }));
}

function showNoticeAdminActions(containerId, notice) {
  const container = document.getElementById(containerId);
  if (!container || !notice) return;

  const canEdit = canBoardAction(notice.boardType, "update");
  const canDelete = canBoardAction(notice.boardType, "delete");
  if (!canEdit && !canDelete) return;

  container.classList.remove("hidden");

  const listUrl = notice.boardType === "ARCHIVE" ? "/archive" : "/notices";
  const editBtn = document.getElementById("notice-edit-btn");
  const deleteBtn = document.getElementById("notice-delete-btn");
  const visibilityBtn = document.getElementById("notice-visibility-btn");

  if (editBtn) {
    editBtn.classList.toggle("hidden", !canEdit);
    editBtn.onclick = canEdit ? () => openNoticeAdminModal(notice) : null;
  }
  if (visibilityBtn) {
    visibilityBtn.classList.toggle("hidden", !canEdit);
    visibilityBtn.textContent = notice.visible ? "숨기기" : "보이기";
    visibilityBtn.onclick = canEdit ? () => toggleNoticeVisibility(notice) : null;
  }
  if (deleteBtn) {
    deleteBtn.classList.toggle("hidden", !canDelete);
    deleteBtn.onclick = canDelete
      ? () => deleteNoticeAdmin(notice.id, { redirectTo: listUrl, boardType: notice.boardType })
      : null;
  }
}
