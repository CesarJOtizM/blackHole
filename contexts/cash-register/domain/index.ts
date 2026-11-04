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
  ShiftPayment,
  ShiftState,
  TenderMethod,
} from "#domain/cash-shift.js";
export {
  CashShift,
  InvalidCashAmount,
  InvalidMovementId,
  InvalidOriginalPayment,
  InvalidReplacementId,
  InvalidReversalId,
  InvalidShiftId,
  InvalidTenderMethod,
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
