```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3eb597080100e92fcb52c20ba41bfc27ae004c0fb8793a3f8e8089b0812a4116
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/8
scenarios: 15/16
test_command: pnpm exec vitest run --project inventory contexts/inventory/domain/shortage-alert.test.ts contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts contexts/inventory/application/mark-alert-seen contexts/inventory/application/resolve-alert contexts/inventory/application/evaluate-coverage/evaluate-coverage.test.ts contexts/inventory/application/evaluate-dish-alert/evaluate-dish-alert.test.ts contexts/inventory/application/escalate-alerts/escalate-alerts.test.ts contexts/inventory/application/restock-from-alert/restock-from-alert.test.ts contexts/inventory/application/propose-stock-levels/propose-stock-levels.test.ts contexts/inventory/application/accept-stock-levels/accept-stock-levels.test.ts contexts/inventory/application/ports/shortage-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-shortage-repository.contract.test.ts && pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/shortage-alerts.controller.test.ts apps/api-cloud/test/http/shortage-realtime.controller.test.ts apps/api-cloud/test/contracts/shortage-alerts.test.ts apps/api-cloud/test/composition/shortage-alerts.worker.test.ts && pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/stock-levels-screen.test.tsx apps/admin-web/test/inventory/purchase-screen.test.tsx apps/admin-web/test/inventory/production-screen.test.tsx apps/admin-web/test/inventory/transfer-screen.test.tsx && pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/kitchen/shortage-notice.test.tsx apps/venue-app/test/cash-register/shortage-notice.test.tsx apps/venue-app/test/kitchen/kitchen-production.test.tsx
test_exit_code: 0
test_output_hash: sha256:2af8b66c285f35f0d026a5383759d2864a2ca3d2ff37250deaef5680507b2947
build_command: N/A
build_exit_code: N/A
build_output_hash: sha256:8933487207360e6c6bc6638c281b17bf878eb2e0d9eac067158fa39201e6be93
archive_allowed: false
```

## Verification Report

**Change**: p2-08-shortage-alerts
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole`
**Strict TDD**: inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded.
**Persistence**: openspec. Engram `sdd/p2-08-shortage-alerts/verify-report` is saved with `capture_prompt: false`.

`tasks.md` has 29 implementation checkboxes, 1.1–7.2, all `[x]`. Proposal success criteria stay unchecked. They describe a real service case, a hybrid outage, and a one-tap document. The one-tap path is covered by the passing restock tests. The hybrid path is the design-deferred scenario below. Before this run `state.yaml` was `status: applying`, `apply: partial`, `verify: pending`, `archive: pending`. That apply status was stale. This run sets `status: applied`, `apply: done`, and `artifacts.verify` to `pass`. The report verdict remains `pass_with_warnings`.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 29 |
| Tasks complete | 29 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: N/A — not executed

```text
N/A. Orchestrator forbade pnpm typecheck, pnpm lint, pnpm architecture, and the full vitest suite. The shortage HTTP tests passed on the first run. apps/api-cloud/src/composition/application-module.ts was not edited.
sha256:8933487207360e6c6bc6638c281b17bf878eb2e0d9eac067158fa39201e6be93
```

**Tests**: 132 passed, 0 failed, 0 skipped. All four commands exited 0. No listed path was missing. The HTTP files were not mid-edit on this run, so they were not repeated. No failure was a producible-quantity route.

`test_output_hash` is the SHA-256 of the four result blocks below, concatenated in this order with a blank line between blocks, UTF-8, LF, and no trailing newline. PowerShell profile noise is not part of that digest. `evidence_revision` is the SHA-256 of those four blocks followed by one LF and the build skip sentence above, without the `sha256:` line.

```text
pnpm exec vitest run --project inventory contexts/inventory/domain/shortage-alert.test.ts contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts contexts/inventory/application/mark-alert-seen contexts/inventory/application/resolve-alert contexts/inventory/application/evaluate-coverage/evaluate-coverage.test.ts contexts/inventory/application/evaluate-dish-alert/evaluate-dish-alert.test.ts contexts/inventory/application/escalate-alerts/escalate-alerts.test.ts contexts/inventory/application/restock-from-alert/restock-from-alert.test.ts contexts/inventory/application/propose-stock-levels/propose-stock-levels.test.ts contexts/inventory/application/accept-stock-levels/accept-stock-levels.test.ts contexts/inventory/application/ports/shortage-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-shortage-repository.contract.test.ts
exit 0
Test Files  13 passed (13)
Tests  79 passed (79)
Duration  8.77s

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/shortage-alerts.controller.test.ts apps/api-cloud/test/http/shortage-realtime.controller.test.ts apps/api-cloud/test/contracts/shortage-alerts.test.ts apps/api-cloud/test/composition/shortage-alerts.worker.test.ts
exit 0
Test Files  4 passed (4)
Tests  12 passed (12)
Duration  8.34s

pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/stock-levels-screen.test.tsx apps/admin-web/test/inventory/purchase-screen.test.tsx apps/admin-web/test/inventory/production-screen.test.tsx apps/admin-web/test/inventory/transfer-screen.test.tsx
exit 0
Test Files  4 passed (4)
Tests  27 passed (27)
Duration  3.61s

pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/kitchen/shortage-notice.test.tsx apps/venue-app/test/cash-register/shortage-notice.test.tsx apps/venue-app/test/kitchen/kitchen-production.test.tsx
exit 0
Test Files  3 passed (3)
Tests  14 passed (14)
Duration  3.12s
```

**Coverage**: N/A. No coverage command was allowed.

**Not run, and not used as compliance evidence**: `pnpm typecheck`, `pnpm lint`, `pnpm architecture`, and the full vitest suite.

### Spec Compliance Matrix

The spec has 8 requirements and 16 scenarios. A scenario is compliant only when a covering test passed in this run. Offline hybrid site stays design-deferred (D-37: cloud-only, no `local-node`, no `shared/sync`). That scenario is a warning, not a slice defect, and it is not sent back to apply.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Stock Levels | Location override | `set-stock-levels.test.ts` > given a brand reorder point of 10 kg for beef, when site A sets 15 kg, then only site A stores that override; `evaluate-stock-levels.test.ts` > given a location reorder point of 12 kg and a venue reorder point of 15 kg, when the balance is 13 kg, then the location level wins and a venue override still applies | ✅ COMPLIANT |
| Stock Levels | Inconsistent levels | `set-stock-levels.test.ts` > given a minimum of 8 kg, when the reorder point is set to 5 kg, then the change is rejected; `shortage-alert.test.ts` > given a minimum of 8 kg, when the reorder point is set to 5 kg, then the levels are rejected | ✅ COMPLIANT |
| Level Evaluation | Yellow alert | `evaluate-stock-levels.test.ts` > given beef at 16 kg with a reorder point of 15 kg, when evaluation reads 14 kg in that transaction, then one yellow alert opens; `shortage-alert.test.ts` > given beef at 16 kg with a reorder point of 15 kg, when a sale leaves 14 kg, then one yellow alert opens | ✅ COMPLIANT |
| Level Evaluation | Jump to critical | `evaluate-stock-levels.test.ts` > given beef at 3 kg, when evaluation reads a 4 kg waste at or under zero, then one critical alert opens; `shortage-alert.test.ts` > given beef at 3 kg, when a 4 kg waste leaves stock at or under zero, then one critical alert opens | ✅ COMPLIANT |
| Coverage Alert | Busy Friday | `evaluate-coverage.test.ts` > given Friday pace covers 3 of the 5 remaining service hours and stock is above the minimum, when coverage runs, then a coverage alert states the hours left | ✅ COMPLIANT |
| Coverage Alert | Insufficient history | `evaluate-coverage.test.ts` > given fewer than N Friday weeks, when coverage runs, then no coverage alert opens | ✅ COMPLIANT |
| Dish Alert | Star dish | `evaluate-dish-alert.test.ts` > given a dish minimum of 10 units, when producible units drop to 9, then the dish alert names every limiter | ✅ COMPLIANT |
| Dish Alert | No minimum configured | `evaluate-dish-alert.test.ts` > given a dish without a minimum, when its units drop, then no dish alert opens | ✅ COMPLIANT |
| Lifecycle And Hysteresis | No flapping | `evaluate-stock-levels.test.ts` > given an open red alert, when stock rises just above the minimum, then the same state is not emitted again; `shortage-alert.test.ts` > given an open red alert, when stock rises just above the minimum, then the same state is not emitted again | ✅ COMPLIANT |
| Lifecycle And Hysteresis | Auto-resolution | `evaluate-stock-levels.test.ts` > given an open red alert, when the balance rises above the reorder point, then it resolves in that transaction; `shortage-alert.test.ts` > given an open red alert, when stock rises above the reorder point, then it resolves | ✅ COMPLIANT |
| Notification And Escalation | Offline hybrid site | (none; design leaves `local-node`, SQLite, and sync unbuilt) | deferred — not a slice defect |
| Notification And Escalation | Escalation | `escalate-alerts.test.ts` > given a red alert and a critical alert unseen past 20 minutes, when escalation runs, then each role gets one notice and yellow and coverage do not | ✅ COMPLIANT |
| One-Tap Action | Restock from point | `restock-from-alert.test.ts` > given beef at 4 kg with a 20 kg maximum and a 1 kg purchase unit, when one supply link exists, then a 16 kg request uses that link as the destination | ✅ COMPLIANT |
| One-Tap Action | No supplying warehouse | `restock-from-alert.test.ts` > given no supply link and two suppliers, when restock is tapped without a supplier, then a purchase order is offered and neither supplier is chosen | ✅ COMPLIANT |
| Suggested Levels | Accepted proposal | `accept-stock-levels.test.ts` > given a pending beef proposal, when the administrator accepts it, then it becomes the active level and evaluation uses it | ✅ COMPLIANT |
| Suggested Levels | Pending proposal | `propose-stock-levels.test.ts` > given an unaccepted beef proposal from consumption and lead time, when evaluation runs, then the proposal stays pending and the active reorder point is used | ✅ COMPLIANT |

**Compliance summary**: 15/16 scenarios compliant. 0 partial. 0 failing. 1 design-deferred. That one is not CRITICAL.

Stock Levels, Level Evaluation, Coverage Alert, Dish Alert, Lifecycle And Hysteresis, One-Tap Action, and Suggested Levels are fully compliant. Notification And Escalation is not, because its offline hybrid scenario stays deferred. The escalation scenario passed.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Stock Levels | ✅ Implemented | Maximum, reorder point, and minimum stay ordered and non-negative. A site override of 15 kg is stored for site A. A reorder point of 5 kg under an 8 kg minimum is rejected. `inventory.configure-levels` is required. |
| Level Evaluation | ✅ Implemented | 14 kg under a 15 kg reorder point opens one yellow alert. A jump to zero opens one critical alert. An open alert is not repeated. The in-memory transaction rolls the alert back with the balance. `shortageAlertsEnabled` defaults off, and a disabled venue writes nothing. |
| Coverage Alert | ✅ Implemented | Friday pace that covers 3 of 5 remaining hours opens a coverage alert that states the hours left. Fewer than N weeks writes nothing. Missing N, margin, slot, or service end writes nothing and assumes no number. The weekday and minute are read in UTC. |
| Dish Alert | ✅ Implemented | 9 producible units under a minimum of 10 opens one dish alert and names every limiter. No configured minimum writes nothing. An open dish alert is not repeated. |
| Lifecycle And Hysteresis | ✅ Implemented | Stock just above the minimum leaves the red alert open. Stock above the reorder point resolves it. Manual resolve records who, when, and a reason, and refuses a missing reason or a balance that is not above the reorder point. Seen records who and when. |
| Notification And Escalation | ⚠️ Partial | Past a 20-minute limit, each unseen red and critical alert gets one `siteAdministrator` notice and an audit. `generalManager` is added only at 40 minutes, twice that limit. `kitchenChief` is not a notice role. Yellow, coverage, and dish do not escalate. Screens read stored notices. The hybrid offline path is not built. Web Push is left to 5.1. |
| One-Tap Action | ✅ Implemented | 4 kg against a 20 kg maximum and a 1 kg purchase unit requests 16 kg on the single supply link. Several links need the actor warehouse. Zero links offer a purchase order and do not pick a supplier until the actor passes `supplierId`. `inventory.request-replenishment` guards the tap. |
| Suggested Levels | ✅ Implemented | An unaccepted proposal stays pending and evaluation keeps the active reorder point. Acceptance makes the proposal the active level. A session without `inventory.configure-levels` leaves it pending. |

`alertsEnabled` is false when no venue flag is stored. The flag-off HTTP tests passed and the routes were skipped. The PGlite contract hides another tenant, rolls an alert back with its transaction, keeps one open row when severity deepens, and creates the shortage tables with alerts off and no backfill. There is no SQLite shortage repository.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Host is `api-cloud` and PgBoss; no node and no sync | ✅ Yes | D-37. The offline hybrid scenario is deferred with the design. |
| Levels are scaled max ≥ reorder ≥ min ≥ 0; location overrides brand; sold out is ≤ 0 | ✅ Yes | Domain and set-level tests passed, including the 15 kg site override and the rejected 5 kg reorder point. |
| One open row; a deeper cross raises severity; resolve only above reorder | ✅ Yes | The contract keeps one open row. The yellow-to-critical raise and the reorder resolution passed. |
| Coverage uses the N-week weekday-and-slot mean and skips thin history | ✅ Yes | Friday and insufficient-history tests passed. Missing settings assume no number. The clock is UTC, not America/Bogota. |
| Dish alert is below `DishLevel` and names every limiter | ✅ Yes | The 9-unit test names every limiter. p2-07 units stay behind the port. |
| `RoleNotice` on a cloud socket; no mail, SMS, or Web Push | ✅ Yes | Escalation notices do not match WhatsApp, SMS, email, or Web Push. The socket lists stored notices. |
| Unseen red escalates; yellow and coverage do not; `critical` shares the red clock | ⚠️ Partial | Yellow, coverage, and dish do not escalate, and `critical` uses the red clock. The notices are `siteAdministrator` at the limit and `generalManager` at twice the limit. There is no `kitchenChief` notice. |
| Point restock calls `RequestTransfer`; a warehouse calls `CreatePurchaseOrder`; quantity is maximum − stock, rounded up | ✅ Yes | The 16 kg use-case test passed. The kitchen and cash-register taps send `purchaseUnit: 1` with `warehouseId: null` and `supplierId: null`. |
| A pending suggestion stays pending until acceptance | ✅ Yes | Both suggestion tests passed. Activation is on the cloud repository. There is no separate owning node. |
| Audit goes through `RecordAuditEvent`; the domain does not import platform | ✅ Yes | Resolve and escalation store audit commands through the shortage audit port. |
| Auth uses `inventory.configure-levels`, `inventory.request-replenishment`, and the venue flag | ✅ Yes | Missing configure-levels and missing request-replenishment are rejected. The waiter is denied on the stream and on restock. |
| Level evaluation shares the balance transaction | ⚠️ Partial | The use case evaluates inside the transaction it is given, and that transaction's rollback drops the alert. `RegisterSaleConsumption`, `ReturnStock`, and `RecordWaste` in `application-module.ts` are not given `EvaluateStockLevels`. `DrizzleShortageRepository.findLevelAlert` ignores the caller transaction and opens `inTenant`. HTTP restock runs on `PostgresShortageTransactions`, whose balance is always 0, not on the ledger transaction. |
| PgBoss runs coverage, dish, escalation, and suggestions every 15 minutes | ⚠️ Partial | Four queues are scheduled every 15 minutes in UTC with an empty payload. A tick without tenant and venue returns before any write. The worker does not list venues. |
| `shortage_alerts_enabled` defaults off | ✅ Yes | Memory, PGlite, HTTP, coverage, dish, and escalation tests leave a venue with no flag unread or unwritten. |
| `StockLevelsScreen` edits levels and accepts proposals | ⚠️ Partial | The screen saves levels and accepts a proposal in its test. `apps/admin-web/src/router.tsx` does not mount `StockLevelsScreen`. Purchase, production, and transfer screens stay in their tests. |

### Issues Found

**CRITICAL**: None

**WARNING**:

1. The offline hybrid scenario is design-deferred and has no passing test. Design and tasks keep this delivery on `api-cloud` (D-37). There is no local node, no SQLite shortage store, and no sync. Phone push stays in 5.1.
2. `shortageAlertsEnabled` defaults off. Flag-off tests passed for evaluation, coverage, dish, escalation, HTTP, and both screens.
3. Coverage reads the weekday and the minute with `getUTCDay` and `getUTCHours`. The worker timezone is `UTC`. America/Bogota is not used. The Friday scenario still passed.
4. At the configured limit the first notice is `siteAdministrator` only, and it is audited. `generalManager` is added only at twice that limit. There is no `kitchenChief` notice. The contract rejects that role. The 20-minute escalation scenario still passed.
5. Yellow, coverage, and dish do not escalate. That matches the red clock. The same escalation test passed.
6. The worker cron is registered with an empty payload and does not list venues. A tick without tenant and venue writes nothing. The coverage, dish, escalation, and suggestion use cases still passed when they were called with a venue.
7. `findLevelAlert` opens its own `inTenant` transaction. HTTP restock is not wrapped in the ledger transaction. `PostgresShortageTransactions.run` supplies a balance of 0. The 16 kg use-case test still passed on its in-memory port.
8. The SSE handler lists stored notices and completes. It does not push a notice saved after the socket opens. The kitchen still sees a stored notice, and a waiter is still denied.
9. `StockLevelsScreen` is not mounted in `apps/admin-web/src/router.tsx`. Its save and accept tests passed. Purchase, production, and transfer tests passed beside it.
10. The kitchen and cash-register one tap sends `purchaseUnit: 1` with `warehouseId: null` and `supplierId: null`. The use case still builds the 16 kg request when a supply link and a purchase unit are given.
11. The Postgres stock entry and the alert are not one SQL transaction. The cloud sale, return, and waste factories do not receive `EvaluateStockLevels`. A shortage write joins SQL only when the handle is a `PostgresShortageTransaction`. The in-memory evaluate test still rolls the alert back with its transaction.
12. This run did not execute typecheck, lint, architecture, or the full vitest suite. No product source was modified. `application-module.ts` was left for the other agent. The shortage HTTP command passed on the first run, and `ReadInventoryReportController` plus the shortage routes were mapped. No producible-quantity failure occurred.

**SUGGESTION**:

- Proposal success criteria remain unchecked. The level, coverage, dish, and one-tap behaviors above are covered by the passing tests. The hybrid success path is the deferred Notification scenario.

### Archive

Archive is not allowed. This run does not archive and does not start archive.

`depends_on` includes `p0-05-roles-and-permissions`, `p0-06-audit`, `p2-02-sale-consumption`, `p2-03-purchasing`, `p2-05-warehouses-and-transfers`, and `p2-07-producible-quantity`.

- `p0-05-roles-and-permissions` is archived at `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions`, with `status: archived` and `archive: done`.
- `p0-06-audit` is archived at `openspec/changes/archive/2026-10-28-p0-06-audit`, with `status: archived` and `archive: done`.
- `p2-02-sale-consumption` is at `openspec/changes/p2-02-sale-consumption`, with `status: applied`, `artifacts.verify: fail`, and `archive: pending`.
- `p2-03-purchasing` is at `openspec/changes/p2-03-purchasing`, with `status: applied`, `artifacts.verify: pass`, and `archive: pending`.
- `p2-05-warehouses-and-transfers` is at `openspec/changes/p2-05-warehouses-and-transfers`, with `status: applied`, `artifacts.verify: pass`, and `archive: pending`.
- `p2-07-producible-quantity` is at `openspec/changes/p2-07-producible-quantity`, with `status: applying`, `artifacts.apply: partial`, `verify: pending`, and `archive: pending`.

Archive stays blocked until `p2-02-sale-consumption`, `p2-03-purchasing`, `p2-05-warehouses-and-transfers`, and `p2-07-producible-quantity` are archived. `archive_blocked` is true.

### Verdict

PASS WITH WARNINGS

29/29 tasks are checked. The four allowed test commands exited 0: 132 tests passed (79 inventory, 12 api-cloud, 27 admin-web, 14 venue-app). 15/16 spec scenarios are compliant from tests that passed in this run. The offline hybrid scenario is design-deferred. The UTC clock, the escalation roles, the empty worker payload, the split SQL transactions, the stored-only SSE, the unmounted levels screen, and the one-tap payload are warnings. No CRITICAL spec miss. No product source was modified.
