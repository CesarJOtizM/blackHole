import { createHmac } from "node:crypto";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { expect, it } from "vitest";
import { qrGatewayFor } from "#src/composition/qr-table-payment.js";

const SECRET = "bold-webhook-secret";
const REFERENCE = "qrpay_table_1";
const AMOUNT_COP = 93_500;

const signedBody = () => {
  const rawBody = JSON.stringify({
    reference: REFERENCE,
    amountCop: AMOUNT_COP,
    instrument: "nequi",
  });

  return {
    rawBody,
    signature: createHmac("sha256", SECRET).update(rawBody).digest("hex"),
  };
};

it("given no Bold secret, when a webhook arrives, then the gateway does not confirm it", async () => {
  const gateway = await qrGatewayFor(new InMemorySecrets({}));
  const { rawBody, signature } = signedBody();

  expect(await gateway.verifyWebhook({ rawBody, signature })).toBeNull();
});

it("given the Bold secret, when the webhook signature matches, then the gateway confirms the payment", async () => {
  const gateway = await qrGatewayFor(
    new InMemorySecrets({ "bold.webhook-secret": SECRET }),
  );
  const { rawBody, signature } = signedBody();

  expect(await gateway.verifyWebhook({ rawBody, signature })).toEqual({
    reference: REFERENCE,
    amountCop: AMOUNT_COP,
    instrument: "nequi",
  });
});
