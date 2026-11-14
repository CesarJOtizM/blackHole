```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d0954654fac64bbffab976287c43b35758723ef5008bb74b26433daf1b7b6935
verdict: fail
blockers: 4
critical_findings: 4
requirements: 10/12
scenarios: 21/25
test_command: pnpm exec vitest run --project inventory && pnpm exec vitest run --project orders
test_exit_code: 0
test_output_hash: sha256:1823cd928f6eaf0d03785bdd56f774141e9562dec3f2d878359ec22698043976
build_command: pnpm typecheck
build_exit_code: 2
build_output_hash: sha256:22e94496dff306ba9735d0f24b2e3ceb16b469cf7bf6e5ed61aee3e3090bada6
```

## Verification Report

**Change**: p2-02-sale-consumption
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole` on branch `master`
**Strict TDD**: inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded. Engram was not written.

This replaces the previous report. That report described worktree `blackHole-p2-02` on `p2-02/domain` and is not evidence for this tree. `test_output_hash` is the SHA-256 of the serial inventory log bytes followed immediately by the serial orders log bytes. `evidence_revision` is that concatenation followed by the typecheck log bytes. A parallel run of the same commands contended with typecheck, architecture, and lint and timed out two PGlite tests. Those timeouts are not the result. The serial reruns below are.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 21 (1.1–1.2, 2.1–2.7, 3.1–3.6, 4.1–4.6) |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

Every implementation checkbox in `tasks.md` is `[x]`. Proposal success criteria remain unchecked. They are not task checkboxes. `state.yaml` has `status: applied`, `apply: done`, and `artifacts.verify: fail`. This run sets `artifacts.verify` to `fail`.

### Build & Tests Execution

**Build**: Failed

```text
pnpm typecheck
exit 2
sha256:22e94496dff306ba9735d0f24b2e3ceb16b469cf7bf6e5ed61aee3e3090bada6
```

`tsc -b` reports two errors, both in `apps/venue-app/src/service/venue-cloud.ts` (lines 87 and 151). `lines: never[]` is not assignable to `lines: []`, and `channel: string | undefined` is not assignable to `"qr_table" | undefined`. That file does not reference sale consumption, the ledger, or the inventory entry port. No diagnostic names `contexts/inventory`, `contexts/orders`, `apps/api-cloud`, `apps/local-node`, or `shared/contracts`. See WARNING.

**Tests**: 293 passed, 0 failed, 0 skipped

```text
pnpm exec vitest run --project inventory
exit 0
Test Files  18 passed (18)
Tests       67 passed (67)
Duration    8.89s
sha256:2a1b30cfadb800fabc457d643c8035b85386e14e1c39e4fdc5cd8da42fb493f2

pnpm exec vitest run --project orders
exit 0
Test Files  43 passed (43)
Tests       226 passed (226)
Duration    15.04s
sha256:575f3097b00c2b9b87d52ac6f171dad7b3f88bcbc1e7106723e3d639281b609f
```

**Lint**: exit 1. Not a fail for the scenarios. See WARNING. The CRLF exemption does not cover every diagnostic.

```text
pnpm lint
exit 1
Checked 984 files. Found 969 errors. Found 1 warning.
sha256:673735466a16f39cdd570c255278de70d5ef2af1a58ce9adf9796cb683f460ee
```

`pnpm exec biome check --reporter=json --max-diagnostics=5000 .` returned 970 diagnostics: 967 `format`, 2 `assist/source/organizeImports`, 1 `lint/complexity/useOptionalChain`. All 967 format files contain a CR byte (`0x0D`). Two import-sort errors are on ledger repositories this change added. The optional-chain warning is `contexts/platform/domain/authorization.ts`, which this change did not edit.

**Architecture**: Passed, with the known TypeScript 7 transpiler notice.

```text
pnpm architecture
exit 0
no dependency violations found (1091 modules, 3699 dependencies cruised)
missing-typescript-transpiler (typescript >=7; already documented in openspec/config.yaml)
sha256:f91a50b11076c8b6e5bc0c1609087b25667bcaf81fa2a44dbaa41a3918169dee
```

**Coverage**: Not available / threshold 0. No coverage package is installed. Not a failure.

### Spec Compliance Matrix

A scenario is COMPLIANT only when a covering test passed in this workspace's serial inventory or orders run. Counts: 12 requirements (7 stock-consumption, 5 inventory-ledger), 25 scenarios. Hybrid-outage and upward-sync scenarios stay in the matrix. The design defers `shared/sync`. That deferral does not remove them.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Deduct on Send to Kitchen | Line deducts ingredients | `register-sale-consumption.test.ts` > given burger version 4, when 2 portions are sent, then beef and cheese are consumed at that version and the reference cost is snapshotted | ✅ COMPLIANT |
| Deduct on Send to Kitchen | Bar shares the location | `register-sale-consumption.test.ts` > given a cocktail routed to the bar, when it is sent, then it deducts from the same point of sale as the grill | ✅ COMPLIANT |
| Deduct on Send to Kitchen | Product without recipe | `register-sale-consumption.test.ts` > given a product with no recipe, when it is sent, then nothing is written and the result is missing recipe; `take-order.test.ts` > given a held line whose recipe is missing, when the course is fired, then the check is still saved | ✅ COMPLIANT |
| Version Fixed at Send Time | Recipe changes mid-service | `record-waste.test.ts` > given a line consumed at version 4, when version 5 is published and the line is wasted after start, then waste stores the version 4 quantities, reason and actor, and on-hand stays at the consumption | ✅ COMPLIANT |
| Version Fixed at Send Time | New send uses new version | `register-sale-consumption.test.ts` > given version 5 is current, when a new line is sent, then consumption uses version 5 | ✅ COMPLIANT |
| Stocked Preparations | Stocked sauce | `register-sale-consumption.test.ts` > given pasta uses a stocked tomato sauce, when it is sent, then the sauce stays collapsed and tomatoes are untouched | ✅ COMPLIANT |
| Stocked Preparations | Non-stocked dressing | `register-sale-consumption.test.ts` > given salad uses a non-stocked dressing, when it is sent, then the dressing ingredients are consumed | ✅ COMPLIANT |
| Void Before or After Kitchen Start | Void before start | `void-line.test.ts` > given a sent line and sale consumption on, when the waiter voids it before the kitchen starts, then stock is returned for the stored line and waste is not recorded; `return-stock.test.ts` > given a line consumed at version 4, when it is returned after that version was current, then the stored quantities and unit cost are restored | ✅ COMPLIANT |
| Void Before or After Kitchen Start | Void after start | `void-line.test.ts` > given a line the kitchen already started and sale consumption on, when the waiter voids it, then waste records the reason and actor and stock is not returned; `record-waste.test.ts` > given a line consumed at version 4, when version 5 is published… | ✅ COMPLIANT |
| Negative Stock Never Blocks | Sale continues | `register-sale-consumption.test.ts` > given 100 g of beef on hand, when a line needing 300 g is sent, then the send succeeds, the balance is -200 g, and one alert opens | ✅ COMPLIANT |
| Negative Stock Never Blocks | Alert not repeated | `register-sale-consumption.test.ts` > given an open negative alert for beef, when another beef line is sent, then no second beef alert opens | ✅ COMPLIANT |
| Idempotent Consumption | Retried send | `register-sale-consumption.test.ts` > given a line already consumed, when the send is redelivered, then nothing new is recorded | ✅ COMPLIANT |
| Idempotent Consumption | Retried void | `return-stock.test.ts` > given a void already returned, when it is redelivered, then no extra return is recorded | ✅ COMPLIANT |
| Operation by Mode | Hybrid outage | (none found) | ❌ UNTESTED |
| Operation by Mode | Cloud-mode outage | (none found) | ❌ UNTESTED |
| Append-only Movements | Movement recorded | `stock-ledger.test.ts` > given an existing movement, when an actor tries to change or delete it, then the operation is rejected and the movement is unchanged (appends −200 g `sale_consumption` with reference `order_line_1` before the rejection) | ✅ COMPLIANT |
| Append-only Movements | Edit attempt rejected | `stock-ledger.test.ts` > given an existing movement…; `drizzle-stock-ledger-repository.contract.test.ts` (postgres) > given a stored movement, when inventory_app updates it, then the update is rejected | ✅ COMPLIANT |
| Derived Balance | Balance equals sum including negatives | `stock-ledger.test.ts` > given movements of +1000 g, -700 g and -500 g, when the balance is read, then it is -200 g; `stock-ledger-repository.contract.ts` > given movements of +1000 g, -700 g, and -500 g… (memory, PGlite, SQLite) | ✅ COMPLIANT |
| Derived Balance | Failed write leaves no trace | `stock-ledger-repository.contract.ts` > given a consumption of three ingredients, when the third insert fails, then movements, balance, alert, and the queued row roll back (memory, PGlite, SQLite) | ✅ COMPLIANT |
| Location Ownership by Operating Mode | Hybrid site writes locally | `drizzle-stock-ledger-repository.contract.test.ts` (sqlite) runs the shared contract, including the queued `after_sales` row | ✅ COMPLIANT |
| Location Ownership by Operating Mode | Stale owner rejects writes | `register-sale-consumption.test.ts`, `return-stock.test.ts`, and `record-waste.test.ts` > given the current generation, when a send/return/waste arrives with another generation, then StaleGeneration is thrown and nothing is written | ✅ COMPLIANT |
| Upward Synchronization | Outage then reconnect | (none found) | ❌ UNTESTED |
| Upward Synchronization | Duplicate batch ignored | (none found) | ❌ UNTESTED |
| Dialect Parity | Same balance in both stores | Shared contract balance assertion passed on SQLite and on PGlite in the same inventory run; both expect −200 g | ✅ COMPLIANT |
| Dialect Parity | Cross-tenant read blocked | `stock-ledger-repository.contract.ts` > given tenants A and B, when tenant A reads its balance, then B stays hidden; postgres > given movements for tenants A and B, when inventory_app selects them without a tenant filter, then only tenant A returns | ✅ COMPLIANT |

**Compliance summary**: 21/25 scenarios compliant, 0 partial, 4 untested, 0 failing. 10/12 requirements have every scenario compliant. Operation by Mode and Upward Synchronization are incomplete.

The previous partial on "Recipe changes mid-service" is closed. `publishVersionFive` publishes the burger four times, changes the beef line from 150 g to 80 g, and publishes again. The test asserts `currentVersion === 5`, explodes version 4 as 150 g and version 5 as 80 g, and asserts the stored waste stays on version 4 with quantity `grams(-300)` for 2 portions. `RecordWaste` copies the stored consumption and does not re-explode. `StockMoved` still carries that −300 g quantity. `ledger.balance` stays at `grams(-300)`. There is no `sale_return`.

UNTESTED detail: no passing test sends lines on an offline hybrid node and syncs them once, limits cloud consumption to lines actually sent after reconnect, delivers 300 movements once with equal cloud balances, or ignores a batch the cloud already acknowledged. The passing enqueue test only repeats a local outbox key. `shared/sync` is absent. `sqliteStockLedger` has no caller. local-node registers the SQLite ledger, point-of-sale directory, and movement queue only when a host passes `stock`. It does not construct `TakeOrder`, `VoidLine`, `RegisterSaleConsumption`, `ReturnStock`, or `RecordWaste`.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Deduct on send | ✅ Implemented | `RegisterSaleConsumption` explodes the current version at the point-of-sale location. `TakeOrder.fire` calls it once per line leaving `held`, with `portions: 1`, after `send` and before `saveCheck`, only when the flag is on. |
| Stocked vs expanded preparations | ✅ Implemented | Covered by the explosion double in the passing use-case tests. |
| Void before start returns stock | ✅ Implemented | `sent` calls `ReturnStock`. The passing return test restores the stored quantity. |
| Void after start records waste | ✅ Implemented | Reason, actor, version 4, and no `sale_return` are tested. The waste row sets `reversesMovementId` to the consumption id. `onHandDelta` returns 0 when that id is a `sale_consumption` of the same ingredient, so on-hand stays at −300 g. The waste row and `StockMoved` still carry −300 g. |
| Unlinked waste still moves on-hand | ✅ Implemented | The domain balance test posts a −500 g `waste` with no `reversesMovementId` and expects −200 g. The shared contract's −500 g waste points at `movement_dinner_source`, which is not a stored sale consumption, and the passing dialect runs still expect −200 g. |
| Flag off skips only the ledger call | ✅ Implemented | `VoidLine.reverseConsumption` returns when `saleConsumptionEnabled` is not true. Authorization, detach, `saveCheck`, and audit stay in `execute` before that return. The passing test `given sale consumption off, when a sent line or a started line is voided, then the inventory port is skipped` expects the started line to leave, `sale.void-after-kitchen` at the line price, steps `count`, `evaluate`, `save`, `audit`, and both inventory arrays empty. |
| Negative stock does not block | ✅ Implemented | Balance −200 g and one `NegativeStockOpened` in the use-case test. Cloud `StoredStockAlertPublisher.publish` is empty. |
| Idempotent send and return | ✅ Implemented | Unique `(tenant_id, order_line_id, role, ingredient_id)` in both `0002_stock_ledger.sql` files. A retry writes nothing. |
| Append-only ledger and derived balance | ✅ Implemented for the specified sums | Domain rejects edit and delete. Postgres rejects `UPDATE`. Failed third insert rolls back movements, balance, alert, and the queued row. A linked waste is stored and excluded from on-hand. See WARNING. |
| Stale generation | ✅ Implemented | Use cases throw `StaleGeneration`. Composition reads `VenueOperationRepository`. |
| Hybrid node records and syncs consumption | ❌ Not composed | `sqliteStockLedger` is unused. local-node does not construct the order or inventory use cases. |
| Upward sync without duplication | ⚠️ Enqueue only | `append` inserts the `stock_movement_outbox` row in the same transaction. A later `enqueue` of the same movement id returns. No cloud apply, 300-movement drain, or acknowledged-batch test exists. `shared/sync` is absent, as the design deferred the drain. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Orders call the inventory entry port | ✅ Yes | Orders import the entry port. Architecture reports no violations. |
| `TakeOrder.fire`: send, then port, then `saveCheck`; `portions: 1` | ✅ Yes | `consumeHeldLines` runs after `check.send` and `commit` saves the check. A later `fire` still throws `EmptyOrder`. |
| Idempotency key `(tenantId, orderLineId, role)` | ❌ No | Both dialects use `(tenant_id, order_line_id, role, ingredient_id)`. The extra column is what allows one movement per ingredient. |
| One open alert; shortage does not block the send | ✅ Yes | Use-case tests. Cloud publisher does not deliver the notice. |
| Snapshot reference cost; waste does not change unit cost | ⚠️ Partial | Use-case doubles snapshot a cost. `CatalogReferenceCostList.costOf` returns the first brand in the tenant whose catalog contains the ingredient. No passing test covers that class. The passing waste test keeps the stored unit cost. |
| `generation` from the venue operation | ✅ Yes | `VenueOperationGeneration` and `currentGeneration` read the venue operation. `acceptWrite` rejects a stale generation. |
| Memory, Postgres RLS, SQLite; api-cloud does not import SQLite | ✅ Yes | Contract suites passed. `pnpm architecture` passed. |
| Flag off skips the inventory port and does not affect orders | ✅ Yes | `saleConsumptionEnabled !== true` returns from `reverseConsumption` only. The started line still leaves the check. This closes the previous critical finding. |
| `saleConsumptionEnabled` defaults off in api-cloud | ✅ Yes | `dependencies.saleConsumptionEnabled === true`. With the flag off, send does not consume and void does not call the ledger. The void itself still runs. |
| local-node wires the SQLite ledger and not Postgres | ⚠️ Partial | `registerStockLedger` can inject the SQLite repository. Nothing in the workspace calls `sqliteStockLedger` or constructs the order and inventory use cases on the node. |
| Same transaction enqueues `StockMoved` on `after_sales`, key = movement id | ✅ Yes | `append` writes the outbox row. The passing memory test shows a repeated `enqueue` leaves one row. |
| Balance is the sum in the same transaction | ⚠️ Partial | Unlinked movements still sum, including the specified +1000 / −700 / −500 case. `onHandDelta` posts 0 for a waste that reverses a sale consumption of the same ingredient. Postgres `postedQuantity` and the SQLite equivalent load that consumption and call `onHandDelta`. The in-memory repository does the same before updating its balance map. |
| No `shared/sync` | ✅ Yes | Sync drain is not in this change. The spec scenarios that require the drain stay untested. |

### Issues Found

**CRITICAL**:

1. Hybrid outage is UNTESTED. The spec requires an offline hybrid site to store consumption locally and sync it once on reconnect. No passing test sends lines on the node. `sqliteStockLedger` has no caller. local-node does not construct `TakeOrder`, `VoidLine`, or the three inventory use cases. The design defers `shared/sync`. The scenario remains required.
2. Cloud-mode outage is UNTESTED. No passing test shows that, after reconnect, consumption exists only for lines that were actually sent.
3. Upward sync "outage then reconnect" is UNTESTED. No passing test delivers 300 movements once or shows cloud balances equal to node balances.
4. "Duplicate batch ignored" is UNTESTED. The passing enqueue test repeats a local outbox key. It does not resend a batch the cloud has already acknowledged.

**WARNING**:

1. `pnpm typecheck` exits 2. Both errors are in `apps/venue-app/src/service/venue-cloud.ts`. This change does not edit that file and the file does not reference the ledger. The workspace build is not green.
2. `pnpm lint` exits 1. 967 diagnostics are `format` and every one of those files contains a CR byte, including files this change added (`stock-ledger.ts`, `void-line.ts`, `record-waste.ts`, both dialect repositories, and others). Two `assist/source/organizeImports` errors are on `contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.ts` and `contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.ts` ("Sort the imported names" for `MOVEMENT_TYPE`, `onHandDelta`, and `MovementType`). Those two are not CR-only and they are on files this change added. One pre-existing `useOptionalChain` warning remains in `contexts/platform/domain/authorization.ts`.
3. The ledger requirement says the balance equals the sum of movements. A waste that reverses a sale consumption stores the consumed quantity and posts 0 to on-hand. After −300 g consumption plus that waste, the balance is −300 g, not −600 g. The specified +1000 / −700 / −500 scenario still passes because that waste is not linked to a stored sale consumption. Unlinked waste still changes the balance.
4. The idempotency key includes `ingredient_id`. Design and task 2.4 name only `(tenantId, orderLineId, role)`.
5. Reference cost uses the first brand in the tenant that contains the ingredient. No passing test covers `CatalogReferenceCostList`.
6. `StoredStockAlertPublisher.publish` is a no-op. The use-case test opens an alert through a capturing double. The requirement text also says the alert is raised on kitchen and cash screens. That delivery is not tested in the cloud composition.
7. `dependency-cruiser` reports `missing-typescript-transpiler` for TypeScript 7. The command still exited 0 and reported no violations across 1091 modules.

**SUGGESTION**:

1. Close the two open questions in `design.md`. `portions: 1` is implemented and covered by the passing take-order test. The architecture command already allows local-node SQLite and does not show an api-cloud SQLite import.

### Verdict

FAIL

21/25 scenarios are compliant. Inventory and orders exited 0 on the serial rerun. Four spec scenarios have no passing covering test: hybrid outage, cloud-mode outage, upward sync after reconnect, and a duplicate batch the cloud already acknowledged. The design defers `shared/sync`, and those scenarios stay UNTESTED. Not ready to archive.

**Ready to archive**: No
