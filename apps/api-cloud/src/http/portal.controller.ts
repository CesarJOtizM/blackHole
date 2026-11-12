import { randomUUID } from "node:crypto";
import {
  portalBuyerFound,
  portalBuyerLookupCommand,
} from "@blackhole/contracts";
import { HmacLinkSigner } from "@blackhole/invoicing/adapters/crypto/hmac-link-signer";
import { LookUpPortalBuyer } from "@blackhole/invoicing/application/entry-port";
import {
  PORTAL_LINK_PURPOSE,
  revealPortalLink,
} from "@blackhole/invoicing/domain";
import { Secrets } from "@blackhole/platform/application/entry-port";
import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
} from "@nestjs/common";

const refuse = (): never => {
  throw new HttpException({}, HttpStatus.NOT_FOUND);
};

export const routePermissions = {
  "POST buyers": "portal.link",
} as const;

@Controller("portal")
export class PortalController {
  constructor(
    @Inject(LookUpPortalBuyer)
    private readonly buyers: LookUpPortalBuyer,
    @Inject(Secrets)
    private readonly secrets: Secrets,
  ) {}

  @Post("buyers")
  @HttpCode(HttpStatus.OK)
  async lookupBuyer(@Body() body: unknown) {
    const parsed = portalBuyerLookupCommand.safeParse(body);

    if (!parsed.success) {
      return refuse();
    }

    const token = parsed.data.token.startsWith("/d/")
      ? parsed.data.token
      : `/d/${parsed.data.token}`;
    const link = await new HmacLinkSigner(this.secrets).verify(token);

    if (link === null || link.purpose !== PORTAL_LINK_PURPOSE.PRE_BILL) {
      return refuse();
    }

    const disclosure = revealPortalLink({
      link,
      account: {
        tenantId: link.tenantId,
        venueId: link.venueId,
        checkId: link.checkId,
      },
      at: parsed.data.at,
    });

    if (disclosure.outcome !== "visible") {
      return refuse();
    }

    const lookup = await this.buyers.execute({
      lookupId: randomUUID(),
      taxId: link.tenantId,
      companyId: link.tenantId,
      documentType: parsed.data.documentType,
      documentNumber: parsed.data.documentNumber,
      at: parsed.data.at,
      link: "visible",
    });

    if (lookup.outcome !== "found") {
      return refuse();
    }

    return portalBuyerFound.parse({
      outcome: lookup.outcome,
      lookupId: lookup.lookupId,
      maskedName: lookup.maskedName,
      maskedEmail: lookup.maskedEmail,
    });
  }
}
