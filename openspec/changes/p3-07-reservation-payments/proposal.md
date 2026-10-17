# Proposal: Reservation Payments

## Intent

High-demand slots need a deposit or fee to reduce no-shows, but transfers to Nequi, Daviplata or Bre-B are checked by screenshot and refunds are improvised. This change adds configurable reservation charges, human-verified transfers with unique transaction numbers, deposits credited to the check and invoice, and tiered refunds from a policy snapshot (PRD-M9 HU-M9-01/03, PRD-00 M9, TRD-00 sec. 6.2, TRD-M9, ADR-012).

## Scope

### In Scope
- Policy per site, slot and party size: none, deposit (credited) or fee (not credited); fixed, per person or % of minimum spend
- Policy snapshot copied into each reservation
- Collection accounts per site; payment message with amount, accounts and reference
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

`ReservationPayment` aggregate and `ReservationPolicy` rule in `contexts/reservations`, owned by the cloud. The `ApplyDeposit` entry port is called by `cash-register`; `invoicing` receives the deposit as prepayment. Receipts go to object storage. The `PaymentGateway` port stays unused (ADR-012).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reservations/{domain,application}` | Modified | Payment, policy, refund |
| `contexts/cash-register` | Modified | "Reservation deposit" payment method |
| `contexts/invoicing` | Modified | Prepayment on the sale document |
| `contexts/platform` | Modified | Verify-payment and approve-refund permissions |
| `shared/contracts` | Modified | Payment events |
| `apps/web-admin`, `apps/site-app` | Modified | Policies, accounts, verification, refunds |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Fake receipt | Med | Confirmation only after human bank check, audited |
| Same transaction reused | Med | Unique per collection account, blocked and alerted |
| Cash at the site allowed by PRD-00 but not by PRD-M9 | Med | Master wins by rule, but spec keeps transfers only until the product owner confirms cash handling |

## Rollback Plan

Set every site policy to "none"; pending reservations become confirmed manually. Verified payments and refunds stay immutable for audit.

## Dependencies

- Reservations (3.6), cash register (1.3), electronic invoicing (1.5)
- Collection accounts and policies of each pilot site

## Success Criteria

- [ ] Reservations with deposit collected and credited to the check, and one cancellation with partial refund
- [ ] A receipt alone never confirms a reservation
- [ ] The deposit does not enter the cash count
