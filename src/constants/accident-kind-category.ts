import type { Prisma } from "@prisma/client";

export const ACCIDENT_KIND_CATEGORIES = ["사고", "준사고", "운행장애", "운행장애(관리)"] as const;

export type AccidentKindCategory = (typeof ACCIDENT_KIND_CATEGORIES)[number];

const EXACT_KINDS_BY_CATEGORY: Record<AccidentKindCategory, string[]> = {
  사고: ["사고"],
  준사고: ["준사고"],
  운행장애: ["장애(지연)", "장애(무정차)", "장애(위험)"],
  "운행장애(관리)": ["관리사고", "장애(관리(기준 미만))", "장애(관리(외부))"],
};

const LEGACY_TYPE_TO_CATEGORY: Record<string, AccidentKindCategory> = {
  COLLISION: "사고",
  DERAILMENT: "사고",
  FIRE: "사고",
  HUMAN_ERROR: "준사고",
  OTHER: "준사고",
  SIGNAL_FAILURE: "운행장애",
  TRACK_DEFECT: "운행장애(관리)",
};

export function normalizeAccidentKindCategories(raw: unknown): AccidentKindCategory[] {
  if (!Array.isArray(raw)) return [];

  const result = new Set<AccidentKindCategory>();
  for (const item of raw) {
    const value = String(item ?? "").trim();
    if (!value) continue;

    if ((ACCIDENT_KIND_CATEGORIES as readonly string[]).includes(value)) {
      result.add(value as AccidentKindCategory);
      continue;
    }

    const legacy = LEGACY_TYPE_TO_CATEGORY[value];
    if (legacy) result.add(legacy);
  }

  return Array.from(result);
}

export function classifyAccidentKind(accidentKind: string | null | undefined): AccidentKindCategory | null {
  const kind = (accidentKind ?? "").trim();
  if (!kind) return null;

  for (const category of ACCIDENT_KIND_CATEGORIES) {
    if (EXACT_KINDS_BY_CATEGORY[category].includes(kind)) {
      return category;
    }
  }

  if (kind === "관리사고" || kind.includes("장애(관리")) return "운행장애(관리)";
  if (kind.startsWith("장애(")) return "운행장애";
  if (kind === "준사고") return "준사고";
  if (kind === "사고") return "사고";

  return null;
}

export function isDisruptionCategory(category: AccidentKindCategory | null): boolean {
  return category === "운행장애" || category === "운행장애(관리)";
}

export function isRailwayAccidentCategory(category: AccidentKindCategory | null): boolean {
  return category === "사고" || category === "준사고";
}

export function rowMatchesAccidentKindCategories(
  accidentKind: string | null | undefined,
  categories: AccidentKindCategory[],
): boolean {
  if (!categories.length) return true;
  const category = classifyAccidentKind(accidentKind);
  return category !== null && categories.includes(category);
}

export function buildAccidentKindCategoryWhere(
  categories: AccidentKindCategory[],
): Prisma.RailwayAccidentWhereInput | undefined {
  if (!categories.length) return undefined;

  const detailOr: Prisma.AccidentDetailWhereInput[] = [];

  for (const category of categories) {
    for (const kind of EXACT_KINDS_BY_CATEGORY[category]) {
      detailOr.push({ accidentKind: kind });
    }

    if (category === "운행장애") {
      detailOr.push({
        AND: [
          { accidentKind: { startsWith: "장애(" } },
          { NOT: { accidentKind: { startsWith: "장애(관리" } } },
        ],
      });
    }

    if (category === "운행장애(관리)") {
      detailOr.push({ accidentKind: { startsWith: "장애(관리" } });
    }
  }

  return {
    detail: {
      OR: detailOr,
    },
  };
}
