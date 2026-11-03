import { sensitiveActionEnvelope } from "@blackhole/contracts";
import { expect, it } from "vitest";

const envelope = {
  permission: "sale.discount",
  targetId: "check_1",
  authorizationId: null,
  reason: "regular",
  value: 10,
  shiftId: "shift_1",
  shiftTotals: { waiterVoidsBeforeKitchen: 2, compShiftCop: 90_000 },
};

it("given a sensitive-action envelope, when it is parsed, then the schema accepts the target and shift totals and rejects a body without permission", () => {
  const accepted = sensitiveActionEnvelope.safeParse(envelope);
  const rejected = sensitiveActionEnvelope.safeParse({
    targetId: envelope.targetId,
    authorizationId: envelope.authorizationId,
    reason: envelope.reason,
    value: envelope.value,
    shiftId: envelope.shiftId,
    shiftTotals: envelope.shiftTotals,
  });

  expect(accepted.success).toBe(true);
  if (accepted.success) {
    expect(accepted.data).toEqual(envelope);
  }
  expect(rejected.success).toBe(false);
});
