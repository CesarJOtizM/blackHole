# Apply progress: p1-08-invoicing-portal

Work unit: domain pair 1.1–1.2. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked RED/GREEN pairs. This batch is the first pair and starts the chain. It stops at tasks 1.1–1.2. Not committed. `size:exception` was not granted.

## Completed tasks

- [x] 1.1 RED `contexts/invoicing/domain/portal-link.test.ts`: expired or other account shows nothing. No crypto.
- [x] 1.2 GREEN `domain/portal-link.ts`, `domain/index.ts`.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm exec biome check --write` on the touched domain files. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `revealPortalLink` compares an already-evaluated expiry and account in memory. It does not open files, sockets, or a database, and it does not sign or verify HMAC. |
| Rollback boundary | `contexts/invoicing/domain/portal-link.test.ts`, `contexts/invoicing/domain/portal-link.ts`, and the `portal-link` exports in `contexts/invoicing/domain/index.ts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts` exit 1. `FAIL contexts/invoicing/domain/portal-link.test.ts` — `Cannot find module '#domain/portal-link.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/portal-link.ts`, the `domain/index.ts` export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |

## Deviations from Design

None for this pair. `revealPortalLink` receives an already-evaluated link (`purpose`, `tenantId`, `venueId`, `checkId`, `expiresAt`) and the account being opened. At or after `expiresAt`, or when tenant, venue, or check differs, the result is `{ outcome: "hidden" }` and carries no account fields. A current link for the same account returns that account and its purpose. An unreadable instant fails closed as hidden. Signing and HMAC verification stay in `HmacLinkSigner` (tasks 3.5–3.6). Invoice issuance closes a pre-bill link by the evaluated `expiresAt`; this pair does not read invoice status.

## Issues Found

None.

## Remaining Tasks

- [ ] 1.3 RED `domain/one-time-code.test.ts`
- [ ] 1.4 onward

## Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current work unit: domain pair 1.1–1.2, first PR of the chain
- Boundary: tasks 1.1 and 1.2 only. No use cases, adapters, HTTP, or UI.
- Files: `contexts/invoicing/domain/portal-link.test.ts`, `contexts/invoicing/domain/portal-link.ts`, `contexts/invoicing/domain/index.ts`, `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this slice is well under 400 lines. The change forecast stays High.
