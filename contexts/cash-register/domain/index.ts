export const layer = "domain" as const;

export type {
  AccountPart,
  PayableLine,
  SplitLine,
} from "#domain/account-split.js";
export {
  AccountSplit,
  InvalidPartId,
  SplitImbalance,
} from "#domain/account-split.js";
export type {
  ApproveCashCount,
  CashDenomination,
  CountCorrection,
  CountState,
  DenominationLine,
  StartCashCount,
  SubmitCashCount,
  TerminalDifference,
  TerminalReport,
} from "#domain/cash-count.js";
export {
  CashCount,
  CountingRejectsCharges,
  InvalidCountId,
  SelfApprovalRejected,
  ShiftClosed,
  VarianceNeedsApproval,
} from "#domain/cash-count.js";
export type {
  CashMovement,
  CashMovementKind,
  PaymentReversal,
  ShiftState,
} from "#domain/cash-shift.js";
export {
  CashShift,
  InvalidCashAmount,
  InvalidMovementId,
  InvalidOriginalPayment,
  InvalidReversalId,
  InvalidShiftId,
  MissingReason,
  ShiftAlreadyOpen,
} from "#domain/cash-shift.js";
export type {
  PaymentMethod,
  PaymentTender,
  PaymentTip,
} from "#domain/payment.js";
export {
  ChangeExceedsCash,
  IncompleteCard,
  InvalidPaymentId,
  MissingTip,
  Payment,
} from "#domain/payment.js";
