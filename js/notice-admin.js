let noticeFormCurrentId = null;

const NOTICE_MENU_PATH = "/notices";

function getNoticeMenuActions() {
  return getUser()?.menuActions?.[NOTICE_MENU_PATH] ?? null;
}

function canNoticeAction(action) {
  const user = getUser();
  if (user?.role === "ADMIN") return true;
  const actions = getNoticeMenuActions();
  return Boolean(actions?.[action]);
}

function ensureNoticeAdminModal() {
  if (document.getElementById("notice-admin-modal")) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="notice-admin-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h3 id="notice-admin-modal-title" class="border-b border-gray-100 pb-2 text-base font-bold text-gray-900">공지 등록</h3>
        <form id="notice-admin-form" class="mt-4 space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-gray-700" for="notice-admin-title">제목</label>
            <input id="notice-admin-title" type="text" required class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-navy-700" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-gray-700" for="notice-admin-content">내용</label>
            <textarea id="notice-admin-content" rows="10" required class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-navy-700"></textarea>
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

function openNoticeAdminModal(notice = null) {
  ensureNoticeAdminModal();
  noticeFormCurrentId = notice?.id ?? null;

  document.getElementById("notice-admin-modal-title").textContent = notice ? "공지 수정" : "공지 등록";
  document.getElementById("notice-admin-title").value = notice?.title ?? "";
  document.getElementById("notice-admin-content").value = notice?.content ?? "";
  document.getElementById("notice-admin-status").textContent = "";

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

async function submitNoticeAdminForm(event) {
  event.preventDefault();
  const statusEl = document.getElementById("notice-admin-status");
  const title = document.getElementById("notice-admin-title")?.value.trim();
  const content = document.getElementById("notice-admin-content")?.value.trim();

  if (!title || !content) {
    statusEl.textContent = "제목과 내용을 입력해 주세요.";
    statusEl.className = "text-center text-xs text-red-600";
    return;
  }

  try {
    if (noticeFormCurrentId) {
      await apiFetch(`/api/notices/${noticeFormCurrentId}`, {
        auth: true,
        method: "PUT",
        body: { title, content },
      });
    } else {
      await apiFetch("/api/notices", {
        auth: true,
        method: "POST",
        body: { title, content },
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

async function deleteNoticeAdmin(noticeId, { redirectTo = null } = {}) {
  if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;

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

function bindNoticeAdminCreateButton(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn || !canNoticeAction("create")) return;
  btn.classList.remove("hidden");
  btn.addEventListener("click", () => openNoticeAdminModal());
}

function showNoticeAdminActions(containerId, notice) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const canEdit = canNoticeAction("update");
  const canDelete = canNoticeAction("delete");
  if (!canEdit && !canDelete) return;

  container.classList.remove("hidden");

  const editBtn = document.getElementById("notice-edit-btn");
  const deleteBtn = document.getElementById("notice-delete-btn");
  if (editBtn) {
    editBtn.classList.toggle("hidden", !canEdit);
    editBtn.onclick = canEdit ? () => openNoticeAdminModal(notice) : null;
  }
  if (deleteBtn) {
    deleteBtn.classList.toggle("hidden", !canDelete);
    deleteBtn.onclick = canDelete ? () => deleteNoticeAdmin(notice.id, { redirectTo: "/notices" }) : null;
  }
}
