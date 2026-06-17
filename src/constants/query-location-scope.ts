import type { Prisma } from "@prisma/client";

export type LocationScopeRule = {
  institutionName: string;
  stationNames?: string[] | null;
};

export const GYEONGGI_ROLE_NAME = "경기도";

/** 경기도 역할 기본 조회 노선 — DB lineName과 정확히 일치해야 함 */
export const GYEONGGI_DEFAULT_ALLOWED_LINE_NAMES = [
  "김포골드라인",
  "수도권 전철5호선",
  "수도권 전철7호선",
  "의정부경전철선",
  "용인에버라인",
] as const;

export const GYEONGGI_DEFAULT_LOCATION_SCOPE: LocationScopeRule[] = [
  { institutionName: "김포골드" },
  { institutionName: "용인" },
  { institutionName: "의정부" },
  { institutionName: "구리도시공사" },
  {
    institutionName: "서울교통공사",
    stationNames: [
      "미사",
      "하남풍산",
      "하남시청",
      "하남검단산",
      "온수",
      "까치울",
      "부천종합운동장",
      "춘의",
      "신중동",
      "부천시청",
      "상동",
    ],
  },
];

export const GYEONGGI_QUERY_TREE = [
  { code: "GIMPO_GOLD", name: "김포골드", lines: [] },
  { code: "YONGIN", name: "용인", lines: [] },
  { code: "UIJEONGBU", name: "의정부", lines: [] },
  { code: "GURI", name: "구리도시공사", lines: [] },
  {
    code: "SEOUL_METRO",
    name: "서울교통공사",
    lines: [
      {
        code: "LINE5",
        name: "수도권 전철5호선",
        stations: [
          { code: "MISA", name: "미사" },
          { code: "HANAM_PUNGSAN", name: "하남풍산" },
          { code: "HANAM_CITY_HALL", name: "하남시청" },
          { code: "HANAM_GEOMDANSAN", name: "하남검단산" },
        ],
      },
      {
        code: "LINE7",
        name: "수도권 전철7호선",
        stations: [
          { code: "ONSU", name: "온수" },
          { code: "KACHIUL", name: "까치울" },
          { code: "BUCHEON_SPORTS", name: "부천종합운동장" },
          { code: "CHUNUI", name: "춘의" },
          { code: "SINJUNG_DONG", name: "신중동" },
          { code: "BUCHEON_CITY_HALL", name: "부천시청" },
          { code: "SANG_DONG", name: "상동" },
        ],
      },
    ],
  },
];

const INSTITUTION_ALIASES: Record<string, string[]> = {
  김포골드: ["김포골드"],
  용인: ["용인"],
  의정부: ["의정부"],
  구리도시공사: ["구리도시공사", "구리도시", "구리"],
  서울교통공사: ["서울교통공사", "서울교통"],
  서울교통: ["서울교통", "서울교통공사"],
};

/** 엑셀/DB에서 쓰이는 역명 변형 (CB·CC 역 컬럼) */
const STATION_NAME_ALIASES: Record<string, string[]> = {
  하남검단산: ["하남검단산", "하남검단"],
  하남검단: ["하남검단", "하남검단산"],
  미사: ["미사", "미사역"],
  하남풍산: ["하남풍산", "하남풍산역"],
  하남시청: ["하남시청", "하남시청역"],
  온수: ["온수", "온수역"],
  까치울: ["까치울", "까치울역"],
  부천종합운동장: ["부천종합운동장", "부천종합운동장역"],
  춘의: ["춘의", "춘의역"],
  신중동: ["신중동", "신중동역"],
  부천시청: ["부천시청", "부천시청역"],
  상동: ["상동", "상동역"],
};

function normalizeStationLabel(value: string): string {
  return value.trim().replace(/\s+/g, "").replace(/역$/u, "");
}

function expandStationSearchTerms(stationName: string): string[] {
  const base = stationName.trim();
  if (!base) return [];

  const terms = new Set<string>([base]);
  const aliases = STATION_NAME_ALIASES[base] ?? [];
  for (const alias of aliases) {
    terms.add(alias);
    terms.add(alias.replace(/역$/u, ""));
  }
  terms.add(base.replace(/역$/u, ""));
  return [...terms].filter(Boolean);
}

function collectStationTokens(row: LocationScopeRow): string[] {
  const detail = row.detail;
  const tokens = new Set<string>();
  const fields = [
    row.location,
    detail?.stationA,
    detail?.stationB,
    detail?.baseStation,
    detail?.occurrencePlace,
  ];

  for (const field of fields) {
    const text = (field ?? "").trim();
    if (!text) continue;

    tokens.add(text);
    tokens.add(normalizeStationLabel(text));

    for (const segment of text.split(/[-–—~\/\s]+/u)) {
      const part = segment.trim();
      if (!part) continue;
      tokens.add(part);
      tokens.add(normalizeStationLabel(part));
    }
  }

  return [...tokens];
}

export function normalizeLocationScope(raw: unknown): LocationScopeRule[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const institutionName = String((item as LocationScopeRule).institutionName ?? "").trim();
      if (!institutionName) return null;

      const stationNamesRaw = (item as LocationScopeRule).stationNames;
      const stationNames = Array.isArray(stationNamesRaw)
        ? stationNamesRaw.map((station) => String(station).trim()).filter(Boolean)
        : null;

      if (stationNames?.length) {
        return { institutionName, stationNames };
      }
      return { institutionName };
    })
    .filter((item): item is LocationScopeRule => item !== null);
}

function institutionDetailMatch(institutionName: string): Prisma.AccidentDetailWhereInput {
  const variants = INSTITUTION_ALIASES[institutionName] ?? [institutionName];
  return {
    OR: variants.map((variant) => ({
      registrationAgency: { contains: variant },
    })),
  };
}

function stationDetailMatch(stationName: string): Prisma.AccidentDetailWhereInput {
  const terms = expandStationSearchTerms(stationName);
  const conditions: Prisma.AccidentDetailWhereInput[] = [];

  for (const term of terms) {
    const normalized = normalizeStationLabel(term);
    conditions.push(
      { stationA: term },
      { stationB: term },
      { baseStation: term },
      { stationA: { contains: term } },
      { stationB: { contains: term } },
      { baseStation: { contains: term } },
      { occurrencePlace: { contains: term } },
    );
    if (normalized !== term) {
      conditions.push(
        { stationA: { contains: normalized } },
        { stationB: { contains: normalized } },
        { occurrencePlace: { contains: normalized } },
      );
    }
  }

  return { OR: conditions };
}

function stationAccidentMatch(stationName: string): Prisma.RailwayAccidentWhereInput {
  const terms = expandStationSearchTerms(stationName);
  const locationOr: Prisma.RailwayAccidentWhereInput[] = terms.map((term) => ({
    location: { contains: term },
  }));

  return {
    OR: [{ detail: stationDetailMatch(stationName) }, ...locationOr],
  };
}

type LocationScopeRow = {
  location?: string | null;
  detail?: {
    registrationAgency?: string | null;
    stationA?: string | null;
    stationB?: string | null;
    baseStation?: string | null;
    occurrencePlace?: string | null;
  } | null;
};

function agencyMatchesInstitution(agency: string, institutionName: string): boolean {
  const variants = INSTITUTION_ALIASES[institutionName] ?? [institutionName];
  return variants.some((variant) => agency.includes(variant));
}

function detailMatchesStation(row: LocationScopeRow, stationName: string): boolean {
  const searchTerms = expandStationSearchTerms(stationName).map(normalizeStationLabel);
  const tokens = collectStationTokens(row).map(normalizeStationLabel);

  return searchTerms.some((term) => tokens.some((token) => token === term));
}

export function rowMatchesLocationScope(row: LocationScopeRow, rules: LocationScopeRule[]): boolean {
  if (!rules.length) return true;

  const agency = row.detail?.registrationAgency?.trim() ?? "";
  if (!agency) return false;

  return rules.some((rule) => {
    if (!agencyMatchesInstitution(agency, rule.institutionName)) return false;
    if (!rule.stationNames?.length) return true;
    if (!row.detail) return false;
    return rule.stationNames.some((stationName) => detailMatchesStation(row, stationName));
  });
}

export function buildRegistrationAgencyWhere(agency: string): Prisma.RailwayAccidentWhereInput | undefined {
  const trimmed = agency.trim();
  if (!trimmed) return undefined;

  const variants = INSTITUTION_ALIASES[trimmed] ?? [trimmed];
  return {
    OR: variants.map((variant) => ({
      detail: { registrationAgency: { contains: variant } },
    })),
  };
}

export function registrationAgencyMatchesFilter(
  registrationAgency: string | null | undefined,
  filterAgency: string,
): boolean {
  const agency = (registrationAgency ?? "").trim();
  if (!agency) return false;

  const variants = INSTITUTION_ALIASES[filterAgency] ?? [filterAgency];
  return variants.some((variant) => agency.includes(variant));
}

export function buildLocationScopeWhere(rules: LocationScopeRule[]): Prisma.RailwayAccidentWhereInput | undefined {
  if (!rules.length) return undefined;

  return {
    OR: rules.map((rule) => {
      if (!rule.stationNames?.length) {
        return { detail: institutionDetailMatch(rule.institutionName) };
      }

      return {
        AND: [
          { detail: institutionDetailMatch(rule.institutionName) },
          {
            OR: rule.stationNames.map((stationName) => stationAccidentMatch(stationName)),
          },
        ],
      };
    }),
  };
}
