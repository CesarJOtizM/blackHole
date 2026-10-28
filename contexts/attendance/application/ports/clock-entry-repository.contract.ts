import { expect, it } from "vitest";

import type {
  ClockEntry,
  ClockEntryRepository,
  ListClockEntries,
} from "#application/ports/clock-entry-repository.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const USER_A = "identity_user_a";
const USER_B = "identity_user_b";
const COMMAND_ID = "command_clock_1";

const entry = (overrides: Partial<ClockEntry> = {}): ClockEntry => ({
  id: "clock_entry_1",
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  userId: USER_A,
  deviceId: "device_terminal",
  kind: "clock_in",
  presence: "matched",
  occurredAt: "2026-10-26T13:00:00.000Z",
  commandId: COMMAND_ID,
  cashRegisterId: null,
  pendingReview: false,
  ...overrides,
});

const queryFor = (tenantId: string, userId: string): ListClockEntries => ({
  tenantId,
  venueId: VENUE_ID,
  userId,
});

const only = (rows: readonly ClockEntry[]): ClockEntry => {
  const row = rows[0];

  if (row === undefined || rows.length !== 1) {
    throw new Error("Expected one clock entry.");
  }

  return row;
};

export function clockEntryRepositoryContract(
  createRepository: () => ClockEntryRepository | Promise<ClockEntryRepository>,
): void {
  it("given a clock entry, when it is appended, then list returns an equal copy", async () => {
    const repository = await createRepository();
    const stored = entry();

    await repository.append(stored);

    const listed = await repository.list(queryFor(TENANT_A, USER_A));
    expect(listed).toEqual([stored]);
    expect(listed[0]).not.toBe(stored);
  });

  it("given the object returned by list, when it is mutated, then the stored row stays unchanged", async () => {
    const repository = await createRepository();
    const stored = entry();
    await repository.append(stored);

    const returned = only(await repository.list(queryFor(TENANT_A, USER_A)));
    returned.kind = "clock_out";
    returned.occurredAt = "2026-10-26T18:00:00.000Z";
    returned.pendingReview = true;

    expect(await repository.list(queryFor(TENANT_A, USER_A))).toEqual([stored]);
  });

  it("given an entry stored for tenant A, when tenant B lists and lists by venue with the same venue, user, and command, then the entry stays hidden", async () => {
    const repository = await createRepository();
    const stored = entry({
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      userId: USER_A,
      commandId: COMMAND_ID,
    });
    await repository.append(stored);

    expect(await repository.list(queryFor(TENANT_A, USER_A))).toEqual([stored]);
    expect(await repository.listByVenue(TENANT_A, VENUE_ID)).toEqual([stored]);
    expect(await repository.list(queryFor(TENANT_B, USER_A))).toEqual([]);
    expect(await repository.listByVenue(TENANT_B, VENUE_ID)).toEqual([]);
  });

  it("given the same tenant and command appended twice, when the retry is appended, then one row remains", async () => {
    const repository = await createRepository();
    const first = entry({
      id: "clock_entry_first",
      occurredAt: "2026-10-26T13:00:00.000Z",
    });
    const retry = entry({
      id: "clock_entry_retry",
      kind: "clock_out",
      occurredAt: "2026-10-26T18:00:00.000Z",
    });

    await repository.append(first);
    await repository.append(retry);

    expect(await repository.list(queryFor(TENANT_A, USER_A))).toEqual([first]);
    expect(await repository.listByVenue(TENANT_A, VENUE_ID)).toEqual([first]);
  });

  it("given a stored command, when another user appends it and a tenant looks it up, then the first row stays and the other tenant sees nothing", async () => {
    const repository = await createRepository();
    const first = entry({ id: "clock_entry_first" });
    await repository.append(first);
    await repository.append(
      entry({ id: "clock_entry_other", userId: USER_B, kind: "clock_out" }),
    );

    expect(await repository.findByCommand(TENANT_A, COMMAND_ID)).toEqual(first);
    expect(await repository.findByCommand(TENANT_B, COMMAND_ID)).toBeNull();
    expect(await repository.list(queryFor(TENANT_A, USER_B))).toEqual([]);
  });

  it("given an entry for one user, when another user in the same tenant and venue lists, then list omits the row and list by venue returns it", async () => {
    const repository = await createRepository();
    const stored = entry({ userId: USER_A });
    await repository.append(stored);

    expect(await repository.list(queryFor(TENANT_A, USER_B))).toEqual([]);
    expect(await repository.listByVenue(TENANT_A, VENUE_ID)).toEqual([stored]);
  });

  it("given a clock entry repository, when the instance is inspected, then it has no update method and no delete method", async () => {
    const repository = await createRepository();

    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });
}
