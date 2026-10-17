# Proposal: Anti-Theft Controls

## Intent

Theft and errors concentrate in voids, discounts, courtesies, reopened accounts, drawer openings and price changes (PRD-01 sec. 6). Each of these must be blocked unless authorized at the moment with a PIN, and every authorized one must surface in the control reports of PRD-00 sec. 8.4.

## Scope

### In Scope
- Sensitive operations with PIN authorization: void line before/after kitchen, void account, discount, courtesy, price change in a sale, edit after pre-bill, transfer table to another waiter, reopen paid account, change payment method, open drawer without sale.
- Shift caps (e.g. waiter voids before kitchen, courtesies per shift).
- Corrections on closed shifts as reversal movements.
- Control reports: voids, discounts and courtesies, cash differences, drawer openings, accounts reopened or edited after pre-bill.
- Unusual-behavior alerts: many voids or discounts, repeated requester-authorizer pair, self-authorization, failed PIN attempts.

### Out of Scope
- Inventory return or waste on void → 2.2; inventory adjustments and transfer differences reports → 2.6, 2.5.
- Credit note on voids after invoicing is already in 1.5.
- Actions outside the worker's schedule alert → 1.9.
- Full site reporting UI → 1.11.

## Capabilities

### New Capabilities
- `sensitive-actions`: guarded operations, shift caps, reversal corrections, control reports, unusual-behavior alerts.

### Modified Capabilities
- `authorization`: authorization bound to one operation, shift accumulators from executed operations, offline behavior per mode.

## Approach

Each guarded use case in `orders` and `cash-register` calls the `platform` entry port to evaluate the PRD-01 permission (TRD-00 sec. 10.2) before changing state; the decision is always server-side. Approved requests emit audit events (0.6) with requester, authorizer, reason, value and moment. Cloud detectors (TRD-00 sec. 10.3) read the audit stream for alerts.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/domain` | Modified | Operation-bound authorization, accumulators |
| `contexts/orders/application` | Modified | Void, discount, courtesy, price, post-pre-bill, transfer |
| `contexts/cash-register/application` | Modified | Reopen, payment method, drawer |
| `shared/printing` | Modified | Drawer job without sale |
| `shared/contracts` | Modified | Sensitive-action audit events |
| `apps/api-cloud` | Modified | Control reports, detectors |
| `apps/local-node`, `apps/venue-app` | Modified | Local evaluation, PIN prompt |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A route bypasses the permission check | Med | Automated test fails on undeclared mutating routes |
| Collusion between two staff | Med | Repeated pair alert |
| Overlap with 0.5 authorization spec | Med | Delta adds only operation binding and accumulators |

## Rollback Plan

Caps and modes are data: restore the previous role configuration. Code rollback re-disables the new operations (void, discount, courtesy) by flag; audit events stay append-only.

## Dependencies

- 0.5 roles and caps; 0.6 audit; 1.2, 1.3, 1.6 operations to guard.
- Default caps and the site administrator as authorizer (D-30). Example thresholds are the initial values and each venue can change them (D-31).

## Success Criteria

- [ ] Every sensitive action without authorization is blocked, and authorized ones appear in the control reports.
- [ ] A user cannot authorize their own action unless self-authorization is active for the shift.
