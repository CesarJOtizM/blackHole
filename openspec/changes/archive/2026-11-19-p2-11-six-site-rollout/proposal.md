# Proposal: Six-Site Rollout (Roadmap 2.11)

## Intent

Phase 2 closes only when inventory control is proven across the pilot. This operational change rolls the system out to the 5 remaining sites — technical visit, hardware, data load, training — and measures theoretical vs actual inventory for one month in at least 3 sites (PRD-00 sec. 11 and 12, PRD-M4 sec. 8, TRD-00 sec. 5.0 and 10.1.2, PRD-M0 sec. 2).

## Scope

### In Scope
- Technical visit checklist per site and site-mode decision (cloud or hybrid).
- Hardware kit per mode (node, UPS, printers, dedicated router, 4G modem recommended; print bridge in cloud mode).
- Data load: menu and site prices, ingredients, recipes, levels, warehouse supply relations, staff and devices; opening counts.
- Role-based training with attendance record.
- Per-site go-live acceptance.
- One-month theoretical-vs-actual measurement in ≥ 3 sites using the 2.10 reports.

### Out of Scope
- Delivery platforms and reservations at the new sites → 3.1–3.8.
- Consolidated six-site reporting → 4.1.
- Guided self-service onboarding for non-pilot customers → 4.4.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `site-rollout` (delta): multi-site rollout and inventory measurement requirements.

## Approach

Reuse the 1.14 go-live playbook per site, one site at a time. Organization data from 0.3 already exists; this change verifies it and loads catalog and inventory data through the cloud admin (`apps/api-cloud`), which hybrid nodes (`apps/local-node`) receive by sync. Measurement uses approved counts (2.6) and the theoretical-vs-actual report (2.10). Evidence (checklists, test prints, training rosters, reports) is stored per site as go-live records.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `infra` | Modified | Node provisioning and site hardware inventory |
| `contexts/platform` | Modified | Sites, devices, users, site mode per new site |
| `contexts/inventory` | Modified | Data load, opening counts, levels |
| `contexts/reporting` | Modified | Measurement reports per site |
| `apps/local-node`, `apps/api-cloud` | Modified | Deployed per site mode |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Staff do not adopt the system | Medium | Role training, gradual rollout one site at a time |
| Incomplete recipes invalidate the measurement | High | Recipe coverage gate before the month starts |
| Router client isolation blocks phones | Medium | Checked in the visit; dedicated router |
| Unrecorded purchases distort actual use | High | Daily purchase completeness check |

## Rollback Plan

Each site keeps its previous process available until acceptance. If a site fails acceptance, it returns to the previous process while the issue is fixed; data already recorded stays and is not deleted. A hybrid site may return to cloud mode only with nothing pending upload (0.7).

## Dependencies

- p1-14 (go-live playbook), p0-03 (organization), p0-07 (hybrid resilience), p2-05/p2-06 (warehouses, counts), p2-10 (reports).

## Success Criteria

- [ ] The difference between theoretical and actual inventory is measured in at least 3 sites during 1 month.
- [ ] All 5 remaining sites pass the technical visit, hardware check, data load and training records.
- [ ] Each new site operates a full service only with the system.
