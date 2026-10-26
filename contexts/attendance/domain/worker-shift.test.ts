import { expect, it } from "vitest";

import {
  SecondClockIn,
  ShiftTransitionRejected,
  WorkerShift,
} from "#domain/worker-shift.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const USER_ID = "user_waiter";
const IN_AT = "2026-10-23T13:00:00.000Z";
const BREAK_AT = "2026-10-23T17:00:00.000Z";
const BACK_AT = "2026-10-23T17:30:00.000Z";
const OUT_AT = "2026-10-23T21:00:00.000Z";

const openShift = () =>
  WorkerShift.open({
    tenantId: TENANT_ID,
    userId: USER_ID,
    venueId: VENUE_ID,
  });

const clockIn = (shift: WorkerShift) => {
  shift.record({
    kind: "clock_in",
    presence: "matched",
    occurredAt: IN_AT,
  });
};

it("given a worker with no marks, when the shift is opened, then the state is off_shift", () => {
  const shift = openShift();

  expect(shift.tenantId).toBe(TENANT_ID);
  expect(shift.userId).toBe(USER_ID);
  expect(shift.venueId).toBe(VENUE_ID);
  expect(shift.state).toBe("off_shift");
});

it("given the worker is off shift, when they clock in, then the state is on_shift", () => {
  const shift = openShift();

  clockIn(shift);

  expect(shift.state).toBe("on_shift");
});

it("given the worker is on shift, when they start a break, then the state is on_break", () => {
  const shift = openShift();
  clockIn(shift);

  shift.record({
    kind: "break_start",
    presence: "matched",
    occurredAt: BREAK_AT,
  });

  expect(shift.state).toBe("on_break");
});

it("given the worker is on a break, when they end the break, then the state is on_shift", () => {
  const shift = openShift();
  clockIn(shift);
  shift.record({
    kind: "break_start",
    presence: "matched",
    occurredAt: BREAK_AT,
  });

  shift.record({
    kind: "break_end",
    presence: "matched",
    occurredAt: BACK_AT,
  });

  expect(shift.state).toBe("on_shift");
});

it("given the worker is on shift, when they clock out, then the state is off_shift", () => {
  const shift = openShift();
  clockIn(shift);

  shift.record({
    kind: "clock_out",
    presence: "matched",
    occurredAt: OUT_AT,
  });

  expect(shift.state).toBe("off_shift");
});

it("given an open clock-in, when the worker clocks in again, then it is rejected and the state stays on_shift", () => {
  const shift = openShift();
  clockIn(shift);

  const again = () => {
    clockIn(shift);
  };

  expect(again).toThrow(SecondClockIn);
  expect(shift.state).toBe("on_shift");
});

it("given an open clock-in during a break, when the worker clocks in again, then it is rejected and the state stays on_break", () => {
  const shift = openShift();
  clockIn(shift);
  shift.record({
    kind: "break_start",
    presence: "matched",
    occurredAt: BREAK_AT,
  });

  const again = () => {
    clockIn(shift);
  };

  expect(again).toThrow(SecondClockIn);
  expect(shift.state).toBe("on_break");
});

it("given a flagged clock-in, when the shift is read, then the state stays off_shift", () => {
  const shift = openShift();

  shift.record({
    kind: "clock_in",
    presence: "flagged",
    occurredAt: IN_AT,
  });

  expect(shift.state).toBe("off_shift");
});

it("given a flagged clock-in, when the worker clocks in on the premises, then the state is on_shift", () => {
  const shift = openShift();
  shift.record({
    kind: "clock_in",
    presence: "flagged",
    occurredAt: IN_AT,
  });

  clockIn(shift);

  expect(shift.state).toBe("on_shift");
});

it("given an open clock-in and a flagged clock-out, when the worker clocks in again, then it is rejected", () => {
  const shift = openShift();
  clockIn(shift);
  shift.record({
    kind: "clock_out",
    presence: "flagged",
    occurredAt: OUT_AT,
  });

  const again = () => {
    clockIn(shift);
  };

  expect(again).toThrow(SecondClockIn);
  expect(shift.state).toBe("on_shift");
});

it("given an open shift, when it is closed for review, then the state is pending_review", () => {
  const shift = openShift();
  clockIn(shift);

  shift.record({
    kind: "clock_out",
    presence: "matched",
    occurredAt: OUT_AT,
    pendingReview: true,
  });

  expect(shift.state).toBe("pending_review");
});

it("given a shift closed for review, when the worker clocks in again, then the state is on_shift", () => {
  const shift = openShift();
  clockIn(shift);
  shift.record({
    kind: "clock_out",
    presence: "matched",
    occurredAt: OUT_AT,
    pendingReview: true,
  });

  clockIn(shift);

  expect(shift.state).toBe("on_shift");
});

it("given the worker is off shift, when they start a break, then it is rejected and the state stays off_shift", () => {
  const shift = openShift();

  const start = () => {
    shift.record({
      kind: "break_start",
      presence: "matched",
      occurredAt: BREAK_AT,
    });
  };

  expect(start).toThrow(ShiftTransitionRejected);
  expect(shift.state).toBe("off_shift");
});
