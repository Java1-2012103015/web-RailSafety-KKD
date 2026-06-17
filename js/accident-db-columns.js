/** 사고정보 DB 컬럼 ↔ 엑셀 헤더 (순서 고정) */
const ACCIDENT_DB_COLUMNS = [
  { key: "accidentNumber", header: "사고번호" },
  { key: "year", header: "년" },
  { key: "month", header: "월" },
  { key: "day", header: "일" },
  { key: "hour", header: "시" },
  { key: "minute", header: "분" },
  { key: "occurredAtText", header: "일시" },
  { key: "weekday", header: "요일" },
  { key: "registrationStatus", header: "등록상태" },
  { key: "registrationAgency", header: "등록기관" },
  { key: "railwayDivision", header: "철도구분" },
  { key: "accidentKind", header: "사고 종류" },
  { key: "railwayAccidentKind", header: "철도사고 종류" },
  { key: "primaryCause", header: "주원인" },
  { key: "primaryCauseOther", header: "주원인 기타" },
  { key: "secondaryCause", header: "부원인" },
  { key: "secondaryCauseOther", header: "부원인 기타" },
  { key: "rootCauseGroup", header: "근본원인별 그룹" },
  { key: "rootCause", header: "근본원인별 원인" },
  { key: "rootCauseDetail", header: "근본원인별 상세" },
  { key: "riskSource", header: "위험원" },
  { key: "operationDisruptionType", header: "운행장애 종류" },
  { key: "riskIncidentDisruptionStatus", header: "위험사건운행장애 현황" },
  { key: "riskIncidentDisruptionCause", header: "위험사건운행장애 원인" },
  { key: "riskIncidentCauseDetail", header: "위험사건원인 상세" },
  { key: "nearMissStatus", header: "준사고 현황" },
  { key: "nearMissCause", header: "준사고 원인" },
  { key: "nearMissDetail", header: "준사고 상세" },
  { key: "delayOperationStatus", header: "지연운행 현황" },
  { key: "delayOperationCause", header: "지연운행 원인" },
  { key: "delayOperationCauseDetail", header: "지연운행원인 상세" },
  { key: "administrativeDistrict", header: "행정구역" },
  { key: "facilityDamage", header: "시설피해" },
  { key: "totalCasualtyLabel", header: "총피해명" },
  { key: "deaths", header: "사망" },
  { key: "seriousInjuries", header: "부상(중상)" },
  { key: "minorInjuries", header: "경상" },
  { key: "totalDamageAmount", header: "총 피해액(백만원)" },
  { key: "casualtyCompensationAmount", header: "사상자보상액" },
  { key: "propertyDamageAmount", header: "재산피해액" },
  { key: "otherDamageAmount", header: "기타피해액" },
  { key: "humanLossCostTotal", header: "인명손실비용합계" },
  { key: "deathProductionLossCost", header: "사망생산손실비용" },
  { key: "deathMedicalCost", header: "사망의료비용" },
  { key: "deathAdministrativeCost", header: "사망행정비용" },
  { key: "deathPsychologicalCost", header: "사망심리적비용" },
  { key: "seriousProductionLossCost", header: "중상생산손실비용" },
  { key: "seriousMedicalCost", header: "중상의료비용" },
  { key: "seriousAdministrativeCost", header: "중상행정비용" },
  { key: "seriousPsychologicalCost", header: "중상심리적비용" },
  { key: "minorProductionLossCost", header: "경상생산손실비용" },
  { key: "minorMedicalCost", header: "경상의료비용" },
  { key: "minorAdministrativeCost", header: "경상행정비용" },
  { key: "minorPsychologicalCost", header: "경상심리적비용" },
  { key: "materialDamageCostTotal", header: "물적피해비용합계" },
  { key: "vehicleRecoveryCost", header: "차량복구비용" },
  { key: "trackRecoveryCost", header: "선로복구비용" },
  { key: "signalRecoveryCost", header: "신호통신복구비용" },
  { key: "electricalRecoveryCost", header: "전철설비복구비용" },
  { key: "otherFacilityRecoveryCost", header: "기타시설및 구조물복구비용" },
  { key: "facilityDamageCostTotal", header: "시설피해비용전체" },
  { key: "operationLossCostTotal", header: "운행손실비용합계" },
  { key: "delayLossCost", header: "운행지연손실비용" },
  { key: "substituteTransportCost", header: "대체수송비용" },
  { key: "fareRefundCost", header: "운임반환료" },
  { key: "propertyEnvCompensationTotal", header: "재산및환경보상비용 합계" },
  { key: "propertyPassengerCompensation", header: "재산승객보상비용" },
  { key: "propertyStaffCompensation", header: "재산직원보상비용" },
  { key: "propertyPublicCompensation", header: "재산공중보상비용" },
  { key: "envPassengerCompensation", header: "환경승객보상비용" },
  { key: "envStaffCompensation", header: "환경직원보상비용" },
  { key: "envPublicCompensation", header: "환경공중보상비용" },
  { key: "otherCostTotal", header: "기타비용합계" },
  { key: "investigationCost", header: "사고조사비용" },
  { key: "legalCost", header: "변호사비용" },
  { key: "reputationCost", header: "이미지손실비용" },
  { key: "otherMiscCost", header: "기타비용" },
  { key: "lineName", header: "노선" },
  { key: "lineDirection", header: "노선방향" },
  { key: "stationA", header: "발생장소역A" },
  { key: "stationB", header: "발생장소역B" },
  { key: "occurrencePlace", header: "발생장소" },
  { key: "baseStation", header: "기점역" },
  { key: "accidentPointKm", header: "사고지점(km)" },
  { key: "crossing", header: "건널목" },
  { key: "crossingType", header: "건널목 종류" },
  { key: "guidePresent", header: "안내원 유무" },
  { key: "trainType", header: "열차종류" },
  { key: "trainNumber", header: "열차번호" },
  { key: "consistNumber", header: "편성번호" },
  { key: "vehicleNumber", header: "차량번호" },
  { key: "vehicleAge", header: "연식" },
  { key: "carCount", header: "호" },
  { key: "unitCount", header: "량" },
  { key: "operationFrom", header: "운행구간 시점" },
  { key: "operationTo", header: "운행구간 종점" },
  { key: "derailedCars", header: "차량탈선량" },
  { key: "damagedCars", header: "차량파손량" },
  { key: "severeDamage", header: "대파" },
  { key: "moderateDamage", header: "중파" },
  { key: "minorDamage", header: "소파" },
  { key: "totalDelayedTrains", header: "합계지연열차수" },
  { key: "highSpeedDelayedTrains", header: "고속지연열차수" },
  { key: "regularDelayedTrains", header: "일반지연열차수" },
  { key: "urbanDelayedTrains", header: "도시지연열차수" },
  { key: "dedicatedDelayedTrains", header: "전용지연열차수" },
  { key: "otherDelayedTrains", header: "기타지연열차수" },
  { key: "totalDelayMin", header: "합계최소지연시간(분)" },
  { key: "totalDelayMax", header: "합계최대지연시간(분)" },
  { key: "highSpeedDelayMin", header: "고속최소지연시간(분)" },
  { key: "highSpeedDelayMax", header: "고속최대지연시간(분)" },
  { key: "regularDelayMin", header: "일반최소지연시간(분)" },
  { key: "regularDelayMax", header: "일반최대지연시간(분)" },
  { key: "urbanDelayMin", header: "도시최소지연시간(분)" },
  { key: "urbanDelayMax", header: "도시최대지연시간(분)" },
  { key: "dedicatedDelayMin", header: "전용최소지연시간(분)" },
  { key: "dedicatedDelayMax", header: "전용최대지연시간(분)" },
  { key: "otherDelayMin", header: "기타최소지연시간(분)" },
  { key: "otherDelayMax", header: "기타최대지연시간(분)" },
  { key: "mainLineBlockTime", header: "본선지장 시간" },
  { key: "mainLineRecoveryTime", header: "본선복구 시기" },
  { key: "siteSituation", header: "현장상황" },
  { key: "closingSetting", header: "마감설정" },
  { key: "weatherStatus", header: "기상상태" },
  { key: "temperature", header: "온도" },
  { key: "rainfall", header: "강우량" },
  { key: "snowfall", header: "적설량" },
  { key: "fogPresence", header: "안개유무" },
  { key: "visibility", header: "가시거리" },
  { key: "earthquake", header: "지진" },
  { key: "wind", header: "바람" },
  { key: "staffCategory", header: "직원구분" },
  { key: "workCategory", header: "작업구분" },
  { key: "relatedPersonCount", header: "관계자 수" },
  { key: "relatedPersonOrg", header: "관계자 소속" },
  { key: "relatedPersonJob", header: "관계자 직종" },
  { key: "relatedPersonRank", header: "관계자 직급" },
  { key: "relatedPersonName", header: "관계자 성명" },
  { key: "relatedPersonAge", header: "관계자 연령" },
  { key: "placeTypeA", header: "장소유형A" },
  { key: "placeTypeB", header: "장소유형B" },
  { key: "operationLineCategory", header: "운행선 구분" },
  { key: "trainVehicleCategory", header: "열차/차량 구분" },
  { key: "speedLimit", header: "제한속도(km/h)" },
  { key: "accidentSpeedA", header: "사고속도(km/h)a" },
  { key: "accidentSpeedB", header: "사고속도(km/h)b" },
  { key: "trackType", header: "선로유형" },
  { key: "signalSystemType", header: "신호시스템 유형" },
  { key: "crossingAccidentPlace", header: "건널목사고 장소" },
  { key: "crossingAccidentVehicle", header: "건널목사고 차종" },
  { key: "hazmatCause", header: "위험물관련 원인" },
  { key: "hazmatType", header: "위험물관련 종류" },
  { key: "safetyFacilityTrack", header: "안전설비현황 시설측" },
  { key: "safetyFacilityVehicle", header: "안전설비현황 차량측" },
  { key: "safetyFacilityCrossing", header: "안전설비현황 건널목" },
  { key: "riskIncidentClass", header: "위험사건분류" },
  { key: "riskIncidentAttribute", header: "위험사건속성" },
  { key: "riskIncident", header: "위험사건" },
  { key: "riskIncidentDetail", header: "상세위험사건" },
  { key: "subjectParty", header: "주체" },
  { key: "objectParty", header: "피주체" },
  { key: "place", header: "장소" },
  { key: "status1", header: "상태1" },
  { key: "status2", header: "상태2" },
  { key: "riskAreaClass", header: "위험영역분류" },
  { key: "riskArea", header: "위험영역" },
  { key: "accidentOverview", header: "사고개요" },
  { key: "actionContent", header: "조치내용" },
  { key: "accidentCause", header: "사고원인" },
  { key: "preventionPlan", header: "예방대책" },
  { key: "accidentNumberBackup", header: "사고번호백업" },
  { key: "investigationStatus", header: "조사상태" },
  { key: "registeredBy", header: "등록자" },
  { key: "savedAtText", header: "저장시간" },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatOccurredAtText(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatSavedAtText(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.0`;
}

function num(value) {
  if (value === null || value === undefined) return "";
  return value;
}

function dec(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "object" && value.toString ? value.toString() : value;
}

/** API 레코드를 DB 컬럼 키 기준으로 정규화 (구 필드 호환) */
function normalizeAccidentRecord(row) {
  const at = row.accidentAt ? new Date(row.accidentAt) : null;
  const year = row.year ?? (at ? at.getFullYear() : null);
  const month = row.month ?? (at ? at.getMonth() + 1 : null);
  const day = row.day ?? (at ? at.getDate() : null);
  const hour = row.hour ?? (at ? at.getHours() : null);
  const minute = row.minute ?? (at ? at.getMinutes() : null);
  const weekday = row.weekday ?? (at ? WEEKDAYS[at.getDay()] : "");
  const accidentNumber =
    row.accidentNumber ??
    (at ? `${year}${pad2(month)}${pad2(day)}${String(row.id).padStart(3, "0")}` : String(row.id));

  return {
    ...row,
    accidentNumber,
    year,
    month,
    day,
    hour,
    minute,
    occurredAtText: row.occurredAtText ?? (at ? formatOccurredAtText(at) : ""),
    weekday,
    registrationStatus: row.registrationStatus ?? "",
    registrationAgency: row.registrationAgency ?? "",
    railwayDivision: row.railwayDivision ?? "",
    accidentKind: row.accidentKind ?? row.railwayAccidentKind ?? "",
    railwayAccidentKind: row.railwayAccidentKind ?? row.accidentKind ?? "",
    primaryCause: row.primaryCause ?? row.cause ?? "",
    administrativeDistrict: row.administrativeDistrict ?? row.location ?? "",
    facilityDamage: row.facilityDamage ?? row.damageScale ?? "",
    deaths: row.deaths ?? 0,
    seriousInjuries: row.seriousInjuries ?? row.injuries ?? 0,
    minorInjuries: row.minorInjuries ?? 0,
    lineName: row.lineName ?? "",
    occurrencePlace: row.occurrencePlace ?? row.location ?? "",
    weatherStatus: row.weatherStatus ?? row.weather ?? "",
    accidentCause: row.accidentCause ?? row.cause ?? "",
    investigationStatus: row.investigationStatus ?? "",
    savedAtText: row.savedAtText ?? formatSavedAtText(row.updatedAt ?? row.createdAt),
    closingSetting: row.closingSetting ?? "",
  };
}

/** API 응답(base + detail)을 DB 컬럼 키 하나의 객체로 병합 */
function flattenAccidentRecord(row) {
  if (!row || typeof row !== "object") return {};
  const { detail, ...base } = row;
  const detailData =
    detail && typeof detail === "object"
      ? Object.fromEntries(Object.entries(detail).filter(([key]) => key !== "id" && key !== "accidentId"))
      : {};
  return { ...base, ...detailData };
}

function rowToDbExport(row) {
  const n = normalizeAccidentRecord(flattenAccidentRecord(row));
  const out = {};
  for (const col of ACCIDENT_DB_COLUMNS) {
    const val = n[col.key];
    if (val === null || val === undefined) {
      out[col.header] = "";
    } else if (typeof val === "number") {
      out[col.header] = val;
    } else {
      out[col.header] = dec(val);
    }
  }
  return out;
}
