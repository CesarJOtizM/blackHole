const CLOCK_KIND = {
  CLOCK_IN: "clock_in",
  CLOCK_OUT: "clock_out",
  BREAK_START: "break_start",
  BREAK_END: "break_end",
} as const;

const SHIFT_STATE = {
  OFF_SHIFT: "off_shift",
  ON_SHIFT: "on_shift",
  ON_BREAK: "on_break",
  PENDING_REVIEW: "pending_review",
} as const;

const PRESENCE = {
  MATCHED: "matched",
  FLAGGED: "flagged",
} as const;

export type ClockKind = (typeof CLOCK_KIND)[keyof typeof CLOCK_KIND];

export type ShiftState = (typeof SHIFT_STATE)[keyof typeof SHIFT_STATE];

export type ClockPresence = (typeof PRESENCE)[keyof typeof PRESENCE];

export interface ClockMark {
  kind: ClockKind;
  presence: ClockPresence;
  occurredAt: string;
  pendingReview?: boolean;
}

interface OpenShift {
  tenantId: string;
  userId: string;
  venueId: string;
}

export class SecondClockIn extends Error {
  constructor() {
    super("A worker already has an open clock-in at this venue.");
    this.name = "SecondClockIn";
  }
}

export class ShiftTransitionRejected extends Error {
  constructor() {
    super("That clock event is not valid for the current shift.");
    this.name = "ShiftTransitionRejected";
  }
}

export class WorkerShift {
  readonly tenantId: string;
  readonly userId: string;
  readonly venueId: string;

  private readonly marks: ClockMark[] = [];

  private constructor(input: OpenShift) {
    this.tenantId = input.tenantId;
    this.userId = input.userId;
    this.venueId = input.venueId;
  }

  static open(input: OpenShift): WorkerShift {
    return new WorkerShift(input);
  }

  get state(): ShiftState {
    let state: ShiftState = SHIFT_STATE.OFF_SHIFT;

    for (const mark of this.marks) {
      state = applyMark(state, mark);
    }

    return state;
  }

  record(mark: ClockMark): void {
    const stored = {
      kind: mark.kind,
      presence: mark.presence,
      occurredAt: mark.occurredAt,
      pendingReview: mark.pendingReview === true,
    };

    applyMark(this.state, stored);
    this.marks.push(stored);
  }
}

function applyMark(state: ShiftState, mark: ClockMark): ShiftState {
  if (mark.presence === PRESENCE.FLAGGED) {
    return state;
  }

  if (mark.kind === CLOCK_KIND.CLOCK_IN) {
    if (state === SHIFT_STATE.ON_SHIFT || state === SHIFT_STATE.ON_BREAK) {
      throw new SecondClockIn();
    }

    return SHIFT_STATE.ON_SHIFT;
  }

  if (mark.kind === CLOCK_KIND.BREAK_START && state === SHIFT_STATE.ON_SHIFT) {
    return SHIFT_STATE.ON_BREAK;
  }

  if (mark.kind === CLOCK_KIND.BREAK_END && state === SHIFT_STATE.ON_BREAK) {
    return SHIFT_STATE.ON_SHIFT;
  }

  if (mark.kind === CLOCK_KIND.CLOCK_OUT && state === SHIFT_STATE.ON_SHIFT) {
    if (mark.pendingReview) {
      return SHIFT_STATE.PENDING_REVIEW;
    }

    return SHIFT_STATE.OFF_SHIFT;
  }

  throw new ShiftTransitionRejected();
}
