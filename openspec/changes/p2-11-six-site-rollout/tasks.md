# Tasks: Six-Site Rollout

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 0 product lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Record that apply builds nothing | single PR | Checkbox updates in this file only. No product diff. |

Apply has nothing to build. `design.md` is binding: zero product files, no new bounded context, and no new tests. The pilot was cancelled. These boxes are confirmations. Mark them without editing product code.

## Phase 1: Empty product diff

- [ ] 1.1 Confirm the File Changes table in `openspec/changes/p2-11-six-site-rollout/design.md` has action None. Leave `contexts/`, `apps/`, `shared/`, and `tools/` unchanged.
- [ ] 1.2 Leave `apps/api-cloud` and `apps/local-node` composition unchanged. Add no bounded context. Leave each `application/entry-port.ts` and the dependency-cruiser rules unchanged.
- [ ] 1.3 Add no HTTP route, Zod schema, sync payload, or test. Leave `OrganizationVenue.mode` as `cloud`. Inside-out layers (domain, use case, adapter, HTTP) have no new file, so there is no RED test to write.

## Phase 2: Cancelled pilot stays outside the repository

- [ ] 2.1 Leave the technical visit, hardware kit, training ledger, per-site acceptance, and one-month measurement in `openspec/changes/p2-11-six-site-rollout/specs/site-rollout/spec.md` unimplemented. Add no module for them.
- [ ] 2.2 Leave `docs/roadmap.md` unchanged. Leave `openspec/changes/p2-05-warehouses-and-transfers/`, `openspec/changes/p2-06-waste-and-counts/`, `openspec/changes/p2-08-shortage-alerts/`, and `openspec/changes/p2-10-inventory-reports/` unchanged.
