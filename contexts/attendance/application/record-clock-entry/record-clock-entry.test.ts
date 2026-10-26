import { expect, it } from "vitest";

import {
  type AttendancePolicy,
  AttendancePolicyRepository,
  defaultAttendancePolicy,
} from "#application/ports/attendance-policy-repository.js";
import { Clock } from "#application/ports/clock.js";
import {
  type ClockEntry,
  ClockEntryRepository,
  type ListClockEntries,
} from "#application/ports/clock-entry-repository.js";
import {
  PinCheck,
  PinCheckRejected,
  PlatformPinCheck,
  type PlatformPinConfirmation,
} from "#application/ports/pin-check.js";
import {
  RecordClockEntry,
  type RecordClockEntryCommand,
} from "#application/record-clock-entry/record-clock-entry.js";
import { SecondClockIn } from "#domain/worker-shift.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const USER_ID = "user_cashier";
const DEVICE_ID = "device_phone";
const SESSION_ID = "session_pin_1";
const REGISTER_ID = "organization_register_front";
const SERVER_AT = "2026-10-23T13:00:00.000Z";
const PHONE_AT = "2026-10-23T13:30:00.000Z";
const SERVER_MS = Date.parse(SERVER_AT);
const VENUE = { latitude: 4.711, longitude: -74.0721 };
const FENCE = { ...VENUE, radiusMeters: 100 };
const OUTSIDE = { latitude: 4.713, longitude: -74.0721 };
const MINUTE_MS = 60_000;

class FrozenClock extends Clock {
  private instant: number;

  constructor(instant: number) {
    super();
    this.instant = instant;
  }

  override now(): number {
    return this.instant;
  }

  advance(milliseconds: number): void {
    this.instant += milliseconds;
  }
}

class MemoryClockEntries extends ClockEntryRepository {
  readonly rows: ClockEntry[] = [];

  override async append(entry: ClockEntry): Promise<void> {
    this.rows.push({ ...entry });
  }

  override async list(query: ListClockEntries): Promise<readonly ClockEntry[]> {
    return this.rows
      .filter(
        (row) =>
          row.tenantId === query.tenantId &&
          row.venueId === query.venueId &&
          row.userId === query.userId,
      )
      .map((row) => ({ ...row }));
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClockEntry[]> {
    return this.rows
      .filter((row) => row.tenantId === tenantId && row.venueId === venueId)
      .map((row) => ({ ...row }));
  }
}

class MemoryPolicies extends AttendancePolicyRepository {
  constructor(private readonly policy: AttendancePolicy | null) {
    super();
  }

  override async find(
    tenantId: string,
    venueId: string,
  ): Promise<AttendancePolicy | null> {
    if (
      this.policy === null ||
      this.policy.tenantId !== tenantId ||
      this.policy.venueId !== venueId
    ) {
      return null;
    }

    return this.policy;
  }
}

class AcceptingPinCheck extends PinCheck {
  override async confirm(): Promise<void> {}
}

class RejectingPinCheck extends PinCheck {
  override async confirm(): Promise<void> {
    throw new PinCheckRejected();
  }
}

const scheduledPolicy = (operationRuleEnabled = false): AttendancePolicy => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  geofence: FENCE,
  toleranceMinutes: 10,
  closeTime: "22:00",
  operationRuleEnabled,
  mode: "scheduled",
  schedule: {
    startsAt: SERVER_AT,
    endsAt: "2026-10-23T21:00:00.000Z",
  },
});

const hoursPolicy = (
  geofence: AttendancePolicy["geofence"],
  operationRuleEnabled: boolean,
): AttendancePolicy => ({
  ...defaultAttendancePolicy(TENANT_ID, VENUE_ID),
  geofence,
  toleranceMinutes: 10,
  closeTime: "22:00",
  operationRuleEnabled,
});

const harness = (
  policy: AttendancePolicy | null,
  pins: PinCheck = new AcceptingPinCheck(),
) => {
  const clock = new FrozenClock(SERVER_MS);
  const entries = new MemoryClockEntries();
  const record = new RecordClockEntry(
    clock,
    pins,
    entries,
    new MemoryPolicies(policy),
  );

  return { clock, entries, record };
};

const command = (
  overrides: Partial<RecordClockEntryCommand> = {},
): RecordClockEntryCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  userId: USER_ID,
  deviceId: DEVICE_ID,
  sessionId: SESSION_ID,
  pin: "2468",
  kind: "clock_in",
  coordinates: VENUE,
  commandId: "command_clock_in",
  claimedAt: PHONE_AT,
  ...overrides,
});

it("given a phone clock 30 minutes ahead, when the worker clocks in, then the entry uses the server clock", async () => {
  const { record } = harness(scheduledPolicy());

  const result = await record.execute(command());

  expect(result.entry.occurredAt).toBe(SERVER_AT);
  expect(result.entry.deviceId).toBe(DEVICE_ID);
});

it("given the same commandId, when the clock-in is retried, then the same row is returned", async () => {
  const { clock, entries, record } = harness(scheduledPolicy());
  const first = await record.execute(command());

  clock.advance(30 * MINUTE_MS);
  const retry = await record.execute(
    command({ claimedAt: "2026-10-23T14:00:00.000Z" }),
  );

  expect(entries.rows).toHaveLength(1);
  expect(retry.entry).toEqual(first.entry);
  expect(retry.entry.occurredAt).toBe(SERVER_AT);
});

it("given an open clock-in, when the worker clocks in again, then it is rejected and only one row is stored", async () => {
  const { entries, record } = harness(scheduledPolicy());
  await record.execute(command());

  const again = record.execute(
    command({ commandId: "command_clock_in_again" }),
  );

  await expect(again).rejects.toBeInstanceOf(SecondClockIn);
  expect(entries.rows).toHaveLength(1);
});

it("given a coordinate inside the geofence, when the worker clocks in, then presence is matched and the rule stays off", async () => {
  const { record } = harness(scheduledPolicy());

  const result = await record.execute(command());

  expect(result.entry.presence).toBe("matched");
  expect(result.operation.counting).toBe(true);
  expect(result.operation.ruleEnabled).toBe(false);
});

it("given a coordinate outside the geofence and the rule on, when the worker clocks in, then the row is flagged and does not enable operation", async () => {
  const { entries, record } = harness(scheduledPolicy(true));

  const missed = await record.execute(
    command({
      commandId: "command_miss",
      coordinates: OUTSIDE,
      cashRegisterId: REGISTER_ID,
    }),
  );

  expect(missed.entry.presence).toBe("flagged");
  expect(missed.operation.ruleEnabled).toBe(true);
  expect(missed.operation.counting).toBe(false);
  expect(missed.openCashRegisterId).toBeNull();
  expect(entries.rows).toHaveLength(1);

  const matched = await record.execute(
    command({
      commandId: "command_inside",
      cashRegisterId: REGISTER_ID,
    }),
  );

  expect(matched.entry.presence).toBe("matched");
  expect(matched.operation.counting).toBe(true);
  expect(entries.rows).toHaveLength(2);
});

it("given the venue has no geofence, when the worker clocks in, then the row is flagged and does not enable operation", async () => {
  const { entries, record } = harness(hoursPolicy(null, true));

  const result = await record.execute(command());

  expect(result.entry.presence).toBe("flagged");
  expect(result.operation.ruleEnabled).toBe(true);
  expect(result.operation.counting).toBe(false);
  expect(entries.rows).toHaveLength(1);
});

it("given no attendance policy, when the worker clocks in, then the operation rule is off", async () => {
  const { record } = harness(null);

  const result = await record.execute(command());

  expect(result.operation.ruleEnabled).toBe(false);
  expect(
    defaultAttendancePolicy(TENANT_ID, VENUE_ID).operationRuleEnabled,
  ).toBe(false);
});

it("given a cashier clocks in with a register, when they later clock out, then the register was kept until clock-out", async () => {
  const { clock, entries, record } = harness(scheduledPolicy());
  const clockIn = await record.execute(
    command({ cashRegisterId: REGISTER_ID }),
  );

  expect(clockIn.entry.cashRegisterId).toBe(REGISTER_ID);
  expect(clockIn.openCashRegisterId).toBe(REGISTER_ID);

  clock.advance(MINUTE_MS);
  const onBreak = await record.execute(
    command({ kind: "break_start", commandId: "command_break_start" }),
  );

  expect(onBreak.openCashRegisterId).toBe(REGISTER_ID);

  clock.advance(MINUTE_MS);
  await record.execute(
    command({ kind: "break_end", commandId: "command_break_end" }),
  );
  clock.advance(MINUTE_MS);
  const clockOut = await record.execute(
    command({ kind: "clock_out", commandId: "command_clock_out" }),
  );

  expect(clockOut.openCashRegisterId).toBeNull();
  expect(clockOut.operation.counting).toBe(false);
  expect(entries.rows[0]?.cashRegisterId).toBe(REGISTER_ID);
  expect(entries.rows[3]?.kind).toBe("clock_out");
  expect(entries.rows[3]?.cashRegisterId).toBeNull();
});

it("given the pin is rejected, when the worker clocks in, then nothing is stored", async () => {
  const { entries, record } = harness(
    scheduledPolicy(),
    new RejectingPinCheck(),
  );

  const act = record.execute(command());

  await expect(act).rejects.toBeInstanceOf(PinCheckRejected);
  expect(entries.rows).toHaveLength(0);
});

it("given a platform pin verifier, when attendance checks a pin, then the verifier receives the session and the pin", async () => {
  let seen: PlatformPinConfirmation | null = null;
  const check = new PlatformPinCheck({
    confirm: async (input) => {
      seen = input;
    },
  });

  await check.confirm({
    tenantId: TENANT_ID,
    userId: USER_ID,
    pin: "2468",
    deviceId: DEVICE_ID,
    sessionId: SESSION_ID,
  });

  expect(seen).toEqual({
    tenantId: TENANT_ID,
    userId: USER_ID,
    pin: "2468",
    sessionId: SESSION_ID,
  });
});
