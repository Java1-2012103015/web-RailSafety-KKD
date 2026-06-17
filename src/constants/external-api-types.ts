export const EXTERNAL_API_TYPES = {
  ROAD_ADDRESS: "ROAD_ADDRESS",
  MAP_ADDRESS: "MAP_ADDRESS",
  WEATHER: "WEATHER",
} as const;

export type ExternalApiType = (typeof EXTERNAL_API_TYPES)[keyof typeof EXTERNAL_API_TYPES];

export const EXTERNAL_API_TYPE_SET = new Set<string>(Object.values(EXTERNAL_API_TYPES));

export const EXTERNAL_API_DEFAULTS: Array<{
  apiType: ExternalApiType;
  name: string;
  endpointUrl: string;
}> = [
  {
    apiType: EXTERNAL_API_TYPES.ROAD_ADDRESS,
    name: "도로명주소 등록 API",
    endpointUrl: "https://business.juso.go.kr/addrlink/addrLinkApi.do",
  },
  {
    apiType: EXTERNAL_API_TYPES.MAP_ADDRESS,
    name: "지도 주소 검색 API",
    endpointUrl: "",
  },
  {
    apiType: EXTERNAL_API_TYPES.WEATHER,
    name: "기상정보 API",
    endpointUrl: "https://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList",
  },
];

export function isExternalApiType(value: string): value is ExternalApiType {
  return EXTERNAL_API_TYPE_SET.has(value);
}
