let pfaMap = null;
let pfaMarkers = [];
let pfaRefreshTimer = null;

function isPublicPreFloodPage() {
  return document.body?.dataset?.pfaPublic === "true";
}

const PFA_AUTO_REFRESH_MS = 15 * 60 * 1000;

const PFA_KOREA_BOUNDS = [
  [33.05, 124.45],
  [38.95, 131.95],
];
const PFA_KOREA_CENTER = [36.35, 127.75];

function riskLabel(level) {
  switch (level) {
    case "red":
      return "위험";
    case "orange":
      return "경계";
    case "amber":
      return "주의";
    default:
      return "안전";
  }
}

function createPfaRiskIcon(color) {
  return L.divIcon({
    className: "pfa-risk-marker-wrap",
    html: `<span class="pfa-risk-marker" style="background:${color}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
}

function addPfaBaseLayers(map) {
  const vworld = L.tileLayer("https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png", {
    maxZoom: 19,
    minZoom: 6,
    attribution: "&copy; VWorld / 국토교통부",
  });
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    minZoom: 6,
    attribution: "&copy; OpenStreetMap",
  });

  vworld.addTo(map);
  vworld.on("tileerror", () => {
    if (map.hasLayer(vworld)) {
      map.removeLayer(vworld);
      if (!map.hasLayer(osm)) osm.addTo(map);
    }
  });
}

function applyPfaDefaultView(map) {
  const bounds = L.latLngBounds(PFA_KOREA_BOUNDS);
  map.setMaxBounds(bounds.pad(0.08));
  map.fitBounds(bounds, { animate: false, padding: [8, 8] });
  const nextZoom = Math.min(map.getZoom() + 1, map.getMaxZoom());
  map.setZoom(nextZoom);
}

function ensurePfaMap() {
  if (pfaMap) return pfaMap;
  const container = document.getElementById("pfa-map");
  if (!container || typeof L === "undefined") return null;

  pfaMap = L.map(container, {
    center: PFA_KOREA_CENTER,
    zoom: 7,
    minZoom: 6,
    maxZoom: 18,
    zoomControl: true,
    attributionControl: true,
  });

  addPfaBaseLayers(pfaMap);
  applyPfaDefaultView(pfaMap);
  return pfaMap;
}

function confidenceBadgeClass(level) {
  switch (level) {
    case "high":
      return "bg-green-100 text-green-800";
    case "medium":
      return "bg-blue-100 text-blue-800";
    case "low":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function renderCompositeRiskCell(site) {
  return `
    <span class="inline-flex items-center gap-2">
      <span class="inline-block h-3 w-3 rounded-full border-2 border-white shadow" style="background:${site.riskColor}"></span>
      <span class="font-semibold">${riskLabel(site.riskLevel)} (${site.riskScore})</span>
    </span>
  `;
}

function renderPfaMarkers(sites) {
  const map = ensurePfaMap();
  if (!map) return;

  pfaMarkers.forEach((marker) => marker.remove());
  pfaMarkers = [];

  for (const site of sites) {
    if (site.latitude == null || site.longitude == null) continue;
    const marker = L.marker([site.latitude, site.longitude], {
      icon: createPfaRiskIcon(site.riskColor),
      riseOnHover: true,
    }).addTo(map);
    marker.bindPopup(`
      <div style="min-width:220px">
        <p style="font-weight:700;margin:0 0 4px">${site.siteName}</p>
        <p style="margin:0;font-size:12px;color:#555">${site.lineName} · ${site.location}</p>
        <div style="margin:8px 0;padding:8px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700">종합 위험도 <span style="color:${site.riskColor}">${riskLabel(site.riskLevel)} (${site.riskScore})</span></p>
          <p style="margin:0 0 4px;font-size:11px"><span style="color:#6b7280">지배 요인</span> · ${site.dominantFactor ?? "-"}</p>
          <p style="margin:0 0 4px;font-size:11px"><span style="color:#6b7280">신뢰도</span> · ${site.confidenceLabel ?? "-"}</p>
          <p style="margin:0;font-size:11px"><span style="color:#6b7280">임계 대비</span> · ${site.thresholdComparison ?? "-"}</p>
        </div>
        <p style="margin:0;font-size:10px;color:#888">현재 강우 15·30·60·360분: ${site.rainfall15m ?? "-"} / ${site.rainfall30m ?? "-"} / ${site.rainfall60m ?? site.rainfall1h ?? "-"} / ${site.rainfall360m ?? "-"}mm</p>
      </div>
    `);
    pfaMarkers.push(marker);
  }
}

function renderPfaSiteTable(sites) {
  const body = document.getElementById("pfa-alert-table-body");
  if (!body) return;
  if (!sites.length) {
    body.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-gray-500">등록된 개소가 없습니다. 관리자에서 침수경보 DB를 업로드하세요.</td></tr>`;
    return;
  }
  body.innerHTML = sites
    .map(
      (site) => `
        <tr>
          <td class="px-4 py-3">${site.agencyName}</td>
          <td class="px-4 py-3">${site.lineName}</td>
          <td class="px-4 py-3">${site.siteName}<div class="text-xs text-gray-500">${site.location}</div></td>
          <td class="px-4 py-3">${renderCompositeRiskCell(site)}</td>
          <td class="px-4 py-3 text-sm">${site.dominantFactor ?? "-"}</td>
          <td class="px-4 py-3">
            <span class="inline-flex rounded px-2 py-0.5 text-xs font-semibold ${confidenceBadgeClass(site.confidenceLevel)}">${site.confidenceLabel ?? "-"}</span>
          </td>
          <td class="px-4 py-3 text-sm font-medium text-navy-800">${site.thresholdComparison ?? "-"}</td>
        </tr>
      `,
    )
    .join("");
}

function renderPfaNews(news) {
  const list = document.getElementById("pfa-news-list");
  if (!list) return;
  if (!news.length) {
    list.innerHTML = `<li class="px-4 py-6 text-sm text-gray-500">관련기사가 현재 없습니다</li>`;
    return;
  }
  list.innerHTML = news
    .map(
      (item) => `
        <li class="border-b border-gray-100 px-4 py-3 last:border-b-0">
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="font-medium text-navy-800 hover:underline">${item.title}</a>
          <p class="mt-1 text-xs text-gray-600 line-clamp-2">${item.description}</p>
          <p class="mt-1 text-[11px] text-gray-400">${item.pubDate ?? ""}</p>
        </li>
      `,
    )
    .join("");
}

function renderPfaSummary(meta, sites) {
  const alertCount = sites.filter((site) => site.riskLevel === "red" || site.riskLevel === "orange").length;
  const cautionCount = sites.filter((site) => site.riskLevel === "amber").length;
  document.getElementById("pfa-stat-alert")?.replaceChildren(document.createTextNode(String(alertCount)));
  document.getElementById("pfa-stat-caution")?.replaceChildren(document.createTextNode(String(cautionCount)));
  document.getElementById("pfa-stat-facilities")?.replaceChildren(document.createTextNode(String(meta.siteCount ?? sites.length)));
  const updatedAt = document.getElementById("pfa-updated-at");
  if (updatedAt) updatedAt.textContent = new Date(meta.updatedAt ?? Date.now()).toLocaleString("ko-KR");
  const rainfallSyncedAt = document.getElementById("pfa-rainfall-synced-at");
  if (rainfallSyncedAt) {
    const syncedAt = meta.rainfallCache?.lastSyncedAt;
    rainfallSyncedAt.textContent = syncedAt ? new Date(syncedAt).toLocaleString("ko-KR") : "-";
  }
}

async function refreshPreFloodDashboard(options = {}) {
  const silent = Boolean(options.silent);
  ensurePfaMap();

  const loading = document.getElementById("pfa-loading");
  const content = document.getElementById("pfa-content");
  if (!silent) {
    if (loading) loading.classList.remove("hidden");
    if (content) content.classList.add("hidden");
  }

  const apiPath = isPublicPreFloodPage()
    ? "/api/public/flood-alert/dashboard"
    : "/api/flood-alert/dashboard";
  const result = await apiFetch(apiPath, { auth: !isPublicPreFloodPage() });
  const data = result.data ?? { sites: [], news: [], meta: {} };
  const sites = data.sites ?? [];

  renderPfaSummary(data.meta ?? {}, sites);
  renderPfaSiteTable(sites);
  renderPfaNews(data.news ?? []);
  renderPfaMarkers(sites);

  if (!silent) {
    if (loading) loading.classList.add("hidden");
    if (content) content.classList.remove("hidden");
  }
  setTimeout(() => {
    if (pfaMap) {
      pfaMap.invalidateSize();
      if (!silent) applyPfaDefaultView(pfaMap);
    }
  }, silent ? 0 : 120);
}

function startPfaAutoRefresh() {
  if (pfaRefreshTimer) clearInterval(pfaRefreshTimer);
  pfaRefreshTimer = setInterval(() => {
    refreshPreFloodDashboard({ silent: true }).catch((error) => {
      console.error("Pre-flood dashboard auto refresh failed:", error);
    });
  }, PFA_AUTO_REFRESH_MS);
}

async function initPreFloodAlertDashboard() {
  const isPublic = isPublicPreFloodPage();
  if (!isPublic && !requireAuth()) return;

  if (isPublic) {
    initPublicBoardLayout();
  } else {
    bindPortalHeader();
  }

  ensurePfaMap();
  try {
    if (isPublic) {
      await loadPublicBranding();
    } else {
      await Promise.all([loadPortalBranding(), loadPortalMenus()]);
    }
    await refreshPreFloodDashboard();
    startPfaAutoRefresh();
  } catch (error) {
    console.error("Pre-flood alert dashboard init failed:", error);
    const loading = document.getElementById("pfa-loading");
    if (loading) loading.textContent = "대시보드를 불러오지 못했습니다.";
  }
}
