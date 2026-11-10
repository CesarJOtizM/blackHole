export const ONE_TIME_CODE_CHANNEL = {
  EMAIL: "email",
  SMS: "sms",
} as const;

export type OneTimeCodeChannel =
  (typeof ONE_TIME_CODE_CHANNEL)[keyof typeof ONE_TIME_CODE_CHANNEL];

export interface OneTimeCodeMessage {
  channel: OneTimeCodeChannel;
  destination: string;
  code: string;
  companyName: string;
  expiresInMinutes: number;
}

export class OneTimeCodeDeliveryFailed extends Error {
  constructor() {
    super("The one-time code could not be delivered.");
    this.name = "OneTimeCodeDeliveryFailed";
  }
}

export abstract class OneTimeCodeSender {
  abstract send(message: OneTimeCodeMessage): Promise<void>;
}
