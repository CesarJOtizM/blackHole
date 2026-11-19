import { shortageNotice } from "@blackhole/contracts";
import { expect, it } from "vitest";

const notice = {
  alertId: "alert_level_1",
  kind: "level",
  severity: "red",
  role: "siteAdministrator",
  venueId: "venue_1",
};

it("given a site administrator shortage notice, when it is parsed, then alert, kind, severity, role, and venue are accepted", () => {
  const accepted = shortageNotice.safeParse(notice);
  const manager = shortageNotice.safeParse({
    ...notice,
    role: "generalManager",
    severity: "critical",
  });
  const coverage = shortageNotice.safeParse({
    ...notice,
    kind: "coverage",
    severity: "yellow",
  });
  const dish = shortageNotice.safeParse({
    ...notice,
    kind: "dish",
    severity: "critical",
  });

  expect(accepted.success).toBe(true);
  if (accepted.success) {
    expect(accepted.data).toEqual(notice);
  }
  expect(manager.success).toBe(true);
  expect(coverage.success).toBe(true);
  expect(dish.success).toBe(true);
});

it("given a shortage notice with an unknown key, when it is parsed, then strict parsing rejects it", () => {
  const rejected = shortageNotice.safeParse({
    ...notice,
    tenantId: "tenant_1",
  });

  expect(rejected.success).toBe(false);
});

it("given a shortage notice for the kitchen chief, when it is parsed, then that role is rejected", () => {
  const rejected = shortageNotice.safeParse({
    ...notice,
    role: "kitchenChief",
  });

  expect(rejected.success).toBe(false);
});
