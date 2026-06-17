const EXACT_KINDS_BY_CATEGORY = {
  사고: ["사고"],
  준사고: ["준사고"],
  운행장애: ["장애(지연)", "장애(무정차)", "장애(위험)"],
  "운행장애(관리)": ["관리사고", "장애(관리(기준 미만))", "장애(관리(외부))"],
};

/** 대시보드 철도사고 차트(L열)와 동일 */
const DASHBOARD_RAILWAY_ACCIDENT_KINDS = ["사고"];

/** 대시보드 운행장애 차트(L열)와 동일 */
const DASHBOARD_OPERATION_DISRUPTION_KINDS = ["장애(지연)", "장애(무정차)"];

function classifyAccidentKind(accidentKind) {
  const kind = String(accidentKind ?? "").trim();
  if (!kind) return null;

  for (const [category, values] of Object.entries(EXACT_KINDS_BY_CATEGORY)) {
    if (values.includes(kind)) return category;
  }

  if (kind === "관리사고" || kind.includes("장애(관리")) return "운행장애(관리)";
  if (kind.startsWith("장애(")) return "운행장애";
  if (kind === "준사고") return "준사고";
  if (kind === "사고") return "사고";

  return null;
}

window.classifyAccidentKind = classifyAccidentKind;
window.DASHBOARD_RAILWAY_ACCIDENT_KINDS = DASHBOARD_RAILWAY_ACCIDENT_KINDS;
window.DASHBOARD_OPERATION_DISRUPTION_KINDS = DASHBOARD_OPERATION_DISRUPTION_KINDS;
