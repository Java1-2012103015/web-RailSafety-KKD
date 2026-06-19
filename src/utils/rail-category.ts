export function inferRailCategoryFromLineName(lineName: string | null | undefined): string {
  const line = lineName?.trim() ?? "";
  if (line.includes("고속")) return "고속";
  if (line.includes("호선") || line.includes("도시")) return "도시철도";
  return "일반";
}

export function resolveRailCategory(
  railwayDivision: string | null | undefined,
  lineName: string | null | undefined,
): string {
  const fromDetail = railwayDivision?.trim();
  if (fromDetail) return fromDetail;
  return inferRailCategoryFromLineName(lineName);
}
