export interface KmaAsosStation {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
}

/** 기상청 ASOS 지점 (강우 조회 stn / stnIds 매핑용) */
export const KMA_ASOS_STATIONS: KmaAsosStation[] = [
  { code: "90", name: "속초", latitude: 38.2509, longitude: 128.5647, aliases: ["속초역"] },
  { code: "93", name: "북춘천", latitude: 37.9741, longitude: 127.2512 },
  { code: "101", name: "춘천", latitude: 37.9474, longitude: 127.7547, aliases: ["남춘천", "청량리"] },
  { code: "105", name: "강릉", latitude: 37.7515, longitude: 128.891 },
  { code: "106", name: "동해", latitude: 37.5071, longitude: 129.1243, aliases: ["동해역", "정동진"] },
  { code: "108", name: "서울", latitude: 37.5714, longitude: 126.9658, aliases: ["서울역", "용산", "영등포", "광명"] },
  { code: "112", name: "인천", latitude: 37.4777, longitude: 126.6249, aliases: ["인천역", "부평"] },
  { code: "114", name: "원주", latitude: 37.3375, longitude: 127.9466, aliases: ["원주역", "만종"] },
  { code: "119", name: "수원", latitude: 37.2575, longitude: 126.983, aliases: ["수원역", "화성", "오산"] },
  { code: "121", name: "영월", latitude: 37.1813, longitude: 128.4574 },
  { code: "127", name: "춘천", latitude: 37.9474, longitude: 127.7547 },
  { code: "129", name: "안동", latitude: 36.5729, longitude: 128.7073 },
  { code: "131", name: "포항", latitude: 36.032, longitude: 129.38, aliases: ["포항역", "영덕"] },
  { code: "133", name: "대전", latitude: 36.3699, longitude: 127.3742, aliases: ["대전역", "옥천", "심천"] },
  { code: "135", name: "충주", latitude: 37.0035, longitude: 127.9142 },
  { code: "136", name: "서산", latitude: 36.7763, longitude: 126.4894 },
  { code: "137", name: "울산", latitude: 35.5824, longitude: 129.3347, aliases: ["울산역", "태화강"] },
  { code: "138", name: "울진", latitude: 36.993, longitude: 129.4 },
  { code: "140", name: "군산", latitude: 36.0053, longitude: 126.7614, aliases: ["군산역", "익산"] },
  { code: "143", name: "대구", latitude: 35.885, longitude: 128.6188, aliases: ["대구역", "동대구", "신경주", "경주"] },
  { code: "146", name: "전주", latitude: 35.8214, longitude: 127.1467, aliases: ["전주역", "익산역"] },
  { code: "152", name: "창원", latitude: 35.1702, longitude: 128.5727, aliases: ["마산", "진해"] },
  { code: "155", name: "광주", latitude: 35.1729, longitude: 126.8916, aliases: ["광주역", "광주송정"] },
  { code: "156", name: "목포", latitude: 34.8174, longitude: 126.3814, aliases: ["목포역"] },
  { code: "159", name: "부산", latitude: 35.1047, longitude: 129.032, aliases: ["부산역", "사상", "구포"] },
  { code: "162", name: "통영", latitude: 34.8454, longitude: 128.4356 },
  { code: "165", name: "여수", latitude: 34.7392, longitude: 127.7406, aliases: ["여수엑스포"] },
  { code: "168", name: "제주", latitude: 33.5141, longitude: 126.5297, aliases: ["제주역"] },
  { code: "184", name: "제천", latitude: 37.1766, longitude: 128.1905 },
  { code: "192", name: "진주", latitude: 35.1639, longitude: 128.0401 },
  { code: "203", name: "이천", latitude: 37.264, longitude: 127.4842 },
  { code: "232", name: "천안", latitude: 36.7622, longitude: 127.2928, aliases: ["천안역", "아산"] },
  { code: "235", name: "보령", latitude: 36.3272, longitude: 126.5577, aliases: ["대천", "서천"] },
  { code: "238", name: "금산", latitude: 36.1056, longitude: 127.4818 },
  { code: "254", name: "순천", latitude: 34.9553, longitude: 127.4875, aliases: ["순천역"] },
];

export const KMA_ASOS_STATION_BY_CODE = new Map(KMA_ASOS_STATIONS.map((station) => [station.code, station]));
