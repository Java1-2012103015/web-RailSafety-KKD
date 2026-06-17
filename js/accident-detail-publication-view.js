function formatPublicationValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString("ko-KR");
  if (value instanceof Date) return value.toLocaleString("ko-KR");
  return String(value);
}

function renderPublicationDetailView(accident, publication) {
  const wrap = document.getElementById("detail-publication-wrap");
  const groupsEl = document.getElementById("detail-approved-groups");
  const panelsEl = document.getElementById("detail-publication-panels");
  const legacy = document.getElementById("detail-content");

  if (!wrap || !panelsEl) return;

  const flat =
    typeof flattenAccidentRecord === "function" ? flattenAccidentRecord(accident) : { ...accident, ...(accident.detail ?? {}) };
  const visibleSet = new Set(publication?.visibleColumnKeys ?? []);
  const groups = publication?.groups ?? [];

  if (groupsEl) {
    const titles = publication?.approvedGroupTitles ?? [];
    groupsEl.innerHTML = titles.length
      ? titles.map((t) => `<span class="inline-flex rounded-full border border-navy-700/30 bg-navy-900/5 px-2 py-0.5 text-[11px] font-semibold text-navy-900">${t}</span>`).join(" ")
      : '<span class="text-amber-700">표시 허용된 구역 없음</span>';
  }

  const headerMap = new Map();
  if (typeof ACCIDENT_DB_COLUMNS !== "undefined") {
    ACCIDENT_DB_COLUMNS.forEach((col) => headerMap.set(col.key, col.header));
  }

  panelsEl.innerHTML = groups
    .filter((group) => group.visibleCount > 0)
    .map((group) => {
      const keys = (group.keys ?? []).filter((key) => visibleSet.has(key));
      if (!keys.length) return "";
      const rows = keys
        .map((key) => {
          const label = headerMap.get(key) ?? key;
          const val = formatPublicationValue(flat[key]);
          return `<tr><th>${label}</th><td>${val}</td></tr>`;
        })
        .join("");

      if (!rows) return "";

      return `
        <div class="detail-section-title">${group.title}</div>
        <table class="detail-table mb-4"><tbody>${rows}</tbody></table>
      `;
    })
    .join("");

  if (typeof setDetailPanelVisible === "function") {
    setDetailPanelVisible("detail-publication-wrap", true);
    setDetailPanelVisible("detail-content", false);
  } else {
    wrap.classList.remove("hidden");
    wrap.style.display = "";
    if (legacy) {
      legacy.classList.add("hidden");
      legacy.style.display = "none";
    }
  }
}

function shouldUsePublicationOnlyView(publication) {
  const user = typeof getUser === "function" ? getUser() : null;
  if (user?.role === "ADMIN") return false;
  const hasVisibleGroups = (publication?.groups ?? []).some((group) => (group.visibleCount ?? 0) > 0);
  return Boolean(publication?.visibleColumnKeys?.length && hasVisibleGroups);
}
