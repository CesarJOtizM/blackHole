import { Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";

const MENU_REJECTION = {
  ERROR: "MenuRejected",
} as const;

export const routePermissions = {
  "POST menu": "menu.edit",
} as const;

interface MenuRejection {
  error: typeof MENU_REJECTION.ERROR;
}

@Controller("tenants/:tenantId")
export class UpdateMenuController {
  @Post("menu")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectUpdate(): MenuRejection {
    return { error: MENU_REJECTION.ERROR };
  }

  @Get("venues/:venueId/menu")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectRead(): MenuRejection {
    return { error: MENU_REJECTION.ERROR };
  }
}
