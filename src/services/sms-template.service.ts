import { EXTERNAL_API_TYPES } from "../constants/external-api-types";
import {
  DEFAULT_SELF_REPORT_DASHBOARD_URL,
  DEFAULT_SMS_TEMPLATES,
  SMS_TEMPLATE_TYPES,
  applySmsTemplateVars,
  ensureTransferReasonInTemplate,
  ensureCredentialLinesInTemplate,
  type SmsTemplateType,
  type SmsTemplateVars,
} from "../constants/sms-templates";
import { ROLES } from "../constants/roles";
import { ExternalApiRepository } from "../repositories/external-api.repository";

type StoredSmsExtraConfig = {
  templates?: Partial<Record<SmsTemplateType, string>>;
  selfReportDashboardUrl?: string;
};

export class SmsTemplateService {
  constructor(private readonly externalApiRepository: ExternalApiRepository) {}

  private async readSmsExtraConfig(): Promise<StoredSmsExtraConfig> {
    const config = await this.externalApiRepository.findByType(EXTERNAL_API_TYPES.SMS);
    return (config?.extraConfig as StoredSmsExtraConfig | null) ?? {};
  }

  async getSelfReportDashboardUrl(fallback?: string): Promise<string> {
    const stored = await this.readSmsExtraConfig();
    const configured = stored.selfReportDashboardUrl?.trim();
    if (configured) return configured;
    return fallback?.trim() || DEFAULT_SELF_REPORT_DASHBOARD_URL;
  }

  async getTemplates(): Promise<Record<SmsTemplateType, string>> {
    const stored = (await this.readSmsExtraConfig()).templates ?? {};
    return {
      [SMS_TEMPLATE_TYPES.ADMIN_TO_INSTITUTION]:
        stored.ADMIN_TO_INSTITUTION?.trim() || DEFAULT_SMS_TEMPLATES.ADMIN_TO_INSTITUTION,
      [SMS_TEMPLATE_TYPES.TIER1_TO_TIER2]:
        stored.TIER1_TO_TIER2?.trim() || DEFAULT_SMS_TEMPLATES.TIER1_TO_TIER2,
      [SMS_TEMPLATE_TYPES.TIER2_TRANSFER]:
        stored.TIER2_TRANSFER?.trim() || DEFAULT_SMS_TEMPLATES.TIER2_TRANSFER,
      [SMS_TEMPLATE_TYPES.TIER1_UNPROCESSABLE_REQUEST]:
        stored.TIER1_UNPROCESSABLE_REQUEST?.trim() || DEFAULT_SMS_TEMPLATES.TIER1_UNPROCESSABLE_REQUEST,
      [SMS_TEMPLATE_TYPES.REPORTER_TIER1_ASSIGNED]:
        stored.REPORTER_TIER1_ASSIGNED?.trim() || DEFAULT_SMS_TEMPLATES.REPORTER_TIER1_ASSIGNED,
      [SMS_TEMPLATE_TYPES.REPORTER_PLAN_ESTABLISHED]:
        stored.REPORTER_PLAN_ESTABLISHED?.trim() || DEFAULT_SMS_TEMPLATES.REPORTER_PLAN_ESTABLISHED,
      [SMS_TEMPLATE_TYPES.REPORTER_COMPLETED]:
        stored.REPORTER_COMPLETED?.trim() || DEFAULT_SMS_TEMPLATES.REPORTER_COMPLETED,
      [SMS_TEMPLATE_TYPES.REPORTER_UNPROCESSABLE]:
        stored.REPORTER_UNPROCESSABLE?.trim() || DEFAULT_SMS_TEMPLATES.REPORTER_UNPROCESSABLE,
    };
  }

  async getSmsSettings(fallbackDashboardUrl?: string) {
    const [templates, dashboardUrl] = await Promise.all([
      this.getTemplates(),
      this.getSelfReportDashboardUrl(fallbackDashboardUrl),
    ]);
    return { templates, dashboardUrl };
  }

  async render(type: SmsTemplateType, vars: SmsTemplateVars): Promise<string> {
    const templates = await this.getTemplates();
    let text = templates[type] ?? DEFAULT_SMS_TEMPLATES[type];
    if (type === SMS_TEMPLATE_TYPES.TIER2_TRANSFER) {
      text = ensureTransferReasonInTemplate(text);
    }
    if (
      type === SMS_TEMPLATE_TYPES.ADMIN_TO_INSTITUTION ||
      type === SMS_TEMPLATE_TYPES.TIER1_TO_TIER2 ||
      type === SMS_TEMPLATE_TYPES.TIER2_TRANSFER
    ) {
      text = ensureCredentialLinesInTemplate(text);
    }
    return applySmsTemplateVars(text, vars);
  }

  templateTypeForRole(role: string): SmsTemplateType {
    if (role === ROLES.ADMIN) return SMS_TEMPLATE_TYPES.ADMIN_TO_INSTITUTION;
    if (role === ROLES.SELF_REPORT_TIER1) return SMS_TEMPLATE_TYPES.TIER1_TO_TIER2;
    return SMS_TEMPLATE_TYPES.TIER2_TRANSFER;
  }
}
