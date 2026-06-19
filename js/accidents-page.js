const ACCIDENT_TYPE_LABELS = {
  COLLISION: "충돌",
  DERAILMENT: "탈선",
  FIRE: "화재",
  SIGNAL_FAILURE: "신호장애",
  HUMAN_ERROR: "인적오류",
  TRACK_DEFECT: "궤도결함",
  OTHER: "기타",
};

const TYPE_DETAIL_LABELS = {
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

const BULK_MAX_RECORDS = 20000;
/** nginx 기본 1MB 제한 등 프록시 환경에서 413 방지 — 건당 요청 크기 상한 */
const BULK_CHUNK_SIZE = 100;

const listState = {
  page: 1,
  pageSize: 15,
  total: 0,
  totalPages: 1,
};

/** 대시보드 차트에서 넘어온 L열(사고 종류) 정확 필터 */
let dashboardAccidentKinds = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getPageMode() {
  const path = window.location.pathname.replace(/\/$/, "");
  if (path.endsWith("/stats")) return "stats";
  if (path.endsWith("/causes")) return "causes";
  return "list";
}

function formatSerialNumber(row) {
  const date = new Date(row.accidentAt);
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}${m}${d}${String(row.id).padStart(3, "0")}`;
}

function resolveOperatingAgency(lineName) {
  if (!lineName) return "철도공사";
  if (lineName.includes("8호선") || lineName.includes("도시철도")) return "서울교통";
  if (lineName.includes("공항")) return "공항철도";
  if (lineName.includes("에스알") || lineName.includes("SR")) return "에스알";
  return "철도공사";
}

function resolveRelatedAgency(row) {
  const agency = resolveOperatingAgency(row.lineName);
  if (agency === "에스알") return "(주)에스알";
  if (agency === "공항철도") return "공항철도";
  return row.id % 3 === 0 ? agency : "-";
}

function resolveInvestigationStatus(row) {
  const statuses = ["최초", "중간", "최종"];
  return statuses[row.id % 3];
}

function resolveDamageAmount(row) {
  const base = (row.deaths * 120 + row.injuries * 15 + row.id * 7) % 900;
  return base === 0 ? 0 : base;
}

function resolveTypeLabel(row) {
  return TYPE_DETAIL_LABELS[row.accidentType] ?? ACCIDENT_TYPE_LABELS[row.accidentType] ?? row.accidentType;
}

function resolveCategory(row) {
  const kind = row.detail?.accidentKind;
  if (kind && typeof classifyAccidentKind === "function") {
    return classifyAccidentKind(kind) ?? "-";
  }
  return CATEGORY_BY_TYPE[row.accidentType] ?? "사고";
}

function parseInvestigationReportLinksForList(raw) {
  if (typeof parseInvestigationReportLinks === "function") {
    return parseInvestigationReportLinks(raw);
  }
  if (raw == null || raw === "") return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const url = String(item.url ?? "").trim();
        if (!url) return null;
        return {
          id: String(item.id ?? "").trim() || `link-${index + 1}`,
          title: String(item.title ?? "").trim() || `조사보고서 ${index + 1}`,
          url,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function enrichRow(row) {
  const detail = row.detail ?? {};
  const seriousInjuries = detail.seriousInjuries ?? row.seriousInjuries ?? row.injuries ?? 0;
  const damageFromDetail = detail.totalDamageAmount ?? row.totalDamageAmount;
  return {
    ...row,
    serialNo: detail.accidentNumber?.trim() || formatSerialNumber(row),
    operatingAgency: detail.registrationAgency?.trim() || "-",
    registrationStatus: detail.registrationStatus?.trim() || "-",
    relatedAgency: detail.relatedAgency?.trim() || "-",
    accidentCategory: resolveCategory(row),
    typeLabel: resolveTypeLabel(row),
    seriousInjuries,
    damageAmount:
      damageFromDetail != null && damageFromDetail !== ""
        ? damageFromDetail
        : resolveDamageAmount(row),
    closingSetting: detail.closingSetting?.trim() || "-",
    hasAttachment: parseInvestigationReportLinksForList(detail.investigationReportLinks).length > 0,
    investigationReportLinks: parseInvestigationReportLinksForList(detail.investigationReportLinks),
    investigationStatus: detail.investigationStatus?.trim() || "-",
    registeredAt: formatDateOnly(row.createdAt),
    supplementRequest: "정상",
    supplementResult: "정상",
    railCategory: detail.railwayDivision?.trim()
      || (row.lineName?.includes("고속")
        ? "고속"
        : row.lineName?.includes("호선") || row.lineName?.includes("도시")
          ? "도시철도"
          : "일반"),
    linked: row.id % 4 === 0 ? "Y" : "N",
    contention: row.deaths > 0 ? "Y" : "N",
  };
}

function initDefaultDates() {
  const start = document.getElementById("filter-start-date");
  const end = document.getElementById("filter-end-date");
  if (!start || !end) return;

  const role = getUser()?.role;
  if (role === "ADMIN") {
    const now = new Date();
    end.value = formatDateOnly(now);
    start.value = formatDateOnly(new Date(now.getFullYear(), 0, 1));
    return;
  }

  // 경기도 등 조회 권한(기관·역) 제한 역할: 기본 전체 기간 — 2022년 등 과거 데이터도 표시
  start.value = "";
  end.value = "";
}

function applyFiltersFromDashboardUrl() {
  const params = new URLSearchParams(window.location.search);
  const year = params.get("year");
  const month = params.get("month");
  const dashboardChart = params.get("dashboardChart");
  if (!year && !dashboardChart) return;

  if (year && /^\d{4}$/.test(year)) {
    const start = document.getElementById("filter-start-date");
    const end = document.getElementById("filter-end-date");
    const y = Number(year);
    if (month && /^(?:[1-9]|1[0-2])$/.test(month)) {
      const m = Number(month);
      const lastDay = new Date(y, m, 0).getDate();
      if (start) start.value = `${year}-${pad2(m)}-01`;
      if (end) end.value = `${year}-${pad2(m)}-${pad2(lastDay)}`;
    } else {
      if (start) start.value = `${year}-01-01`;
      if (end) end.value = `${year}-12-31`;
    }
  }

  const typeL1 = document.getElementById("filter-type-l1");
  if (dashboardChart === "scoped-accidents") {
    if (typeL1) typeL1.value = "사고";
    dashboardAccidentKinds = null;
  } else if (dashboardChart === "scoped-disruptions") {
    if (typeL1) typeL1.value = "운행장애";
    dashboardAccidentKinds = window.DASHBOARD_OPERATION_DISRUPTION_KINDS ?? ["장애(지연)", "장애(무정차)"];
  }
}

async function populateSearchFilters() {
  const agencySelect = document.getElementById("filter-agency");
  const railCategorySelect = document.getElementById("filter-rail-category");
  const lineSelect = document.getElementById("filter-line");
  if (!agencySelect && !railCategorySelect && !lineSelect) return;

  const currentAgency = agencySelect?.value ?? "";
  const currentRailCategory = railCategorySelect?.value ?? "";
  const currentLine = lineSelect?.value ?? "";

  if (agencySelect) {
    agencySelect.innerHTML = '<option value="">전체</option>';
  }
  if (railCategorySelect) {
    railCategorySelect.innerHTML = '<option value="">전체</option>';
  }
  if (lineSelect) {
    lineSelect.innerHTML = '<option value="">전체</option>';
  }

  try {
    const result = await apiFetch("/api/accidents/filter-options", { auth: true });
    const agencies = result.data?.registrationAgencies ?? [];
    const railCategories = result.data?.railCategories ?? [];
    const lineNames = result.data?.lineNames ?? [];

    if (agencySelect) {
      for (const agency of agencies) {
        const option = document.createElement("option");
        option.value = agency;
        option.textContent = agency;
        agencySelect.appendChild(option);
      }
      if (currentAgency && agencies.includes(currentAgency)) {
        agencySelect.value = currentAgency;
      }
    }

    if (railCategorySelect) {
      for (const railCategory of railCategories) {
        const option = document.createElement("option");
        option.value = railCategory;
        option.textContent = railCategory;
        railCategorySelect.appendChild(option);
      }
      if (currentRailCategory && railCategories.includes(currentRailCategory)) {
        railCategorySelect.value = currentRailCategory;
      }
    }

    if (lineSelect) {
      for (const line of lineNames) {
        const option = document.createElement("option");
        option.value = line;
        option.textContent = line;
        lineSelect.appendChild(option);
      }
      if (currentLine && lineNames.includes(currentLine)) {
        lineSelect.value = currentLine;
      }
    }
  } catch (error) {
    console.error("검색 조건 목록을 불러오지 못했습니다.", error);
  }
}

function buildQueryParams(overrides = {}) {
  const params = new URLSearchParams();
  params.set("page", String(overrides.page ?? listState.page));
  params.set("pageSize", String(overrides.pageSize ?? listState.pageSize));

  const startDate = document.getElementById("filter-start-date")?.value;
  const endDate = document.getElementById("filter-end-date")?.value;
  const lineName = document.getElementById("filter-line")?.value;
  const accidentKindCategory = document.getElementById("filter-type-l1")?.value;
  const registrationAgency = document.getElementById("filter-agency")?.value;

  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", `${endDate}T23:59:59.999`);
  if (lineName) params.set("lineName", lineName);
  if (registrationAgency) params.set("registrationAgency", registrationAgency);
  if (dashboardAccidentKinds?.length) {
    params.set("accidentKinds", dashboardAccidentKinds.join(","));
  } else if (accidentKindCategory) {
    params.set("accidentKindCategory", accidentKindCategory);
  }

  return params;
}

function hasClientOnlyFilters() {
  // 대시보드 차트 클릭: accidentKinds(L열 정확값)는 서버에서 이미 필터됨
  if (dashboardAccidentKinds?.length) return false;

  return Boolean(document.getElementById("filter-rail-category")?.value);
}

function matchesClientFilters(row) {
  const agency = document.getElementById("filter-agency")?.value;
  const railCategory = document.getElementById("filter-rail-category")?.value;

  if (agency) {
    const reg = row.detail?.registrationAgency?.trim() ?? row.operatingAgency ?? "";
    const variants =
      agency === "서울교통" ? ["서울교통", "서울교통공사"] : agency === "철도공사" ? ["철도공사", "철도공단"] : [agency];
    if (!variants.some((variant) => reg.includes(variant))) return false;
  }
  if (railCategory && row.railCategory !== railCategory) return false;
  return true;
}

function toAccidentExportRow(row) {
  const enriched = enrichRow(row);
  return {
    일련번호: enriched.serialNo,
    발생일시: formatDateTime(row.accidentAt),
    운영기관: enriched.operatingAgency,
    등록기관: enriched.operatingAgency,
    등록상태: enriched.registrationStatus,
    관련기관: enriched.relatedAgency,
    노선: row.lineName,
    "사고/장애구분": enriched.accidentCategory,
    유형: enriched.typeLabel,
    사망건수: row.deaths,
    부상건수: row.injuries,
    "피해액(백만원)": enriched.damageAmount,
    마감설정: enriched.closingSetting,
    첨부파일: enriched.hasAttachment ? "Y" : "N",
    조사상태: enriched.investigationStatus,
    최초등록일자: enriched.registeredAt,
    보완요청: enriched.supplementRequest,
    보완결과: enriched.supplementResult,
    위치: row.location,
    원인: row.cause ?? "",
    피해규모: row.damageScale ?? "",
    열차수: row.trainCount ?? "",
    기상: row.weather ?? "",
  };
}

function normalizeAccidentType(value) {
  const text = String(value ?? "").trim();
  if (!text) return "OTHER";
  if (text.includes("충돌")) return "COLLISION";
  if (text.includes("탈선")) return "DERAILMENT";
  if (text.includes("화재")) return "FIRE";
  if (text.includes("신호")) return "SIGNAL_FAILURE";
  if (text.includes("인적") || text.includes("사상")) return "HUMAN_ERROR";
  if (text.includes("궤도")) return "TRACK_DEFECT";
  return "OTHER";
}

function parseNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseOccurredAt(record) {
  const occurred = String(record.occurredAtText ?? "").trim();
  if (occurred) {
    const parsed = new Date(occurred);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const y = parseNumber(record.year, 2000);
  const m = parseNumber(record.month, 1);
  const d = parseNumber(record.day, 1);
  const h = parseNumber(record.hour, 0);
  const min = parseNumber(record.minute, 0);
  const fallback = new Date(y, Math.max(0, m - 1), d, h, min, 0);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return new Date();
}

function pickExcelField(rawRow, headers) {
  for (const header of headers) {
    const raw = rawRow[header];
    if (raw !== undefined && raw !== "") {
      return String(raw).trim();
    }
  }
  return null;
}

/** 엑셀 CB(80열)·CC(81열) = 발생장소역A/B (0-based index 79, 80) — 헤더 탐색 실패 시 폴백 */
const EXCEL_STATION_A_COL = 79;
const EXCEL_STATION_B_COL = 80;

const GYEONGGI_SCOPE_STATION_NAMES = [
  "하남검단산",
  "하남검단",
  "하남풍산",
  "하남시청",
  "미사",
  "온수",
  "까치울",
  "부천종합운동장",
  "춘의",
  "신중동",
  "부천시청",
  "상동",
];

function findSheetHeaderColumn(sheet, headerNames) {
  const ref = sheet["!ref"];
  if (!ref) return -1;
  const range = XLSX.utils.decode_range(ref);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    const val = String(cell?.v ?? "").trim();
    if (headerNames.includes(val)) return c;
  }
  return -1;
}

function inferStationsFromPlaceText(detail) {
  const blob = [detail.occurrencePlace, detail.stationA, detail.stationB, detail.baseStation]
    .filter(Boolean)
    .join(" ");
  if (!blob) return;

  const sorted = [...GYEONGGI_SCOPE_STATION_NAMES].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (blob.includes(name)) {
      if (!detail.stationA) detail.stationA = name;
      return;
    }
  }

  const place = String(detail.occurrencePlace ?? "").trim();
  if (!place) return;
  const segments = place.split(/[-–—~]/u).map((part) => part.trim()).filter(Boolean);
  if (segments.length >= 1 && !detail.stationA) detail.stationA = segments[0];
  if (segments.length >= 2 && !detail.stationB) detail.stationB = segments[1];
}

function mapExcelRowToBulkPayload(rawRow, positionValues = {}) {
  const detail = {};
  for (const col of ACCIDENT_DB_COLUMNS) {
    const raw = rawRow[col.header];
    detail[col.key] = raw === undefined || raw === "" ? null : raw;
  }

  if (!detail.stationA) {
    detail.stationA =
      pickExcelField(rawRow, ["발생장소역A", "역A", "발생장소 역A", "역 A"]) ?? positionValues.stationA ?? null;
  }
  if (!detail.stationB) {
    detail.stationB =
      pickExcelField(rawRow, ["발생장소역B", "역B", "발생장소 역B", "역 B"]) ?? positionValues.stationB ?? null;
  }
  inferStationsFromPlaceText(detail);

  // 과거 파일 호환: "일련번호" 헤더를 사고번호로 취급
  const serialFromLegacy = rawRow["일련번호"];
  if (!detail.accidentNumber && serialFromLegacy !== undefined && serialFromLegacy !== "") {
    detail.accidentNumber = String(serialFromLegacy).trim();
  }

  const occurredAt = parseOccurredAt(detail);
  const lineName = String(detail.lineName ?? "").trim() || "미상노선";
  const location =
    String(detail.occurrencePlace ?? "").trim() ||
    String(detail.administrativeDistrict ?? "").trim() ||
    "미상";
  const injuries = parseNumber(detail.seriousInjuries, 0) + parseNumber(detail.minorInjuries, 0);

  return {
    base: {
      accidentAt: occurredAt.toISOString(),
      location,
      lineName,
      accidentType: normalizeAccidentType(detail.railwayAccidentKind ?? detail.accidentKind),
      cause: String(detail.accidentCause ?? detail.primaryCause ?? "").trim() || "미상",
      damageScale: String(detail.facilityDamage ?? "").trim() || "미상",
      deaths: parseNumber(detail.deaths, 0),
      injuries,
      trainCount: parseNumber(detail.unitCount, 0) || null,
      weather: String(detail.weatherStatus ?? "").trim() || null,
    },
    detail,
  };
}

async function handleBulkUploadFile(file) {
  if (!file) return;
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
    return;
  }

  const btn = document.getElementById("accidents-bulk-upload-btn");
  const originalLabel = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "업로드 중...";
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      alert("엑셀 시트를 찾을 수 없습니다.");
      return;
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rows.length) {
      alert("업로드할 데이터가 없습니다.");
      return;
    }
    if (rows.length > BULK_MAX_RECORDS) {
      alert(`일괄등록은 최대 ${BULK_MAX_RECORDS.toLocaleString("ko-KR")}건까지 가능합니다.`);
      return;
    }

    const readCell = (rowIndex, colIndex) => {
      if (colIndex < 0) return null;
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })];
      if (cell?.v === undefined || cell?.v === null || cell.v === "") return null;
      return String(cell.v).trim();
    };

    const colStationA = findSheetHeaderColumn(sheet, ["발생장소역A", "역A", "발생장소 역A", "역 A"]);
    const colStationB = findSheetHeaderColumn(sheet, ["발생장소역B", "역B", "발생장소 역B", "역 B"]);

    const records = rows.map((rawRow, index) =>
      mapExcelRowToBulkPayload(rawRow, {
        stationA: readCell(index + 1, colStationA >= 0 ? colStationA : EXCEL_STATION_A_COL),
        stationB: readCell(index + 1, colStationB >= 0 ? colStationB : EXCEL_STATION_B_COL),
      }),
    );

    let created = 0;
    let updated = 0;
    for (let offset = 0; offset < records.length; offset += BULK_CHUNK_SIZE) {
      const chunk = records.slice(offset, offset + BULK_CHUNK_SIZE);
      if (btn) {
        const done = Math.min(offset + chunk.length, records.length);
        btn.textContent = `업로드 중... ${done.toLocaleString("ko-KR")}/${records.length.toLocaleString("ko-KR")}`;
      }
      const result = await apiFetch("/api/accidents/bulk", {
        auth: true,
        method: "POST",
        body: { records: chunk },
      });
      created += result.data?.created ?? 0;
      updated += result.data?.updated ?? 0;
    }

    alert(`일괄등록 완료: 생성 ${created}건, 업데이트 ${updated}건`);
    listState.page = 1;
    await loadAccidentsList();
  } catch (error) {
    console.error(error);
    alert(error.message ?? "일괄등록에 실패했습니다.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

async function fetchAllFilteredAccidents() {
  const allItems = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = buildQueryParams({ page, pageSize: 100 });
    const result = await apiFetch(`/api/accidents?${params.toString()}`, { auth: true });
    let items = result.data?.items ?? [];
    if (hasClientOnlyFilters()) {
      items = items.filter((row) => matchesClientFilters(enrichRow(row)));
    }
    allItems.push(...items);
    totalPages = result.data?.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return allItems;
}

function applyWorksheetColumnWidths(worksheet, rows) {
  if (!rows.length) return;
  worksheet["!cols"] = Object.keys(rows[0]).map((key) => ({
    wch: Math.min(40, Math.max(key.length + 2, ...rows.map((row) => String(row[key] ?? "").length + 2))),
  }));
}

function buildDbColumnWorksheet(exportRows) {
  const headers = ACCIDENT_DB_COLUMNS.map((col) => col.header);
  const body = exportRows.map((row) => headers.map((header) => row[header] ?? ""));
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
  if (body.length) {
    worksheet["!cols"] = headers.map((header, index) => ({
      wch: Math.min(
        40,
        Math.max(header.length + 2, ...body.map((row) => String(row[index] ?? "").length + 2)),
      ),
    }));
  }
  return worksheet;
}

async function downloadXlsx({ buttonId, buildRows, sheetName, filePrefix, emptyMessage, useDbColumns = false }) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 페이지를 새로고침해 주세요.");
    return;
  }

  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "다운로드 중...";

  try {
    const items = await fetchAllFilteredAccidents();
    const rows = buildRows(items);
    if (!rows.length) {
      alert(emptyMessage);
      return;
    }

    const worksheet = useDbColumns ? buildDbColumnWorksheet(rows) : XLSX.utils.json_to_sheet(rows);
    if (!useDbColumns) {
      applyWorksheetColumnWidths(worksheet, rows);
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const stamp = formatDateOnly(new Date()).replace(/-/g, "");
    XLSX.writeFile(workbook, `${filePrefix}_${stamp}.xlsx`);
  } catch (error) {
    console.error(error);
    alert("엑셀 다운로드에 실패했습니다.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function exportAccidentInfoToXlsx() {
  return downloadXlsx({
    buttonId: "accidents-export-accident-btn",
    buildRows: (items) => items.map((row) => rowToDbExport(flattenAccidentRecord(row))),
    sheetName: "사고정보",
    filePrefix: "사고정보",
    emptyMessage: "다운로드할 사고 정보가 없습니다.",
    useDbColumns: true,
  });
}

const ACCIDENT_LIST_COL_COUNT = 11;

function shouldShowAccidentReportDownloadColumn() {
  return typeof getUser === "function" && getUser()?.role !== "ADMIN";
}

function renderInvestigationReportListCell(row, enriched) {
  if (!shouldShowAccidentReportDownloadColumn()) return "";
  const links = enriched.investigationReportLinks ?? [];
  if (!links.length) return "";
  if (typeof buildInvestigationReportDownloadButton !== "function") return "";

  return `<div class="flex flex-wrap items-center justify-center gap-1.5">${links
    .map((link, index) => {
      const labeledLink = {
        ...link,
        title: link.title || `조사보고서 ${index + 1}`,
      };
      return buildInvestigationReportDownloadButton(row.id, labeledLink, { compact: true });
    })
    .join("")}</div>`;
}

function applyAccidentReportColumnVisibility() {
  const showColumn = shouldShowAccidentReportDownloadColumn();
  document.getElementById("accidents-col-report-header")?.classList.toggle("hidden", !showColumn);
  document.querySelectorAll(".accidents-col-report").forEach((cell) => {
    cell.classList.toggle("hidden", !showColumn);
  });
}

function renderAccidents(items) {
  const tbody = document.getElementById("accidents-table-body");
  if (!items.length) {
    tbody.innerHTML =
      `<tr><td colspan="${ACCIDENT_LIST_COL_COUNT}" class="px-4 py-8 text-center text-sm text-gray-500">조회 결과가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((row) => {
      const enriched = enrichRow(row);
      const reportCell = renderInvestigationReportListCell(row, enriched);
      return `
    <tr class="hover:bg-blue-50/40">
      <td class="border-r border-gray-200 px-1 py-1.5">
        <input type="checkbox" class="accident-row-check rounded border-gray-400" data-id="${row.id}" />
      </td>
      <td class="whitespace-nowrap border-r border-gray-200 px-2 py-1.5 text-left">${enriched.serialNo}</td>
      <td class="whitespace-nowrap border-r border-gray-200 px-2 py-1.5">${formatDateOnly(row.accidentAt)}</td>
      <td class="whitespace-nowrap border-r border-gray-200 px-2 py-1.5">${enriched.operatingAgency}</td>
      <td class="whitespace-nowrap border-r border-gray-200 px-2 py-1.5">${row.lineName ?? "-"}</td>
      <td class="border-r border-gray-200 px-2 py-1.5">${enriched.accidentCategory}</td>
      <td class="accidents-col-casualty border-r border-gray-200 px-2 py-1.5">${row.deaths ?? 0}</td>
      <td class="accidents-col-casualty border-r border-gray-200 px-2 py-1.5">${enriched.seriousInjuries}</td>
      <td class="border-r border-gray-200 px-2 py-1.5 text-right">${enriched.damageAmount}</td>
      <td class="accidents-col-report border-r border-gray-200 px-2 py-1.5">${reportCell}</td>
      <td class="px-2 py-1.5">
        <button type="button" class="rounded border border-gray-400 bg-white px-2 py-0.5 text-[11px] hover:bg-gray-50 accident-detail-btn" data-id="${row.id}">보기</button>
      </td>
    </tr>
  `;
    })
    .join("");

  applyAccidentReportColumnVisibility();
  if (typeof bindInvestigationReportDownloadButtons === "function") {
    bindInvestigationReportDownloadButtons(tbody);
  }
}

function getSelectedAccidentIds() {
  return Array.from(document.querySelectorAll(".accident-row-check:checked"))
    .map((el) => Number(el.dataset.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function deleteSelectedAccidents() {
  const selectedIds = getSelectedAccidentIds();
  if (!selectedIds.length) {
    alert("삭제할 데이터를 먼저 선택해 주세요.");
    return;
  }

  const confirmed = window.confirm(`선택한 ${selectedIds.length}건을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);
  if (!confirmed) return;

  const btn = document.getElementById("accidents-delete-selected-btn");
  const originalLabel = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "삭제 중...";
  }

  try {
    const result = await apiFetch("/api/accidents", {
      auth: true,
      method: "DELETE",
      body: { ids: selectedIds },
    });
    const deleted = result.data?.deleted ?? 0;
    alert(`${deleted}건 삭제되었습니다.`);
    listState.page = 1;
    await loadAccidentsList();
    const checkAll = document.getElementById("accidents-check-all");
    if (checkAll) checkAll.checked = false;
  } catch (error) {
    console.error(error);
    alert(error.message ?? "삭제에 실패했습니다.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

function updatePaginationUI() {
  document.getElementById("accidents-total").textContent = String(listState.total);
  document.getElementById("accidents-current-page").textContent = String(listState.page);
  document.getElementById("accidents-total-pages").textContent = String(listState.totalPages);

  const numbers = document.getElementById("accidents-page-numbers");
  if (!numbers) return;
  numbers.innerHTML = "";

  const maxButtons = 5;
  let start = Math.max(1, listState.page - Math.floor(maxButtons / 2));
  let end = Math.min(listState.totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  for (let page = start; page <= end; page += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(page);
    btn.className =
      page === listState.page
        ? "min-w-[28px] border border-navy-800 bg-navy-800 px-2 py-0.5 text-xs text-white"
        : "min-w-[28px] border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50";
    btn.addEventListener("click", () => {
      listState.page = page;
      loadAccidentsList();
    });
    numbers.appendChild(btn);
  }
}

function renderStatsSummary(items) {
  const container = document.getElementById("accidents-summary");
  const byLine = new Map();
  const byType = new Map();

  for (const item of items) {
    byLine.set(item.lineName, (byLine.get(item.lineName) ?? 0) + 1);
    byType.set(item.accidentType, (byType.get(item.accidentType) ?? 0) + 1);
  }

  const lineRows = Array.from(byLine.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `<li class="flex justify-between text-sm"><span>${name}</span><span>${count}건</span></li>`)
    .join("");

  const typeRows = Array.from(byType.entries())
    .map(([type, count]) => {
      const label = ACCIDENT_TYPE_LABELS[type] ?? type;
      return `<li class="flex justify-between text-sm"><span>${label}</span><span>${count}건</span></li>`;
    })
    .join("");

  container.innerHTML = `
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded border border-gray-200 p-4">
        <h3 class="mb-2 font-bold text-gray-900">노선별 건수</h3>
        <ul class="space-y-1">${lineRows || "<li class='text-sm text-gray-500'>데이터 없음</li>"}</ul>
      </div>
      <div class="rounded border border-gray-200 p-4">
        <h3 class="mb-2 font-bold text-gray-900">유형별 건수</h3>
        <ul class="space-y-1">${typeRows || "<li class='text-sm text-gray-500'>데이터 없음</li>"}</ul>
      </div>
    </div>
  `;
}

function renderCauseSummary(items) {
  const container = document.getElementById("accidents-summary");
  const causeMap = new Map();

  for (const item of items) {
    const key = item.cause?.trim() || "미상";
    causeMap.set(key, (causeMap.get(key) ?? 0) + 1);
  }

  const rows = Array.from(causeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => `<li class="flex justify-between gap-4 text-sm"><span>${cause}</span><span>${count}건</span></li>`)
    .join("");

  container.innerHTML = `
    <div class="rounded border border-gray-200 p-4">
      <h3 class="mb-2 font-bold text-gray-900">사고 원인별 건수</h3>
      <ul class="space-y-1">${rows || "<li class='text-sm text-gray-500'>데이터 없음</li>"}</ul>
    </div>
  `;
}

function showAccidentsListError(message) {
  const tbody = document.getElementById("accidents-table-body");
  if (!tbody) return;
  const detail = message ? `: ${message}` : "";
  tbody.innerHTML =
    `<tr><td colspan="${ACCIDENT_LIST_COL_COUNT}" class="px-4 py-6 text-center text-sm text-red-600">데이터를 불러오지 못했습니다${detail}</td></tr>`;
}

async function loadAccidentsList() {
  const tbody = document.getElementById("accidents-table-body");
  if (!tbody) return;

  tbody.innerHTML =
    `<tr><td colspan="${ACCIDENT_LIST_COL_COUNT}" class="px-4 py-8 text-center text-sm text-gray-500">불러오는 중...</td></tr>`;

  const params = buildQueryParams();
  const clientFilters = hasClientOnlyFilters();

  if (clientFilters) {
    params.set("page", "1");
    params.set("pageSize", "100");
  }

  let result;
  try {
    result = await apiFetch(`/api/accidents?${params.toString()}`, { auth: true });
  } catch (error) {
    console.error(error);
    showAccidentsListError(error.message);
    return;
  }
  let items = result.data?.items ?? [];
  if (clientFilters) {
    items = items.filter((row) => matchesClientFilters(enrichRow(row)));
  }

  if (clientFilters) {
    listState.total = items.length;
    listState.totalPages = Math.max(1, Math.ceil(items.length / listState.pageSize));
    if (listState.page > listState.totalPages) listState.page = listState.totalPages;
    const start = (listState.page - 1) * listState.pageSize;
    items = items.slice(start, start + listState.pageSize);
  } else {
    const pagination = result.data?.pagination;
    if (pagination) {
      listState.total = pagination.total;
      listState.totalPages = Math.max(1, pagination.totalPages);
      listState.page = pagination.page;
    } else {
      listState.total = items.length;
      listState.totalPages = 1;
    }
  }

  renderAccidents(items);
  updatePaginationUI();
}

function applyAccidentsAdminControls() {
  const isAdmin = getUser()?.role === "ADMIN";
  const deleteBtn = document.getElementById("accidents-delete-selected-btn");
  const bulkUploadBtn = document.getElementById("accidents-bulk-upload-btn");
  if (deleteBtn) {
    deleteBtn.classList.toggle("hidden", !isAdmin);
  }
  if (bulkUploadBtn) {
    bulkUploadBtn.classList.toggle("hidden", !isAdmin);
  }
}

function bindListEvents() {
  const form = document.getElementById("accidents-search-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    dashboardAccidentKinds = null;
    listState.page = 1;
    loadAccidentsList();
  });

  document.getElementById("accidents-page-size")?.addEventListener("change", (event) => {
    listState.pageSize = Number(event.target.value) || 15;
    listState.page = 1;
    loadAccidentsList();
  });

  document.getElementById("accidents-export-accident-btn")?.addEventListener("click", () => {
    exportAccidentInfoToXlsx();
  });

  document.getElementById("accidents-bulk-upload-btn")?.addEventListener("click", () => {
    document.getElementById("accidents-bulk-file-input")?.click();
  });

  document.getElementById("accidents-bulk-file-input")?.addEventListener("change", async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    await handleBulkUploadFile(file);
    input.value = "";
  });

  document.getElementById("accidents-page-first")?.addEventListener("click", () => {
    listState.page = 1;
    loadAccidentsList();
  });
  document.getElementById("accidents-page-prev")?.addEventListener("click", () => {
    if (listState.page > 1) {
      listState.page -= 1;
      loadAccidentsList();
    }
  });
  document.getElementById("accidents-page-next")?.addEventListener("click", () => {
    if (listState.page < listState.totalPages) {
      listState.page += 1;
      loadAccidentsList();
    }
  });
  document.getElementById("accidents-page-last")?.addEventListener("click", () => {
    listState.page = listState.totalPages;
    loadAccidentsList();
  });

  document.getElementById("accidents-delete-selected-btn")?.addEventListener("click", () => {
    deleteSelectedAccidents();
  });

  document.getElementById("accidents-check-all")?.addEventListener("change", (event) => {
    const checked = event.target.checked;
    document.querySelectorAll(".accident-row-check").forEach((el) => {
      el.checked = checked;
    });
  });

  document.getElementById("accidents-table-body")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".accident-detail-btn");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    window.location.href = `/accidents/detail?id=${encodeURIComponent(id)}`;
  });
}

async function loadAccidentsPage() {
  const mode = getPageMode();
  const titleEl = document.getElementById("accidents-page-title");
  const descEl = document.getElementById("accidents-page-desc");
  const summaryWrap = document.getElementById("accidents-summary-wrap");
  const listWrap = document.getElementById("accidents-list-wrap");

  if (mode === "stats") {
    titleEl.textContent = "사고 통계";
    descEl.textContent = "권한 범위 내 사고 데이터의 노선·유형별 집계입니다.";
    descEl.classList.remove("hidden");
    summaryWrap.classList.remove("hidden");
    listWrap.classList.add("hidden");
  } else if (mode === "causes") {
    titleEl.textContent = "사고 원인 분석";
    descEl.textContent = "권한 범위 내 사고 원인별 건수를 확인합니다.";
    descEl.classList.remove("hidden");
    summaryWrap.classList.remove("hidden");
    listWrap.classList.add("hidden");
  } else {
    titleEl.textContent = "사고 등록/조회";
    descEl.classList.add("hidden");
    summaryWrap.classList.add("hidden");
    listWrap.classList.remove("hidden");
    applyAccidentsAdminControls();
    initDefaultDates();
    applyFiltersFromDashboardUrl();
    await populateSearchFilters();
    bindListEvents();
    await loadAccidentsList();
    return;
  }

  const result = await apiFetch("/api/accidents?page=1&pageSize=50", { auth: true });
  const items = result.data?.items ?? [];

  if (mode === "stats") {
    renderStatsSummary(items);
  } else if (mode === "causes") {
    renderCauseSummary(items);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!requireAuth()) return;
  applyAccidentReportColumnVisibility();
  bindPortalHeader();
  await loadPortalMenus();
  try {
    await loadPortalBranding();
  } catch (error) {
    console.error("브랜딩 정보를 불러오지 못했습니다.", error);
  }
  try {
    await loadAccidentsPage();
  } catch (error) {
    console.error(error);
    showAccidentsListError(error.message);
  }
});
