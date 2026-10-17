# Proposal: QR Table Payment

## Intent

Customers should pay their table's balance and tip from the same QR portal, for the exact amount, without queuing at the register. A payment exists only when the gateway confirms it, once; then the invoice is issued and the table is freed. QR money must stay out of cash in the cash count (PRD-00 6.1.3, PRD-M2 HU-M2-03, TRD-00 6.4, ADR-016).

## Scope

### In Scope
- Balance and optional tip in the portal, from the table QR or pre-bill QR; split parts paid separately.
- Charge for the exact server-computed amount with a unique reference per charge.
- Confirmation only by signed gateway webhook; duplicates ignored.
- Applying the payment to the open shift, invoice on confirmation (or pending), table to "to clean".
- Payments made during an outage applied on reconnection, once.
- QR as a separate method in the blind cash count; reconciliation against the gateway report.

### Out of Scope
- Card terminal integration → 5.2; reservation payment gateway → 5.3.
- Reservation deposits by transfer → 3.7 (do not use this gateway).
- QR payment share in reports → 1.11 already separates it.

## Capabilities

### New Capabilities
- `qr-table-payment`: balance and tip, exact-amount charge, webhook confirmation, application, outage handling, reconciliation.

### Modified Capabilities
- `cash-register` (delta): QR payment method in the shift and blind count, pending-application handling.

## Approach

Charges are born only in api-cloud behind a payment-gateway port; the node never talks to the gateway (TRD-M2 sec. 1). Confirmed payments sync to the operation owner with top priority and apply idempotently by reference, requesting the invoice with portal data (1.8). The adapter waits for ADR-016.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/cash-register/domain`, `contexts/cash-register/application` | Modified | QR charge, confirmation, application, reconciliation |
| `contexts/cash-register/adapters/payment-gateway` | New | ADR-016 provider adapter |
| `contexts/invoicing/application` | Modified | Invoice on QR confirmation |
| `contexts/orders/application/entry-port.ts` | Modified | Account balance, table to clean |
| `apps/customer-portal`, `apps/api-cloud` | Modified | Pay screen, webhook endpoint |
| `apps/local-node`, `apps/site-app` | Modified | Apply payment; QR totals in count |
| `shared/contracts`, `shared/sync` | Modified | Confirmed-payment contract, priority |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ADR-016 gateway undecided | High | Blocks this delivery only; contract defined first |
| Duplicate or forged webhook | Med | Signature check, unique reference |
| No open shift when a payment arrives (docs silent) | Med | Spec keeps it pending and alerts; product owner confirms |
| Balance changes after charge starts | Med | Charge bound to balance snapshot; mismatch flagged |

## Rollback Plan

A per-site flag hides the pay button; customers pay at the register. Confirmed but unapplied payments keep being applied (money already received). Gateway settlement continues for reconciliation.

## Dependencies

- ADR-016 decision; gateway merchant account.
- p1-03, p1-05, p1-08, p1-10, p1-12, p0-07.

## Success Criteria

- [ ] A customer pays the bill from the QR, the gateway confirms only once, the invoice is issued and the table becomes "to clean". The cash count separates that money from cash.
- [ ] A payment made during an outage is applied once on reconnection.
