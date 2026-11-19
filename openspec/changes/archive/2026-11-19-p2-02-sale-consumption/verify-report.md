```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b34a2995ff2395becc701ee135958d4e146d6f4b4383dbd764107ec2fee3a873
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 12/12
scenarios: 21/21
test_command: pnpm exec vitest run --project inventory && pnpm exec vitest run --project orders && pnpm exec vitest run --project api-cloud test/composition/sale-consumption.test.ts test/http/shortage-realtime.controller.test.ts
test_exit_code: 0
test_output_hash: sha256:7cd22e11bcde4f2580f7f7da02be7cfc3afc706659958f9502dce86928e82fc5
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
archive_allowed: true
```

## Verification Report

**Change**: p2-02-sale-consumption
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole` on branch `p2-11/rollout-status`
**Strict TDD**: inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded.
**Persistence**: openspec.

This replaces the previous report. That report failed only because `pnpm typecheck` exited 2. This run executed typecheck and the same test projects again. `pnpm typecheck` (`tsc -b`) exited 0 and wrote `$ tsc -b` with no diagnostics.

Hybrid outage, cloud-mode outage, outage-then-reconnect, and duplicate-batch drain stay deferred to the hybrid phase (D-37). `specs/stock-consumption/spec.md`, `specs/inventory-ledger/spec.md`, and `design.md` say those four are not acceptance criteria. They are not counted and are not UNTESTED.

`test_output_hash` is the SHA-256 of the passing inventory log, then the orders log, then the api-cloud log, concatenated with no separator. `build_output_hash` is the SHA-256 of the typecheck log. `evidence_revision` is those test bytes followed by the typecheck bytes. Logs are the exact files written by `cmd` redirection.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 21 (1.1–1.2, 2.1–2.7, 3.1–3.6, 4.1–4.6) |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

Every implementation checkbox in `tasks.md` is `[x]`. Proposal success criteria remain unchecked. They are not task checkboxes. `state.yaml` stays `status: applied` and `archive: pending`. This run sets `artifacts.verify` to `pass-with-warnings`.

### Build & Tests Execution

**Build**: Passed. The log names no file.

```text
pnpm typecheck
exit 0
sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
```

**Tests**: 632 passed, 0 failed, 0 skipped on the recorded runs.

```text
pnpm exec vitest run --project inventory
exit 0
Test Files  70 passed (70)
Tests       376 passed (376)
Duration    16.71s
sha256:f165a84a138a52c1fb01b143544def6158bab70057fe61b4c4950c01a109a079

pnpm exec vitest run --project orders
exit 0
Test Files  48 passed (48)
Tests       251 passed (251)
Duration    12.21s
sha256:3feccba4c88f8a255bb40e776eba1285e5ca826e32aa7e9ecd17c13b7ca12c21

pnpm exec vitest run --project api-cloud test/composition/sale-consumption.test.ts test/http/shortage-realtime.controller.test.ts
exit 0
Test Files  2 passed (2)
Tests       5 passed (5)
Duration    22.14s
sha256:b72d41a084e5249c34cfcbf0bcd80bb2182f15ece4fd71b86d2de422b40598b6
```

A first concurrent run of typecheck plus the three vitest projects timed out unrelated PGlite contracts (purchasing, transfers, stock counts, shortage, recipe catalog, dining room, menu, QR, station routes, no-restock). Those timeouts are not sale-consumption scenarios. The inventory and orders logs above are the immediate serial reruns. The api-cloud log is the concurrent run, which already passed 5/5. The hashes above are those recorded logs.

**Lint**: not run.

**Architecture**: not run.

**Coverage**: Not available / threshold 0. No coverage package is installed. Not a failure.

### Spec Compliance Matrix

A scenario is COMPLIANT only when a covering test passed in the recorded inventory, orders, or api-cloud run. Counts: 12 requirements (7 stock-consumption, 5 inventory-ledger), 21 scenarios. Operation by Mode and Upward Synchronization have no scenarios.

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
| Append-only Movements | Movement recorded | `stock-ledger.test.ts` > given an existing movement, when an actor tries to change or delete it, then the operation is rejected and the movement is unchanged (appends −200 g `sale_consumption` with reference `order_line_1` and keeps that balance) | ✅ COMPLIANT |
| Append-only Movements | Edit attempt rejected | `stock-ledger.test.ts` > given an existing movement…; `drizzle-stock-ledger-repository.contract.test.ts` (postgres) > given a stored movement, when inventory_app updates it, then the update is rejected | ✅ COMPLIANT |
| Derived Balance | Balance equals sum including negatives | `stock-ledger.test.ts` > given movements of +1000 g, -700 g and -500 g, when the balance is read, then it is -200 g; `stock-ledger-repository.contract.ts` > given movements of +1000 g, -700 g, and -500 g… (memory, PGlite, SQLite) | ✅ COMPLIANT |
| Derived Balance | Failed write leaves no trace | `stock-ledger-repository.contract.ts` > given a consumption of three ingredients, when the third insert fails, then movements, balance, alert, and the queued row roll back (memory, PGlite, SQLite) | ✅ COMPLIANT |
| Location Ownership by Operating Mode | Hybrid site writes locally | `drizzle-stock-ledger-repository.contract.test.ts` (sqlite) runs the shared contract, including the queued `after_sales` row | ✅ COMPLIANT |
| Location Ownership by Operating Mode | Stale owner rejects writes | `register-sale-consumption.test.ts`, `return-stock.test.ts`, and `record-waste.test.ts` > given the current generation, when a send/return/waste arrives with another generation, then StaleGeneration is thrown and nothing is written | ✅ COMPLIANT |
| Dialect Parity | Same balance in both stores | Shared contract balance assertion passed on SQLite and on PGlite in the same inventory run; both expect −200 g | ✅ COMPLIANT |
| Dialect Parity | Cross-tenant read blocked | `stock-ledger-repository.contract.ts` > given tenants A and B, when tenant A reads its balance, then B stays hidden; postgres > given movements for tenants A and B, when inventory_app selects them without a tenant filter, then only tenant A returns | ✅ COMPLIANT |

**Compliance summary**: 21/21 scenarios compliant, 0 partial, 0 untested, 0 failing. 12/12 requirements have every named scenario compliant. Operation by Mode and Upward Synchronization have no scenarios; their remaining statements are in the correctness table.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Deduct on send | ✅ Implemented | `RegisterSaleConsumption` explodes the current version at the point-of-sale location. `TakeOrder.fire` calls it once per line leaving `held`, with `portions: 1`, after `send` and before `saveCheck`, only when the flag is on. |
| Stocked vs expanded preparations | ✅ Implemented | Covered by the explosion double in the passing use-case tests. |
| Void before start returns stock | ✅ Implemented | `sent` calls `ReturnStock`. The passing return test restores the stored quantity. |
| Void after start records waste | ✅ Implemented | Reason, actor, version 4, and no `sale_return` are tested. Linked waste posts 0 to on-hand, so the consumption is not deducted twice. |
| Flag off skips only the ledger call | ✅ Implemented | Passing void and take-order tests keep the order path and skip the inventory port when the flag is off. `saleConsumptionEnabled` is true only when the dependency flag is exactly true. |
| Negative stock does not block | ✅ Implemented | Balance −200 g and one alert in the use-case test. `sale-consumption.test.ts` records one `siteAdministrator` notice and does not duplicate a second publish. |
| Idempotent send and return | ✅ Implemented | Unique `(tenant_id, order_line_id, role, ingredient_id)` in `0002_stock_ledger.sql`. A retry writes nothing. The contract allows two ingredients on one line. |
| Append-only ledger and derived balance | ✅ Implemented for the specified sums | Domain rejects edit and delete. Postgres rejects `UPDATE`. Failed third insert rolls back movements, balance, alert, and the queued row. |
| Cloud records accepted lines | ✅ Implemented | api-cloud constructs `RegisterSaleConsumption` when `saleConsumptionEnabled` is true. The passing take-order test calls that port for each line leaving `held`. |
| Stale generation | ✅ Implemented | Use cases throw `StaleGeneration`. `VenueOperationGeneration` reads the venue operation. |
| Enqueue `StockMoved` once per movement id | ✅ Implemented | Shared contract on PGlite queues the row in the append transaction and rolls it back with a failed insert. Postgres `enqueue` returns when that movement id is already stored. The repeat-key test that passed is the memory adapter. |
| Hybrid outage and batch drain | Deferred | Not scenarios. D-37. Not counted. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Orders call the inventory entry port | ✅ Yes | Orders use the entry port. |
| `TakeOrder.fire`: send, then port, then `saveCheck`; `portions: 1` | ✅ Yes | Passing take-order test. A later `fire` still throws `EmptyOrder`. |
| Idempotency key `(tenantId, orderLineId, role)` | ⚠️ Partial | Both dialects also include `ingredient_id`. That column stores one movement per ingredient. The rejected design alternative was "per ingredient" as the only key. |
| One open alert; shortage does not block the send | ✅ Yes | Use-case tests and the composition publisher test. |
| Snapshot reference cost; waste does not change unit cost | ⚠️ Partial | Use-case doubles snapshot a cost. `CatalogReferenceCostList.costOf` returns the first brand in the tenant whose catalog contains the ingredient. No passing test covers that class. The passing waste test keeps the stored unit cost. |
| `generation` from the venue operation | ✅ Yes | `VenueOperationGeneration` reads the venue operation. |
| Memory, Postgres RLS, SQLite | ✅ Yes | Contract suites passed in the inventory run. |
| Flag off skips the inventory port | ✅ Yes | Passing take-order and void-line tests. Default remains off. |
| local-node wires the SQLite ledger | ⚠️ Partial | `sqliteStockLedger` and `registerStockLedger` exist. Nothing in the workspace calls either function. Hybrid outage is not an acceptance criterion. |
| Same transaction enqueues `StockMoved` on `after_sales`, key = movement id | ✅ Yes | Passing contract queue assertion and the memory repeat-key test. |
| Hybrid outage, cloud-mode outage, reconnect drain, duplicate batch | ✅ Deferred | `design.md` says these four are not acceptance criteria. |

### Issues Found

**CRITICAL**: None

**WARNING**:

1. A concurrent typecheck plus inventory, orders, and api-cloud run timed out unrelated PGlite contracts at 5000ms. The serial inventory and orders reruns passed 376/376 and 251/251. Those reruns are the recorded inventory and orders evidence. The timeout is not in `test_output_hash`.
2. The idempotency unique key includes `ingredient_id`. Design and task 2.4 name `(tenantId, orderLineId, role)`.
3. `CatalogReferenceCostList.costOf` uses the first brand that contains the ingredient. No passing test covers that class.
4. `NegativeStockNoticeLog` records `role: "siteAdministrator"`. The passing composition test checks that notice. The requirement text also says kitchen and cash screens. No passing test shows this alert on a cash screen.
5. `registerStockLedger` and `sqliteStockLedger` have no caller. The SQLite contract passed. The node host does not construct the order or inventory use cases. That gap is the deferred hybrid path, not an acceptance scenario.

**SUGGESTION**:

1. The two open questions in `design.md` are still open. `portions: 1` is implemented and covered by the passing take-order test.
2. Proposal success criteria remain unchecked. The third criterion is the deferred hybrid outage.

### Verdict

PASS WITH WARNINGS

21/21 scenarios are compliant. Inventory, orders, and the sale-consumption api-cloud tests exited 0 on the recorded runs. `pnpm typecheck` exited 0. No critical findings. Archive is allowed. This phase did not archive the change.

**Ready to archive**: Yes
