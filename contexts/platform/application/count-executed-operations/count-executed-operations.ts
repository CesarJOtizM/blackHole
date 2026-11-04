import type {
  AuditEvent,
  AuditRepository,
} from "#application/ports/audit-repository.js";
import type { AuthorizationShiftTotals } from "#domain/authorization.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const FAILED_PIN_ACTION = "pin.confirmation-failed";

export interface CountExecutedOperationsQuery {
  tenantId: string;
  actorId: string;
  shiftId: string;
}

interface ExecutedOperation {
  value: number;
  shiftId: string;
  kitchen: "before" | "after" | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameState = (before: unknown, after: unknown): boolean =>
  JSON.stringify(before) === JSON.stringify(after);

const executedOperation = (after: unknown): ExecutedOperation | null => {
  if (!isRecord(after)) {
    return null;
  }

  const { value, shiftId, kitchen } = after;

  if (
    typeof value !== "number" ||
    typeof shiftId !== "string" ||
    (kitchen !== "before" && kitchen !== "after" && kitchen !== null)
  ) {
    return null;
  }

  return { value, shiftId, kitchen };
};

const deniedDecision = (after: unknown): boolean =>
  isRecord(after) && after.approved === false;

const counts = (
  event: AuditEvent,
  query: CountExecutedOperationsQuery,
  operation: ExecutedOperation,
): boolean =>
  event.kind === "event" &&
  event.actorId === query.actorId &&
  event.action !== FAILED_PIN_ACTION &&
  operation.shiftId === query.shiftId &&
  !deniedDecision(event.after) &&
  !sameState(event.before, event.after);

export class CountExecutedOperations {
  constructor(private readonly audits: AuditRepository) {}

  async execute(
    query: CountExecutedOperationsQuery,
  ): Promise<AuthorizationShiftTotals> {
    const stored = await this.audits.list(query.tenantId, null);
    let waiterVoidsBeforeKitchen = 0;
    let compShiftCop = 0;

    for (const event of stored) {
      const operation = executedOperation(event.after);

      if (operation === null || !counts(event, query, operation)) {
        continue;
      }

      if (event.action === PERMISSION.SALE_VOID_BEFORE_KITCHEN) {
        waiterVoidsBeforeKitchen += 1;
      }

      if (event.action === PERMISSION.SALE_COMP) {
        compShiftCop += operation.value;
      }
    }

    return { waiterVoidsBeforeKitchen, compShiftCop };
  }
}
