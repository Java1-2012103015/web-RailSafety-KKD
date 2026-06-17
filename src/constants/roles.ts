export const ROLES = {
  ADMIN: "ADMIN",
  GUEST: "GUEST",
  GUEST_A: "GUEST_A",
  GUEST_B: "GUEST_B",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
