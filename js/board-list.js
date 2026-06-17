let boardListPage = 1;
let activeBoardListConfig = null;

function renderBoardPagination(containerId, pagination, onPageChange) {
  const container = document.getElementById(containerId);
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
      boardListPage = Number(button.dataset.page);
      onPageChange();
    });
  });
}

async function loadBoardListPage(config) {
  const {
    boardType,
    listElId,
    paginationId,
    pageSize,
    emptyMessage,
    loadingMessage,
    errorMessage,
  } = config;

  const listEl = document.getElementById(listElId);
  if (!listEl) return;

  listEl.innerHTML = `<li class="px-5 py-8 text-center text-sm text-gray-500">${loadingMessage}</li>`;

  const includeHidden =
    typeof canBoardAction === "function" && canBoardAction(boardType, "update");

  try {
    const { items, pagination } = await fetchNotices({
      page: boardListPage,
      pageSize,
      boardType,
      includeHidden,
    });

    if (!items.length) {
      listEl.innerHTML = `<li class="px-5 py-8 text-center text-sm text-gray-500">${emptyMessage}</li>`;
      renderBoardPagination(paginationId, pagination, () => loadBoardListPage(config));
      return;
    }

    listEl.innerHTML = items
      .map((notice) => renderNoticeListItem(notice, { showAdminControls: includeHidden }))
      .join("");
    bindNoticeVisibilityToggles(listEl, items);
    renderBoardPagination(paginationId, pagination, () => loadBoardListPage(config));
  } catch (error) {
    console.error(error);
    listEl.innerHTML = `<li class="px-5 py-8 text-center text-sm text-red-500">${errorMessage}</li>`;
  }
}

function initBoardListPage(config) {
  const { createBtnId, defaultBoardType } = config;

  activeBoardListConfig = config;
  bindNoticeAdminCreateButton(createBtnId, { defaultBoardType });
  boardListPage = 1;
  return loadBoardListPage(config);
}

async function initNoticesListPage() {
  await refreshSession();
  await initBoardListPage({
    boardType: "NOTICE",
    defaultBoardType: "NOTICE",
    createBtnId: "notice-create-btn",
    listElId: "notices-page-list",
    paginationId: "notices-pagination",
    pageSize: 15,
    emptyMessage: "등록된 공지사항이 없습니다.",
    loadingMessage: "공지사항을 불러오는 중...",
    errorMessage: "공지사항을 불러오지 못했습니다.",
  });
}

async function initArchiveListPage() {
  await refreshSession();
  await initBoardListPage({
    boardType: "ARCHIVE",
    defaultBoardType: "ARCHIVE",
    createBtnId: "archive-create-btn",
    listElId: "archive-page-list",
    paginationId: "archive-pagination",
    pageSize: 15,
    emptyMessage: "등록된 자료가 없습니다.",
    loadingMessage: "자료를 불러오는 중...",
    errorMessage: "자료를 불러오지 못했습니다.",
  });
}

async function onNoticeAdminSaved() {
  if (activeBoardListConfig) {
    await loadBoardListPage(activeBoardListConfig);
  }
}
