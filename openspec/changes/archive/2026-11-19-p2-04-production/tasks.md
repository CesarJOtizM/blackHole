# Tasks: Production

## Review Workload Forecast

Estimated changed lines: 2600–4000.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain | PR 1 | 1.1–1.6 on tracker `phase-2/production` |
| 2 | Use cases | PR 2 | 2.1–2.6 on PR 1 |
| 3 | Persistence | PR 3 | 3.1–3.5 on PR 2; memory then Postgres |
| 4 | HTTP | PR 4 | 4.1–4.3 on PR 3; `inject`, no listen |
| 5 | Screens | PR 5 | 5.1–5.2 on PR 4 |

Cloud-only `api-cloud`. No `local-node`, `shared/sync`, `after_sales`, or sale edits.

## 1. Domain

- [x] 1.1 RED `contexts/inventory/domain/stock-ledger.test.ts`: consumption < 0 and output > 0 append; wrong signs throw. Positive output replays `nextAverageCost`. Purchase 10 then 14 stays 12. Second reverse throws. No new types.
- [x] 1.2 GREEN `contexts/inventory/domain/stock-ledger.ts`: writable signs. Replay `nextAverageCost` for `purchase` and positive output only. Do not change its formula. Removal half-up. `reverse` stays sale-only.
- [x] 1.3 RED `contexts/inventory/domain/production.test.ts`: `floor(line * expected / outputQuantity)`. Variance actual − expected (−400 at 4600). Actual 0 has no output. Costs 6 and 5. Compensate once.
- [x] 1.4 GREEN `contexts/inventory/domain/production.ts`: run, variance, `consumed_average` or `standard`, compensate. Export `contexts/inventory/domain/index.ts`.
- [x] 1.5 RED `contexts/inventory/domain/recipe-catalog.test.ts`: `explodePreparation` keeps a stocked child collapsed on the id `explode` returns. Non-stocked children expand. Require `outputQuantity`.
- [x] 1.6 GREEN `contexts/inventory/domain/recipe-catalog.ts`: `outputQuantity` and `explodePreparation`. Leave product `explode`.

## 2. Use cases

- [x] 2.1 RED `contexts/inventory/application/record-production/record-production.test.ts`: output ingredient id is `recipeId`. Store the cloud version. Reject non-stocked. Same `runId` is a no-op. Shortage alerts. Burned batch writes no output.
- [x] 2.2 GREEN `contexts/inventory/application/record-production/`: append both types. Null `order_line_id` and `role`. `reference` is `runId`. Skip `StockLedgerRepository.append`. Audit. Export `entry-port.ts` and `#application/record-production/*`.
- [x] 2.3 RED `contexts/inventory/application/correct-production/correct-production.test.ts`: `inventory.adjust` or `ConsumeAuthorization` compensates once. A chief alone changes nothing.
- [x] 2.4 GREEN `contexts/inventory/application/correct-production/`: opposite sign plus `reversesMovementId`. No edit or delete.
- [x] 2.5 RED `contexts/inventory/application/configure-production-cost/configure-production-cost.test.ts`: `consumed_average` or `standard`, plus `standardUnitCost` per preparation. Requires `recipe.edit`.
- [x] 2.6 GREEN `contexts/inventory/application/configure-production-cost/`. Export all three.

## 3. Persistence

- [x] 3.1 RED `contexts/inventory/application/ports/production-repository.contract.ts` on memory: balances match, other tenant hidden, failed output rolls back. No Drizzle mock.
- [x] 3.2 GREEN `contexts/inventory/adapters/memory/in-memory-production-repository.ts`. Skip `after_sales`.
- [x] 3.3 RED that contract on PGlite with `SET LOCAL` `app.tenant_id`.
- [x] 3.4 GREEN `contexts/inventory/adapters/postgres/schema.ts` and `drizzle-production-repository.ts`: three production tables plus `output_quantity`, one transaction, next SQL after purchasing. No backfill.
- [x] 3.5 `contexts/inventory/adapters/sqlite/schema.ts`: parity only. No wiring.

## 4. Cloud HTTP

- [x] 4.1 `shared/contracts/production.ts` and `shared/contracts/index.ts`: strict Zod command, policy, and run. Add `inventory.record-production` in `contexts/platform/domain/permission-catalog.ts`.
- [x] 4.2 RED `apps/api-cloud/test/http/production.controller.test.ts`: Fastify `inject`, no listen. Flag off, waiter denied, variance hidden without `inventory.view-cost`, Zod 400. No queue.
- [x] 4.3 GREEN `apps/api-cloud/src/http/production.controller.ts` and `apps/api-cloud/src/composition/application-module.ts`: `productionEnabled`, record and correct permissions, cost redaction. Postgres only.

## 5. Screens

- [x] 5.1 `apps/admin-web/src/inventory/inventory-screen.tsx`: policy, run, variance when present.
- [x] 5.2 `apps/venue-app/src/kitchen/kitchen-screen.tsx`: same POST. No local run.
