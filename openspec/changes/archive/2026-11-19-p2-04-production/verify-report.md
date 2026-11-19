```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e8863ca4aecb483e172c58b2de0d6a966dfce379a98c26a6422ea152290101ae
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 3/7
scenarios: 11/16
test_command: pnpm exec vitest run --project inventory contexts/inventory/domain/production.test.ts contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/recipe-catalog.test.ts contexts/inventory/application/record-production/record-production.test.ts contexts/inventory/application/correct-production/correct-production.test.ts contexts/inventory/application/configure-production-cost/configure-production-cost.test.ts contexts/inventory/application/ports/production-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-production-repository.contract.test.ts && pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/production.controller.test.ts && pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/production-screen.test.tsx && pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/kitchen/kitchen-production.test.tsx
test_exit_code: 0
test_output_hash: sha256:88c1a545c938621348a88f3ad6c7f9e2e6595155158d2bf2cedef31a71fef3a9
build_command: N/A
build_exit_code: N/A
build_output_hash: sha256:57e14b81cf0d1ed8f1c91ae791c50435eb2accb75991759ea6ebd25e9608fbb8
archive_allowed: false
```

## Verification Report

**Change**: p2-04-production
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole`
**Strict TDD**: inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded.
**Persistence**: openspec. Engram `sdd/p2-04-production/verify-report` is saved with `capture_prompt: false`.

`tasks.md` has 22 implementation checkboxes, 1.1–5.2, all `[x]`, and no unchecked task line. Proposal success criteria stay unchecked. They describe a pilot site, not implementation tasks. Before this run `state.yaml` was `status: applying`, `apply: partial`, `verify: pending`, `archive: pending`. This run sets `status: applied`, `apply: done`, and `artifacts.verify` to `pass`. The report verdict remains `pass_with_warnings`.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: N/A — not executed

```text
N/A. Orchestrator forbade pnpm typecheck, pnpm lint, pnpm architecture, and the full vitest suite. Other agents are writing application-module.ts, inventory package.json, postgres schema.ts, and the stock-count and stock-ledger Drizzle repositories.
sha256:57e14b81cf0d1ed8f1c91ae791c50435eb2accb75991759ea6ebd25e9608fbb8
```

**Tests**: 86 passed, 0 failed, 0 skipped. All four commands exited 0. No listed path was missing. No foreign-file failure occurred.

`test_output_hash` is the SHA-256 of the four result blocks below, concatenated in this order, UTF-8, LF. PowerShell profile noise is not part of that digest. `evidence_revision` is the SHA-256 of those four blocks followed by the build skip text above. `contexts/inventory/application/ports/production-repository.contract.ts` defines the suite and does not execute by itself. The PGlite file calls it, so those four cases are inside the 69.

```text
pnpm exec vitest run --project inventory contexts/inventory/domain/production.test.ts contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/recipe-catalog.test.ts contexts/inventory/application/record-production/record-production.test.ts contexts/inventory/application/correct-production/correct-production.test.ts contexts/inventory/application/configure-production-cost/configure-production-cost.test.ts contexts/inventory/application/ports/production-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-production-repository.contract.test.ts
exit 0
Test Files  7 passed (7)
Tests  69 passed (69)
Duration  7.53s

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/production.controller.test.ts
exit 0
Test Files  1 passed (1)
Tests  6 passed (6)
Duration  11.24s

pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/production-screen.test.tsx
exit 0
Test Files  1 passed (1)
Tests  6 passed (6)
Duration  3.03s

pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/kitchen/kitchen-production.test.tsx
exit 0
Test Files  1 passed (1)
Tests  5 passed (5)
Duration  2.21s
```

The api-cloud log includes one Nest `UnknownElementException` for `ProductionController` while the flag-off case looks up a controller that is not registered. That file still passed 6 tests, and `server.listening` stayed false.

**Coverage**: N/A. No coverage command was allowed.

**Not run, and not used as compliance evidence**: `contexts/inventory/adapters/memory/in-memory-production-repository.contract.test.ts`, `contexts/inventory/application/register-sale-consumption/register-sale-consumption.test.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm architecture`, and the full vitest suite.

### Spec Compliance Matrix

The spec has 7 requirements and 16 scenarios. A scenario is compliant only when a covering test passed in this run. Hybrid offline scenarios are design-deferred (D-37, tasks: cloud-only, no `local-node`, no `shared/sync`). Sale-deduction scenarios stay on the p2-02 use case, which this change does not edit and which this command list does not run. Those four are warnings, not slice defects, and they are not sent back to apply.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Production Run | Sauce run | `production.test.ts` and `record-production.test.ts` record expected 5000 g as −6000 g tomato and −500 g onion, with output equal to actual. No passed test asserts actual 5000 g and +5000 g sauce. | ⚠️ PARTIAL |
| Production Run | Non-stocked rejected | `record-production.test.ts` > given non-stocked vinaigrette, when a run is attempted, then it is rejected with no movement | ✅ COMPLIANT |
| Production Run | Atomic failure | `production-repository.contract.ts` > given a stored run, when the output insert fails, then the consumption, balance, and alert roll back (executed on PGlite) | ✅ COMPLIANT |
| Recipe Version Recorded | Version stored | `record-production.test.ts` > given stocked sauce version 2, when 4600 g of a 5000 g batch is registered, then output uses the recipe id explode returns and movements store that cloud version | ✅ COMPLIANT |
| Recipe Version Recorded | Offline node copy | (none; design leaves hybrid and offline copies unbuilt) | deferred — not a slice defect |
| Yield Variance | Lower output | `production.test.ts` > given a batch expected at 5000 g, when actual output is 4600 g, then variance is actual minus expected; `record-production.test.ts` stores −400; HTTP shows variance only with `inventory.view-cost` | ✅ COMPLIANT |
| Yield Variance | Burned batch | `production.test.ts` and `record-production.test.ts` > given actual output 0, when the batch is recorded, then ingredients are consumed and no output is written | ✅ COMPLIANT |
| Output Cost | Average of consumed inputs | `production.test.ts` and `record-production.test.ts` > given consumed inputs cost 24000 COP, when actual output is 4000 g, then output cost is 6 | ✅ COMPLIANT |
| Output Cost | Standard cost | `production.test.ts` and `record-production.test.ts` > given a standard cost of 5 COP/g, when actual output is 4000 g, then output cost is 5 | ✅ COMPLIANT |
| Output Cost | Ingredient goes negative | `record-production.test.ts` > given tomato below the required quantity, when a run is registered, then it succeeds, tomato goes negative, and an alert opens | ✅ COMPLIANT |
| Sale Deducts the Preparation | Pasta after production | `record-production.test.ts` only asserts `explode` collapses pasta to 80 g of sauce. It does not send the sale or assert 4520 g. `register-sale-consumption.test.ts` was not run. | uncovered this run |
| Sale Deducts the Preparation | Not produced yet | (none in the allowed commands). No passed test sends pasta at sauce balance 0 and asserts −80 g plus an alert. | uncovered this run |
| Corrections and Audit | Compensating run | `correct-production.test.ts` > given inventory.adjust, when a mistaken run is corrected, then opposite movements reference the originals and the originals stay; `production.test.ts` rejects a second compensate | ✅ COMPLIANT |
| Corrections and Audit | Unauthorized correction | `correct-production.test.ts` > given a kitchen chief alone, when a run is corrected, then nothing changes; a consumed authorization stores one compensation; HTTP denies a chief correction | ✅ COMPLIANT |
| Operation by Mode | Offline hybrid run | (none; design and tasks leave the node and sync unbuilt). Kitchen and admin tests assert no local run. | deferred — not a slice defect |
| Operation by Mode | Cloud-mode outage | `production-screen.test.tsx` and `kitchen-production.test.tsx` > given the cloud is offline, when a run is attempted, then it is not stored on this screen | ✅ COMPLIANT |

**Compliance summary**: 11/16 scenarios compliant. 1 partial (sauce run at exact +5000 g). 0 failing. 2 uncovered sale scenarios and 2 design-deferred hybrid scenarios. Those four are not CRITICAL.

Yield Variance, Output Cost, and Corrections and Audit are fully compliant. Production Run, Recipe Version Recorded, Sale Deducts the Preparation, and Operation by Mode are not.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Production Run | ✅ Implemented for the recorded batch | Stocked sauce consumes the expected batch and writes one output at the actual quantity. Non-stocked vinaigrette writes nothing. PGlite rolls back a failed output. The equal-yield +5000 g case is the same output assignment and is not separately asserted. |
| Recipe Version Recorded | ✅ Implemented for the cloud version | Movements store cloud version 2. An offline node holding an older copy is not built. |
| Yield Variance | ✅ Implemented | 4600 g of a 5000 g batch stores −400. Actual 0 consumes ingredients, writes no output, and stores −5000. Variance is omitted without `inventory.view-cost`. |
| Output Cost | ✅ Implemented | Consumed average of 24000 COP over 4000 g is 6. Standard cost stays 5. A short tomato balance still records and opens an alert. The preparation average follows `nextAverageCost` on positive output. |
| Sale Deducts the Preparation | ⚠️ Not retested | Design keeps the p2-02 collapse and forbids sale-consumption edits. The allowed record test shows pasta explodes to the sauce id. Balances 4520 g and −80 g were not executed here. |
| Corrections and Audit | ✅ Implemented | `inventory.adjust` or a consumed authorization appends the opposite sign once with `reversesMovementId`. A chief alone changes nothing. Record and correct write audit events. The same `runId` is a no-op. |
| Operation by Mode | ✅ Implemented for cloud mode | Flag off skips the route and listens on nothing. Offline screens do not store a run. No production files exist under `apps/local-node` or `shared/sync`. |

`productionEnabled` is on only when `dependencies.productionEnabled === true`, so the default is off. The flag-off HTTP test passed. Cost and variance stay off the response without `inventory.view-cost`. The kitchen POST sends `runId`, `locationId`, `recipeId`, `expectedQuantity`, and `actualQuantity`. It does not PUT the cost policy. That PUT stays on `ProductionScreen`.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Host is `api-cloud` with `productionEnabled` | ✅ Yes | Flag-off test passed. No production files under `apps/local-node` or `shared/sync`. |
| Writable consumption < 0 and output > 0; no edit or delete | ✅ Yes | `stock-ledger.test.ts` rejects the wrong signs. The 10 then 14 purchase average stays 12. A second sale `reverse` throws. |
| `compensate` once; `reverse` stays sale-only | ✅ Yes | Domain and correct-production tests passed. |
| `explodePreparation` collapses a stocked child | ✅ Yes | `recipe-catalog.test.ts` keeps the stocked sauce collapsed and expands a non-stocked child. Product `explode` stays. |
| `floor(line * expected / outputQuantity)`; variance is actual − expected | ✅ Yes | Domain tests passed, including −400 at 4600 g and a burned batch. |
| `consumed_average` or `standard`; `nextAverageCost` unchanged | ✅ Yes | 6 COP/g and 5 COP/g passed. A standard rule without a unit cost is rejected. |
| Zero output writes no output row | ✅ Yes | Domain and use-case tests passed. |
| Shortage opens the existing alert | ✅ Yes | Record-production test passed. |
| Null sale columns; `reference` is the run id; no `after_sales` | ✅ Yes | Record test and HTTP test passed. The PGlite contract expects outbox count 0. |
| `inventory.record-production`, `inventory.adjust` or `ConsumeAuthorization`, `inventory.view-cost`, `recipe.edit` | ✅ Yes | Waiter 403, chief correction 403, policy requires `recipe.edit`, variance hidden without view-cost. |
| Audit on record and correct; same `runId` is a no-op | ✅ Yes | Both use-case tests passed. |
| Removal uses a separate half-up formula | ⚠️ Deviation | Apply kept one average formula. Consumption of 1 g from 10 g at 10 COP/g leaves the average at 10 in the passed ledger test. Positive output still replays `nextAverageCost`. |
| `outputQuantity` required on every recipe upsert | ⚠️ Deviation | It is required for `explodePreparation`. Product upsert stays optional so existing recipes remain valid. The catalog tests passed. |
| Kitchen posts the run and does not send the cost policy | ⚠️ Intended | Confirmed. The policy PUT is on the admin screen. |
| Neither screen is mounted as a new route | ⚠️ Intended | `router.tsx` in admin-web has no `ProductionScreen`. Venue `router.tsx` was not edited. `KitchenScreen` is already the `/kitchen` route, and the production form now renders inside that screen. |
| Postgres tables, one transaction, no backfill | ✅ Yes on the PGlite contract | The empty-database test sees `production_runs`, `production_cost_policies`, `preparation_standard_costs`, and `output_quantity`, with no movement backfill. The memory contract file was not re-run. |

### Issues Found

**CRITICAL**: None

**WARNING**:

1. Sauce run never asserts the equal-yield case. Passed tests consume −6000 g tomato and −500 g onion for an expected 5000 g batch, and they write +4600 g or no output. They do not assert +5000 g when actual quantity is 5000 g.
2. Sale deduction is uncovered in this run. Design leaves `register-sale-consumption` unchanged. The allowed commands do not include that test. "Pasta after production" (4600 g to 4520 g, tomato unchanged) and "Not produced yet" (sale continues, sauce −80 g, alert opens) have no passing test here.
3. Offline node copy and offline hybrid run are not built. Design and tasks keep production on `api-cloud`. Both screens refuse to store a run while offline. No `local-node` run and no `shared/sync`.
4. The kitchen posts the run and does not send the cost policy. The policy PUT stays on the admin screen.
5. `ProductionScreen` has no admin route. The kitchen form is inside `KitchenScreen`, which is already mounted at `/kitchen`. Venue `router.tsx` was not edited.
6. `productionEnabled` defaults off (`=== true`). Cost and variance are hidden without `inventory.view-cost`.
7. This run did not execute the in-memory production contract, typecheck, lint, or architecture. The PGlite contract passed, including rollback, tenant isolation, and no `after_sales` row. No failure came from the files other agents are writing.

**SUGGESTION**:

- Add one domain or use-case assertion with actual quantity 5000 g so the sauce-run scenario's +5000 g output is named directly. The current 4600 g case already locks the consumption rule.

### Archive

Archive is not allowed yet. `depends_on` is `p2-01-ingredients-and-recipes`, `p2-02-sale-consumption`, and `p2-03-purchasing`.

- `p2-01-ingredients-and-recipes` lives at `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes`. Its copied `state.yaml` still says `archive: pending`. The directory location is the archive.
- `p2-02-sale-consumption` is still at `openspec/changes/p2-02-sale-consumption`, with `status: applied`, `artifacts.verify: fail`, and `archive: pending`.
- `p2-03-purchasing` is still at `openspec/changes/p2-03-purchasing`, with `status: applied`, `artifacts.verify: pass`, and `archive: pending`.

This run does not archive and does not start archive. Archive stays blocked until `p2-02-sale-consumption` and `p2-03-purchasing` are archived.

### Verdict

PASS WITH WARNINGS

22/22 tasks are checked. The four allowed test commands exited 0: 86 tests passed (69 inventory, 6 HTTP, 6 admin, 5 kitchen). 11/16 spec scenarios are compliant from tests that passed in this run. One scenario is partial. Four are uncovered or design-deferred and are warnings. No CRITICAL spec miss. No product source was modified.
