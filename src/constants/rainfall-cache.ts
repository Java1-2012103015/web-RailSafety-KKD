/** 강우 API 서버 캐시 TTL (15분) */
export const RAINFALL_CACHE_TTL_MS = 15 * 60 * 1000;

/** 백그라운드 동기화 주기 (15분) */
export const RAINFALL_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/** 대시보드 화면 자동 새로고침 (15분, 강우 캐시 TTL과 동일) */
export const RAINFALL_DASHBOARD_REFRESH_MS = 15 * 60 * 1000;
