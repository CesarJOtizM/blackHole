import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

const TAX_REJECTION = {
  ERROR: "TaxRejected",
} as const;

export const routePermissions = {
  "POST tax-rules": "tax.configure",
} as const;

interface TaxRejection {
  error: typeof TAX_REJECTION.ERROR;
}

@Controller("tenants/:tenantId")
export class TaxController {
  @Post("tax-quotes")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectQuote(): TaxRejection {
    return { error: TAX_REJECTION.ERROR };
  }

  @Post("tax-rules")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectPublish(): TaxRejection {
    return { error: TAX_REJECTION.ERROR };
  }

  @Post("fiscal-profiles/adopt")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectAdopt(): TaxRejection {
    return { error: TAX_REJECTION.ERROR };
  }
}
