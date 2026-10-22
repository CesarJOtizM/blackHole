import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

const PERMISSION_REJECTION = {
  ERROR: "PermissionCommandRejected",
} as const;

interface PermissionCommandRejection {
  error: typeof PERMISSION_REJECTION.ERROR;
}

export const routePermissions = {
  "POST authorization": "authorization.manage",
} as const;

@Controller("tenants/:tenantId")
export class AuthorizationController {
  @Post("authorization")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectAuthorization(): PermissionCommandRejection {
    return { error: PERMISSION_REJECTION.ERROR };
  }
}
