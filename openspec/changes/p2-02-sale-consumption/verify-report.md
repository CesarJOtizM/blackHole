```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ce8f5374371a7c65537d6a984cbe104ba633459bebdc0e13fe5349a84cfac8f2
verdict: fail
blockers: 5
critical_findings: 5
requirements: 9/12
scenarios: 20/25
test_command: pnpm exec vitest run --project inventory && pnpm exec vitest run --project orders
test_exit_code: 0
test_output_hash: sha256:3173a99f076683eae920d8cd646bba7d1179ccd5be12ceb7b40b8974564d3ee5
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
```

## Verification Report

**Change**: p2-02-sale-consumption
**Version**: N/A
**Mode**: Standard
**Worktree**: `C:\Users\csar-\Proyectos\blackHole-p2-02` on branch `p2-02/domain`
**Strict TDD**: inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded.

`test_output_hash` is the SHA-256 of the inventory log bytes followed immediately by the orders log bytes. `evidence_revision` is that concatenation followed by the typecheck log bytes. Each command was run separately in this worktree. Individual digests are in Build & Tests.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 21 (1.1–1.2, 2.1–2.7, 3.1–3.6, 4.1–4.6) |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

Every implementation checkbox in `tasks.md` is `[x]`. No implementation checkbox is open. Proposal success criteria remain unchecked; they are not task checkboxes. `state.yaml` still says `apply: pending` and `status: planned`. This report updates only `artifacts.verify`.

### Build & Tests Execution

**Build**: Passed

```text
pnpm typecheck
exit 0
output: "$ tsc -b" (9 bytes)
sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
```

**Tests**: 293 passed, 0 failed, 0 skipped

```text
pnpm exec vitest run --project inventory
exit 0
Test Files  18 passed (18)
Tests       67 passed (67)
Duration    14.65s
sha256:f1f85e08dc83381216255e29f95ea8575898b77a23a96948fe0c6a047842f06c

pnpm exec vitest run --project orders
exit 0
Test Files  43 passed (43)
Tests       226 passed (226)
Duration    19.02s
sha256:7581adca93ec5ec451c4cf55c68745f06d66d6116d46964f305b1da796353534
```

**Lint**: exit 1. Not a fail for this change. See WARNING below.

```text
pnpm lint
cwd: C:\Users\csar-\Proyectos\blackHole-p2-02
exit 1
Checked 980 files. Found 935 errors. Found 1 warning.
sha256:d34389a817e7c722e72e553cd4cc39a9dec057c4cb0d6475bbb5757c2b31efdf
```

Biome JSON (`--max-diagnostics=5000 --reporter=json`, 936 diagnostics): 935 `format`, 1 `lint/complexity/useOptionalChain`. Zero diagnostics name a file this change added or edited. All 935 format files contain a CR byte. `biome format --stdin-file-path` on the LF-normalized contents of `apps/admin-web/tsconfig.json`, `contexts/inventory/application/ports/recipe-catalog-repository.contract.ts`, `vitest.config.ts`, and `contexts/platform/domain/authorization.ts` reproduced those contents exactly. The `pnpm lint` diff for the files it printed removes only `␍`. The single warning is `useOptionalChain` in `contexts/platform/domain/authorization.ts`, which this change did not edit.

**Architecture**: Passed, with the known TypeScript 7 transpiler notice.

```text
pnpm architecture
exit 0
no dependency violations found (1087 modules, 3688 dependencies cruised)
missing-typescript-transpiler (typescript >=7; already documented in openspec/config.yaml)
sha256:cde30a0e60593e721d185f13f5ab3a54b76454581ac54b639a0fba68637249bc
```

**Coverage**: Not available / threshold 0. No coverage package is installed. Not a failure.

### Spec Compliance Matrix

A scenario is COMPLIANT only when a covering test passed in this worktree's inventory or orders run. Counts: 12 requirements (7 stock-consumption, 5 inventory-ledger), 25 scenarios.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Deduct on Send to Kitchen | Line deducts ingredients | `register-sale-consumption.test.ts` > given burger version 4, when 2 portions are sent, then beef and cheese are consumed at that version and the reference cost is snapshotted | ✅ COMPLIANT |
| Deduct on Send to Kitchen | Bar shares the location | `register-sale-consumption.test.ts` > given a cocktail routed to the bar, when it is sent, then it deducts from the same point of sale as the grill | ✅ COMPLIANT |
| Deduct on Send to Kitchen | Product without recipe | `register-sale-consumption.test.ts` > given a product with no recipe, when it is sent, then nothing is written and the result is missing recipe; `take-order.test.ts` > given a held line whose recipe is missing, when the course is fired, then the check is still saved | ✅ COMPLIANT |
| Version Fixed at Send Time | Recipe changes mid-service | `record-waste.test.ts` > given a line consumed at version 4, when it is wasted after start, then waste stores reason and actor, keeps version 4 and unit cost, and does not return stock | ⚠️ PARTIAL |
| Version Fixed at Send Time | New send uses new version | `register-sale-consumption.test.ts` > given version 5 is current, when a new line is sent, then consumption uses version 5 | ✅ COMPLIANT |
| Stocked Preparations | Stocked sauce | `register-sale-consumption.test.ts` > given pasta uses a stocked tomato sauce, when it is sent, then the sauce stays collapsed and tomatoes are untouched | ✅ COMPLIANT |
| Stocked Preparations | Non-stocked dressing | `register-sale-consumption.test.ts` > given salad uses a non-stocked dressing, when it is sent, then the dressing ingredients are consumed | ✅ COMPLIANT |
| Void Before or After Kitchen Start | Void before start | `void-line.test.ts` > given a sent line and sale consumption on, when the waiter voids it before the kitchen starts, then stock is returned for the stored line and waste is not recorded; `return-stock.test.ts` > given a line consumed at version 4, when it is returned after that version was current, then the stored quantities and unit cost are restored | ✅ COMPLIANT |
| Void Before or After Kitchen Start | Void after start | `void-line.test.ts` > given a line the kitchen already started and sale consumption on, when the waiter voids it, then waste records the reason and actor and stock is not returned; `record-waste.test.ts` > given a line consumed at version 4, when it is wasted after start… | ✅ COMPLIANT |
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

**Compliance summary**: 20/25 scenarios compliant, 1 partial, 4 untested, 0 failing. 9/12 requirements have every scenario compliant. Version Fixed at Send Time, Operation by Mode, and Upward Synchronization are incomplete.

PARTIAL detail: the waste test copies the stored version-4 line and asserts version 4 quantities. It never publishes version 5 in that case, so the scenario's "version 5 is published" condition is not arranged. `RecordWaste` does not re-explode, which is why a later version cannot change the stored quantities, but that condition was not executed.

UNTESTED detail: no passing test sends lines on an offline hybrid node, syncs them once, limits cloud consumption to lines actually sent after reconnect, delivers 300 movements once with equal cloud balances, or ignores a batch the cloud already acknowledged. The passing enqueue test only repeats a local outbox key.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Deduct on send | ✅ Implemented | `RegisterSaleConsumption` explodes the current version at the point-of-sale location. `TakeOrder.fire` calls it once per line leaving `held`, with `portions: 1`, after `send` and before `saveCheck`, only when the flag is on. |
| Stocked vs expanded preparations | ✅ Implemented | Covered by the explosion double in the passing use-case tests. |
| Void before start returns stock | ✅ Implemented | `sent` calls `ReturnStock`, which appends the negated quantity. Balance returns to 0 in the passing test. |
| Void after start records waste | ✅ Implemented when the flag is on | Reason, actor, version 4, and no `sale_return` are tested. Waste copies the consumption quantity, so −300 g plus waste leaves −600 g. The passing waste test expects that balance. |
| Negative stock does not block | ✅ Implemented | Balance −200 g and one `NegativeStockOpened` in the use-case test. Cloud `StoredStockAlertPublisher.publish` is empty. |
| Idempotent send and return | ✅ Implemented | Unique `(tenant_id, order_line_id, role, ingredient_id)` in both `0002_stock_ledger.sql` files. A retry writes nothing. |
| Append-only ledger and derived balance | ✅ Implemented | Domain rejects edit and delete. Postgres rejects `UPDATE`. Failed third insert rolls back movements, balance, alert, and the queued row. |
| Stale generation | ✅ Implemented | Use cases throw `StaleGeneration`. Composition reads `VenueOperationRepository`, not a new HTTP field. |
| Hybrid node records and syncs consumption | ❌ Not composed | `sqliteStockLedger` has no caller. `local-node` registers the SQLite ports only if a host passes `stock`. It does not construct `TakeOrder`, `VoidLine`, `RegisterSaleConsumption`, `ReturnStock`, or `RecordWaste`. |
| Upward sync without duplication | ⚠️ Enqueue only | `append` inserts the `stock_movement_outbox` row in the same transaction. A later `enqueue` of the same movement id returns. No cloud apply, 300-movement drain, or acknowledged-batch test exists. `shared/sync` is absent, as the design deferred the drain. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Orders call the inventory entry port | ✅ Yes | Orders import the entry port. Architecture reports no violations. |
| `TakeOrder.fire`: send, then port, then `saveCheck`; `portions: 1` | ✅ Yes | Passing take-order test. A later `fire` still throws `EmptyOrder`. |
| Idempotency key `(tenantId, orderLineId, role)` | ❌ No | Both dialects use `(tenant_id, order_line_id, role, ingredient_id)`. The extra column is what allows one movement per ingredient. The triple alone would reject the second ingredient. |
| One open alert; shortage does not block the send | ✅ Yes | Use-case tests. Cloud publisher does not deliver the notice. |
| Snapshot reference cost; waste does not change unit cost | ⚠️ Partial | Use-case doubles snapshot a cost. `CatalogReferenceCostList` returns the first brand in the tenant whose catalog contains the ingredient. No passing test covers that class. |
| `generation` from the venue operation | ✅ Yes | `VenueOperationGeneration` and `currentGeneration` read the venue operation. `acceptWrite` rejects a stale generation. |
| Memory, Postgres RLS, SQLite; api-cloud does not import SQLite | ✅ Yes | Contract suites passed. `pnpm architecture` passed. |
| Flag off skips the inventory port and does not affect orders | ❌ No | Flag off skips the port on send, and a sent-line void still completes. An after-start void returns the original check before permission, detach, waste, and audit. The passing test expects the line to stay `in_preparation`. |
| `saleConsumptionEnabled` defaults off in api-cloud | ✅ Yes | `dependencies.saleConsumptionEnabled === true`. Combined with the early return, the composed cloud module does not perform after-kitchen voids unless a host passes `true`. |
| local-node wires the SQLite ledger and not Postgres | ⚠️ Partial | `registerStockLedger` can inject the SQLite repository. Nothing in the worktree calls `sqliteStockLedger` or constructs the order and inventory use cases on the node. |
| Same transaction enqueues `StockMoved` on `after_sales`, key = movement id | ✅ Yes | `append` writes the outbox row. The passing memory test shows a repeated `enqueue` leaves one row. |
| No `shared/sync` | ✅ Yes | Sync drain is not in this change. The spec scenarios that require the drain are therefore untested. |

### Issues Found

**CRITICAL**:

1. Hybrid outage is UNTESTED. The spec requires an offline hybrid site to store consumption locally and sync it once on reconnect. No passing test sends lines on the node. `sqliteStockLedger` is unused, and local-node does not construct `TakeOrder`, `VoidLine`, or the three inventory use cases.
2. Cloud-mode outage is UNTESTED. No passing test shows that, after reconnect, consumption exists only for lines that were actually sent.
3. Upward sync "outage then reconnect" is UNTESTED. No passing test delivers 300 movements once or shows cloud balances equal to node balances.
4. "Duplicate batch ignored" is UNTESTED. The passing enqueue test repeats a local outbox key. It does not resend a batch the cloud has already acknowledged.
5. After-kitchen void runs only when `saleConsumptionEnabled` is on. With the flag off, or with the optional `SaleReversal` omitted, `VoidLine` returns the original check before authorization and before the line leaves the account. api-cloud defaults the flag off (`saleConsumptionEnabled === true`). The proposal rollback says disabling the flag stops deduction without affecting orders. The design says the flag skips the port. The passing test `given sale consumption off, when a sent line or a started line is voided, then the inventory port is skipped` expects the started line to remain `in_preparation`.

**WARNING**:

1. `pnpm lint` exits 1. 935 diagnostics are `format` on files this change did not add or edit. All 935 contain CR, and the printed diffs and four LF-normalized format checks show a line-ending change. One pre-existing `useOptionalChain` warning is in `contexts/platform/domain/authorization.ts`.
2. Waste copies the negative consumption quantity. A −300 g send plus waste leaves −600 g. The passing waste test expects `grams(-600)`. The void-after-start scenario requires a waste record with reason and user and no return; it does not state the resulting balance. The proposal success criterion that theoretical consumption matches the recipes is not met for that void.
3. The idempotency key includes `ingredient_id`. Design and task 2.4 name only `(tenantId, orderLineId, role)`.
4. Reference cost uses the first brand in the tenant that contains the ingredient. No passing test covers `CatalogReferenceCostList`.
5. `StoredStockAlertPublisher.publish` is a no-op. The use-case test opens an alert through a capturing double. The requirement text also says the alert is raised on kitchen and cash screens; that delivery is not tested in the cloud composition.
6. `dependency-cruiser` reports `missing-typescript-transpiler` for TypeScript 7. The command still exited 0 and reported no violations across 1087 modules.
7. `state.yaml` still has `apply: pending` and `status: planned` after tasks 1.1–4.6 were checked. `status` is the change lifecycle field, so this report does not overwrite it with the verdict.

**SUGGESTION**:

1. Close the two open questions in `design.md`. `portions: 1` is implemented and covered by the passing take-order test. The architecture command already allows local-node SQLite and does not show an api-cloud SQLite import.
2. Publish version 5 inside the waste/return test so the mid-service scenario is fully arranged.

### Verdict

FAIL

20/25 scenarios are compliant and the inventory, orders, typecheck, and architecture commands exited 0. Four spec scenarios have no passing covering test, and the composed cloud default blocks after-kitchen voids. Not ready to archive.

**Ready to archive**: No
