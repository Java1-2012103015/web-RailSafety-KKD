export const ALIGO_SMS_DEFAULT_ENDPOINT = "https://apis.aligo.in/send/";

export type AligoSmsExtraConfig = {
  aligoUserId?: string;
  aligoSender?: string;
  aligoTestMode?: boolean;
  templates?: Record<string, string>;
  selfReportDashboardUrl?: string;
};

export function readAligoSmsConfig(extraConfig: unknown): {
  aligoUserId: string;
  aligoSender: string;
  aligoTestMode: boolean;
} {
  const extra = (extraConfig ?? {}) as AligoSmsExtraConfig;
  return {
    aligoUserId: extra.aligoUserId?.trim() ?? "",
    aligoSender: extra.aligoSender?.trim() ?? "",
    aligoTestMode: Boolean(extra.aligoTestMode),
  };
}

export function isAligoSmsConfigured(input: {
  enabled?: boolean;
  apiKey?: string | null;
  extraConfig?: unknown;
}): boolean {
  if (!input.enabled || !input.apiKey?.trim()) return false;
  const { aligoUserId, aligoSender } = readAligoSmsConfig(input.extraConfig);
  return Boolean(aligoUserId && aligoSender);
}
