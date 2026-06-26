import { ExternalApiRepository } from "../repositories/external-api.repository";
import { EXTERNAL_API_TYPES } from "../constants/external-api-types";
import {
  ALIGO_SMS_DEFAULT_ENDPOINT,
  readAligoSmsConfig,
} from "../constants/aligo-sms";

export class SmsNotificationService {
  constructor(private readonly externalApiRepository: ExternalApiRepository) {}

  async sendSms(phone: string, message: string): Promise<boolean> {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!normalizedPhone) return false;

    const config = await this.externalApiRepository.findByType(EXTERNAL_API_TYPES.SMS);
    if (!config?.enabled) {
      console.info("[sms] disabled:", message.slice(0, 80));
      return false;
    }

    const apiKey = config.apiKey?.trim() ?? "";
    const { aligoUserId, aligoSender, aligoTestMode } = readAligoSmsConfig(config.extraConfig);
    if (!apiKey || !aligoUserId || !aligoSender) {
      console.info("[sms] aligo credentials missing:", message.slice(0, 80));
      return false;
    }

    const endpoint = config.endpointUrl?.trim() || ALIGO_SMS_DEFAULT_ENDPOINT;
    const sender = aligoSender.replace(/\D/g, "");
    const body = new URLSearchParams({
      key: apiKey,
      user_id: aligoUserId,
      sender,
      receiver: normalizedPhone,
      msg: message,
    });
    if (aligoTestMode) {
      body.set("testmode_yn", "Y");
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString(),
      });

      const responseText = await response.text().catch(() => "");
      if (!response.ok) {
        console.error("[sms] aligo HTTP error:", response.status, responseText);
        return false;
      }

      try {
        const data = JSON.parse(responseText) as { result_code?: string | number; message?: string };
        if (String(data.result_code) !== "1") {
          console.error("[sms] aligo API error:", data.message ?? responseText);
          return false;
        }
      } catch {
        console.error("[sms] aligo unexpected response:", responseText);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[sms] send failed:", error);
      return false;
    }
  }
}
