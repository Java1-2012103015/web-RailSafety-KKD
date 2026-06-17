const KST_OFFSET = "+09:00";

/** YYYY-MM-DD 또는 ISO 문자열을 KST 기준 조회용 Date로 변환 */
export function parseQueryStartDate(value: string): Date {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000${KST_OFFSET}`);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    return new Date(`${trimmed}${KST_OFFSET}`);
  }
  return new Date(trimmed);
}

export function parseQueryEndDate(value: string): Date {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59.999${KST_OFFSET}`);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    return new Date(`${trimmed}${KST_OFFSET}`);
  }
  return new Date(trimmed);
}
