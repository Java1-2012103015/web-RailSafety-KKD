/** 상세 폼 필드 ↔ DB 컬럼 키 (하나라도 승인되면 표시) */
const DETAIL_FIELD_COLUMNS = {
  "f-serial": ["accidentNumber"],
  "f-acc-class-display": ["accidentKind", "railwayAccidentKind", "operationDisruptionType"],
  "f-agency": ["registrationAgency"],
  "f-related-agency": ["relatedAgency"],
  "f-registration": ["registrationStatus"],
  "f-disruption-type": ["operationDisruptionType"],
  "f-rail-type": ["railwayDivision"],
  "f-investigation": ["investigationStatus"],
  "f-cause-1": ["primaryCause"],
  "f-cause-2": ["rootCause", "rootCauseDetail"],
  "f-date": ["year", "month", "day", "occurredAtText"],
  "f-hour": ["hour"],
  "f-minute": ["minute"],
  "f-weather": ["weatherStatus"],
  "f-temp": ["temperature"],
  "f-location": ["administrativeDistrict", "place"],
  "f-line-name": ["lineName"],
  "f-station-a": ["stationA"],
  "f-station-from": ["stationA"],
  "f-station-b": ["stationB"],
  "f-base-station": ["baseStation"],
  "f-accident-km": ["accidentPointKm"],
  "f-occurrence-place": ["occurrencePlace", "place"],
  "f-crossing": ["crossing"],
  "d-pass-death": ["deaths"],
  "d-pass-serious": ["seriousInjuries"],
  "d-pass-minor": ["minorInjuries"],
  "d-pass-total": ["deaths", "seriousInjuries", "minorInjuries"],
  "d-public-total": ["deaths", "seriousInjuries", "minorInjuries"],
  "d-staff-death": ["deaths"],
  "d-staff-serious": ["seriousInjuries"],
  "d-staff-minor": ["minorInjuries"],
  "d-staff-total": ["deaths", "seriousInjuries", "minorInjuries"],
  "f-facility-damage": ["facilityDamage"],
  "d-total": ["totalDamageAmount"],
  "d-property": ["propertyDamageAmount"],
  "f-overview": ["accidentOverview"],
  "f-action": ["actionContent"],
  "f-cause-detail": ["accidentCause"],
  "f-prevention": ["preventionPlan"],
  "f-report-updated": ["savedAtText"],
  "s-temp": ["temperature"],
  "s-rail-type": ["railwayDivision"],
  "f-supplement-req": ["supplementRequestStatus"],
  "f-supplement-req-detail": ["supplementRequestDetail"],
  "f-supplement-res": ["supplementResultStatus"],
  "f-supplement-res-detail": ["supplementResultDetail"],
};

const DETAIL_TAB_IDS = ["basic", "extra", "site", "review"];

function applyDetailPublicationTabs(publication) {
  const visibleTabs = new Set(
    publication?.visibleTabKeys?.length ? publication.visibleTabKeys : DETAIL_TAB_IDS,
  );

  let firstVisible = null;
  DETAIL_TAB_IDS.forEach((tabId) => {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const panel = document.getElementById(`tab-${tabId}`);
    const show = visibleTabs.has(tabId);

    if (btn) {
      btn.style.display = show ? "" : "none";
      btn.setAttribute("aria-hidden", show ? "false" : "true");
    }
    if (panel) {
      panel.style.display = show ? "" : "none";
      panel.setAttribute("aria-hidden", show ? "false" : "true");
      if (!show) panel.classList.remove("active");
    }
    if (show && firstVisible === null) firstVisible = tabId;
  });

  if (!firstVisible) return;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    if (btn.style.display === "none") return;
    btn.classList.toggle("active", btn.dataset.tab === firstVisible);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const tabId = panel.id.replace(/^tab-/, "");
    if (!visibleTabs.has(tabId)) return;
    panel.classList.toggle("active", tabId === firstVisible);
  });
}

function isDetailFieldVisible(fieldId, visibleSet) {
  const keys = DETAIL_FIELD_COLUMNS[fieldId];
  if (!keys?.length) return true;
  return keys.some((key) => visibleSet.has(key));
}

function setColInputs(colKey, value) {
  document.querySelectorAll(`[data-col-key="${colKey}"]`).forEach((el) => {
    if ("value" in el) el.value = value ?? "";
    else el.textContent = value ?? "";
  });
}

function applyDetailPublicationMask(publication) {
  const visibleSet = new Set(publication?.visibleColumnKeys ?? []);
  if (!visibleSet.size) return;

  for (const fieldId of Object.keys(DETAIL_FIELD_COLUMNS)) {
    if (!isDetailFieldVisible(fieldId, visibleSet)) {
      const el = document.getElementById(fieldId);
      if (el) el.value = "";
    }
  }

  document.querySelectorAll("[data-col-key]").forEach((el) => {
    const key = el.dataset.colKey;
    if (key && !visibleSet.has(key)) {
      if ("value" in el) el.value = "";
      else el.textContent = "";
    }
  });

  const reportEl = document.getElementById("f-report-file");
  if (reportEl && !isDetailFieldVisible("f-report-updated", visibleSet)) {
    reportEl.textContent = "";
  }
}

function shouldUsePublicationOnlyView() {
  return false;
}
