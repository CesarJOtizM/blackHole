# Proposal: Go-Live of the Pilot Site

## Intent

Put the pilot site into production on blackHole alone, proving Phase 1 end to end (PRD-00 sec. 11-12). This delivery is operational: no product feature, only verifiable readiness gates.

## Scope

### In Scope
- Technical visit with the TRD-00 10.1.2 checklist.
- Recommended router and 4G modem bought by the owner and checked on the technical visit (D-36; ADR-006, ADR-008).
- Site configuration loaded and checked (menu, tax profiles, DIAN resolution, users, devices, tip rule, attendance).
- Rehearsal of one service with an internet cut halfway through (TRD-00 16.8).
- Staff training per role.
- Two consecutive weeks running only on the system, with a go/no-go decision and fallback plan.

### Out of Scope
- Remaining five sites → 2.11.
- Inventory, recipes and stock → 2.1–2.10.
- Customer onboarding wizard → 4.4; support panel → 4.5.

## Capabilities

### New Capabilities
- `site-rollout`: readiness gates for bringing a site into production and the validation run.

### Modified Capabilities
None

## Approach

Go-live is a sequence of gates with evidence per site. The visit decides the pilot's mode; the rehearsal covers it. Monitoring from 0.9 is the safety net during the run. Defects found are fixed in their own changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `infra` | Modified | Production environment and node enrollment for the site |
| `apps/local-node` | Modified | Installed on the pilot node (hybrid) or bridge profile (cloud) |
| `apps/admin-web` | Modified | Site configuration, devices, users |
| `contexts/platform` | Modified | Site mode and organization data for the pilot |
| `shared/printing` | Modified | Real printer profiles (80/58 mm) |
| Go-live evidence (operations) | New | Checklists, rehearsal log, training roster, daily run log; no product code |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Staff fall back to the old process | Med | Training, on-site support first days; fallback resets the 2-week count |
| Router client isolation blocks phones | Med | Checked in visit; dedicated router |
| DIAN rejection in production | Med | Sandbox parity from 1.5; monitoring alerts; rejection playbook |
| QR payment gateway | Low | Several adapters; Bold is one (D-46). Go-live still waits for delivery 1.13 |
## Rollback Plan

If a day cannot be run on the system, the site returns to its previous process for that day, issued invoices remain valid (they are fiscal), and the 2-week count restarts. A hybrid site can go back to cloud mode only with an empty outbox (TRD-00 5.0).

## Dependencies

- All Phase 1 changes p1-01 to p1-13, plus p0-07, p0-08, p0-09.
- Factus production credentials, DIAN resolution, gateway merchant account, hardware purchase.

## Success Criteria

- [ ] The site operates 2 consecutive weeks only with the system, with DIAN documents accepted, at least one service with QR orders and payments, and staff clocking attendance.
- [ ] Rehearsal: after the mid-service cut, pending invoices are issued and QR orders and payments enter without duplicates.
- [ ] An unregistered phone on the site network cannot use the node or print.
