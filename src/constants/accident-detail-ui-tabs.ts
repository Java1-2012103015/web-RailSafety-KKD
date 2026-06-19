/** 사고 상세 화면 UI 탭 (기본정보 / 추가정보 / 현장상황 / 보완검토) */
export const ACCIDENT_DETAIL_UI_TABS = [
  { id: "basic", title: "기본정보" },
  { id: "extra", title: "추가정보" },
  { id: "site", title: "현장상황" },
  { id: "review", title: "보완검토" },
] as const;

export type AccidentDetailUiTabId = (typeof ACCIDENT_DETAIL_UI_TABS)[number]["id"];

export const ALL_ACCIDENT_DETAIL_TAB_IDS: AccidentDetailUiTabId[] = ACCIDENT_DETAIL_UI_TABS.map((tab) => tab.id);
