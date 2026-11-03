import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

const PRINTING_REJECTION = {
  ERROR: "PrintingRejected",
} as const;

export const routePermissions = {
  "POST reprints": "sale.reprint",
} as const;

interface PrintingRejection {
  error: typeof PRINTING_REJECTION.ERROR;
}

@Controller("tenants/:tenantId")
export class PrintingController {
  @Post("reprints")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectReprint(): PrintingRejection {
    return { error: PRINTING_REJECTION.ERROR };
  }
}
