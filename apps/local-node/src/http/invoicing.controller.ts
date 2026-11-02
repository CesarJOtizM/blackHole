import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

const INVOICING_REJECTION = {
  ERROR: "InvoicingRejected",
} as const;

export const routePermissions = {
  "POST acquirers/lookup": "sale.charge",
  "POST closures/:closureId/buyer": "sale.charge",
  "POST document-balance": "tax.configure",
  "POST numbering-ranges": "tax.configure",
  "POST credit-notes": "sale.credit-note",
} as const;

interface InvoicingRejection {
  error: typeof INVOICING_REJECTION.ERROR;
}

@Controller("tenants/:tenantId/venues/:venueId")
export class InvoicingController {
  @Post("acquirers/lookup")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectLookup(): InvoicingRejection {
    return { error: INVOICING_REJECTION.ERROR };
  }

  @Post("closures/:closureId/buyer")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectBuyer(): InvoicingRejection {
    return { error: INVOICING_REJECTION.ERROR };
  }

  @Post("document-balance")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectBalance(): InvoicingRejection {
    return { error: INVOICING_REJECTION.ERROR };
  }

  @Post("numbering-ranges")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectRanges(): InvoicingRejection {
    return { error: INVOICING_REJECTION.ERROR };
  }

  @Post("credit-notes")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectCreditNote(): InvoicingRejection {
    return { error: INVOICING_REJECTION.ERROR };
  }
}
