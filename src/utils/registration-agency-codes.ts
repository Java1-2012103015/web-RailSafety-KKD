/** 사고 DB 등록기관명 → 기관 코드(InstitutionCode.code) 매핑 */
export const REGISTRATION_AGENCY_CODE_PRESETS: Record<string, string> = {
  "SG(GTX-A)": "SG_GTX_A",
  "경기철도(신분당선)": "GYEONGGI_SBD",
  공항철도: "AREX",
  광주: "GWANGJU",
  김포골드: "GIMPO_GOLD",
  "남양주(진접선)": "NAMYANGJU",
  대구: "DAEGU",
  대전: "DAEJEON",
  부산: "BUSAN",
  부산김해: "BUSAN_GIMHAE",
  "새서울(신분당선)": "NEWSEOUL_SBD",
  "서부광역(서해선)": "SEOHO",
  서울교통: "SEOUL_METRO",
  서울도철: "SEOUL_URBAN",
  서울메트로: "SEOUL_METRO_CORP",
  서울메트로9호선운영: "SEOUL_M9_OPS",
  서울시메트로9호선: "SEOUL_M9",
  "신림선(로템SRS)": "SILLIM",
  "신분당선㈜  (네오트랜스)": "SHINBUNDANG_NEO",
  에스알: "SR",
  용인: "YONGIN",
  우이신설: "UI_SINSEOL",
  의정부: "UIJEONGBU",
  "이레일(서해선)": "IRE_RAIL",
  인천: "INCHEON",
  인천공항: "INCHEON_AIRPORT",
  전라선철도: "JEOLLA",
  "조사중인 사항": "UNDER_INVESTIGATION",
  철도공단: "KRAIL",
  철도공사: "KORAIL",
};

export function suggestInstitutionCode(name: string, usedCodes: Set<string>, index: number): string {
  const preset = REGISTRATION_AGENCY_CODE_PRESETS[name];
  if (preset && !usedCodes.has(preset)) {
    return preset;
  }

  const fromAscii = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (fromAscii.length >= 2) {
    let code = fromAscii.slice(0, 24);
    if (!usedCodes.has(code)) {
      return code;
    }
    let suffix = 2;
    while (usedCodes.has(`${code}_${suffix}`)) {
      suffix += 1;
    }
    return `${code}_${suffix}`;
  }

  let seq = index;
  let code = `REG${String(seq).padStart(4, "0")}`;
  while (usedCodes.has(code)) {
    seq += 1;
    code = `REG${String(seq).padStart(4, "0")}`;
  }
  return code;
}

/** 기관코드+노선명 기준 결정적 노선 코드 생성 */
export function buildLineCode(institutionCode: string, lineName: string, usedCodes: Set<string>): string {
  const raw = `${institutionCode}::${lineName}`;
  let hash = 2_166_136_261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 1_677_761_9);
  }

  let code = `LN${(hash >>> 0).toString(36).toUpperCase().padStart(8, "0").slice(0, 8)}`;
  if (!usedCodes.has(code)) {
    return code;
  }

  let suffix = 2;
  while (usedCodes.has(`${code}_${suffix}`)) {
    suffix += 1;
  }
  return `${code}_${suffix}`;
}

export const UNREGISTERED_AGENCY_NAME = "미등록";
export const UNREGISTERED_AGENCY_CODE = "UNREGISTERED";
