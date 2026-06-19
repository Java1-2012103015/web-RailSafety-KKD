/** WEEKDAYS, pad2 — accident-db-columns.js (선행 로드) */

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value ?? "";
}

function readFlatRow(row) {
  if (typeof flattenAccidentRecord !== "function" || typeof normalizeAccidentRecord !== "function") {
    return { ...(row ?? {}), ...(row?.detail ?? {}) };
  }
  return normalizeAccidentRecord(flattenAccidentRecord(row));
}

function textOrEmpty(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text;
}

function formatSerial(row) {
  const flat = readFlatRow(row);
  if (flat.accidentNumber) return String(flat.accidentNumber);
  const d = new Date(row.accidentAt);
  if (Number.isNaN(d.getTime())) return String(row.id ?? "");
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${String(row.id).padStart(3, "0")}`;
}

function splitCasualties(row) {
  const deaths = row.deaths ?? 0;
  const injuries = row.injuries ?? row.seriousInjuries ?? 0;
  const passDeath = row.accidentType === "HUMAN_ERROR" ? 0 : Math.min(deaths, 1);
  const staffDeath = deaths - passDeath;
  const passSerious = Math.ceil(injuries * 0.6);
  const staffSerious = injuries - passSerious;
  return { passDeath, staffDeath, passSerious, staffSerious: Math.max(0, staffSerious) };
}

function populateColFields(flat) {
  if (typeof setColInputs !== "function") return;
  const keys = new Set(
    Array.from(document.querySelectorAll("[data-col-key]")).map((el) => el.dataset.colKey).filter(Boolean),
  );
  keys.forEach((key) => {
    const value = flat[key];
    setColInputs(key, value === null || value === undefined ? "" : String(value));
  });
}

function sumNums(...values) {
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function splitMinutesToHourMin(totalMinutes) {
  const n = Number(totalMinutes);
  if (!Number.isFinite(n) || n < 0) return { hour: "00", min: "00" };
  return { hour: pad2(Math.floor(n / 60)), min: pad2(n % 60) };
}

function setDelayRange(prefix, minKey, maxKey, flat) {
  const min = splitMinutesToHourMin(flat[minKey]);
  const max = splitMinutesToHourMin(flat[maxKey]);
  setValue(`${prefix}-sh`, min.hour);
  setValue(`${prefix}-sm`, min.min);
  setValue(`${prefix}-eh`, max.hour);
  setValue(`${prefix}-em`, max.min);
}

function resolveAccidentClassCode(flat) {
  const kind = textOrEmpty(flat.accidentKind) || textOrEmpty(flat.railwayAccidentKind);
  if (kind === "관리사고") return "AF";
  if (kind === "준사고") return "NM";
  if (kind === "장애(위험)") return "TH";
  if (kind === "장애(무정차)") return "TE";
  if (kind === "장애(지연)") return "T";
  if (kind.includes("장애(관리(외부))")) return "TO";
  if (kind.includes("장애(관리(기준 미만))")) return "TF";
  if (kind === "사고") return "A";
  const category = typeof classifyAccidentKind === "function" ? classifyAccidentKind(kind) : null;
  if (category === "사고") return kind === "관리사고" ? "AF" : "A";
  if (category === "준사고") return "NM";
  if (category === "운행장애") {
    if (kind.includes("무정차")) return "TE";
    if (kind.includes("위험")) return "TH";
    return "T";
  }
  if (category === "운행장애(관리)") {
    if (kind.includes("외부")) return "TO";
    return "TF";
  }

  const disruption = textOrEmpty(flat.operationDisruptionType);
  if (disruption) {
    return resolveAccidentClassCode({ ...flat, accidentKind: disruption, operationDisruptionType: "" });
  }

  return "";
}

function updateAccidentTypeDetailField(flat) {
  const labelEl = document.getElementById("f-type-detail-label");
  const valueEl = document.getElementById("f-type-detail-value");
  if (!labelEl || !valueEl) return;

  const code = resolveAccidentClassCode(flat);
  const kind = textOrEmpty(flat.accidentKind) || textOrEmpty(flat.railwayAccidentKind);
  const isDelay = code === "T" || code === "TE" || code === "TO" || code === "TF";
  const isNear = code === "NM" || code === "TH";

  if (isDelay) {
    labelEl.textContent = "운행장애";
    valueEl.value = kind || textOrEmpty(flat.operationDisruptionType);
    return;
  }
  if (isNear) {
    labelEl.textContent = "준사고";
    valueEl.value = kind || textOrEmpty(flat.nearMissStatus);
    return;
  }
  labelEl.textContent = "사고유형";
  valueEl.value = kind || textOrEmpty(flat.railwayAccidentKind);
}

function setAccidentClassRadios(flat) {
  const code = resolveAccidentClassCode(flat);
  const groups = [
    { name: "acc-class-main", values: ["A", "AF"] },
    { name: "acc-class-near", values: ["NM", "TH"] },
    { name: "acc-class-delay", values: ["TE", "T", "TO", "TF"] },
  ];
  groups.forEach(({ name, values }) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.checked = input.value === code;
    });
  });
  applyTroubleTypeLayout(code);
}

function applyTroubleTypeLayout(code) {
  const isAccident = code === "A" || code === "AF";
  const isDelay = code === "T" || code === "TE" || code === "TO" || code === "TF";
  const typeLabel = document.getElementById("title-type-label");
  const causeSide = document.getElementById("cause-side-label");
  const causeMain = document.getElementById("title-cause-main");
  const subCause = document.getElementById("row-sub-cause");
  const trainCar = document.getElementById("tr-train-car-div");

  if (typeLabel) typeLabel.textContent = isAccident ? "사고유형" : isDelay ? "운행장애 현상" : "사건유형";
  if (causeSide) {
    causeSide.innerHTML = isAccident ? "사고<br />원인" : isDelay ? "지연<br />운행<br />원인" : "사건<br />원인";
  }
  if (causeMain) causeMain.textContent = isAccident ? "주원인" : "발생원인";
  if (subCause) subCause.style.display = isAccident ? "" : "none";
  if (trainCar) trainCar.style.display = isAccident ? "" : "none";
}

function setRegistrationRadios(flat) {
  const status = textOrEmpty(flat.registrationStatus);
  const solo = document.querySelector('input[name="reg-status"][value="10"]');
  const compete = document.querySelector('input[name="reg-status"][value="20"]');
  if (solo) solo.checked = status.includes("단독") || status === "10";
  if (compete) compete.checked = status.includes("경합") || status === "20";
}

function populateMainLineFields(flat) {
  const block = textOrEmpty(flat.mainLineBlockTime);
  const recovery = textOrEmpty(flat.mainLineRecoveryTime);
  const blockMatch = block.match(/(\d+)\s*시간?\s*(\d+)?/);
  if (blockMatch) {
    setValue("f-mainline-block-h", pad2(blockMatch[1]));
    setValue("f-mainline-block-m", pad2(blockMatch[2] ?? "0"));
  } else if (block) {
    const parts = splitMinutesToHourMin(block);
    setValue("f-mainline-block-h", parts.hour);
    setValue("f-mainline-block-m", parts.min);
  }
  if (recovery) {
    setValue("f-mainline-rec-mo", recovery);
  }
}

function resolveAccidentClassLabel(flat) {
  const kind = textOrEmpty(flat.accidentKind);
  if (kind && typeof classifyAccidentKind === "function") {
    const category = classifyAccidentKind(kind);
    if (category) return `${category} · ${kind}`;
  }
  const detail = textOrEmpty(flat.railwayAccidentKind);
  if (detail) return detail;
  const disruption = textOrEmpty(flat.operationDisruptionType);
  if (disruption) return `운행장애 · ${disruption}`;
  return kind;
}

function populateDetail(row, publication) {
  const flat = readFlatRow(row);
  const at = row.accidentAt ? new Date(row.accidentAt) : null;
  const year = flat.year ?? (at ? at.getFullYear() : "");
  const month = flat.month ?? (at ? at.getMonth() + 1 : "");
  const day = flat.day ?? (at ? at.getDate() : "");
  const hour = flat.hour ?? (at ? at.getHours() : "");
  const minute = flat.minute ?? (at ? at.getMinutes() : "");
  const deaths = flat.deaths ?? 0;
  const serious = flat.seriousInjuries ?? 0;
  const minor = flat.minorInjuries ?? 0;
  const casualties = splitCasualties({ ...row, deaths, injuries: serious, seriousInjuries: serious });

  setValue("f-serial", textOrEmpty(flat.accidentNumber) || formatSerial(row));
  setValue("f-acc-class-display", resolveAccidentClassLabel(flat));
  setValue("f-agency", textOrEmpty(flat.registrationAgency));
  setValue("f-related-agency", textOrEmpty(flat.relatedAgency));
  setValue("f-registration", textOrEmpty(flat.registrationStatus));
  setAccidentClassRadios(flat);
  updateAccidentTypeDetailField(flat);
  setRegistrationRadios(flat);
  setValue("f-rail-type", textOrEmpty(flat.railwayDivision));
  setValue("f-investigation", textOrEmpty(flat.investigationStatus));
  setValue("f-cause-1", textOrEmpty(flat.primaryCause));
  setValue("f-cause-2", textOrEmpty(flat.rootCause));
  setValue(
    "f-date",
    year && month && day ? `${year}${pad2(month)}${pad2(day)}` : textOrEmpty(flat.occurredAtText).slice(0, 10).replace(/-/g, ""),
  );
  setValue("f-hour", hour !== "" && hour !== null && hour !== undefined ? pad2(hour) : "");
  setValue("f-minute", minute !== "" && minute !== null && minute !== undefined ? pad2(minute) : "");
  setValue("f-weather", textOrEmpty(flat.weatherStatus));
  setValue("f-temp", flat.temperature === null || flat.temperature === undefined ? "" : String(flat.temperature));
  setValue("f-location", textOrEmpty(flat.administrativeDistrict || flat.place));

  setValue("f-line-name", textOrEmpty(flat.lineName));
  setValue("f-station-a", textOrEmpty(flat.stationA));
  setValue("f-station-from", textOrEmpty(flat.stationA));
  setValue("f-station-b", textOrEmpty(flat.stationB));
  setValue("f-base-station", textOrEmpty(flat.baseStation));
  setValue("f-accident-km", flat.accidentPointKm === null || flat.accidentPointKm === undefined ? "" : String(flat.accidentPointKm));
  setValue("f-occurrence-place", textOrEmpty(flat.occurrencePlace || flat.place));
  setValue("f-crossing", textOrEmpty(flat.crossing));

  setValue("d-pass-death", deaths ? String(casualties.passDeath) : "");
  setValue("d-pass-serious", serious ? String(casualties.passSerious) : "");
  setValue("d-pass-minor", minor ? String(minor) : "");
  setValue("d-pass-total", sumNums(casualties.passDeath, casualties.passSerious, minor) || "");
  setValue("d-public-total", sumNums(deaths, serious, minor) || "");
  setValue("d-staff-death", deaths ? String(casualties.staffDeath) : "");
  setValue("d-staff-serious", serious ? String(casualties.staffSerious) : "");
  setValue("d-staff-minor", "");
  setValue("d-staff-total", sumNums(casualties.staffDeath, casualties.staffSerious) || "");

  setValue("f-facility-damage", textOrEmpty(flat.facilityDamage));
  setValue("d-total", flat.totalDamageAmount === null || flat.totalDamageAmount === undefined ? "" : String(flat.totalDamageAmount));
  setValue(
    "d-property",
    flat.propertyDamageAmount === null || flat.propertyDamageAmount === undefined ? "" : String(flat.propertyDamageAmount),
  );

  setValue("f-overview", textOrEmpty(flat.accidentOverview));
  setValue("f-action", textOrEmpty(flat.actionContent));
  setValue("f-cause-detail", textOrEmpty(flat.accidentCause));
  setValue("f-prevention", textOrEmpty(flat.preventionPlan));

  const reportEl = document.getElementById("f-report-file");
  if (reportEl) {
    reportEl.textContent = "첨부파일 없음";
  }
  setValue("f-report-updated", textOrEmpty(flat.savedAtText));

  setValue("s-temp", flat.temperature === null || flat.temperature === undefined ? "" : String(flat.temperature));
  setValue("s-rail-type", textOrEmpty(flat.railwayDivision));

  setValue("f-supplement-req", textOrEmpty(flat.supplementRequestStatus));
  setValue("f-supplement-res", textOrEmpty(flat.supplementResultStatus));
  setValue("f-supplement-req-detail", textOrEmpty(flat.supplementRequestDetail));
  setValue("f-supplement-res-detail", textOrEmpty(flat.supplementResultDetail));

  populateColFields(flat);

  setDelayRange("delay-hs", "highSpeedDelayMin", "highSpeedDelayMax", flat);
  setDelayRange("delay-rg", "regularDelayMin", "regularDelayMax", flat);
  setDelayRange("delay-ur", "urbanDelayMin", "urbanDelayMax", flat);
  setDelayRange("delay-dd", "dedicatedDelayMin", "dedicatedDelayMax", flat);
  setDelayRange("delay-ot", "otherDelayMin", "otherDelayMax", flat);
  setDelayRange("delay-tot", "totalDelayMin", "totalDelayMax", flat);
  populateMainLineFields(flat);

  if (typeof applyDetailPublicationMask === "function") {
    applyDetailPublicationMask(publication);
  }
  if (typeof applyDetailPublicationTabs === "function") {
    applyDetailPublicationTabs(publication);
  }
}

function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.style.display === "none") return;
      const tab = btn.dataset.tab;
      buttons.forEach((b) => {
        if (b.style.display === "none") return;
        b.classList.toggle("active", b === btn);
      });
      panels.forEach((p) => {
        const panelTab = p.id.replace(/^tab-/, "");
        if (p.style.display === "none") return;
        p.classList.toggle("active", panelTab === tab);
      });
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
  const err = document.getElementById("detail-error");
  if (err) {
    err.textContent = message;
    setDetailPanelVisible("detail-error", true);
  }
}

function showContent() {
  setDetailPanelVisible("detail-loading", false);
  setDetailPanelVisible("detail-error", false);
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

    populateDetail(accident, publication);
    showContent();

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
