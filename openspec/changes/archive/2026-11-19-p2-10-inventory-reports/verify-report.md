```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d4e6f3c61d3eb64424f6be8139ffebf18799a1815c4eedeb2aa1d16f6d686625
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 3/6
scenarios: 7/13
test_command: pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/read-inventory-report.controller.test.ts && pnpm exec vitest run --project reporting contexts/reporting/domain/metrics.test.ts contexts/reporting/application/read-food-cost-report/read-food-cost-report.test.ts contexts/reporting/application/read-stock-gap-report/read-stock-gap-report.test.ts && pnpm exec vitest run --project inventory contexts/inventory/application/list-venue-stock-facts/list-venue-stock-facts.test.ts
test_exit_code: 0
test_output_hash: sha256:357fb13c069c8e0a3ad439dc7eacb1cb57a96471ae0380816180935af0596d92
build_command: N/A
build_exit_code: N/A
build_output_hash: sha256:e49b4bc6b3bbc1611466c7fbe1226cf049aef1027c3347d43130daf2d11548fa
archive_allowed: false
```

## Verification Report

**Change**: p2-10-inventory-reports
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole`
**Strict TDD**: inactive (`strict_tdd: false`). `strict-tdd-verify.md` was not loaded.
**Persistence**: openspec.

Apply state was confirmed in the change files before judging. `tasks.md` has 16 implementation checkboxes, 1.1–4.3, all `[x]`, and no `- [ ]` task line. The orchestrator count of 18 is two higher than the file; completeness is the 16 lines that exist. `apply-progress.md` records work units 1–4 and ends with tasks 1.1–4.3 complete, `status: applied`, and `apply: done`. `state.yaml` was `status: applied`, `apply: done`, `verify: pending`, `archive: pending`. This run sets `artifacts.verify` to `pass`. Proposal success criteria stay unchecked.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 16 |
| Tasks complete | 16 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: N/A — not executed

```text
N/A. Orchestrator forbade pnpm typecheck, pnpm lint, pnpm architecture, and a full vitest project because other agents are writing this working tree. Foreign tsc errors in transfers, orders, and purchasing.ts are not failures of this change.
sha256:e49b4bc6b3bbc1611466c7fbe1226cf049aef1027c3347d43130daf2d11548fa
```

**Tests**: 29 passed, 0 failed, 0 skipped. All three commands exited 0 on the first run. No mid-edit rerun was required.

`test_output_hash` is the SHA-256 of the three result blocks below, concatenated in this order, UTF-8, 690 bytes. PowerShell profile noise and the Nest route log are not part of that digest. `evidence_revision` is the SHA-256 of those three blocks followed by the build skip text above.

```text
pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/read-inventory-report.controller.test.ts
exit 0
Test Files  1 passed (1)
Tests  3 passed (3)
Duration  2.96s

pnpm exec vitest run --project reporting contexts/reporting/domain/metrics.test.ts contexts/reporting/application/read-food-cost-report/read-food-cost-report.test.ts contexts/reporting/application/read-stock-gap-report/read-stock-gap-report.test.ts
exit 0
Test Files  3 passed (3)
Tests  23 passed (23)
Duration  277ms

pnpm exec vitest run --project inventory contexts/inventory/application/list-venue-stock-facts/list-venue-stock-facts.test.ts
exit 0
Test Files  1 passed (1)
Tests  3 passed (3)
Duration  238ms
```

**Coverage**: N/A. `openspec/config.yaml` sets `coverage_threshold: 0`. No coverage command was allowed.

**Not run, and not used as compliance evidence**: `pnpm typecheck`, `pnpm lint`, `pnpm architecture`, a full Vitest project, and the stock-ledger `listByVenue` contract tests on memory, PostgreSQL, and SQLite. Apply-progress records those adapter contracts green earlier. This run does not repeat them. A foreign `tsc -b apps/api-cloud` failure in transfers, orders, or `purchasing.ts` is outside this change.

### Spec Compliance Matrix

The spec has 6 requirements and 13 scenarios. A scenario is compliant only when a covering test passed in this run. Waste-by-reason, inventory value, rotation, producible dishes, shortage alerts, the node day query, and inbox projections are design exclusions ("stay out") and task text ("No other §8.3 report"). They are deferred, not CRITICAL, and they are not sent back to apply. An empty approved-count list that returns stock-gap `pending` matches the design while p2-06 persistence is unfinished. That pending result is not a CRITICAL miss. The 40 kg versus 43 kg scenario is still covered by tests that pass approved counts in memory.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Food Cost Percentage | Weekly food cost | `metrics.test.ts` > given net sales of 10000000 and theoretical cost of 3200000 inside a half-open week, when food cost is computed, then the ratio is 32 percent | ✅ COMPLIANT |
| Food Cost Percentage | Recipe changed mid-period | `metrics.test.ts` > given a recipe that changes mid-period, when food cost is computed, then each consumption keeps its recipe version; `read-food-cost-report.test.ts` > given two charged lines of one product, when food cost is read, then that product id is a single row and each recipe version is kept | ✅ COMPLIANT |
| Food Cost Percentage | Product without recipe | `metrics.test.ts` > given a sold product with no recipe, when food cost is computed, then the product is listed as uncosted and excluded from both sides; `read-food-cost-report.test.ts` > given a sold line with no consumption and a repeated uncosted product, when food cost is read, then that line is off both sides and the product id is listed once | ✅ COMPLIANT |
| Theoretical Versus Actual | Difference between counts | `read-stock-gap-report.test.ts` > given approved counts and movements between them, when the stock gap is read, then 40 against 43 is 3 kg at the closing average cost and waste is its own column; `metrics.test.ts` > given counts and movements between them, when the stock gap is computed, then actual subtracts closing from opening plus receipts and theoretical nets sale and production consumption | ✅ COMPLIANT |
| Theoretical Versus Actual | No closing count | `metrics.test.ts` > given only an opening count, when the stock gap is computed, then the period is pending and not a zero difference; `read-stock-gap-report.test.ts` > given only an opening count, when the stock gap is read, then the period is pending and not a zero difference; `read-inventory-report.controller.test.ts` > given the home venue and inventory.view-cost, when GET inventory reports is injected, then stock gap is pending and not zero | ✅ COMPLIANT |
| Waste, Value And Rotation | Waste by reason | (none; design: waste report stays out; waste is a column on the gap) | deferred — not a slice defect |
| Waste, Value And Rotation | General warehouse value | (none; design: value and last-sync timestamp stay out) | deferred — not a slice defect |
| Producible Dishes And Alerts | Stockout count | (none; design: alerts stay out) | deferred — not a slice defect |
| Producible Dishes And Alerts | Unseen alert | (none; design: alerts stay out) | deferred — not a slice defect |
| Day And History Sources | Hybrid outage | (none; design: node day query stays out) | deferred — not a slice defect |
| Day And History Sources | Duplicate batch | (none for an inbox resend; design: `ProjectFacts` stays out). Movement-id dedup passed in `read-stock-gap-report.test.ts` and is the design duplicate rule, not this projection scenario. | deferred — not a slice defect |
| Cost Access | Other site | `read-food-cost-report.test.ts` > given an administrator of another venue, when food cost is read, then access is denied; `read-inventory-report.controller.test.ts` > given a site administrator, when GET stock gap is injected for another venue, then the response is denied | ✅ COMPLIANT |
| Cost Access | Waiter | `read-food-cost-report.test.ts` > given a waiter with view-cost, when food cost is read, then no cost data is returned. HTTP also denies a kitchen chief without `inventory.view-cost` for both families. | ✅ COMPLIANT |

**Compliance summary**: 7/13 scenarios compliant. 0 failing. 0 untested in-scope defects. 6 deferred by the design statement that waste, value, rotation, producible dishes, alerts, the node day query, and inbox projections stay out.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Food Cost Percentage | ✅ Implemented | `foodCostRatio` is `theoreticalCop / netSalesCop` on `[from, to)`. 3,200,000 / 10,000,000 is the 32% ratio. Zero net sales returns `ratio: null`. An uncosted product is listed and leaves both sides. Each in-range consumption keeps `recipeVersion`. |
| Theoretical Versus Actual | ✅ Implemented | Actual is opening + purchase + transfer_in + production_output − closing. Theoretical nets sale and production consumption. Waste is `wasteQuantity`. 40 kg against 43 kg is 3 kg at closing `averageCostCop` (difference value 3,000 when that cost is 1,000). Fewer than two approved counts is `{ status: "pending" }` and not a zero row. A second ingredient with only an opening count replaces every row with pending. |
| Waste, Value And Rotation | Deferred | Not in tasks. Design leaves the waste-by-reason report, location value, and rotation out. The gap row still carries waste as its own column, and that column passed. |
| Producible Dishes And Alerts | Deferred | Not in tasks. Design leaves producible dishes and shortage alerts out. p2-08 is still applying. |
| Day And History Sources | Deferred | Not in tasks. No local-node inventory-report route. No inbox projector. Design says no link means no report, and api-cloud is the runtime. |
| Cost Access | ✅ Implemented | `inventory.view-cost` and the home venue are required. Another venue is `other_venue`. A waiter is `missing_permission` even when the access port would allow the actor. HTTP inject returns 403 and does not return a zeroed report. `server.listening` stayed false. |

`EmptyApprovedCounts` returns no rows. With no approved counts, the injected home-venue stock gap is `{ status: "pending" }` and the body has no `differenceQuantity` or `differenceCop` of 0. That matches the design while p2-06 persistence is unfinished.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Runtime is api-cloud PostgreSQL | ✅ Yes | `createInventoryReportFacts` uses `DrizzleStockLedgerRepository` when `inventoryDatabase` is set. No `inventory-reports` match under `apps/local-node`. |
| Reports are food cost and stock gap only | ✅ Yes | `inventoryReportFamily` is `food-cost` and `stock-gap`. They are not members of the site `reportFamily`. |
| Food cost formula and uncosted exclusion | ✅ Yes | Domain and read-model tests passed in this run. |
| Cost is `abs(quantity) * unitCost`, net of `sale_return`; `recipeVersion` stays on the line | ✅ Yes | Food-cost read-model test passed. |
| Stock gap formula; no closing count is `pending` | ✅ Yes | Domain, read-model, and HTTP tests passed. |
| Receipts are purchase, transfer_in, and production_output | ✅ Yes | Domain stock-gap test passed. |
| Gap value uses closing `averageCostCop` | ✅ Yes | Read-model test passed. `ListVenueStockFacts` maps that cost at `approvedAt`. The empty-session test passed. |
| Access is `inventory.view-cost` and the home venue | ✅ Yes | Route permission is `GET inventory-reports/:family` → `inventory.view-cost`. Waiter, other venue, and missing permission tests passed. |
| `ListVenueStockFacts` calls `listByVenue` only | ✅ Yes | The venue-facts test passed: other tenant and other venue stay out, and `append` is not called. |
| Approved counts empty until p2-06 means `pending` | ✅ Yes | `EmptyApprovedCounts` is what the cloud composition uses. HTTP pending is the expected result, not a miss. |
| One row per movement id | ✅ Yes | Stock-gap read-model test passed. This is not the deferred inbox-batch scenario. |
| No schema change, no local-node route, no admin-web screen from this change | ✅ Yes | Task 4.3 and the design file list say so. The existing admin reports shell still has a static `food-cost` section. It does not call `GET .../inventory-reports/:family`. |
| Strict TDD | N/A | `strict_tdd` is false. Not loaded. |

### Issues Found

**CRITICAL**: None

**WARNING**:

1. The spec still requires waste by reason, inventory value with a sync time, rotation and days of inventory, producible dishes, stockout and attention-time alerts, a hybrid node answer during an outage, and unchanged totals after a resent batch. Design and tasks leave those out. They are not implemented. They are not defects of this slice.
2. Proposal success criteria for a hybrid outage and for complete totals after sync stay unchecked. They describe the deferred node day query and inbox projector.
3. This run did not re-execute typecheck, lint, architecture, a full Vitest project, or the memory, PostgreSQL, and SQLite `listByVenue` contracts. Other agents are editing transfers, shortage use cases, and order firing. Those commands would not be evidence for this change. Foreign typecheck errors are excluded.
4. `InventoryCountFact` carries `averageCostCop` in addition to `locationId`, `ingredientId`, `quantity`, and `approvedAt`. The read model values the gap from the closing count instead of replaying purchases. Apply recorded this. The 3 kg value test passed.

**SUGGESTION**:

- `apps/admin-web` already lists a static `food-cost` report section. It is not the new inventory-report endpoint. A later change can point that section at `GET .../inventory-reports/food-cost` when a screen is in scope.
- A company-scoped administration session has no venue, so apply treats the requested venue as the home venue. The passing HTTP denial uses a site session. The spec sentence that is tested is the site administrator.

### Archive

Archive is not allowed yet. Do not start archive.

`depends_on` includes `p2-05-warehouses-and-transfers`, `p2-06-waste-and-counts`, and `p2-08-shortage-alerts`. All three are still under `openspec/changes/`, with `status: applying`, `artifacts.apply: partial`, `verify: pending`, and `archive: pending`. None is under `openspec/changes/archive`.

These other dependencies are also unarchived: `p2-02-sale-consumption` (`verify: fail`, `archive: pending`), `p2-03-purchasing` (`verify: pass`, `archive: pending`), `p2-04-production` (`apply: partial`, `archive: pending`), and `p2-07-producible-quantity` (`apply: partial`, `archive: pending`). `p1-11-site-reports` and `p2-01-ingredients-and-recipes` are already archived. This run does not archive.

### Verdict

PASS WITH WARNINGS

16/16 tasks are checked. The three allowed test commands exited 0: 29 tests passed. 7/13 spec scenarios are compliant from tests that passed in this run. Six §8.3 scenarios are deferred by the design and are not defects of this slice. Empty approved counts producing a pending stock gap match the design and are not a CRITICAL miss. Archive is not allowed yet.
