const TYPE_LABELS = {
  COLLISION: "충돌",
  DERAILMENT: "탈선",
  FIRE: "화재",
  SIGNAL_FAILURE: "신호장애",
  HUMAN_ERROR: "인적오류",
  TRACK_DEFECT: "궤도결함",
  OTHER: "기타",
};

const TYPE_DETAIL = {
  COLLISION: "신호위반",
  DERAILMENT: "차량고장",
  FIRE: "화재",
  SIGNAL_FAILURE: "신호장애",
  HUMAN_ERROR: "직원(사상)",
  TRACK_DEFECT: "궤도결함",
  OTHER: "기타",
};

const CATEGORY_BY_TYPE = {
  COLLISION: "사고",
  DERAILMENT: "사고",
  FIRE: "사고",
  SIGNAL_FAILURE: "지연",
  HUMAN_ERROR: "준사고",
  TRACK_DEFECT: "관리사고",
  OTHER: "준사고",
};

/** WEEKDAYS, pad2 — accident-db-columns.js (선행 로드) */

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value ?? "";
}

function formatSerial(row) {
  const d = new Date(row.accidentAt);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${String(row.id).padStart(3, "0")}`;
}

function resolveAgency(lineName) {
  if (!lineName) return "철도공사";
  if (lineName.includes("8호선") || lineName.includes("도시")) return "서울교통공사";
  if (lineName.includes("공항")) return "공항철도";
  return "한국철도공사";
}

function resolveRailType(lineName) {
  if (lineName?.includes("고속")) return "고속철도";
  if (lineName?.includes("호선") || lineName?.includes("도시")) return "도시철도";
  return "일반철도";
}

function resolveInvestigation(id) {
  return ["최초", "중간", "최종"][id % 3];
}

function resolveDamageAmount(row) {
  const base = (row.deaths * 120 + row.injuries * 15 + row.id * 7) % 900;
  return (base === 0 ? 0 : base).toFixed(3);
}

function splitCasualties(row) {
  const deaths = row.deaths ?? 0;
  const injuries = row.injuries ?? 0;
  const passDeath = row.accidentType === "HUMAN_ERROR" ? 0 : Math.min(deaths, 1);
  const staffDeath = deaths - passDeath;
  const passSerious = Math.ceil(injuries * 0.6);
  const staffSerious = injuries - passSerious;
  return { passDeath, staffDeath, passSerious, staffSerious: Math.max(0, staffSerious) };
}

function buildOverview(row) {
  const d = new Date(row.accidentAt);
  const day = WEEKDAYS[d.getDay()];
  const weather = row.weather ?? "맑음";
  const typeLabel = TYPE_DETAIL[row.accidentType] ?? TYPE_LABELS[row.accidentType];
  const casualty =
    row.deaths + row.injuries > 0
      ? `사망 ${row.deaths}명, 부상 ${row.injuries}명`
      : "없음";

  return [
    "1. 개요",
    `· 일시: ${d.getFullYear()}. ${pad2(d.getMonth() + 1)}. ${pad2(d.getDate())}. (${day}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}경 (날씨: ${weather})`,
    `· 장소: ${row.lineName} ${row.location}`,
    `· 내용: ${typeLabel} - ${row.cause}`,
    `· 인적피해(피해내역): ${casualty}`,
    "· 인접 및 언론보도: 없음",
  ].join("\n");
}

function buildPrevention(row) {
  return [
    "4. 예방대책",
    "· 선로전환기 진로 표시에 우선하여 신호기(진로개통표시기 포함) 설치상태 확인 철저",
    "· 모터카 운행 시 지적, 확인, 환호 절차 준수 철저",
    "· 동종사고 장애 예방 교육 철저",
    `· (${row.lineName}) 구간 정기 점검 강화`,
  ].join("\n");
}

function populateDetail(row) {
  const detail = row.detail ?? {};
  const d = new Date(row.accidentAt);
  const agency = detail.registrationAgency?.trim() || "-";
  const category = detail.accidentKind && typeof classifyAccidentKind === "function"
    ? classifyAccidentKind(detail.accidentKind) ?? "사고"
    : CATEGORY_BY_TYPE[row.accidentType] ?? "사고";
  const typeDetail =
    detail.railwayAccidentKind?.trim() || TYPE_DETAIL[row.accidentType] || TYPE_LABELS[row.accidentType];
  const casualties = splitCasualties(row);
  const damage = resolveDamageAmount(row);

  setValue("f-serial", detail.accidentNumber?.trim() || formatSerial(row));
  setValue("f-agency", agency);
  setValue("f-related-agency", "-");
  setValue("f-registration", detail.registrationStatus?.trim() || "-");
  setValue("f-rail-type", detail.railwayDivision?.trim() || resolveRailType(row.lineName));
  setValue("f-near-type", category === "준사고" ? `3 ${typeDetail}` : typeDetail);
  setValue("f-investigation", detail.investigationStatus?.trim() || "-");
  setValue("f-cause-1", row.cause ?? "");
  setValue("f-cause-2", `인적요인 · ${row.cause ?? "미상"}`);
  setValue("f-date", `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`);
  setValue("f-hour", pad2(d.getHours()));
  setValue("f-minute", pad2(d.getMinutes()));
  setValue("f-weather", row.weather ?? "맑음");
  setValue("f-temp", String(15 + (row.id % 10)));
  setValue("f-location", row.location);
  setValue("f-line-section", `${row.lineName} · ${row.location}`);

  setValue("d-pass-death", String(casualties.passDeath));
  setValue("d-pass-serious", String(casualties.passSerious));
  setValue("d-pass-minor", "0");
  setValue("d-staff-death", String(casualties.staffDeath));
  setValue("d-staff-serious", String(casualties.staffSerious));
  setValue("f-facility-damage", row.damageScale ?? "");
  setValue("d-total", damage);
  setValue("d-property", damage);

  setValue("f-overview", buildOverview(row));
  setValue("f-action", `2. 발생경위 및 조치내용\n· ${row.cause}\n· 현장 조치: 운행 통제 및 복구 작업 실시\n· ${row.damageScale ?? ""}`);
  setValue("f-cause-detail", `3. 발생원인: ${row.cause}`);
  setValue("f-prevention", buildPrevention(row));

  const reportEl = document.getElementById("f-report-file");
  if (reportEl) {
    reportEl.textContent = "첨부파일 없음";
  }
  setValue("f-report-updated", formatDateTime(row.updatedAt));

  setValue("s-temp", row.weather ? String(15 + (row.id % 10)) : "-");
  setValue("s-rail-type", resolveRailType(row.lineName));

  setValue("f-supplement-req", "정상");
  setValue("f-supplement-res", "정상");
  setValue("f-supplement-req-detail", "");
  setValue("f-supplement-res-detail", "");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      buttons.forEach((b) => b.classList.toggle("active", b === btn));
      panels.forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
    });
  });
}

function setDetailPanelVisible(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = visible ? "" : "none";
  el.classList.toggle("hidden", !visible);
  el.setAttribute("aria-hidden", visible ? "false" : "true");
}

function showError(message) {
  setDetailPanelVisible("detail-loading", false);
  setDetailPanelVisible("detail-content", false);
  setDetailPanelVisible("detail-publication-wrap", false);
  const err = document.getElementById("detail-error");
  if (err) {
    err.textContent = message;
    setDetailPanelVisible("detail-error", true);
  }
}

function showContent(mode = "legacy") {
  setDetailPanelVisible("detail-loading", false);
  setDetailPanelVisible("detail-error", false);
  if (mode === "publication") {
    setDetailPanelVisible("detail-content", false);
    setDetailPanelVisible("detail-publication-wrap", true);
    return;
  }
  setDetailPanelVisible("detail-publication-wrap", false);
  setDetailPanelVisible("detail-content", true);
}

async function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    showError("사고 ID가 없습니다. 목록에서 다시 선택해 주세요.");
    return;
  }

  try {
    const result = await apiFetch(`/api/accidents/${encodeURIComponent(id)}`, { auth: true });
    const accident = result.data;
    const publication = result.publication;

    if (!accident || typeof accident !== "object") {
      showError("사고 데이터 형식이 올바르지 않습니다.");
      return;
    }

    if (typeof shouldUsePublicationOnlyView === "function" && shouldUsePublicationOnlyView(publication)) {
      renderPublicationDetailView(accident, publication);
      const panels = document.getElementById("detail-publication-panels");
      const hasPanels = Boolean(panels?.innerHTML?.trim());
      if (hasPanels) {
        showContent("publication");
      } else {
        populateDetail(accident);
        showContent("legacy");
      }
    } else {
      populateDetail(accident);
      showContent("legacy");
    }

    document.title = `사고 ${formatSerial(accident)} | 철도안전정보종합관리시스템`;
  } catch (error) {
    console.error(error);
    showError(error.message ?? "사고 정보를 불러오지 못했습니다.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  bindPortalHeader();
  initTabs();

  const detailTask = loadDetail();
  const chromeTask = Promise.all([
    loadPortalMenus().catch((error) => console.error("메뉴 로드 실패:", error)),
    loadPortalBranding().catch((error) => console.error("브랜딩 로드 실패:", error)),
  ]);

  try {
    await detailTask;
  } catch (error) {
    console.error(error);
    showError(error?.message ?? "사고 정보를 불러오지 못했습니다.");
  } finally {
    await chromeTask;
  }
});
