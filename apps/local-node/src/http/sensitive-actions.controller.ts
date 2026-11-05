import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from "@nestjs/common";

const SENSITIVE_ACTION_REJECTION = {
  ERROR: "SensitiveActionRejected",
} as const;

export const routePermissions = {
  "POST checks/:checkId/lines/:lineId/void": "sale.void-before-kitchen",
  "POST checks/:checkId/void": "sale.void-account",
  "POST checks/:checkId/discount": "sale.discount",
  "POST checks/:checkId/courtesy": "sale.comp",
  "POST checks/:checkId/lines/:lineId/price": "sale.change-price",
  "POST checks/:checkId/transfer-table": "sale.transfer-table",
  "POST cash-registers/:registerId/open-drawer": "cash.open-drawer",
  "POST cash-registers/:registerId/payments/:paymentId/reopen":
    "sale.reopen-paid",
  "POST cash-registers/:registerId/payments/:paymentId/tender":
    "sale.change-tender",
  "GET control-report": "audit.view",
  "GET unusual-behavior": "audit.view",
  "PUT tip-rule": "cash.settle-tips",
  "POST tip-settlements": "cash.settle-tips",
  "POST tip-settlements/:id/adjustments": "cash.settle-tips",
  "POST tip-settlements/:id/print": "cash.settle-tips",
} as const;

interface SensitiveActionRejection {
  error: typeof SENSITIVE_ACTION_REJECTION.ERROR;
}

@Controller("tenants/:tenantId/venues/:venueId")
export class SensitiveActionsController {
  @Post("checks/:checkId/lines/:lineId/void")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectVoidLine(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("checks/:checkId/void")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectVoidAccount(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("checks/:checkId/discount")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectDiscount(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("checks/:checkId/courtesy")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectCourtesy(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("checks/:checkId/lines/:lineId/price")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectPrice(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("checks/:checkId/transfer-table")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectTransferTable(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("cash-registers/:registerId/open-drawer")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectOpenDrawer(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("cash-registers/:registerId/payments/:paymentId/reopen")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectReopen(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("cash-registers/:registerId/payments/:paymentId/tender")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectTender(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Get("control-report")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectControlReport(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Get("unusual-behavior")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectUnusualBehavior(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Put("tip-rule")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectTipRule(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("tip-settlements")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectTipSettlement(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("tip-settlements/:id/adjustments")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectTipAdjustment(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }

  @Post("tip-settlements/:id/print")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectTipPrint(): SensitiveActionRejection {
    return { error: SENSITIVE_ACTION_REJECTION.ERROR };
  }
}
