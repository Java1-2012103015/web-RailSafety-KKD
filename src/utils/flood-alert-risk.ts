export type FloodRiskLevel = "green" | "amber" | "orange" | "red";

export type FloodRiskConfidenceLevel = "high" | "medium" | "low" | "estimated";

export type RainfallWindowKey = "15m" | "30m" | "60m" | "360m";

interface RainfallWindowSpec {
  key: RainfallWindowKey;
  label: string;
  shortLabel: string;
  weight: number;
}

const RAINFALL_WINDOWS: RainfallWindowSpec[] = [
  { key: "15m", label: "15분 집중호우", shortLabel: "15분", weight: 0.2 },
  { key: "30m", label: "30분 집중호우", shortLabel: "30분", weight: 0.35 },
  { key: "60m", label: "60분 누적", shortLabel: "60분", weight: 0.3 },
  { key: "360m", label: "6시간 누적", shortLabel: "360분", weight: 0.15 },
];

const DRAINAGE_VULNERABILITY_PATTERN = /상습|배수|저지대|취약|우려개소|침수이력/;

export function calculateFloodRiskScore(
  currentRainfallMm: number | null,
  historicalRainfallMm: number | null,
): number {
  if (currentRainfallMm == null || historicalRainfallMm == null || historicalRainfallMm <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((currentRainfallMm / historicalRainfallMm) * 100));
}

export function resolveFloodRiskLevel(riskScore: number): FloodRiskLevel {
  if (riskScore >= 80) return "red";
  if (riskScore >= 50) return "orange";
  if (riskScore >= 20) return "amber";
  return "green";
}

export function resolveFloodRiskColor(level: FloodRiskLevel): string {
  switch (level) {
    case "red":
      return "#ef4444";
    case "orange":
      return "#f97316";
    case "amber":
      return "#f59e0b";
    default:
      return "#22c55e";
  }
}

export function buildFloodRiskProfile(
  currentRainfallMm: number | null,
  historicalRainfallMm: number | null,
) {
  const riskScore = calculateFloodRiskScore(currentRainfallMm, historicalRainfallMm);
  const riskLevel = resolveFloodRiskLevel(riskScore);
  return {
    riskScore,
    riskLevel,
    riskColor: resolveFloodRiskColor(riskLevel),
  };
}

export function isDrainageVulnerableSite(input: {
  caseCount: number;
  notesText?: string | null;
}): boolean {
  if (input.caseCount >= 2) return true;
  const notes = input.notesText?.trim() ?? "";
  return Boolean(notes && DRAINAGE_VULNERABILITY_PATTERN.test(notes));
}

export function resolveRiskConfidence(input: {
  caseCount: number;
  usedSimilarSite: boolean;
}): { level: FloodRiskConfidenceLevel; label: string } {
  if (input.usedSimilarSite) {
    return { level: "estimated", label: "유사개소 추정" };
  }
  if (input.caseCount >= 3) {
    return { level: "high", label: "3건+" };
  }
  if (input.caseCount >= 1) {
    return {
      level: input.caseCount >= 2 ? "medium" : "low",
      label: input.caseCount === 1 ? "사례 1건" : `사례 ${input.caseCount}건`,
    };
  }
  return { level: "estimated", label: "유사개소 추정" };
}

export interface SiteHistoricalRainfall {
  rainfall15mMm: number | null;
  rainfall30mMm: number | null;
  rainfall60mMm: number | null;
  rainfall360mMm: number | null;
}

export interface SiteCurrentRainfall {
  rainfall15m: number | null;
  rainfall30m: number | null;
  rainfall60m: number | null;
  rainfall360m: number | null;
}

export interface SiteFloodRiskAssessment {
  riskScore: number;
  riskLevel: FloodRiskLevel;
  riskColor: string;
  dominantFactor: string;
  dominantWindow: RainfallWindowKey | "drainage" | null;
  confidenceLevel: FloodRiskConfidenceLevel;
  confidenceLabel: string;
  thresholdComparison: string;
  thresholdRatio: number | null;
  thresholdWindowLabel: string | null;
  drainageVulnerable: boolean;
  usedSimilarSite: boolean;
  windowScores: Array<{
    key: RainfallWindowKey;
    label: string;
    ratio: number | null;
    score: number;
    weight: number;
  }>;
}

function getHistoricalForWindow(
  historical: SiteHistoricalRainfall,
  key: RainfallWindowKey,
): number | null {
  switch (key) {
    case "15m":
      return historical.rainfall15mMm;
    case "30m":
      return historical.rainfall30mMm;
    case "60m":
      return historical.rainfall60mMm;
    case "360m":
      return historical.rainfall360mMm;
    default:
      return null;
  }
}

function getCurrentForWindow(current: SiteCurrentRainfall, key: RainfallWindowKey): number | null {
  switch (key) {
    case "15m":
      return current.rainfall15m;
    case "30m":
      return current.rainfall30m;
    case "60m":
      return current.rainfall60m;
    case "360m":
      return current.rainfall360m;
    default:
      return null;
  }
}

export function buildSiteFloodRiskAssessment(input: {
  current: SiteCurrentRainfall;
  historical: SiteHistoricalRainfall;
  caseCount: number;
  notesText?: string | null;
  usedSimilarSite?: boolean;
}): SiteFloodRiskAssessment {
  const usedSimilarSite = Boolean(input.usedSimilarSite);
  const drainageVulnerable = isDrainageVulnerableSite({
    caseCount: input.caseCount,
    notesText: input.notesText,
  });
  const confidence = resolveRiskConfidence({
    caseCount: input.caseCount,
    usedSimilarSite,
  });

  const windowScores = RAINFALL_WINDOWS.map((window) => {
    const currentValue = getCurrentForWindow(input.current, window.key);
    const historicalValue = getHistoricalForWindow(input.historical, window.key);
    const ratio =
      currentValue != null && historicalValue != null && historicalValue > 0
        ? (currentValue / historicalValue) * 100
        : null;
    const score = ratio == null ? 0 : Math.min(100, Math.round(ratio));
    return {
      key: window.key,
      label: window.label,
      ratio: ratio == null ? null : Math.round(ratio),
      score,
      weight: window.weight,
    };
  });

  let weightSum = 0;
  let weightedTotal = 0;
  for (const item of windowScores) {
    if (item.ratio == null) continue;
    weightSum += item.weight;
    weightedTotal += item.weight * item.score;
  }

  let riskScore = weightSum > 0 ? Math.round(weightedTotal / weightSum) : 0;
  if (drainageVulnerable && riskScore > 0) {
    riskScore = Math.min(100, riskScore + (input.caseCount >= 3 ? 8 : 5));
  }

  const rainfallLeader = [...windowScores]
    .filter((item) => item.ratio != null)
    .sort((a, b) => b.weight * b.score - a.weight * a.score)[0];

  let dominantFactor = rainfallLeader?.label ?? "강우 데이터 없음";
  let dominantWindow: RainfallWindowKey | "drainage" | null = rainfallLeader?.key ?? null;
  let thresholdRatio = rainfallLeader?.ratio ?? null;
  let thresholdWindowLabel = rainfallLeader
    ? RAINFALL_WINDOWS.find((window) => window.key === rainfallLeader.key)?.shortLabel ?? null
    : null;

  if (
    drainageVulnerable &&
    rainfallLeader &&
    rainfallLeader.ratio != null &&
    rainfallLeader.ratio >= 35 &&
    rainfallLeader.ratio < 85
  ) {
    dominantFactor = "배수 취약";
    dominantWindow = "drainage";
  }

  const thresholdComparison =
    thresholdRatio != null && thresholdWindowLabel
      ? `침수이력 대비 ${thresholdWindowLabel} 강우 ${thresholdRatio}%`
      : "침수이력 대비 강우 비교 불가";

  const riskLevel = resolveFloodRiskLevel(riskScore);

  return {
    riskScore,
    riskLevel,
    riskColor: resolveFloodRiskColor(riskLevel),
    dominantFactor,
    dominantWindow,
    confidenceLevel: confidence.level,
    confidenceLabel: confidence.label,
    thresholdComparison,
    thresholdRatio,
    thresholdWindowLabel,
    drainageVulnerable,
    usedSimilarSite,
    windowScores,
  };
}

export function mergeHistoricalFromPeers(
  site: SiteHistoricalRainfall & { caseCount: number },
  peers: Array<SiteHistoricalRainfall & { caseCount: number }>,
): { historical: SiteHistoricalRainfall; usedSimilarSite: boolean } {
  const hasOwnHistory =
    site.caseCount > 0 &&
    (site.rainfall15mMm != null ||
      site.rainfall30mMm != null ||
      site.rainfall60mMm != null ||
      site.rainfall360mMm != null);

  if (hasOwnHistory) {
    return { historical: site, usedSimilarSite: false };
  }

  const validPeers = peers.filter(
    (peer) =>
      peer.caseCount > 0 &&
      (peer.rainfall15mMm != null ||
        peer.rainfall30mMm != null ||
        peer.rainfall60mMm != null ||
        peer.rainfall360mMm != null),
  );
  if (!validPeers.length) {
    return { historical: site, usedSimilarSite: false };
  }

  const pickMin = (getter: (peer: SiteHistoricalRainfall) => number | null) => {
    let min: number | null = null;
    for (const peer of validPeers) {
      const value = getter(peer);
      if (value == null) continue;
      min = min == null ? value : Math.min(min, value);
    }
    return min;
  };

  return {
    historical: {
      rainfall15mMm: pickMin((peer) => peer.rainfall15mMm),
      rainfall30mMm: pickMin((peer) => peer.rainfall30mMm),
      rainfall60mMm: pickMin((peer) => peer.rainfall60mMm),
      rainfall360mMm: pickMin((peer) => peer.rainfall360mMm),
    },
    usedSimilarSite: true,
  };
}
