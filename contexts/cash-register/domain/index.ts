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
  DistributeTipsInput,
  TipDistribution,
  TipDistributionMode,
  TipDistributionParticipant,
  TipDistributionPercentage,
  TipShare,
} from "#domain/distribute-tips.js";
export {
  distributeTips,
  InvalidTipDistribution,
} from "#domain/distribute-tips.js";
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
export type { TipPeriodKind } from "#domain/tip-period.js";
export {
  InvalidTipInstant,
  InvalidTipWindow,
  TipPeriod,
} from "#domain/tip-period.js";
export type { TipPercentage, TipRuleMode } from "#domain/tip-rule.js";
export {
  InvalidTipPercentage,
  InvalidTipRoleShare,
  TipRule,
} from "#domain/tip-rule.js";
export type {
  AdjustTipSettlement,
  CloseTipSettlement,
  TipSettlement,
  TipSettlementMode,
  TipSettlementParticipant,
  TipSettlementPercentage,
  TipSettlementRuleSnapshot,
  TipSettlementShare,
} from "#domain/tip-settlement.js";
export {
  InvalidTipSettlementId,
  MissingTipSettlement,
  TipSettlements,
  TipShareEditRejected,
} from "#domain/tip-settlement.js";
