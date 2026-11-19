# Tasks: How Much Can Be Produced

## Review Workload Forecast

Estimated changed lines: 1800–2200. given/when/then titles. `#` imports.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Read-only on api-cloud. No stock append, `shared/sync`, SQLite, or local-node. D-37 leaves hybrid sync out. Stocked lines use the recipe id `explode` returns.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain rule | PR 1 | Base: `phase-2/inventory`. |
| 2 | Projector | PR 2 | Base: PR 1. |
| 3 | Memory store | PR 3 | Base: PR 2. |
| 4 | Postgres read | PR 4 | Base: PR 3. |
| 5 | Menu flag | PR 5 | Base: PR 4. |
| 6 | Cloud HTTP | PR 6 | Base: PR 5. `inject`, no `listen`. |

## 1. Domain

- [x] 1.1 RED `contexts/inventory/domain/producible-quantity.test.ts`: 12 buns limit at 12; −200 is 0; a missing row limits at 0; a tie lists both ids; skip `quantity <= 0`; restock 52 keeps point state; 0 is `sold_out`; at or under a threshold is `low_units`; no threshold stays `available`; stocked stock uses the explode recipe id. No Nest.
- [x] 1.2 GREEN `contexts/inventory/domain/producible-quantity.ts` (`PossibleUnits`, `AvailabilityState`). Export `domain/index.ts`.

## 2. Projector

- [x] 2.1 RED `contexts/inventory/application/project-producible-quantity/project-producible-quantity.test.ts`: lemons are skipped; beef or bun hits indexed products; a new version recalculates that product; 30 to 29 emits nothing; 6 to 5 emits once; a warehouse changes replenishment only; no recipe adds no state; `append` is never called. Payload: site, product, variant, state. No cost.
- [x] 2.2 GREEN that use case and ports `producible-quantity-repository`, `supplying-locations`, `low-units-threshold`, `availability-publisher`. Current `explode`. Minimum of `floor(max(balance, 0) / quantity)`; replenishment adds supplying locations. Export `entry-port.ts` and `#application/project-producible-quantity/*`.

## 3. Projection store

- [x] 3.1 RED `contexts/inventory/application/ports/producible-quantity-repository.contract.ts` on memory: `explode` index, other tenant hidden, no `stock_movements` insert.
- [x] 3.2 GREEN `contexts/inventory/adapters/memory/in-memory-producible-quantity-repository.ts`. No Drizzle mock.
- [x] 3.3 RED that contract on PGlite with `SET LOCAL` `app.tenant_id`.
- [x] 3.4 GREEN `contexts/inventory/adapters/postgres/schema.ts`, the next SQL file after `0002_stock_ledger.sql`, and `drizzle-producible-quantity-repository.ts`. Read `stock_balances`. No SQLite.

## 4. Menu

- [x] 4.1 RED `contexts/orders/domain/menu.test.ts`: manual off stays not orderable at 20 units; in-schedule `low_units` stays orderable; no state omits `inventoryState`.
- [x] 4.2 GREEN `contexts/orders/domain/menu.ts`: `inventoryState` in `presentProduct`. `isOrderable` stays manual availability plus schedule.
- [x] 4.3 RED `contexts/orders/application/apply-menu-availability/apply-menu-availability.test.ts`: same state does not publish; `sold_out` still sends.
- [x] 4.4 GREEN that folder on `RealtimeHub` only on change. Add `#application/apply-menu-availability/*` in `contexts/orders/package.json`.

## 5. Cloud HTTP

- [x] 5.1 RED `apps/api-cloud/test/http/producible-quantity.controller.test.ts` via `inject`, no `listen`: waiter denied; `inventory.configure-levels` audits 5; the menu shows the flag; `sold_out` send succeeds; 30 to 29 emits nothing.
- [x] 5.2 GREEN the threshold on `update-menu.controller.ts`. Nullable `lowUnitsThreshold` on `venue_prices` (null skips `low_units`). Projector in `application-module.ts` after sale, return, waste, and publish. `availability_changed` on `orders-realtime`. No `shared/sync`. Skip purchase, production, and transfer. `pnpm vitest run --project inventory`, `--project orders`, and the api-cloud test.
