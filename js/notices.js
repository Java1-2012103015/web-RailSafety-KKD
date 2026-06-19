function formatNoticeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

function formatNoticeDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

function noticePostedAt(notice) {
  return notice?.postedAt ?? notice?.createdAt;
}

function noticeDetailUrl(id) {
  return `/notices/detail?id=${id}`;
}

function renderNoticeListItem(notice, { compact = false, showAdminControls = false } = {}) {
  const titleClass = compact
    ? "min-w-0 flex-1 truncate text-gray-800 transition group-hover:text-navy-800 group-hover:underline"
    : "min-w-0 flex-1 truncate font-medium text-gray-900 transition group-hover:text-navy-800 group-hover:underline";

  const hiddenBadge =
    notice.visible === false
      ? '<span class="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">숨김</span>'
      : "";

  const adminControls =
    showAdminControls && typeof canBoardAction === "function" && canBoardAction(notice.boardType, "update")
      ? `<button
          type="button"
          class="notice-visibility-toggle shrink-0 rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
          data-notice-id="${notice.id}"
        >${notice.visible ? "숨기기" : "보이기"}</button>`
      : "";

  return `
    <li class="${notice.visible === false ? "bg-gray-50/80" : ""}" data-notice-id="${notice.id}">
      <div class="flex items-center gap-2 px-5 py-3 text-sm">
        <a href="${noticeDetailUrl(notice.id)}" class="group flex min-w-0 flex-1 items-center justify-between gap-4 transition hover:bg-gray-50 -mx-2 px-2 py-1 rounded">
          <p class="${titleClass}">· ${escapeHtml(notice.title)}</p>
          <span class="flex shrink-0 items-center gap-2">
            ${hiddenBadge}
            <span class="text-xs text-gray-500 sm:text-sm">${formatNoticeDate(noticePostedAt(notice))}</span>
          </span>
        </a>
        ${adminControls}
      </div>
    </li>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchNotices({ page = 1, pageSize = 10, boardType = "NOTICE", includeHidden = false } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    boardType,
  });
  if (includeHidden) {
    params.set("includeHidden", "true");
  }
  const result = await apiFetch(`/api/notices?${params.toString()}`, { auth: true });
  return {
    items: result.data ?? [],
    pagination: result.pagination ?? { page: 1, pageSize, total: 0, totalPages: 0 },
  };
}

function bindNoticeVisibilityToggles(container, items) {
  if (!container) return;
  const byId = new Map(items.map((item) => [String(item.id), item]));
  container.querySelectorAll(".notice-visibility-toggle").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const notice = byId.get(button.dataset.noticeId);
      if (notice && typeof toggleNoticeVisibility === "function") {
        await toggleNoticeVisibility(notice);
      }
    });
  });
}

async function loadPortalBoardList({ listElId, boardType, limit = 5, labels }) {
  const listEl = document.getElementById(listElId);
  if (!listEl) return;

  listEl.innerHTML = `<li class="px-5 py-6 text-center text-sm text-gray-500">${labels.loading}</li>`;

  try {
    const { items } = await fetchNotices({ page: 1, pageSize: limit, boardType });
    if (!items.length) {
      listEl.innerHTML = `<li class="px-5 py-6 text-center text-sm text-gray-500">${labels.empty}</li>`;
      return;
    }

    listEl.innerHTML = items.map((notice) => renderNoticeListItem(notice, { compact: true })).join("");
  } catch (error) {
    console.error(error);
    listEl.innerHTML = `<li class="px-5 py-6 text-center text-sm text-red-500">${labels.error}</li>`;
  }
}

async function loadPortalNotices(limit = 5) {
  await loadPortalBoardList({
    listElId: "notices-list",
    boardType: "NOTICE",
    limit,
    labels: {
      loading: "공지사항을 불러오는 중...",
      empty: "등록된 공지사항이 없습니다.",
      error: "공지사항을 불러오지 못했습니다.",
    },
  });
}

async function loadPortalArchive(limit = 5) {
  await loadPortalBoardList({
    listElId: "archive-list",
    boardType: "ARCHIVE",
    limit,
    labels: {
      loading: "자료실을 불러오는 중...",
      empty: "등록된 자료가 없습니다.",
      error: "자료실을 불러오지 못했습니다.",
    },
  });
}
