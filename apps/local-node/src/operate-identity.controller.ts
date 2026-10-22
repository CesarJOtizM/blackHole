import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

const IDENTITY_REJECTION = {
  ERROR: "IdentityCommandRejected",
} as const;

interface IdentityCommandRejection {
  error: typeof IDENTITY_REJECTION.ERROR;
}

@Controller("tenants/:tenantId")
export class OperateIdentityController {
  @Post("identity")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectIdentity(): IdentityCommandRejection {
    return { error: IDENTITY_REJECTION.ERROR };
  }
}
