export const DEFAULT_SELF_REPORT_DASHBOARD_URL = "/dashboard/self-report";

export const SMS_TEMPLATE_TYPES = {
  ADMIN_TO_INSTITUTION: "ADMIN_TO_INSTITUTION",
  TIER1_TO_TIER2: "TIER1_TO_TIER2",
  TIER2_TRANSFER: "TIER2_TRANSFER",
  TIER1_UNPROCESSABLE_REQUEST: "TIER1_UNPROCESSABLE_REQUEST",
  REPORTER_TIER1_ASSIGNED: "REPORTER_TIER1_ASSIGNED",
  REPORTER_PLAN_ESTABLISHED: "REPORTER_PLAN_ESTABLISHED",
  REPORTER_COMPLETED: "REPORTER_COMPLETED",
  REPORTER_UNPROCESSABLE: "REPORTER_UNPROCESSABLE",
} as const;

export type SmsTemplateType = (typeof SMS_TEMPLATE_TYPES)[keyof typeof SMS_TEMPLATE_TYPES];

export const SMS_TEMPLATE_LABELS: Record<SmsTemplateType, string> = {
  ADMIN_TO_INSTITUTION: "관리자 → 기관(1차) 배정",
  TIER1_TO_TIER2: "1차 → 2차 실무담당 배정",
  TIER2_TRANSFER: "2차 담당 이첩",
  TIER1_UNPROCESSABLE_REQUEST: "1차 담당 — 처리불가 검토 요청",
  REPORTER_TIER1_ASSIGNED: "보고자 — 1차 담당 배정",
  REPORTER_PLAN_ESTABLISHED: "보고자 — 조치계획 수립",
  REPORTER_COMPLETED: "보고자 — 처리완료",
  REPORTER_UNPROCESSABLE: "보고자 — 처리불가",
};

export const STAFF_SMS_TEMPLATE_TYPES = [
  SMS_TEMPLATE_TYPES.ADMIN_TO_INSTITUTION,
  SMS_TEMPLATE_TYPES.TIER1_TO_TIER2,
  SMS_TEMPLATE_TYPES.TIER2_TRANSFER,
  SMS_TEMPLATE_TYPES.TIER1_UNPROCESSABLE_REQUEST,
] as const;

export const REPORTER_SMS_TEMPLATE_TYPES = [
  SMS_TEMPLATE_TYPES.REPORTER_TIER1_ASSIGNED,
  SMS_TEMPLATE_TYPES.REPORTER_PLAN_ESTABLISHED,
  SMS_TEMPLATE_TYPES.REPORTER_COMPLETED,
  SMS_TEMPLATE_TYPES.REPORTER_UNPROCESSABLE,
] as const;

export const DEFAULT_SMS_TEMPLATES: Record<SmsTemplateType, string> = {
  ADMIN_TO_INSTITUTION:
    "[자율보고] {receiptNumber} 보고 배정 안내\n" +
    "이메일 ; {email}\n" +
    "패스키 ; {authKey}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "로 접속하여 확인하시기 바랍니다.\n" +
    "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))",
  TIER1_TO_TIER2:
    "[자율보고] {receiptNumber} 보고 배정 안내\n" +
    "이메일 ; {email}\n" +
    "패스키 ; {authKey}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "로 접속하여 확인하시기 바랍니다.\n" +
    "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))",
  TIER2_TRANSFER:
    "[자율보고] {receiptNumber} 보고 이첩 안내\n" +
    "이첩사유 ; {transferReason}\n" +
    "이메일 ; {email}\n" +
    "패스키 ; {authKey}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "로 접속하여 확인하시기 바랍니다.\n" +
    "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))",
  TIER1_UNPROCESSABLE_REQUEST:
    "[자율보고] {receiptNumber} 보고 처리불가 검토 요청\n" +
    "처리불가 사유 ; {unprocessableReason}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "대시보드에서 확인 후 처리해 주세요.",
  REPORTER_TIER1_ASSIGNED:
    "[자율보고] {receiptNumber} 보고가 {institutionName}에 배정되어 처리가 시작됩니다.",
  REPORTER_PLAN_ESTABLISHED:
    "[자율보고] {receiptNumber} 보고의 조치계획이 수립되었습니다. 계획일: {processingPlanDate}",
  REPORTER_COMPLETED:
    "[자율보고] {receiptNumber} 보고 처리가 완료되었습니다. 완료일: {processingResultDate}",
  REPORTER_UNPROCESSABLE:
    "[자율보고] {receiptNumber} 보고는 처리불가로 종결되었습니다.\n사유 ; {unprocessableReason}",
};

export const SMS_TEMPLATE_PLACEHOLDERS =
  "{receiptNumber}, {title}, {institutionName}, {staffName}, {regionalHq}, {reporterName}, {email}, {authKey}, {dashboardUrl}, {assignerName}, {assignerEmail}, {transferReason}, {unprocessableReason}, {processingPlanDate}, {processingPlanContent}, {processingResultDate}";

export const TIER1_ACCOUNT_SMS_TEMPLATE =
  "[자율보고] 1차 담당 계정 안내\n" +
  "이메일 ; {email}\n" +
  "패스키 ; {authKey}\n" +
  "접속 사이트 | {dashboardUrl}\n" +
  "로 접속하여 확인하시기 바랍니다.\n" +
  "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))";

export const TIER2_ACCOUNT_SMS_TEMPLATE =
  "[자율보고] 2차 담당 계정 안내\n" +
  "이메일 ; {email}\n" +
  "패스키 ; {authKey}\n" +
  "접속 사이트 | {dashboardUrl}\n" +
  "로 접속하여 확인하시기 바랍니다.\n" +
  "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))";

export interface SmsTemplateVars {
  receiptNumber?: string;
  title?: string;
  institutionName?: string;
  staffName?: string;
  regionalHq?: string;
  reporterName?: string;
  email?: string;
  authKey?: string;
  dashboardUrl?: string;
  assignerName?: string;
  assignerEmail?: string;
  transferReason?: string;
  unprocessableReason?: string;
  processingPlanDate?: string;
  processingPlanContent?: string;
  processingResultDate?: string;
}

export function buildTier2AccountSmsMessage(vars: SmsTemplateVars): string {
  return applySmsTemplateVars(TIER2_ACCOUNT_SMS_TEMPLATE, vars);
}

export function buildStaffAccountSmsMessage(tier: 1 | 2, vars: SmsTemplateVars): string {
  const template = tier === 1 ? TIER1_ACCOUNT_SMS_TEMPLATE : TIER2_ACCOUNT_SMS_TEMPLATE;
  return applySmsTemplateVars(template, vars);
}

/** 저장된 템플릿에 이메일·패스키·접속 안내가 없으면 자동 삽입 */
export function ensureCredentialLinesInTemplate(template: string): string {
  if (template.includes("{email}") && template.includes("{authKey}")) return template;
  return (
    `${template.trimEnd()}\n` +
    "이메일 ; {email}\n" +
    "패스키 ; {authKey}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "로 접속하여 확인하시기 바랍니다."
  );
}

/** 저장된 템플릿에 이첩사유 치환이 없으면 제목 다음 줄에 자동 삽입 */
export function ensureTransferReasonInTemplate(template: string): string {
  if (template.includes("{transferReason}")) return template;
  const line = "이첩사유 ; {transferReason}\n";
  const nl = template.indexOf("\n");
  return nl >= 0 ? `${template.slice(0, nl + 1)}${line}${template.slice(nl + 1)}` : `${line}${template}`;
}

/** 템플릿 변수 치환. {staffName}/{reporterName} 없으면 수신자명을 문장 앞에 붙임 */
export function applySmsTemplateVars(template: string, vars: SmsTemplateVars): string {
  let text = template;
  const staffName = vars.staffName ?? "";
  const reporterName = vars.reporterName ?? "";
  const hasStaffPlaceholder = text.includes("{staffName}");
  const hasReporterPlaceholder = text.includes("{reporterName}");

  for (const [key, value] of Object.entries(vars)) {
    if (key === "staffName" || key === "reporterName") continue;
    text = text.split(`{${key}}`).join(value ?? "");
  }

  if (hasStaffPlaceholder) {
    text = text.split("{staffName}").join(staffName);
  } else if (staffName.trim()) {
    text = `${staffName.trim()}님, ${text}`;
  }

  if (hasReporterPlaceholder) {
    text = text.split("{reporterName}").join(reporterName);
  } else if (reporterName.trim()) {
    text = `${reporterName.trim()}님, ${text}`;
  }

  return text;
}
