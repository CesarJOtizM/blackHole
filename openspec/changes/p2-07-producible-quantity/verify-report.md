```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:28dae874ae0998f9920911df2a7778badeada350ab86738fb18fb8a61884f3d8
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 6/9
scenarios: 16/19
test_command: pnpm exec vitest run --project inventory contexts/inventory/domain/producible-quantity.test.ts contexts/inventory/application/project-producible-quantity/project-producible-quantity.test.ts contexts/inventory/application/ports/producible-quantity-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-producible-quantity-repository.contract.test.ts && pnpm exec vitest run --project orders contexts/orders/domain/menu.test.ts contexts/orders/application/apply-menu-availability/apply-menu-availability.test.ts contexts/orders/adapters/postgres/drizzle-menu-repository.contract.test.ts && pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/producible-quantity.controller.test.ts apps/api-cloud/test/http/orders-realtime.controller.test.ts
test_exit_code: 0
test_output_hash: sha256:cfbc8329018995f20f9aa87dad65a59fb85e7bc043df22fac48cff2ffdc768a0
build_command: N/A
build_exit_code: N/A
build_output_hash: sha256:1a1eef0f1b772c1fb2a5328fbd70501870f70efb53f1abf23db9d59c4ed2ab67
archive_allowed: false
```

## Verification Report

**Change**: p2-07-producible-quantity
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole`
**Strict TDD**: inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded.
**Persistence**: openspec. Engram had no prior `sdd/p2-07-producible-quantity` spec, design, or tasks observation. This report is the openspec file. An Engram save of `sdd/p2-07-producible-quantity/verify-report` is attempted with `capture_prompt: false`.

`tasks.md` has 14 implementation checkboxes, 1.1–5.2, all `[x]`, and no unchecked task line. Proposal success criteria stay unchecked. They still describe a hybrid outage and a waiter menu that marks sold out during that outage. Before this run `state.yaml` was `status: applying`, `apply: partial`, `verify: pending`, `archive: pending`. This run sets `status: applied`, `apply: done`, and `artifacts.verify` to `pass-with-warnings`. Archive stays pending and `archive_blocked` is true. This run does not archive.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: N/A — not executed

```text
N/A. Orchestrator forbade pnpm typecheck, pnpm lint, pnpm architecture, and the full vitest suite. This run did not edit product source, including apps/api-cloud/src/composition/application-module.ts.
sha256:1a1eef0f1b772c1fb2a5328fbd70501870f70efb53f1abf23db9d59c4ed2ab67
```

**Tests**: 53 passed, 0 failed, 0 skipped. All three commands exited 0. No listed path was missing.

`test_output_hash` is the SHA-256 of the three result blocks below, concatenated in this order with a blank line between blocks, UTF-8, LF, and no trailing newline. PowerShell profile noise is not part of that digest. `evidence_revision` is the SHA-256 of those three blocks followed by one LF and the build skip sentence above. Inventory is 10 domain + 12 projector + 3 memory-contract + 4 PGlite (the shared contract plus the balance read). Orders is 18 across the three files; the menu PGlite file applies `0008_low_units_threshold.sql` and then the existing menu contract. api-cloud is 4 producible HTTP + 2 orders-realtime.

```text
pnpm exec vitest run --project inventory contexts/inventory/domain/producible-quantity.test.ts contexts/inventory/application/project-producible-quantity/project-producible-quantity.test.ts contexts/inventory/application/ports/producible-quantity-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-producible-quantity-repository.contract.test.ts
exit 0
Test Files  4 passed (4)
Tests  29 passed (29)
Duration  5.58s

pnpm exec vitest run --project orders contexts/orders/domain/menu.test.ts contexts/orders/application/apply-menu-availability/apply-menu-availability.test.ts contexts/orders/adapters/postgres/drizzle-menu-repository.contract.test.ts
exit 0
Test Files  3 passed (3)
Tests  18 passed (18)
Duration  4.55s

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/producible-quantity.controller.test.ts apps/api-cloud/test/http/orders-realtime.controller.test.ts
exit 0
Test Files  2 passed (2)
Tests  6 passed (6)
Duration  3.65s
```

**Coverage**: N/A. No coverage command was allowed. `openspec/config.yaml` sets `coverage_threshold: 0` and records no coverage package.

**Not run, and not used as compliance evidence**: `pnpm typecheck`, `pnpm lint`, `pnpm architecture`, and the full vitest suite.

### Spec Compliance Matrix

The producible-quantity spec has 6 requirements and 12 scenarios. The catalog delta has 3 requirements and 7 scenarios. Total: 9 requirements, 19 scenarios. A scenario is compliant only when a covering test passed in this run. General-warehouse last-sync, the hybrid node offline, and a threshold change while that node is offline stay design-deferred (D-37, design and tasks: cloud only, no `local-node`, no `shared/sync`). Those three are warnings, not slice defects, and they are not sent back to apply.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Units Producible From Point Stock | Minimum across ingredients | `producible-quantity.test.ts` > given 3000 g of beef and 12 buns, when producible units are computed, then the buns limit the result at 12 | ✅ COMPLIANT |
| Units Producible From Point Stock | Negative stock | `producible-quantity.test.ts` > given beef stock of -200 g, when producible units are computed, then the result is 0 | ✅ COMPLIANT |
| Limiting Ingredient | Ingredient missing from the point | `producible-quantity.test.ts` > given the point has no balance row for buns, when the limiting ingredient is requested, then buns limit the result at 0 | ✅ COMPLIANT |
| Limiting Ingredient | Tie | `producible-quantity.test.ts` > given beef and buns both allow 12 units, when the limiting ingredient is requested, then both ingredient ids are listed | ✅ COMPLIANT |
| Units With Restocking | Site warehouse adds capacity | `producible-quantity.test.ts` > given the point allows 12 and the warehouse adds 40 buns, when units with restocking are computed, then replenishment is 52 and the point state stays; projector test keeps the menu state on the point when supplying stock is present | ✅ COMPLIANT |
| Units With Restocking | General warehouse offline | (none; design leaves last-sync timestamp and hybrid stock unbuilt) | deferred — not a slice defect |
| Recalculation On Stock Change | Consumption on send to kitchen | `project-producible-quantity.test.ts` > given beef or buns change at the point, when recalculation runs, then every indexed product using that ingredient is recalculated | ✅ COMPLIANT |
| Recalculation On Stock Change | Unrelated ingredient | `project-producible-quantity.test.ts` > given a purchase of lemons at the point, when recalculation runs, then products without lemons are not re-evaluated | ✅ COMPLIANT |
| Availability State | Low units | `producible-quantity.test.ts` > given a threshold of 5, when point units are at or under it, then the state is low_units; projector test emits one `low_units` event when units drop from 6 to 5 | ✅ COMPLIANT |
| Availability State | Sold out does not block the sale | `apply-menu-availability.test.ts` > given the burger is available, when the state becomes sold out, then the hub sends sold_out and the product stays orderable; `producible-quantity.controller.test.ts` > given five units under a threshold of 5, when the menu is read and a sold-out product is sent, then the flag is shown and the send succeeds | ✅ COMPLIANT |
| Real-Time Availability Event | Hybrid site offline | (none; design and tasks leave `local-node` and offline notify unbuilt) | deferred — not a slice defect |
| Real-Time Availability Event | No transition, no event | `project-producible-quantity.test.ts` > given no threshold and 30 available units, when units drop to 29, then the state stays available and nothing is emitted; HTTP test sends one unit from 30 and emits nothing further | ✅ COMPLIANT |
| Effective Menu Availability | Manual availability wins | `menu.test.ts` > given the site disabled fish of the day manually and inventory allows 20 units, when the waiter opens the menu, then the product is not orderable | ✅ COMPLIANT |
| Effective Menu Availability | Inventory state shown | `menu.test.ts` > given a product enabled and in schedule whose state is low_units, when the waiter opens the menu, then the product stays orderable and flagged as low units | ✅ COMPLIANT |
| Products Without Recipe | Bottled drink without recipe | `project-producible-quantity.test.ts` > given a bottled soda has no recipe, when availability is derived, then no inventory state is stored; `menu.test.ts` > given a bottled soda has no inventory state, when the waiter opens the menu, then presentProduct omits inventoryState and the soda follows manual availability | ✅ COMPLIANT |
| Products Without Recipe | Recipe added later | `project-producible-quantity.test.ts` > given a new recipe version is published, when that product is projected, then the current explode replaces the previous result (the first projection stores 12 units) | ✅ COMPLIANT |
| Low-Units Threshold Per Product | Admin sets the threshold | `producible-quantity.controller.test.ts` > given an owner session, when the burger threshold is set to 5, then the change is audited | ✅ COMPLIANT |
| Low-Units Threshold Per Product | Waiter cannot change it | `producible-quantity.controller.test.ts` > given a waiter session, when the low-units threshold is set, then the request is denied | ✅ COMPLIANT |
| Low-Units Threshold Per Product | Change made while a hybrid site is offline | (none; the node copy and reconnection are not built) | deferred — not a slice defect |

**Compliance summary**: 16/19 scenarios compliant. 0 partial. 0 failing. 3 design-deferred. Those three are not CRITICAL.

Units from point stock, limiting ingredient, recalculation, availability state, effective menu availability, and products without a recipe are fully compliant. Units with restocking, the real-time event, and the low-units threshold each still have one deferred hybrid scenario, so those three requirements are not complete: 6/9 requirements complete.

Uncovered scenarios:

- General warehouse offline. No test uses a last-sync timestamp.
- Hybrid site offline. No test shows waiter phones on the node network a sold-out burger within 2 s.
- Change made while a hybrid site is offline. No test keeps the previous threshold on a node and applies the new one after reconnection.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Units from point stock | ✅ Implemented | `possibleUnits` takes the minimum of `floor(max(balance, 0) / quantity)`. A missing row is 0. Negative stock becomes 0. A line with `quantity <= 0` is skipped. A stocked preparation is limited by the recipe id `explode` returns. Both of those extra cases passed in the domain file. |
| Limiting ingredient | ✅ Implemented | The minimum ids are kept. A tie lists every tied id, sorted. |
| Units with restocking | ⚠️ Rule tested, host supplies nothing | Domain and projector tests keep point state at 12 and replenishment at 52, and a warehouse change updates replenishment without an event. `application-module.ts` injects `EmptySupplyingLocations`, whose `locationIds` returns `[]`. The running cloud path does not add supplying-warehouse stock. There is no sync timestamp. |
| Recalculation on stock change | ✅ Implemented for the wired callers | The projector recalculates indexed products and skips an ingredient that is not in the index. `append` is not called. Composition calls the projector after sale, return, order-line waste, and recipe publish. Purchase, production, transfer, and `RecordOperationalWaste` do not. |
| Availability state | ✅ Implemented | `sold_out` at 0 point units. `low_units` only when `lowUnitsThreshold` is not null and point units are at or under it. Otherwise `available`. Replenishment does not change the state. A sold-out product stays orderable and the HTTP send returns 200. This run does not read the ledger after that send, so the negative balance is not re-proven here. |
| Real-time event | ⚠️ Cloud hub only | A state change publishes site, product, variant, and state. 30 to 29 publishes nothing. The HTTP notices have no `cost` or `unitCost`. The orders-realtime test file does not assert `availability_changed` on the SSE stream. The controller maps that kind. No 2 s measurement. No node path. |
| Effective menu availability | ✅ Implemented | `isOrderable` reads manual availability and the schedule window. It does not read `inventoryState`. Manual off at 20 units stays not orderable. In-schedule `low_units` stays orderable. |
| Products without a recipe | ✅ Implemented | No explosion stores no projection and emits nothing. `presentProduct` omits `inventoryState` when the key is absent. The first recipe projection stores units. |
| Low-units threshold | ✅ Implemented on cloud | Nullable integer on `venue_prices` (`NULL` or `>= 0`). Null skips `low_units`. Owner set-to-5 is audited as `inventory.configure-levels`. Waiter is denied. The offline node copy is not built. |

`isOrderable` staying on manual availability plus schedule matches the catalog delta. It is not a broken scenario. The same is true of manual off at 20 units, in-schedule `low_units` staying orderable, sold out still sending while the product stays orderable, a missing inventory state omitting the key, 30 to 29 emitting nothing, and a null threshold skipping `low_units`. Those tests passed.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cloud only (D-37). No `local-node`, no `shared/sync` | ✅ Yes | No producible or availability match under `apps/local-node` or `shared/sync`. |
| Read `stock_balances`. No ledger append | ✅ Yes | `0005_producible_quantity.sql` creates the read model. The contract asserts no `stock_movements` insert. Projector tests keep `appendCalls` at 0. |
| Keep `Menu.isOrderable`. Add `inventoryState` | ✅ Yes | Domain menu tests passed. `presentProduct` adds the key only when a state is stored. |
| In-process port, one WebSocket. No new shared contract module | ⚠️ Deviation | The publisher calls `ApplyMenuAvailability` in process. `availability_changed` was also added to the existing `ordersRealtimeEvent` union in `shared/contracts/dining-room.ts`, and `inventoryState` is optional on the menu contract. There is no new sync contract. The payload in the HTTP test has no cost. |
| Threshold on the venue menu, audited, stock-level permission | ✅ Yes | HTTP owner audit and waiter denial passed. `0008_low_units_threshold.sql` adds the nullable column. |
| Base recipe and variant only | ✅ Yes | Notices carry `variantId`. The menu flag is per venue and product. |
| Live cloud balances. No suppliers means restock equals point | ⚠️ Intended, and the host always takes that branch | `EmptySupplyingLocations` returns no ids, so cloud replenishment equals point units even when p2-05 supply links exist. The projector still honors injected locations in its own tests. |
| Composition calls the projector after the stock command | ⚠️ Partial by design | After sale (`ProjectingSaleConsumption`), return (`ProjectingReturnStock`), order-line waste (`ProjectingRecordWaste`), and publish (`ProjectingRecipeCatalog`). Not after purchase, production, or transfer. Design says those three call the same projector later. `RecordOperationalWaste` is also not wrapped. |
| Export the use case from `entry-port.ts` and the package imports | ✅ Yes | `entry-port.ts` exports `ProjectProducibleQuantity` and its input type. `package.json` has `#application/project-producible-quantity/*` and also exports the ports and the memory and Postgres repositories so api-cloud can construct them. Specs do not require a single export path. The class export is present. |
| Orders flag stored beside manual availability | ✅ Yes, filename differs from the inventory task | `menu_inventory_states` is created in orders `0008_low_units_threshold.sql` with states `available`, `low_units`, and `sold_out`. Specs do not name that table. It keeps the flag off `isOrderable`. Inventory's read model is `0005_producible_quantity.sql` because `0003_purchasing.sql` and `0004_transfers.sql` already occupy the numbers after `0002_stock_ledger.sql`. Task 3.4 said the next file after 0002. The filename differs. The tables and the no-insert rule match the spec. |

### Issues Found

**CRITICAL**: None

**WARNING**:

1. Three spec scenarios are design-deferred and have no passing test: general warehouse offline with a last-sync timestamp, hybrid site offline within 2 s, and a threshold change while a hybrid site is offline. Design and tasks keep this delivery on `api-cloud` (D-37). No `local-node`. No `shared/sync`.
2. The projector runs after sale, return, order-line waste, and publish. It does not run after purchase, production, or transfer. Design leaves those three for later. `RecordOperationalWaste` is also not wrapped. The index rule itself passed: lemons do not re-evaluate the burger, and beef or buns recalculate every indexed product.
3. `isOrderable` stays manual availability plus schedule. The tests passed: manual off stays not orderable at 20 units; in-schedule `low_units` stays orderable; `sold_out` still sends and the product stays orderable; a missing inventory state omits the key.
4. 30 to 29 emits nothing, in the projector and on the HTTP hub. A null `lowUnitsThreshold` skips `low_units`. Both passed.
5. `application-module.ts` uses `EmptySupplyingLocations`. Cloud replenishment does not add supplying-warehouse stock. Domain and projector tests still prove 52 against a point state of 12 when locations are injected.
6. `availability_changed` lives on the existing dining-room realtime contract. The design text said no `shared/contracts`. The HTTP payload has no cost. `orders-realtime.controller.test.ts` passed and does not assert this kind on the SSE body. The controller maps the kind.
7. `menu_inventory_states` was added in orders `0008_low_units_threshold.sql`. The inventory projection is `0005_producible_quantity.sql`, not the next file after `0002`. Specs do not name either file. `entry-port.ts` does export the projector. `package.json` also exports the ports and repositories.
8. This run did not execute typecheck, lint, architecture, or the full vitest suite. The sold-out HTTP send was not followed by a ledger read, so a negative balance after that send is not re-proven here.

**SUGGESTION**:

- Proposal success criteria remain unchecked. They describe the hybrid outage this delivery leaves out.
- The 2 s p90 is stated on the real-time requirement and is not measured. The cloud event is asserted on the in-memory hub.

### Archive

Archive is not allowed. This run does not archive and does not start archive.

`depends_on` includes `p1-01-menu-and-catalog`, `p1-02-dining-room-and-kitchen`, `p2-01-ingredients-and-recipes`, `p2-02-sale-consumption`, `p2-04-production`, and `p2-05-warehouses-and-transfers`.

- `p1-01-menu-and-catalog` is under `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog`, with `status: archived` and `archive: done`.
- `p1-02-dining-room-and-kitchen` is under `openspec/changes/archive/2026-10-28-p1-02-dining-room-and-kitchen`, with `status: archived` and `archive: done`.
- `p2-01-ingredients-and-recipes` is already archived at `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes`. Its inner `state.yaml` still says `archive: pending` and `verify: pass-with-warnings`. The folder location is the archive.
- `p2-02-sale-consumption` is at `openspec/changes/p2-02-sale-consumption`, with `status: applied`, `artifacts.verify: fail`, and `archive: pending`. It is not archived.
- `p2-04-production` is at `openspec/changes/p2-04-production`, with `status: applied`, `artifacts.verify: pass`, and `archive: pending`. It is not archived.
- `p2-05-warehouses-and-transfers` is at `openspec/changes/p2-05-warehouses-and-transfers`, with `status: applied`, `artifacts.verify: pass`, and `archive: pending`. It is not archived.

`archive_blocked` is true. Archive stays blocked until `p2-02-sale-consumption`, `p2-04-production`, and `p2-05-warehouses-and-transfers` are archived. `p2-02` also failed verify.

### Verdict

PASS WITH WARNINGS

14/14 tasks are checked. The three allowed test commands exited 0: 53 tests passed (29 inventory, 18 orders, 6 HTTP). 16/19 spec scenarios are compliant from tests that passed in this run. Three hybrid scenarios are design-deferred and are the uncovered scenarios. No CRITICAL spec miss. No product source was modified. Archive was not started.
