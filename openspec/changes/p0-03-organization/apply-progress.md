# Apply progress: p0-03-organization

Work unit 1 (domain). Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

Delivery: feature-branch-chain. This batch stays on `p0-03-organization-domain`. Not committed.

## Completed tasks

- [x] 1.1 RED `contexts/platform/domain/organization.test.ts`
- [x] 1.2 GREEN `contexts/platform/domain/organization.ts`, `domain/index.ts`
- [x] 1.3 `tools/skeleton/skeleton.test.ts` allows `domain/organization.ts` and the new domain keys

## Work Unit Evidence

### Unit 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/domain/organization.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| Runtime harness command/scenario and exact result | N/A: this unit has no I/O. The aggregate does not open files, sockets, or a database. |
| Rollback boundary | `contexts/platform/domain/organization.ts`, `contexts/platform/domain/organization.test.ts`, `contexts/platform/domain/index.ts`, and the skeleton expectations for `domain/organization.ts` plus the new domain export keys. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm vitest run --project platform contexts/platform/domain/organization.test.ts` exit 1. `FAIL contexts/platform/domain/organization.test.ts` — `Cannot find module '#domain/organization.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `organization.ts` and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |
| 1.3 | Skeleton still expected only `venue-operation` domain keys and declarations. | `pnpm vitest run --project skeleton` exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |

`pnpm exec biome check --write` on the four edited files — exit 0. Checked 4 files. Fixed line endings only.

## Deviations

None — implementation matches design. `addPoint` and `addInvoicingTaxpayer` are the attempts that throw: a second point, and a second invoicing taxpayer without `replaceInvoicingTaxpayer`. `assignStock` throws `StockNotHeld` and does not store quantity. `taxProfileId` is stored as an opaque reference. `VenueOperation` was not changed.

## Remaining tasks

- [ ] 2.1–2.4 Use case, memory repository, contract
- [ ] 3.1–3.3 Postgres RLS
- [ ] 4.1–4.4 Cloud HTTP and sample fixture
- [ ] 5.1–5.4 Node 403

## Workload / PR boundary

- Mode: feature-branch-chain, work unit 1 of 5
- Boundary: domain aggregate, its test, `domain/index.ts`, and the skeleton expectation this file requires
- Estimated review budget impact: domain-only slice, under the 400-line budget for this PR
