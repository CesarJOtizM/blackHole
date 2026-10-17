# Proposal: Tips

## Intent

Tips are voluntary, separate from the sale and not restaurant income. Each site needs a fair, verifiable distribution of its common tip pool, printed and signed by staff, without spreadsheets (PRD-00 M2 and rule 5, PRD-M2 HU-M2-04, TRD-00 6.3).

## Scope

### In Scope
- Per-site distribution rule: period (shift, day, week) and mode (equal, percentage per person or role, by hours worked).
- Common pool summing tips recorded per payment and payment method in the period.
- Participants from attendance clock events, adjustable by the administrator with a reason.
- Deterministic rounding to the peso so parts add up to the pool.
- Closed, immutable settlement storing the rule used; corrections as adjustment settlements.
- Printable settlement with per-person detail and signature space.

### Out of Scope
- Capturing the tip at payment time (exists from 1.3) and as invoice surcharge (1.5).
- QR-payment tips entering the pool → 1.13 (same pool, new source).
- Tip reports by period and method → 1.11.
- Payroll or salary (out of product scope).

## Capabilities

### New Capabilities
- `tips`: distribution rule, pool, participants, calculation, immutable settlement and printout.

### Modified Capabilities
None

## Approach

In `contexts/cash-register`, a pure distribution function computes shares in integer pesos with deterministic residue assignment (TRD-M2 sec. 2). A settle use case reads the pool from cash-register payments and participants with hours through the attendance entry port, freezes the rule snapshot and appends the settlement. It runs on the operation owner: local-node in hybrid (works offline with local clock events), api-cloud in cloud mode. The print template from 1.6 renders it through `shared/printing`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/cash-register/domain`, `contexts/cash-register/application` | Modified | Rule, distribution, settlement |
| `contexts/attendance/application/entry-port.ts` | Modified | Participants of a period |
| `shared/printing` | Modified | Tip settlement template data |
| `apps/local-node`, `apps/api-cloud` | Modified | Settle and rule endpoints |
| `apps/web-admin`, `apps/site-app` | Modified | Rule configuration, settlement screen |
| `shared/contracts`, `shared/sync` | Modified | Settlement event |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Contradiction: TRD-00 6.3 assigns rounding so the total matches exactly; TRD-M2 keeps an explicit residue | Med | Spec allocates the residue deterministically and shows it; design confirms |
| Percentage per role with several people is undefined | Med | Assume equal split within the role; product owner confirms |
| Staff dispute a closed settlement | Med | Rule snapshot, participant reasons, adjustment settlements |

## Rollback Plan

Hide the settlement screen and return to manual distribution; recorded tips stay in payments. Closed settlements are immutable and kept; no other capability consumes them until 1.11.

## Dependencies

- p1-03, p1-06, p1-09, p0-05, p0-06.
- Tip policy of the pilot site (PRD-M2 Q2).

## Success Criteria

- [ ] A tip settlement for one real week, signed by the staff.
- [ ] Shares plus residue always equal the pool.
- [ ] Changing the rule never alters a closed settlement.
