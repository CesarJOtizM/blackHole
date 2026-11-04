import {
  type ConsumeAuthorization,
  type CountExecutedOperations,
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";

import type { Printer } from "#application/ports/printer.js";
import {
  type KnownRegister,
  REGISTER_DRAWER,
  type RegisterLookup,
} from "#application/ports/register-lookup.js";

const DRAWER_OPENED = "cash.drawer-opened";
const OPENING = 1;

export interface OpenDrawerInput {
  tenantId: string;
  venueId: string;
  registerId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  shiftId: string;
  reason: string;
  commandId: string;
  authorizationId: string | null;
}

const readyDrawer = async (
  lookup: RegisterLookup,
  input: OpenDrawerInput,
): Promise<KnownRegister | null> => {
  const known = await lookup.find(
    input.tenantId,
    input.venueId,
    input.registerId,
  );

  if (
    known === null ||
    known.id !== input.registerId ||
    known.venueId !== input.venueId ||
    known.drawer !== REGISTER_DRAWER.PRESENT ||
    known.printerId === null
  ) {
    return null;
  }

  return known;
};

const recordOpening = (
  audits: RecordAuditEvent,
  input: OpenDrawerInput,
): Promise<unknown> =>
  audits.execute({
    tenantId: input.tenantId,
    actorId: input.actorId,
    authorizerId: input.authorizerId,
    deviceId: input.deviceId,
    siteId: input.venueId,
    action: DRAWER_OPENED,
    entity: input.registerId,
    before: { value: 0 },
    after: { value: OPENING, shiftId: input.shiftId, kitchen: null },
    reason: input.reason,
  });

export class OpenDrawer {
  constructor(
    private readonly registerLookup: RegisterLookup,
    private readonly counts: CountExecutedOperations,
    private readonly permissions: EvaluatePermission,
    private readonly grants: ConsumeAuthorization,
    private readonly audits: RecordAuditEvent,
    private readonly printer: Printer,
  ) {}

  async execute(input: OpenDrawerInput): Promise<void> {
    const register = await readyDrawer(this.registerLookup, input);

    if (register === null || register.printerId === null) {
      return;
    }

    const shiftTotals = await this.counts.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      shiftId: input.shiftId,
    });
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.CASH_OPEN_DRAWER,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: OPENING,
      supportGrantId: null,
      shiftTotals,
    });

    if (decision.outcome === "denied") {
      return;
    }

    if (decision.outcome === "requires_authorization") {
      const consumed = await this.consumeGrant(input);

      if (!consumed) {
        return;
      }
    }

    await this.printer.enqueue({
      commandId: input.commandId,
      printerId: register.printerId,
      document: "drawer_open",
      kickDrawer: true,
    });
    await recordOpening(this.audits, input);
  }

  private async consumeGrant(input: OpenDrawerInput): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await this.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission: PERMISSION.CASH_OPEN_DRAWER,
        targetId: input.registerId,
        value: OPENING,
      });
    } catch (error: unknown) {
      if (error instanceof UnknownAuthorizationReference) {
        return false;
      }

      throw error;
    }
  }
}
