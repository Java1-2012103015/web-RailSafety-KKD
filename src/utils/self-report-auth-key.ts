import { encryptSecret, decryptSecret } from "./secret-crypto";

export function encryptSelfReportAuthKey(plain: string): string {
  return encryptSecret(plain.trim());
}

export function decryptSelfReportAuthKey(enc: string | null | undefined): string | null {
  if (!enc) return null;
  return decryptSecret(enc);
}
