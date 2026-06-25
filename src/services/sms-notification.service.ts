import { ExternalApiRepository } from "../repositories/external-api.repository";
import { EXTERNAL_API_TYPES } from "../constants/external-api-types";

export class SmsNotificationService {
  constructor(private readonly externalApiRepository: ExternalApiRepository) {}

  async sendSms(phone: string, message: string): Promise<boolean> {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!normalizedPhone) return false;

    const config = await this.externalApiRepository.findByType(EXTERNAL_API_TYPES.SMS);
    if (!config?.enabled || !config.endpointUrl?.trim()) {
      console.info("[sms] disabled or not configured:", message.slice(0, 80));
      return false;
    }

    try {
      const response = await fetch(config.endpointUrl.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ to: normalizedPhone, message }),
      });
      if (!response.ok) {
        console.error("[sms] API error:", response.status, await response.text().catch(() => ""));
        return false;
      }
      return true;
    } catch (error) {
      console.error("[sms] send failed:", error);
      return false;
    }
  }
}
