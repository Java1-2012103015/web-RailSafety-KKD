const GYEONGGI_ROLE_NAME = "경기도";

const GYEONGGI_DEFAULT_ALLOWED_LINE_NAMES = [
  "김포골드라인",
  "수도권 전철5호선",
  "수도권 전철7호선",
  "의정부경전철선",
  "용인에버라인",
];

const GYEONGGI_DEFAULT_LOCATION_SCOPE = [
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

const GYEONGGI_QUERY_TREE = [
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

/** 저장 scope ↔ UI 트리 매칭용 (과거 DB/동기화 명칭 호환) */
const INSTITUTION_SCOPE_ALIASES = {
  서울교통공사: ["서울교통공사", "서울교통"],
  서울교통: ["서울교통", "서울교통공사"],
  김포골드: ["김포골드"],
  용인: ["용인"],
  의정부: ["의정부"],
  구리도시공사: ["구리도시공사", "구리도시", "구리"],
};

const STATION_SCOPE_ALIASES = {
  하남검단산: ["하남검단산", "하남검단"],
  하남검단: ["하남검단", "하남검단산"],
};

const LINE_SCOPE_ALIASES = {
  "수도권 전철5호선": ["수도권 전철5호선", "수도권도시철도 5호선", "5호선"],
  "수도권 전철7호선": ["수도권 전철7호선", "수도권도시철도 7호선", "7호선"],
  "5호선": ["5호선", "수도권 전철5호선", "수도권도시철도 5호선"],
  "7호선": ["7호선", "수도권 전철7호선", "수도권도시철도 7호선"],
  김포골드라인: ["김포골드라인"],
  의정부경전철선: ["의정부경전철선"],
  용인에버라인: ["용인에버라인"],
};

function expandScopeAliases(name, aliasMap) {
  const base = String(name ?? "").trim();
  if (!base) return [];
  const variants = aliasMap[base] ?? [base];
  return [...new Set(variants)];
}

function normalizeLocationScope(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const institutionName = String(item.institutionName ?? "").trim();
      if (!institutionName) return null;
      const stationNames = Array.isArray(item.stationNames)
        ? item.stationNames.map((station) => String(station).trim()).filter(Boolean)
        : null;
      if (stationNames?.length) {
        return { institutionName, stationNames };
      }
      return { institutionName };
    })
    .filter(Boolean);
}

function getDefaultLocationScopeForRole(roleName) {
  if (roleName === GYEONGGI_ROLE_NAME) {
    return GYEONGGI_DEFAULT_LOCATION_SCOPE.map((rule) => ({ ...rule, stationNames: rule.stationNames ? [...rule.stationNames] : undefined }));
  }
  return [];
}

function normalizeInstitutionNode(inst) {
  return {
    code: inst.code,
    name: inst.name,
    lines: (inst.lines ?? []).map((line) => ({
      code: line.code,
      name: line.name,
      stations: (line.stations ?? []).map((station) => ({
        code: station.code,
        name: station.name,
      })),
    })),
  };
}

function normalizeLineNode(line) {
  return {
    code: line.code,
    name: line.name,
    stations: (line.stations ?? []).map((station) => ({
      code: station.code,
      name: station.name,
    })),
  };
}

/** DB 노선 전체 유지 + 경기도 고정 노선(명칭·역)만 덮어씀 */
function mergeLines(dbLines, canonicalLines) {
  if (!canonicalLines?.length) {
    return dbLines.map((line) => normalizeLineNode(line));
  }

  const merged = dbLines.map((line) => normalizeLineNode(line));

  for (const canonical of canonicalLines) {
    const normalized = normalizeLineNode(canonical);
    let targetIdx = merged.findIndex((line) => line.code === canonical.code);

    if (targetIdx < 0) {
      const canonicalAliases = expandScopeAliases(canonical.name, LINE_SCOPE_ALIASES);
      targetIdx = merged.findIndex((line) => {
        const lineAliases = expandScopeAliases(line.name, LINE_SCOPE_ALIASES);
        return lineAliases.some((alias) => canonicalAliases.includes(alias));
      });
    }

    if (targetIdx >= 0) {
      merged[targetIdx] = {
        ...merged[targetIdx],
        name: canonical.name,
        stations:
          normalized.stations.length > 0
            ? normalized.stations
            : merged[targetIdx].stations,
      };
    } else {
      merged.push(normalized);
    }
  }

  return merged;
}

/** 전체 DB 트리에 경기도 고정 기관(명칭·노선·역)만 덮어씀 — 나머지 기관은 그대로 표시 */
function mergeGyeonggiCanonicalIntoTree(codeTree) {
  const byCode = new Map(
    codeTree.map((inst) => [inst.code, normalizeInstitutionNode(inst)]),
  );

  for (const canonical of GYEONGGI_QUERY_TREE) {
    const existing = byCode.get(canonical.code);
    if (existing) {
      byCode.set(canonical.code, {
        ...existing,
        name: canonical.name,
        lines: mergeLines(existing.lines, canonical.lines),
      });
    } else {
      byCode.set(canonical.code, normalizeInstitutionNode(canonical));
    }
  }

  return [...byCode.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "ko"),
  );
}

function getQueryLocationTreeForRole(roleName, codeTree) {
  if (Array.isArray(codeTree) && codeTree.length > 0) {
    if (roleName === GYEONGGI_ROLE_NAME) {
      return mergeGyeonggiCanonicalIntoTree(codeTree);
    }
    return codeTree;
  }
  if (roleName === GYEONGGI_ROLE_NAME) {
    return GYEONGGI_QUERY_TREE;
  }
  return [];
}
