import type { Secrets } from "@blackhole/platform/application/entry-port";

import {
  ONE_TIME_CODE_CHANNEL,
  OneTimeCodeDeliveryFailed,
  type OneTimeCodeMessage,
  OneTimeCodeSender,
} from "#application/ports/one-time-code-sender.js";

export const TWILIO_SECRET = {
  ACCOUNT_SID: "twilio.account-sid",
  AUTH_TOKEN: "twilio.auth-token",
  SMS_FROM: "twilio.sms-from",
} as const;

export const SENDGRID_SECRET = {
  API_KEY: "sendgrid.api-key",
  FROM_EMAIL: "sendgrid.from-email",
} as const;

const TWILIO_MESSAGES_ORIGIN = "https://api.twilio.com/2010-04-01/Accounts";
const SENDGRID_MAIL_URL = "https://api.sendgrid.com/v3/mail/send";

const deliveryText = (message: OneTimeCodeMessage): string =>
  `${message.companyName} code ${message.code}. It expires in ${message.expiresInMinutes} minutes.`;

const basicAuthorization = (accountSid: string, authToken: string): string =>
  `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

export class TwilioOneTimeCodeSender extends OneTimeCodeSender {
  constructor(private readonly secrets: Secrets) {
    super();
  }

  override async send(message: OneTimeCodeMessage): Promise<void> {
    try {
      if (message.channel === ONE_TIME_CODE_CHANNEL.SMS) {
        await this.sendSms(message);
        return;
      }

      if (message.channel === ONE_TIME_CODE_CHANNEL.EMAIL) {
        await this.sendEmail(message);
        return;
      }

      throw new OneTimeCodeDeliveryFailed();
    } catch (caught) {
      if (caught instanceof OneTimeCodeDeliveryFailed) {
        throw caught;
      }

      throw new OneTimeCodeDeliveryFailed();
    }
  }

  private async sendSms(message: OneTimeCodeMessage): Promise<void> {
    const accountSid = await this.readSecret(TWILIO_SECRET.ACCOUNT_SID);
    const authToken = await this.readSecret(TWILIO_SECRET.AUTH_TOKEN);
    const from = await this.readSecret(TWILIO_SECRET.SMS_FROM);
    const body = new URLSearchParams({
      To: message.destination,
      From: from,
      Body: deliveryText(message),
    });

    await this.post(
      `${TWILIO_MESSAGES_ORIGIN}/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: basicAuthorization(accountSid, authToken),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
  }

  private async sendEmail(message: OneTimeCodeMessage): Promise<void> {
    const apiKey = await this.readSecret(SENDGRID_SECRET.API_KEY);
    const from = await this.readSecret(SENDGRID_SECRET.FROM_EMAIL);

    await this.post(SENDGRID_MAIL_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.destination }] }],
        from: { email: from },
        subject: `${message.companyName} verification code`,
        content: [{ type: "text/plain", value: deliveryText(message) }],
      }),
    });
  }

  private async readSecret(name: string): Promise<string> {
    const value = (await this.secrets.read(name)).trim();

    if (value.length === 0) {
      throw new OneTimeCodeDeliveryFailed();
    }

    return value;
  }

  private async post(url: string, init: RequestInit): Promise<void> {
    const response = await fetch(url, init);

    if (!response.ok) {
      throw new OneTimeCodeDeliveryFailed();
    }
  }
}
