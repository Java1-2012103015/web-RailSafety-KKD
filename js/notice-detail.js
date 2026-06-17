function getNoticeIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

let currentNotice = null;

async function onNoticeAdminSaved() {
  await initNoticeDetailPage();
}

async function initNoticeDetailPage() {
  await refreshSession();
  const loadingEl = document.getElementById("notice-detail-loading");
  const errorEl = document.getElementById("notice-detail-error");
  const contentEl = document.getElementById("notice-detail-content");
  const noticeId = getNoticeIdFromQuery();

  if (!noticeId) {
    loadingEl?.classList.add("hidden");
    if (errorEl) {
      errorEl.textContent = "잘못된 공지사항 주소입니다.";
      errorEl.classList.remove("hidden");
    }
    return;
  }

  try {
    const result = await apiFetch(`/api/notices/${noticeId}`, { auth: true });
    currentNotice = result.data;

    document.title = `${currentNotice.title} | 철도안전정보종합관리시스템`;
    document.getElementById("notice-detail-title").textContent = currentNotice.title;
    document.getElementById("notice-detail-author").textContent = `작성자: ${currentNotice.authorName}`;
    document.getElementById("notice-detail-date").textContent = `등록일: ${formatNoticeDateTime(currentNotice.createdAt)}`;
    document.getElementById("notice-detail-body").textContent = currentNotice.content;

    const actions = document.getElementById("notice-admin-actions");
    if (actions) {
      actions.classList.add("hidden");
      showNoticeAdminActions("notice-admin-actions", currentNotice);
    }

    loadingEl?.classList.add("hidden");
    contentEl?.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    loadingEl?.classList.add("hidden");
    if (errorEl) {
      errorEl.textContent = error.message || "공지사항을 불러오지 못했습니다.";
      errorEl.classList.remove("hidden");
    }
  }
}
