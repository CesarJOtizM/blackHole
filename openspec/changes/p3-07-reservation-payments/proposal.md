# Proposal: Reservation Payments

## Intent

High-demand slots need a deposit or fee to reduce no-shows, but transfers to Nequi, Daviplata or Bre-B are checked by screenshot and refunds are improvised. This change adds configurable reservation charges, human-verified transfers with unique transaction numbers, cash taken in person at the site, deposits credited to the check and invoice, and tiered refunds from a policy snapshot (PRD-M9 HU-M9-01/03, PRD-00 M9, TRD-00 sec. 6.2, TRD-M9, ADR-012).

Payment method follows the reservation channel (D-01): a reservation made by link, call or chat is paid only by verified transfer; a reservation made in person at the site is paid by verified transfer or cash, and cash goes into the open cash-register shift.

## Scope

### In Scope
- Policy per site, slot and party size: none, deposit (credited) or fee (not credited); fixed, per person or % of minimum spend
- Policy snapshot copied into each reservation
- Collection accounts per site; payment message with amount, accounts and reference
- Allowed payment method by reservation channel (D-01): link, call or chat → verified transfer only; in person at the site → verified transfer or cash
- Cash deposit recorded in the open cash-register shift of the site; no open shift, no cash
- Payment states: pending, receipt received, verified, rejected; human verification with permission
- Transaction number unique per collection account
- Expiry of unverified pending reservations
- Offline verification on the node
- Deposit applied once to the check, outside the cash count, as prepayment on the invoice
- Tiered refunds on cancellation or no-show, approved and receipted

### Out of Scope
- Online gateway with automatic confirmation → 5.3
- WhatsApp sending of the payment message → 5.1
- Public link → 3.8; reports → 3.9

## Capabilities

### New Capabilities
- `reservation-payments`: charge policy, verification, deposit application, refunds

### Modified Capabilities
None

## Approach

`ReservationPayment` aggregate (method `transfer` or `cash`) and `ReservationPolicy` rule in `contexts/reservations`, owned by the cloud; the reservation records its channel (`public_link`, `phone`, `chat`, `in_person`). `RecordCashPayment` runs on the cash owner and records the income in the open M2 shift. The `ApplyDeposit` entry port is called by `cash-register`; `invoicing` receives the deposit as prepayment. Receipts go to object storage. No payment gateway in this delivery; `ReservationGateway` arrives in 5.3 (ADR-012).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reservations/{domain,application}` | Modified | Payment, policy, refund |
| `contexts/cash-register` | Modified | "Reservation deposit" payment method; cash deposit taken in the open shift |
| `contexts/invoicing` | Modified | Prepayment on the sale document |
| `contexts/platform` | Modified | Verify-payment and approve-refund permissions |
| `shared/contracts` | Modified | Payment events |
| `apps/admin-web`, `apps/venue-app` | Modified | Policies, accounts, verification, refunds |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Fake receipt | Med | Confirmation only after human bank check, audited |
| Same transaction reused | Med | Unique per collection account, blocked and alerted |
| Cash deposit counted twice (at intake and on the check) | Med | Cash enters the shift once at intake; applying the deposit to the check never touches the cash count |
| Deposit and retained amount | Low | Abonable deposit rides on the service invoice. A retained amount, if invoiced, uses its own tax classification (D-12) |
| A venue has not loaded its collection account yet | Low | The three charge modes are configurable; the account is venue data (D-34) |
| Refund method for a cash reservation that ends in conflict | Med | Open: PA-48 |

## Rollback Plan

Set every site policy to "none"; pending reservations become confirmed manually. Verified payments and refunds stay immutable for audit.

## Dependencies

- Reservations (3.6), cash register (1.3), electronic invoicing (1.5)
- Charge mode per venue is D-34. Deposit and retained-amount treatment is D-12.

## Success Criteria

- [ ] Reservations with deposit collected and credited to the check, and one cancellation with partial refund
- [ ] A receipt alone never confirms a reservation
- [ ] Applying a deposit to the check does not enter the cash count; a cash deposit taken in person enters the open shift once
- [ ] A reservation made by link, call or chat cannot be paid in cash
