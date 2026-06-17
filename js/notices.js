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

function noticeDetailUrl(id) {
  return `/notices/detail?id=${id}`;
}

function renderNoticeListItem(notice, { compact = false } = {}) {
  const titleClass = compact
    ? "min-w-0 flex-1 truncate text-gray-800 transition group-hover:text-navy-800 group-hover:underline"
    : "min-w-0 flex-1 truncate font-medium text-gray-900 transition group-hover:text-navy-800 group-hover:underline";

  return `
    <li>
      <a
        href="${noticeDetailUrl(notice.id)}"
        class="group flex items-center justify-between gap-4 px-5 py-3 text-sm transition hover:bg-gray-50"
      >
        <p class="${titleClass}">· ${escapeHtml(notice.title)}</p>
        <span class="shrink-0 text-xs text-gray-500 sm:text-sm">${formatNoticeDate(notice.createdAt)}</span>
      </a>
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

async function fetchNotices({ page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const result = await apiFetch(`/api/notices?${params.toString()}`, { auth: true });
  return {
    items: result.data ?? [],
    pagination: result.pagination ?? { page: 1, pageSize, total: 0, totalPages: 0 },
  };
}

async function loadPortalNotices(limit = 5) {
  const listEl = document.getElementById("notices-list");
  if (!listEl) return;

  listEl.innerHTML = `<li class="px-5 py-6 text-center text-sm text-gray-500">공지사항을 불러오는 중...</li>`;

  try {
    const { items } = await fetchNotices({ page: 1, pageSize: limit });
    if (!items.length) {
      listEl.innerHTML = `<li class="px-5 py-6 text-center text-sm text-gray-500">등록된 공지사항이 없습니다.</li>`;
      return;
    }

    listEl.innerHTML = items.map((notice) => renderNoticeListItem(notice, { compact: true })).join("");
  } catch (error) {
    console.error(error);
    listEl.innerHTML = `<li class="px-5 py-6 text-center text-sm text-red-500">공지사항을 불러오지 못했습니다.</li>`;
  }
}
