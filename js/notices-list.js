let noticesPage = 1;
const NOTICES_PAGE_SIZE = 15;

function renderNoticesPagination(pagination) {
  const container = document.getElementById("notices-pagination");
  if (!container) return;

  if (!pagination || pagination.totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const buttons = [];
  for (let page = 1; page <= pagination.totalPages; page += 1) {
    const active = page === pagination.page;
    buttons.push(`
      <button
        type="button"
        data-page="${page}"
        class="rounded px-3 py-1 text-sm ${active ? "bg-navy-900 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}"
      >
        ${page}
      </button>
    `);
  }

  container.innerHTML = buttons.join("");
  container.querySelectorAll("button[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      noticesPage = Number(button.dataset.page);
      loadNoticesListPage();
    });
  });
}

async function loadNoticesListPage() {
  const listEl = document.getElementById("notices-page-list");
  if (!listEl) return;

  listEl.innerHTML = `<li class="px-5 py-8 text-center text-sm text-gray-500">공지사항을 불러오는 중...</li>`;

  try {
    const { items, pagination } = await fetchNotices({ page: noticesPage, pageSize: NOTICES_PAGE_SIZE });

    if (!items.length) {
      listEl.innerHTML = `<li class="px-5 py-8 text-center text-sm text-gray-500">등록된 공지사항이 없습니다.</li>`;
      renderNoticesPagination(pagination);
      return;
    }

    listEl.innerHTML = items.map((notice) => renderNoticeListItem(notice)).join("");
    renderNoticesPagination(pagination);
  } catch (error) {
    console.error(error);
    listEl.innerHTML = `<li class="px-5 py-8 text-center text-sm text-red-500">공지사항을 불러오지 못했습니다.</li>`;
  }
}

async function initNoticesListPage() {
  await refreshSession();
  bindNoticeAdminCreateButton("notice-create-btn");
  loadNoticesListPage();
}

async function onNoticeAdminSaved() {
  await loadNoticesListPage();
}
