export const ROLES = {
  ADMIN: "ADMIN",
  GUEST: "GUEST",
  GUEST_A: "GUEST_A",
  GUEST_B: "GUEST_B",
  SELF_REPORT_TIER1: "SELF_REPORT_TIER1",
  SELF_REPORT_TIER2: "SELF_REPORT_TIER2",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
