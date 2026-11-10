import { expect, it } from "vitest";

import type {
  OneTimeCodeMessage,
  OneTimeCodeSender,
} from "#application/ports/one-time-code-sender.js";

export interface OneTimeCodeSenderHarness {
  sender(): OneTimeCodeSender;
  delivered(): readonly OneTimeCodeMessage[];
}

const MESSAGE: OneTimeCodeMessage = {
  channel: "email",
  destination: "holder@example.com",
  code: "482915",
  companyName: "Cafe Norte",
  expiresInMinutes: 10,
};

export function oneTimeCodeSenderContract(
  open: () => OneTimeCodeSenderHarness | Promise<OneTimeCodeSenderHarness>,
): void {
  it("given a registered contact, when a one-time code is sent, then channel, destination, code, company name, and expiry are delivered", async () => {
    const opened = await open();

    await opened.sender().send(MESSAGE);

    expect(opened.delivered()).toEqual([MESSAGE]);
  });
}
