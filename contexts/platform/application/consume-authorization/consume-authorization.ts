import { UnknownAuthorization } from "#application/operate-authorization/operate-authorization.js";
import type { AuthorizationClock } from "#application/ports/authorization-clock.js";
import type {
  AuthorizationChanged,
  AuthorizationRepository,
} from "#application/ports/authorization-repository.js";
import type { PermissionCode } from "#domain/permission-catalog.js";

export { AuthorizationAlreadyConsumed } from "#domain/authorization.js";

export interface ConsumeAuthorizationInput {
  tenantId: string;
  authorizationId: string;
  permission: PermissionCode;
  targetId: string;
  value: number | null;
}

export class ConsumeAuthorization {
  constructor(
    private readonly authorizations: AuthorizationRepository,
    private readonly clock: AuthorizationClock,
  ) {}

  async execute(input: ConsumeAuthorizationInput): Promise<boolean> {
    const authorization = await this.authorizations.load(input.tenantId);

    if (!authorization) {
      throw new UnknownAuthorization();
    }

    const before = authorization.snapshot();
    const consumed = authorization.consumeAuthorization({
      requestId: input.authorizationId,
      permission: input.permission,
      targetId: input.targetId,
      value: input.value,
      at: this.clock.now(),
    });

    if (!consumed) {
      return false;
    }

    const event: AuthorizationChanged = {
      before,
      after: authorization.snapshot(),
    };

    await this.authorizations.save(authorization, event);

    return true;
  }
}
