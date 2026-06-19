import type { RoleQueryPermission } from "@prisma/client";
import { ROLES } from "../constants/roles";
import { normalizeLocationScope } from "../constants/query-location-scope";

export type QueryScopeInstitutionSummary = {
  institutionName: string;
  scopeType: "all" | "stations";
  stationNames: string[];
};

export type QueryScopeSummary = {
  roleName: string;
  institutions: QueryScopeInstitutionSummary[];
  allowedLineNames: string[];
  allowedTypes: string[];
  dateRange: { min: string | null; max: string | null };
  enforcedLineName: string | null;
};

function formatDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function readStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function buildQueryScopeSummary(
  role: string,
  queryPermission: RoleQueryPermission | null,
): QueryScopeSummary | null {
  if (role === ROLES.ADMIN || !queryPermission) return null;

  const locationScope = normalizeLocationScope(queryPermission.allowedLocationScope);
  const allowedLineNames = readStringArray(queryPermission.allowedLineNames);
  const allowedTypes = readStringArray(queryPermission.allowedTypes);
  const enforcedLineName = queryPermission.enforcedLineName?.trim() || null;

  const institutions: QueryScopeInstitutionSummary[] = locationScope.map((rule) => ({
    institutionName: rule.institutionName,
    scopeType: rule.stationNames?.length ? "stations" : "all",
    stationNames: rule.stationNames ?? [],
  }));

  const hasScope =
    institutions.length > 0 ||
    allowedLineNames.length > 0 ||
    Boolean(enforcedLineName) ||
    allowedTypes.length > 0 ||
    queryPermission.minAccidentAt ||
    queryPermission.maxAccidentAt;

  if (!hasScope) return null;

  return {
    roleName: role,
    institutions,
    allowedLineNames,
    allowedTypes,
    dateRange: {
      min: formatDateOnly(queryPermission.minAccidentAt),
      max: formatDateOnly(queryPermission.maxAccidentAt),
    },
    enforcedLineName,
  };
}
