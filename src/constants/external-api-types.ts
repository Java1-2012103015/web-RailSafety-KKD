export const EXTERNAL_API_TYPES = {
  ROAD_ADDRESS: "ROAD_ADDRESS",
  MAP_ADDRESS: "MAP_ADDRESS",
  WEATHER: "WEATHER",
  NEWS: "NEWS",
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
    endpointUrl: "https://api.vworld.kr/req/address",
  },
  {
    apiType: EXTERNAL_API_TYPES.WEATHER,
    name: "기상청 강우 API (침수경보, 선택)",
    endpointUrl: "https://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList",
  },
  {
    apiType: EXTERNAL_API_TYPES.NEWS,
    name: "기상·재난 뉴스 API",
    endpointUrl: "https://openapi.naver.com/v1/search/news",
  },
];

export function isExternalApiType(value: string): value is ExternalApiType {
  return EXTERNAL_API_TYPE_SET.has(value);
}
