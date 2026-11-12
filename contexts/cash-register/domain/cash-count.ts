import {
  InvalidCashAmount,
  InvalidMovementId,
  MissingReason,
} from "#domain/cash-shift.js";

const COUNT_ID_PREFIX = "count_";
const MOVEMENT_ID_PREFIX = "movement_";

const COUNT_STATE = {
  OPEN: "open",
  COUNTING: "counting",
  CLOSED: "closed",
} as const;

const DENOMINATION_COP = [
  50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000,
] as const;

export type CountState = (typeof COUNT_STATE)[keyof typeof COUNT_STATE];

export type CashDenomination = (typeof DENOMINATION_COP)[number];

const DENOMINATIONS = new Set<number>(DENOMINATION_COP);

export interface DenominationLine {
  denomination: CashDenomination;
  quantity: number;
}

export interface TerminalReport {
  terminalId: string;
  recordedCop: number;
  reportedCop: number;
}

export interface TerminalDifference {
  terminalId: string;
  differenceCop: number;
}

export interface SubmitCashCount {
  denominations: readonly DenominationLine[];
  expectedCashCop: number;
  terminals: readonly TerminalReport[];
  qrCop?: number;
  qrReportCop?: number;
}

export interface ApproveCashCount {
  approverId: string;
  justification: string;
}

export interface CountCorrection {
  id: string;
  referencesId: string;
  amountCop: number;
  reason: string;
}

interface Submission {
  denominations: DenominationLine[];
  expectedCashCop: number;
  countedCashCop: number;
  terminals: TerminalDifference[];
  qrCop?: number;
  qrReportCop?: number;
}

export interface StartCashCount {
  id: string;
  countedBy: string;
}

export class InvalidCountId extends Error {
  constructor() {
    super("A count identifier must use the count_ prefix.");
    this.name = "InvalidCountId";
  }
}

export class VarianceNeedsApproval extends Error {
  constructor() {
    super("A difference needs a justification and another person's approval.");
    this.name = "VarianceNeedsApproval";
  }
}

export class SelfApprovalRejected extends Error {
  constructor() {
    super("The person who counted cannot approve the difference.");
    this.name = "SelfApprovalRejected";
  }
}

export class ShiftClosed extends Error {
  constructor() {
    super("A closed shift cannot be changed.");
    this.name = "ShiftClosed";
  }
}

export class CountingRejectsCharges extends Error {
  constructor() {
    super("A shift that is counting rejects new charges.");
    this.name = "CountingRejectsCharges";
  }
}

function assertCountId(id: string): void {
  if (!id.startsWith(COUNT_ID_PREFIX) || id.length === COUNT_ID_PREFIX.length) {
    throw new InvalidCountId();
  }
}

function assertMovementId(id: string): void {
  if (
    !id.startsWith(MOVEMENT_ID_PREFIX) ||
    id.length === MOVEMENT_ID_PREFIX.length
  ) {
    throw new InvalidMovementId();
  }
}

function assertCop(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new InvalidCashAmount();
  }
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new InvalidCashAmount();
  }
}

function assertReason(reason: string): void {
  if (reason.trim().length === 0) {
    throw new MissingReason();
  }
}

function assertDenomination(
  denomination: number,
): asserts denomination is CashDenomination {
  if (!DENOMINATIONS.has(denomination)) {
    throw new InvalidCashAmount();
  }
}

function needsApproval(submission: Submission): boolean {
  if (submission.countedCashCop !== submission.expectedCashCop) {
    return true;
  }

  return submission.terminals.some((terminal) => terminal.differenceCop !== 0);
}

function readSubmission(input: SubmitCashCount): Submission {
  assertCop(input.expectedCashCop);

  const denominations = input.denominations.map((line) => {
    assertDenomination(line.denomination);
    assertQuantity(line.quantity);

    return {
      denomination: line.denomination,
      quantity: line.quantity,
    };
  });
  const terminals = input.terminals.map((terminal) => {
    assertCop(terminal.recordedCop);
    assertCop(terminal.reportedCop);

    return {
      terminalId: terminal.terminalId,
      differenceCop: terminal.recordedCop - terminal.reportedCop,
    };
  });
  const countedCashCop = denominations.reduce(
    (total, line) => total + line.denomination * line.quantity,
    0,
  );

  if (input.qrCop !== undefined) {
    assertCop(input.qrCop);
  }

  if (input.qrReportCop !== undefined) {
    assertCop(input.qrReportCop);
  }

  return {
    denominations,
    expectedCashCop: input.expectedCashCop,
    countedCashCop,
    terminals,
    ...(input.qrCop === undefined ? {} : { qrCop: input.qrCop }),
    ...(input.qrReportCop === undefined
      ? {}
      : { qrReportCop: input.qrReportCop }),
  };
}

export class CashCount {
  readonly id: string;

  readonly countedBy: string;

  private stateValue: CountState = COUNT_STATE.OPEN;

  private submission: Submission | undefined;

  private approvedBy: string | undefined;

  private readonly recordedCorrections: CountCorrection[] = [];

  private constructor(id: string, countedBy: string) {
    this.id = id;
    this.countedBy = countedBy;
  }

  static start(input: StartCashCount): CashCount {
    assertCountId(input.id);

    return new CashCount(input.id, input.countedBy);
  }

  get state(): CountState {
    return this.stateValue;
  }

  get expectedCashCop(): number | undefined {
    return this.submission?.expectedCashCop;
  }

  get countedCashCop(): number | undefined {
    return this.submission?.countedCashCop;
  }

  get qrCop(): number | undefined {
    return this.submission?.qrCop;
  }

  get qrReportCop(): number | undefined {
    return this.submission?.qrReportCop;
  }

  get differenceCop(): number | undefined {
    if (!this.submission) {
      return undefined;
    }

    return this.submission.countedCashCop - this.submission.expectedCashCop;
  }

  get denominations(): readonly DenominationLine[] {
    return (this.submission?.denominations ?? []).map((line) => ({
      ...line,
    }));
  }

  get terminalDifferences(): readonly TerminalDifference[] {
    return (this.submission?.terminals ?? []).map((terminal) => ({
      ...terminal,
    }));
  }

  get corrections(): readonly CountCorrection[] {
    return this.recordedCorrections.map((correction) => ({ ...correction }));
  }

  submit(input: SubmitCashCount): void {
    if (this.stateValue === COUNT_STATE.CLOSED) {
      throw new ShiftClosed();
    }

    const submission = readSubmission(input);

    this.submission = submission;
    this.approvedBy = undefined;
    this.stateValue = COUNT_STATE.COUNTING;
  }

  approve(input: ApproveCashCount): void {
    if (this.stateValue === COUNT_STATE.CLOSED) {
      throw new ShiftClosed();
    }

    if (this.stateValue !== COUNT_STATE.COUNTING || !this.submission) {
      throw new VarianceNeedsApproval();
    }

    if (input.approverId === this.countedBy) {
      throw new SelfApprovalRejected();
    }

    if (
      input.approverId.trim().length === 0 ||
      input.justification.trim().length === 0
    ) {
      throw new VarianceNeedsApproval();
    }

    this.approvedBy = input.approverId;
  }

  partialClose(): void {
    if (this.stateValue === COUNT_STATE.CLOSED) {
      throw new ShiftClosed();
    }

    this.stateValue = COUNT_STATE.OPEN;
  }

  finalClose(): void {
    if (this.stateValue === COUNT_STATE.CLOSED) {
      throw new ShiftClosed();
    }

    if (this.stateValue !== COUNT_STATE.COUNTING || !this.submission) {
      throw new VarianceNeedsApproval();
    }

    if (needsApproval(this.submission) && this.approvedBy === undefined) {
      throw new VarianceNeedsApproval();
    }

    this.stateValue = COUNT_STATE.CLOSED;
  }

  recordCharge(): void {
    this.assertPaymentChangeAllowed();
  }

  editPayment(): void {
    this.assertPaymentChangeAllowed();
  }

  correct(input: CountCorrection): void {
    if (this.stateValue !== COUNT_STATE.CLOSED) {
      throw new ShiftClosed();
    }

    assertMovementId(input.id);
    assertCop(input.amountCop);
    assertReason(input.reason);

    this.recordedCorrections.push({
      id: input.id,
      referencesId: input.referencesId,
      amountCop: input.amountCop,
      reason: input.reason,
    });
  }

  private assertPaymentChangeAllowed(): void {
    if (this.stateValue === COUNT_STATE.COUNTING) {
      throw new CountingRejectsCharges();
    }

    if (this.stateValue === COUNT_STATE.CLOSED) {
      throw new ShiftClosed();
    }
  }
}
