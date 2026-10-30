import { Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";

const CASH_REGISTER_REJECTION = {
  ERROR: "CashRegisterRejected",
} as const;

export const routePermissions = {
  "POST cash-registers/:registerId/open": "cash.open-shift",
  "POST cash-registers/:registerId/checks/:checkId/charge": "sale.charge",
  "GET cash-registers/:registerId/count": "cash.open-shift",
  "POST cash-registers/:registerId/count": "cash.open-shift",
  "POST cash-registers/:registerId/count/approve": "cash.approve-variance",
  "POST cash-registers/:registerId/count/partial-close": "cash.open-shift",
  "POST cash-registers/:registerId/count/final-close": "cash.open-shift",
} as const;

interface CashRegisterRejection {
  error: typeof CASH_REGISTER_REJECTION.ERROR;
}

@Controller("tenants/:tenantId/venues/:venueId")
export class CashRegisterController {
  @Post("cash-registers/:registerId/open")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectOpen(): CashRegisterRejection {
    return { error: CASH_REGISTER_REJECTION.ERROR };
  }

  @Post("cash-registers/:registerId/checks/:checkId/charge")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectCharge(): CashRegisterRejection {
    return { error: CASH_REGISTER_REJECTION.ERROR };
  }

  @Get("cash-registers/:registerId/count")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectReadCount(): CashRegisterRejection {
    return { error: CASH_REGISTER_REJECTION.ERROR };
  }

  @Post("cash-registers/:registerId/count")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectSubmitCount(): CashRegisterRejection {
    return { error: CASH_REGISTER_REJECTION.ERROR };
  }

  @Post("cash-registers/:registerId/count/approve")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectApprove(): CashRegisterRejection {
    return { error: CASH_REGISTER_REJECTION.ERROR };
  }

  @Post("cash-registers/:registerId/count/partial-close")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectPartialClose(): CashRegisterRejection {
    return { error: CASH_REGISTER_REJECTION.ERROR };
  }

  @Post("cash-registers/:registerId/count/final-close")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectFinalClose(): CashRegisterRejection {
    return { error: CASH_REGISTER_REJECTION.ERROR };
  }
}
