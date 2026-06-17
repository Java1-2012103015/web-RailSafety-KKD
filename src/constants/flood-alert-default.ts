import { FLOOD_ALERT_CSV_HEADER } from "../utils/flood-alert-csv";

function sampleRainfallWindows(rainfall60mMm: number) {
  return {
    rainfall15mMm: Math.round(rainfall60mMm * 0.33 * 10) / 10,
    rainfall30mMm: Math.round(rainfall60mMm * 0.62 * 10) / 10,
    rainfall60mMm,
    rainfall360mMm: Math.round(rainfall60mMm * 1.35 * 10) / 10,
    rainfallMm: rainfall60mMm,
  };
}

function buildSampleRow(input: {
  accidentNumber: string;
  agencyName: string;
  lineName: string;
  siteName: string;
  location: string;
  latitude: number;
  longitude: number;
  accidentAtText: string;
  rainfall60mMm: number;
  notes: string;
}) {
  const rainfall = sampleRainfallWindows(input.rainfall60mMm);
  const accidentAt = new Date(input.accidentAtText.replace(/\./g, "-"));
  return {
    accidentNumber: input.accidentNumber,
    agencyName: input.agencyName,
    lineName: input.lineName,
    siteName: input.siteName,
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    accidentAt: Number.isNaN(accidentAt.getTime()) ? null : accidentAt,
    accidentAtText: input.accidentAtText,
    ...rainfall,
    weatherStationCode: null,
    notes: input.notes,
  };
}

const SAMPLE_ROWS = [
  buildSampleRow({
    accidentNumber: "FLD-2024-001",
    agencyName: "한국철도공사",
    lineName: "경부선",
    siteName: "○○교",
    location: "서울역~용산역 구간",
    latitude: 37.5547,
    longitude: 126.9706,
    accidentAtText: "2024-07-15 14:00",
    rainfall60mMm: 85.5,
    notes: "상습침수 우려개소",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2023-002",
    agencyName: "한국철도공사",
    lineName: "경부선",
    siteName: "△△교",
    location: "수원역~영등포역 구간",
    latitude: 37.2636,
    longitude: 127.0286,
    accidentAtText: "2023-08-09 17:20",
    rainfall60mMm: 72,
    notes: "집중호우 침수사례",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2022-003",
    agencyName: "한국철도공사",
    lineName: "경부선",
    siteName: "××교",
    location: "대전역 인근 선로",
    latitude: 36.3325,
    longitude: 127.4342,
    accidentAtText: "2022-08-08 19:10",
    rainfall60mMm: 95.3,
    notes: "하천 범람 연계",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2023-004",
    agencyName: "한국철도공사",
    lineName: "경부선",
    siteName: "◇◇교",
    location: "동대구역~신경주역 구간",
    latitude: 35.8795,
    longitude: 128.6283,
    accidentAtText: "2023-07-25 16:40",
    rainfall60mMm: 68,
    notes: "배수시설 보완 필요",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2024-005",
    agencyName: "한국철도공사",
    lineName: "경부선",
    siteName: "○○교",
    location: "울산역~부산역 구간",
    latitude: 35.1796,
    longitude: 129.0756,
    accidentAtText: "2024-06-30 13:50",
    rainfall60mMm: 110.2,
    notes: "집중호우 침수사례",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2023-006",
    agencyName: "한국철도공사",
    lineName: "경인선",
    siteName: "△△교",
    location: "인천역~부평역 구간",
    latitude: 37.4563,
    longitude: 126.7052,
    accidentAtText: "2023-09-16 15:30",
    rainfall60mMm: 58.4,
    notes: "저지대 침수이력",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2022-007",
    agencyName: "한국철도공사",
    lineName: "호남선",
    siteName: "○○교",
    location: "익산역~전주역 구간",
    latitude: 35.8242,
    longitude: 127.1479,
    accidentAtText: "2022-07-18 18:00",
    rainfall60mMm: 88.7,
    notes: "상습침수 우려개소",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2023-001",
    agencyName: "한국철도공사",
    lineName: "중앙선",
    siteName: "△△터널",
    location: "원주역~만종역 구간",
    latitude: 37.3422,
    longitude: 127.9201,
    accidentAtText: "2023-08-09 18:30",
    rainfall60mMm: 120,
    notes: "집중호우 침수사례",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2024-008",
    agencyName: "한국철도공사",
    lineName: "동해선",
    siteName: "××교",
    location: "포항역~영덕역 구간",
    latitude: 36.019,
    longitude: 129.3435,
    accidentAtText: "2024-08-10 11:20",
    rainfall60mMm: 76.5,
    notes: "태풍 영향 침수",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2023-009",
    agencyName: "한국철도공사",
    lineName: "경춘선",
    siteName: "○○교",
    location: "청량리역~남춘천역 구간",
    latitude: 37.7341,
    longitude: 127.0982,
    accidentAtText: "2023-07-14 14:45",
    rainfall60mMm: 64.2,
    notes: "산악지역 집중호우",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2022-010",
    agencyName: "한국철도공사",
    lineName: "영동선",
    siteName: "△△교",
    location: "동해역~정동진역 구간",
    latitude: 37.5247,
    longitude: 129.1143,
    accidentAtText: "2022-09-06 12:10",
    rainfall60mMm: 92.1,
    notes: "해안 침수사례",
  }),
  buildSampleRow({
    accidentNumber: "FLD-2024-011",
    agencyName: "한국철도공사",
    lineName: "장항선",
    siteName: "○○교",
    location: "대천역~서천역 구간",
    latitude: 36.3339,
    longitude: 126.6127,
    accidentAtText: "2024-07-22 16:00",
    rainfall60mMm: 81,
    notes: "만조·강우 복합 침수",
  }),
];

export const DEFAULT_FLOOD_ALERT_ROWS = SAMPLE_ROWS;

export const FLOOD_ALERT_SAMPLE_CSV = [
  FLOOD_ALERT_CSV_HEADER,
  ...SAMPLE_ROWS.map((row) =>
    [
      row.accidentNumber,
      row.agencyName,
      row.lineName,
      row.siteName,
      row.location,
      row.latitude,
      row.longitude,
      row.accidentAtText,
      row.rainfall15mMm,
      row.rainfall30mMm,
      row.rainfall60mMm,
      row.rainfall360mMm,
      row.weatherStationCode ?? "",
      row.notes,
    ].join(","),
  ),
].join("\n");

export const DEFAULT_FLOOD_NEWS_KEYWORDS = [
  "철도역 침수",
  "철도시설 침수",
  "철도 침수 사고",
  "지하철역 침수",
  "철도역 침수사고",
];
