```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2dc3401e527c8f809c81f12d4ca071df09dcd3bd74136c75555b9f4f6a6909fa
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/6
scenarios: 13/15
test_command: pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/operational-waste.test.ts contexts/inventory/domain/stock-count.test.ts contexts/inventory/application/set-ingredient-category/set-ingredient-category.test.ts contexts/inventory/application/record-operational-waste/record-operational-waste.test.ts contexts/inventory/application/record-stock-count/record-stock-count.test.ts contexts/inventory/application/approve-adjustment/approve-adjustment.test.ts contexts/inventory/application/record-waste/stock-movement-contract.test.ts contexts/inventory/application/ports/stock-count-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts && pnpm exec vitest run --project platform contexts/platform/application/evaluate-permission/evaluate-permission.test.ts && pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/stock-operations.controller.test.ts
test_exit_code: 0
test_output_hash: sha256:b79d709159b004db9b4d67769e049d35a6196b3dde1eab98053e9c91a8756204
build_command: N/A
build_exit_code: N/A
build_output_hash: sha256:57c88949ec3cbf668ef6651293a6604ab11ea9e415c43592a4f69c2a22205ec8
archive_allowed: false
```

## Verification Report

**Change**: p2-06-waste-and-counts
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole`
**Strict TDD**: inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded.
**Persistence**: openspec. Engram `sdd/p2-06-waste-and-counts/verify-report` is saved with `capture_prompt: false`.

`tasks.md` has 24 implementation checkboxes, 1.1–4.2, all `[x]`. There is no task after 4.2. Proposal success criteria stay unchecked. They describe a completed pilot count and a blocked over-cap waste, which this delivery leaves as product behavior already covered by the passing tests, plus the hybrid path the design leaves out. Before this run `state.yaml` was `status: applying`, `apply: partial`, `verify: pending`, `archive: pending`. That apply status was stale. This run sets `status: applied`, `apply: done`, and `artifacts.verify` to `pass`. The report verdict remains `pass_with_warnings`.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 24 |
| Tasks complete | 24 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: N/A — not executed

```text
N/A. Orchestrator forbade pnpm typecheck, pnpm lint, pnpm architecture, and the full vitest suite. The stock-operations HTTP test passed on the first run. apps/api-cloud/src/composition/application-module.ts was not edited.
sha256:57c88949ec3cbf668ef6651293a6604ab11ea9e415c43592a4f69c2a22205ec8
```

**Tests**: 71 passed, 0 failed, 0 skipped. All three commands exited 0. No listed path was missing. The HTTP file was not mid-edit on this run, so it was not repeated. No failure was a shortage-alert route.

`test_output_hash` is the SHA-256 of the three result blocks below, concatenated in this order with a blank line between blocks, UTF-8, LF, and no trailing newline. PowerShell profile noise is not part of that digest. `evidence_revision` is the SHA-256 of those three blocks followed by one LF and the build skip sentence above, without the `sha256:` line. The platform project name is `platform`. `contexts/inventory/application/ports/stock-count-repository.contract.ts` runs its three cases on the in-memory repository when Vitest loads that path, and the PGlite file calls the same contract, so those three cases are also inside the 60.

```text
pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/operational-waste.test.ts contexts/inventory/domain/stock-count.test.ts contexts/inventory/application/set-ingredient-category/set-ingredient-category.test.ts contexts/inventory/application/record-operational-waste/record-operational-waste.test.ts contexts/inventory/application/record-stock-count/record-stock-count.test.ts contexts/inventory/application/approve-adjustment/approve-adjustment.test.ts contexts/inventory/application/record-waste/stock-movement-contract.test.ts contexts/inventory/application/ports/stock-count-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts
exit 0
Test Files  10 passed (10)
Tests  60 passed (60)
Duration  10.14s

pnpm exec vitest run --project platform contexts/platform/application/evaluate-permission/evaluate-permission.test.ts
exit 0
Test Files  1 passed (1)
Tests  7 passed (7)
Duration  323ms

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/stock-operations.controller.test.ts
exit 0
Test Files  1 passed (1)
Tests  4 passed (4)
Duration  8.48s
```

**Coverage**: N/A. No coverage command was allowed.

**Not run, and not used as compliance evidence**: `pnpm typecheck`, `pnpm lint`, `pnpm architecture`, and the full vitest suite.

### Spec Compliance Matrix

The spec has 6 requirements and 15 scenarios. A scenario is compliant only when a covering test passed in this run. Offline hybrid count and cloud-mode outage stay design-deferred (D-37: cloud-only, no `local-node`, no `shared/sync`). Those two are warnings, not slice defects, and they are not sent back to apply.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Waste with Reason | Expired milk | `operational-waste.test.ts` > given milk at 4 COP/ml, when 1000 ml is recorded as expired, then the quantity is negative, the value is 4000 whole COP, the average stays 4, and there is no reversal id; `record-operational-waste.test.ts` > given milk at 4 COP/ml, when 1000 ml is recorded as expired, then quantity -1000 ml valued 4000 COP posts as waste with role operational_waste and on-hand drops | ✅ COMPLIANT |
| Waste with Reason | Missing reason | `operational-waste.test.ts` > given a waste entry without a reason, when it is submitted, then it is rejected; `stock-operations.controller.test.ts` > given a waste reason outside expired, damaged, preparation_error, and other, when it is posted, then the response is 400 and nothing is stored | ✅ COMPLIANT |
| Waste Cap | Within cap | `record-operational-waste.test.ts` > given a 30000 COP waste cap, when 12000 COP is recorded, then it posts and is audited | ✅ COMPLIANT |
| Waste Cap | Above cap | `record-operational-waste.test.ts` > given the same 30000 COP cap, when 45000 COP is recorded by the chief, then another authorizer is required and nothing is posted; `stock-operations.controller.test.ts` > given a kitchen chief over the 30000 COP waste cap and no other authorizer, when 45000 COP of expired milk is posted, then nothing is stored | ✅ COMPLIANT |
| Physical Count | Category count | `stock-count.test.ts` > given a dairy classification, when a category count is submitted, then only movers in that classification are required; `record-stock-count.test.ts` > given a dairy count, when milk is short 600 g at 900 COP under the 1000 COP cap, then one count_adjustment posts at the cut-off snapshot and a later sale is ignored | ✅ COMPLIANT |
| Physical Count | Uncounted item | `stock-count.test.ts` > given a full count missing one ingredient, when it is submitted, then it is rejected naming that ingredient | ✅ COMPLIANT |
| Variance Against Theoretical | Shortage | `stock-count.test.ts` > given movers at the location by the cut-off, when a full count is submitted, then later lines are ignored, a zero variance is skipped, and the value is the absolute sum (beef 8000 g counted as 7400 g yields −600 g and a COP value) | ✅ COMPLIANT |
| Variance Against Theoretical | Sale during count | `record-stock-count.test.ts` > given a dairy count, when milk is short 600 g at 900 COP under the 1000 COP cap, then one count_adjustment posts at the cut-off snapshot and a later sale is ignored; `stock-ledger.test.ts` > given a sale, its reversal waste, and a count at the cut-off, when later lines arrive, then balanceUntil and averageCostUntil ignore them; `drizzle-stock-count-repository.contract.test.ts` > given a sale consumption and a posted count for the same ingredient, when that count document, role, and ingredient are appended again, then the sale row stays and the balance is not applied twice | ✅ COMPLIANT |
| Approval and Adjustment | Within cap | `record-stock-count.test.ts` > given a dairy count, when milk is short 600 g at 900 COP under the 1000 COP cap, then one count_adjustment posts at the cut-off snapshot and a later sale is ignored | ✅ COMPLIANT |
| Approval and Adjustment | Above cap | `record-stock-count.test.ts` > given a variance valued at 1500 COP and a 1000 COP cap, when the count is submitted, then no count_adjustment is posted | ✅ COMPLIANT |
| Approval and Adjustment | Above cap approved | `approve-adjustment.test.ts` > given a pending count frozen above the cap, when a role allowed to approve count results approves it, then the frozen lines post and a later cost is ignored; `stock-operations.controller.test.ts` > given a count frozen above the 1000 COP cap and a sale after cut-off, when another person approves it, then the response is that freeze | ✅ COMPLIANT |
| Approval and Adjustment | Rejected | `approve-adjustment.test.ts` > given a pending count above the cap, when it is rejected, then the audit is stored, stock is unchanged, and a recount may open; `stock-count-repository.contract.ts` > given 8000 g on hand and a pending count, when that count is rejected, then the freeze stays and stock is unchanged | ✅ COMPLIANT |
| Approval and Adjustment | Self-approval | `approve-adjustment.test.ts` > given the counter is the only approver, when they approve without shift self-authorization, then approval is denied and stock is unchanged; the same file posts the frozen lines when the shift flag is enabled | ✅ COMPLIANT |
| Operation by Mode | Offline hybrid count | (none; design leaves `local-node`, SQLite, and sync unbuilt) | deferred — not a slice defect |
| Operation by Mode | Cloud-mode outage | (none; design leaves the offline cloud-mode path unbuilt) | deferred — not a slice defect |

**Compliance summary**: 13/15 scenarios compliant. 0 partial. 0 failing. 2 design-deferred. Those two are not CRITICAL.

Waste with Reason, Waste Cap, Physical Count, Variance Against Theoretical, and Approval and Adjustment are fully compliant. Operation by Mode is not, because both of its scenarios stay deferred.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Waste with Reason | ✅ Implemented | Expired, damaged, preparation error, and other-with-note keep a negative quantity, whole COP, the current average, and no reversal id. A missing reason is rejected. The use case posts `waste` / `operational_waste` and drops on-hand. A reason outside the four values is HTTP 400 and stores nothing. |
| Waste Cap | ✅ Implemented | 12,000 COP under the 30,000 COP cap posts and is audited. 45,000 COP without another authorizer posts nothing in the use case and over HTTP. |
| Physical Count | ✅ Implemented | A dairy count compares only classified movers. A full count missing one ingredient is rejected with that name. Counted units go through the catalog factor, then `QUANTITY_SCALE`. |
| Variance Against Theoretical | ✅ Implemented | Beef 8000 g counted as 7400 g is a −600 g variance with value. Lines after the cut-off, including a later sale, do not change the freeze. The sale consumption row stays in `stock_movements`. |
| Approval and Adjustment | ✅ Implemented | At or under 1,000 COP, one `count_adjustment` posts. 1,500 COP posts none until approval. Approval writes the frozen lines and ignores a later cost. Rejection audits, writes no movement, and leaves a recount possible. Self-approval is denied unless the shift flag is on. The HTTP test covers approval of the freeze and does not post reject or self-approval. |
| Operation by Mode | ⚠️ Not built | No hybrid node, no local store, and no sync of an approved count. A cloud-mode outage cannot be exercised because this delivery has no offline store. |

`wasteAndCountsEnabled` is on only when `dependencies.wasteAndCountsEnabled === true`, so the default is off. The flag-off HTTP test passed with 404 and nothing listening. `EvaluatePermission.execute` still passes `shiftId: null`, so the shift self-authorization flag is proven in `ApproveAdjustment` through its permission double and is not proven over HTTP. A repeated unique (tenant, document, role, ingredient) append keeps the sale row and does not apply the count balance twice. Operational waste retry keeps the first balance and the first outbox row. Count adjustment append stores the movement, `stock_balances`, and `stock_movement_outbox` from one `database.transaction`. There is no SQLite count repository.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Reuse `waste` and `count_adjustment`; `change` and `delete` stay immutable | ✅ Yes | Nonzero `count_adjustment` of either sign keeps the average. Zero is rejected. Change and delete of a count adjustment are rejected. Sale-void waste still has `onHandDelta` 0. |
| Operational waste omits the reversal id and does not explode a preparation | ✅ Yes | Domain and use-case waste tests passed for one stocked ingredient. |
| Snapshot `averageCost`; never call `nextAverageCost` | ✅ Yes | Expired milk stays at 4 COP/ml. The count posts the cut-off snapshot. Approval ignores a later cost. |
| Freeze outside the ledger; at or under the cap post one line per nonzero variance; above the cap wait; reject writes nothing | ✅ Yes | 900 COP posts. 1,500 COP waits. Rejection leaves stock unchanged in the use case and in the repository contract. |
| Full population is movers by the cut-off; category is that set intersected with classifications; a missing line rejects | ✅ Yes | Dairy intersection and the named full-count gap passed. Another tenant's classification stays hidden. |
| Caps stay in `EvaluatePermission`; a site may only lower the count cap | ✅ Yes | Omitted `selfAuthorizationAttempt` is false and `true` is forwarded. `LimitRaised` rejects a raised site cap. A site cap lowered to 500 COP does not post a 900 COP variance. |
| Same `stock_movements` table; `orderLineId` is the document id; `recipeVersion` is 0; sale rows stay | ✅ Yes | `StockMoved` accepts `operational_waste` and `count_adjustment` beside consumption and reversal. The unique retry test keeps the sale row. |
| HTTP and Postgres on `api-cloud`; flag `wasteAndCountsEnabled` | ✅ Yes | Flag-off test passed. Composition still opens purchasing, production, transfers, no-restock, and waste-and-counts. This run did not edit that file. |
| PA-42 is not decided; variance is still computed after submit | ✅ Yes | The design leaves the open question unchecked. Tests assert the variance after submit and do not hide or show theoretical stock. |
| One PostgreSQL transaction for the movement, `stock_balances`, and the outbox | ✅ Yes on the PGlite tests | Count adjustment of −600 g stores the balance and the outbox row with the movement. Operational waste stores the balance and the outbox on the first row and ignores the retry. |

### Issues Found

**CRITICAL**: None

**WARNING**:

1. Two spec scenarios are design-deferred and have no passing test: offline hybrid count, and cloud-mode outage. Design and tasks keep this delivery on `api-cloud` (D-37). Hybrid sync is out. There is no SQLite count repository.
2. `wasteAndCountsEnabled` defaults off. The flag-off HTTP test passed with 404 and the controller absent.
3. PA-42 is not decided. Blind count is neither hidden nor shown. Variance is computed after submit.
4. The HTTP test does not exercise reject or self-approval. Those behaviors passed in `ApproveAdjustment` and, for reject, in the stock-count repository contract.
5. `EvaluatePermission` still sends `shiftId: null`. The shift self-authorization flag is proven by the `ApproveAdjustment` double and is not proven over HTTP.
6. Sale consumption rows stay. The PGlite retry keeps the sale movement and applies the count balance once.
7. A unique retry of the same tenant, document, role, and ingredient does not apply the balance twice. The second count id is not stored, and the balance stays at the sale plus one adjustment.
8. Operational waste and count adjustment write the movement, `stock_balances`, and the outbox in one transaction. Both PGlite cases passed. This run did not add a separate rollback-failure test beyond that stored result.
9. This run did not execute typecheck, lint, architecture, or the full vitest suite. No product source was modified.

**SUGGESTION**:

- The proposal still lists a site PWA. This delivery does not add those screens. The design limits the runtime to `api-cloud` and PostgreSQL.
- Proposal success criteria remain unchecked. The count, the over-cap block, and movement-only balance changes are covered by the tests above. The hybrid success path is the deferred Operation by Mode requirement.

### Archive

Archive is not allowed. This run does not archive and does not start archive.

`depends_on` includes `p2-02-sale-consumption` and `p2-03-purchasing`.

- `p2-02-sale-consumption` is at `openspec/changes/p2-02-sale-consumption`, with `status: applied`, `artifacts.verify: fail`, and `archive: pending`.
- `p2-03-purchasing` is at `openspec/changes/p2-03-purchasing`, with `status: applied`, `artifacts.verify: pass`, and `archive: pending`. It is not archived.

Archive stays blocked until those two are archived. `archive_blocked` is true. `p0-05-roles-and-permissions` and `p0-06-audit` are already under `openspec/changes/archive`.

### Verdict

PASS WITH WARNINGS

24/24 tasks are checked. The three allowed test commands exited 0: 71 tests passed (60 inventory, 7 platform, 4 HTTP). 13/15 spec scenarios are compliant from tests that passed in this run. Two hybrid scenarios are design-deferred and are warnings. No CRITICAL spec miss. No product source was modified.
