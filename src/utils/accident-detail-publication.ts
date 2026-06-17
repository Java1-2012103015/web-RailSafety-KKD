import {
  ACCIDENT_DETAIL_COLUMN_GROUPS,
  ALL_ACCIDENT_DETAIL_COLUMN_KEYS,
  getApprovedGroupTitles,
} from "../constants/accident-detail-column-groups";

export function normalizeVisibleColumnKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return keys.filter((key): key is string => typeof key === "string" && key.length > 0);
}

export function resolveVisibleColumnKeys(stored: string[] | null | undefined): string[] {
  const normalized = normalizeVisibleColumnKeys(stored);
  if (normalized.length > 0) return normalized;
  return [...ALL_ACCIDENT_DETAIL_COLUMN_KEYS];
}

export function buildPublicationCatalog() {
  return {
    groups: ACCIDENT_DETAIL_COLUMN_GROUPS,
    allColumnKeys: ALL_ACCIDENT_DETAIL_COLUMN_KEYS,
  };
}

export function buildPublicationMeta(visibleColumnKeys: string[]) {
  const set = new Set(visibleColumnKeys);
  return {
    visibleColumnKeys,
    approvedGroupTitles: getApprovedGroupTitles(set),
    groups: ACCIDENT_DETAIL_COLUMN_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      keys: [...group.keys],
      visibleCount: group.keys.filter((key) => set.has(key)).length,
      totalCount: group.keys.length,
    })),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 사고 레코드에서 비공개 컬럼 값 제거 */
export function filterAccidentRecordByVisibleColumns<T extends Record<string, unknown>>(
  record: T,
  visibleKeys: Set<string>,
): T {
  const out: Record<string, unknown> = { ...record };

  for (const key of Object.keys(out)) {
    if (key === "detail") continue;
    if (!visibleKeys.has(key)) {
      out[key] = null;
    }
  }

  if (isPlainObject(out.detail)) {
    const detail: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(out.detail)) {
      if (key === "id" || key === "accidentId" || visibleKeys.has(key)) {
        detail[key] = value;
      }
    }
    out.detail = detail;
  }

  return out as T;
}
