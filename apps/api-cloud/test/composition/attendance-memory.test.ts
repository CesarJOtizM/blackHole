import { expect, it } from "vitest";

import { InMemoryClockEntryCorrectionRepository } from "#src/composition/attendance-memory.js";

it("given two tenants stored the same entry id, when one tenant lists corrections, then the other tenant's row stays hidden", async () => {
  const corrections = new InMemoryClockEntryCorrectionRepository();
  const entryId = "clock_entry_command_shared";

  await corrections.appendCorrection({
    tenantId: "organization_company_1",
    entryId,
    occurredAt: "2026-10-26T18:00:00.000Z",
    reason: "Company one",
  });
  await corrections.appendCorrection({
    tenantId: "organization_company_2",
    entryId,
    occurredAt: "2026-10-26T19:00:00.000Z",
    reason: "Company two",
  });

  const listed = await corrections.listCorrections({
    tenantId: "organization_company_1",
    entryIds: [entryId],
  });

  expect(listed).toEqual([
    {
      tenantId: "organization_company_1",
      entryId,
      occurredAt: "2026-10-26T18:00:00.000Z",
      reason: "Company one",
    },
  ]);
});
