import { HmacLinkSigner } from "@blackhole/invoicing/adapters/crypto/hmac-link-signer";
import {
  PreBillLink,
  type PreBillLinkInput,
} from "@blackhole/orders/application/entry-port";
import type { Secrets } from "@blackhole/platform/application/entry-port";

const PRE_BILL_TTL_MS = 24 * 60 * 60 * 1000;
const INVOICE_PREFIX = "/f/";
const PRE_BILL_PREFIX = "/d/";

export class CloudPreBillLink extends PreBillLink {
  constructor(
    private readonly secrets: Secrets,
    private readonly enabled: boolean,
  ) {
    super();
  }

  override async sign(input: PreBillLinkInput): Promise<string> {
    if (!this.enabled) {
      return "";
    }

    const signed = await new HmacLinkSigner(this.secrets).sign({
      purpose: "pre_bill",
      tenantId: input.tenantId,
      venueId: input.venueId,
      checkId: input.checkId,
      expiresAt: new Date(Date.parse(input.at) + PRE_BILL_TTL_MS).toISOString(),
    });

    if (!signed.token.startsWith(INVOICE_PREFIX)) {
      return "";
    }

    return `${PRE_BILL_PREFIX}${signed.token.slice(INVOICE_PREFIX.length)}`;
  }
}
