# Proposal: Cash Register

## Intent

The site must collect every account with any payment method and close each shift with a blind cash count, so differences come from what was counted, not from what the system showed (PRD-M2 HU-M2-01, HU-M2-02; PRD-00 sec. 7 M2, sec. 6.5). A closed shift is immutable.

## Scope

### In Scope
- Shifts per cashier and cash register: opening float by denomination, partial close, final close.
- Payment methods: cash with change, card registered from a card terminal (terminal, approval, brand, last 4), transfers and wallets, vouchers, customer or corporate credit.
- Mixed payments; account split by diner, by products or equal parts (orders context keeps line origin).
- Tip asked on every payment and recorded per payment and method, outside the sale.
- Cash in, cash out and withdrawals with reason.
- Blind cash count by denomination and method; comparison with each card terminal closing report; difference justification and approval by another person.
- Immutable close; corrections as new movements.
- Sale closure handoff to invoicing; table moves to "to clean".

### Out of Scope
- Fiscal document emission → 1.5; withholdings on corporate payments → 1.4.
- Closing report and drawer printing, print queue → 1.6.
- Sensitive-action authorization (drawer without sale, reopen, change payment method) → 1.7.
- Tip pool and distribution → 1.10. QR table payment → 1.13.
- Reservation deposits → 3.7; courier cash and platform receivables → 3.1, 3.2.
- Direct card-terminal integration → 5.2.

## Capabilities

### New Capabilities
- `cash-register`: shifts, payments, split, tips capture, movements, blind count, terminal reconciliation, immutable close.

### Modified Capabilities
None

## Approach

New bounded context `cash-register` (TRD-M2 sec. 1-2): `CashShift` aggregate, `CashMovement`, `Payment`, `CashCount` rule. Amounts are integers in pesos. Runs where the dining room runs: local-node in hybrid, api-cloud in cloud mode. Reads accounts through the `orders` entry port; card terminal behind a `CardTerminal` port with a manual adapter. Outbox in the same transaction as each payment.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/cash-register/{domain,application}` | New | Shift, payment, count, use cases |
| `contexts/cash-register/adapters/{postgres,sqlite,http,manual-terminal}` | New | Persistence, HTTP, manual terminal |
| `contexts/orders/application/entry-port.ts` | Modified | Read account, split, mark paid |
| `shared/contracts` | Modified | `ShiftClosed`, `PaymentRecorded`, sale-closed handoff |
| `apps/local-node`, `apps/api-cloud`, `apps/venue-app` | Modified/New | Hosts and cash screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Expected total leaked before counting | Med | Result exists only after count submission; permission-gated |
| Rounding errors in split | Med | Integer amounts, deterministic remainder |
| Invoicing not yet available | High | Sale-closed handoff queued until 1.5 consumes it |

## Rollback Plan

Disable the cash module per site and return to the previous cash process. Closed shifts are append-only; keep tables (`cash_shifts`, `cash_movements`, `payments`, `cash_counts`) read-only rather than dropping them, to preserve trial data.

## Dependencies

- 1.2 accounts and table states; 0.3 cash registers; 0.5 permissions; 0.6 audit.

## Success Criteria

- [ ] A trial shift with every payment method balances against what was counted.
- [ ] Cashier and supervisor cannot see the expected total before counting.
- [ ] A closed shift rejects any edit.
