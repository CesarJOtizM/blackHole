```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:f824c759db13b44085bc31ec4422194767e4db2daa1de5cfcedd03c32641910b
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/7
scenarios: 10/17
test_command: pnpm exec vitest run --project admin-web test/inventory/purchase-screen.test.tsx && pnpm exec vitest run --config apps/venue-app/vitest.config.ts test/purchasing/receive-screen.test.tsx && pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/purchasing.controller.test.ts && pnpm exec vitest run --project inventory contexts/inventory/domain/purchasing.test.ts contexts/inventory/application/receive-purchase/receive-purchase.test.ts contexts/inventory/application/create-supplier/create-supplier.test.ts contexts/inventory/application/create-purchase-order/create-purchase-order.test.ts contexts/inventory/application/cancel-purchase-order/cancel-purchase-order.test.ts
test_exit_code: 0
test_output_hash: sha256:0c25cb24655c4344b1b0dd2582a7b2a23c4508f01f172538b4a611d421378b11
build_command: N/A
build_exit_code: N/A
build_output_hash: sha256:5a7ead709a938f511f8d3d17a009ab9f26a3c5c1f5b2db27fd323519ca8fcf70
archive_allowed: false
```

## Verification Report

**Change**: p2-03-purchasing
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole`
**Strict TDD**: inactive (`strict_tdd: false`). `strict-tdd-verify.md` was not loaded.
**Persistence**: openspec. Engram was unavailable during this run (`user-engram` discovery error).

Apply state was confirmed in the change files before judging. `tasks.md` has 22 implementation checkboxes, 1.1–5.2, all `[x]`, and no `- [ ]` task line. `apply-progress.md` records work units 1–6 and ends with `status: applied` and `apply: done`. `state.yaml` was `status: applied`, `apply: done`, `verify: pending`, `archive: pending`. This run sets `artifacts.verify` to `pass`. Proposal success criteria stay unchecked; they describe a week of real purchases and are not implementation tasks.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: N/A — not executed

```text
N/A. Orchestrator forbade pnpm typecheck, pnpm lint, pnpm architecture, and a full vitest project because other agents are writing this working tree.
sha256:5a7ead709a938f511f8d3d17a009ab9f26a3c5c1f5b2db27fd323519ca8fcf70
```

**Tests**: 36 passed, 0 failed, 0 skipped. All four commands exited 0 on the first run. No mid-edit rerun was required.

`test_output_hash` is the SHA-256 of the four result blocks below, concatenated in this order, UTF-8. PowerShell profile noise is not part of that digest. The api-cloud process log is 94094 bytes, SHA-256 `1aa0ea4cce56b7d90bcc4a10972b94aa1121968515722b2117c11f2ea47f5934`. `evidence_revision` is the SHA-256 of those four blocks followed by the build skip text above.

```text
pnpm exec vitest run --project admin-web test/inventory/purchase-screen.test.tsx
exit 0
Test Files  1 passed (1)
Tests  5 passed (5)
Duration  6.21s

pnpm exec vitest run --config apps/venue-app/vitest.config.ts test/purchasing/receive-screen.test.tsx
exit 0
Test Files  1 passed (1)
Tests  6 passed (6)
Duration  4.52s

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/purchasing.controller.test.ts
exit 0
Test Files  1 passed (1)
Tests  5 passed (5)
Duration  12.57s

pnpm exec vitest run --project inventory contexts/inventory/domain/purchasing.test.ts contexts/inventory/application/receive-purchase/receive-purchase.test.ts contexts/inventory/application/create-supplier/create-supplier.test.ts contexts/inventory/application/create-purchase-order/create-purchase-order.test.ts contexts/inventory/application/cancel-purchase-order/cancel-purchase-order.test.ts
exit 0
Test Files  5 passed (5)
Tests  20 passed (20)
Duration  612ms
```

**Coverage**: N/A. No coverage command was allowed.

**Not run, and not used as compliance evidence**: `contexts/inventory/domain/stock-ledger.test.ts`, `purchasing-repository.contract.ts` on memory and PGlite, and the SQLite stock-ledger contract. Apply-progress records earlier green runs. This run does not repeat them.

### Spec Compliance Matrix

The spec has 7 requirements and 17 scenarios. A scenario is compliant only when a covering test passed in this run. Six fiscal scenarios, plus the supplier scenario whose outcome is a support document, are proposal out of scope (D-14) and design says they are not built. They are deferred, not CRITICAL, and they are not sent back to apply.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Suppliers | Duplicate identification | `create-supplier.test.ts` > given a supplier with NIT 900123456, when another supplier with the same NIT is created in that company, then it is rejected | ✅ COMPLIANT |
| Suppliers | Non-invoicing supplier | `create-supplier.test.ts` stores `issuesEInvoices` and lead time and asserts no document, Factus, or VAT. The scenario outcome is a required support document. | deferred — not a slice defect |
| Purchase Orders | Partial receipt | `receive-purchase.test.ts` > given an order for 10, when 6 and then 4 are received, then it is partial and then received | ✅ COMPLIANT |
| Purchase Orders | Cancelled order | `cancel-purchase-order.test.ts` > given an open order, when it is cancelled, then no stock movement is written and a later receipt is rejected; `receive-purchase.test.ts` > given a cancelled order, when a receipt is confirmed, then it is rejected | ✅ COMPLIANT |
| Receipt at Real Cost | Direct receipt | `purchasing.test.ts` > given 5 kg at 4000 COP/kg, when converted with the scaled kilogram factor, then it is 5000 g at 4 COP/g; `receive-purchase.test.ts` > given no purchase order, when 5 kg at 4000 COP/kg is received, then 5000 g at 4 COP/g is recorded | ✅ COMPLIANT |
| Receipt at Real Cost | Waiter denied | `purchasing.controller.test.ts` > given a waiter session, when a receipt is posted, then it is denied | ✅ COMPLIANT |
| Receipt at Real Cost | Cloud-mode outage | `purchase-screen.test.tsx` > given the cloud is offline, when a receipt is attempted, then it is not stored on this screen; `receive-screen.test.tsx` > given the cloud is offline, when a receipt is attempted, then it is not stored on this screen | ✅ COMPLIANT |
| Weighted Average Cost | Recalculated | `receive-purchase.test.ts` > given 1000 g at 10 COP/g, when 1000 g arrive at 14 COP/g, then the average is 12 | ✅ COMPLIANT |
| Weighted Average Cost | Waste keeps average | `receive-purchase.test.ts` > given an average of 12 COP/g, when waste is appended, then the purchase average stays 12 | ✅ COMPLIANT |
| Support Document | Accepted | (none; D-14, design: not built) | deferred — not a slice defect |
| Support Document | Offline hybrid receipt | (none; D-14 and hybrid receipt, design: not built) | deferred — not a slice defect |
| Support Document | Missing range | (none; D-14, design: not built) | deferred — not a slice defect |
| Supplier E-invoice Intake | XML proposes receipt | (none; D-14, design: not built) | deferred — not a slice defect |
| Supplier E-invoice Intake | Duplicate CUFE | (none; D-14, design: not built) | deferred — not a slice defect |
| Supplier E-invoice Intake | Unmapped item | (none; D-14, design: not built) | deferred — not a slice defect |
| Cost Visibility | Warehouse keeper | `purchasing.controller.test.ts` > given a warehouse keeper, when a receipt is recorded at the warehouse, then averageCost is omitted; both screen tests hide the average when the response omits it | ✅ COMPLIANT |
| Cost Visibility | Administrator | `purchasing.controller.test.ts` > given an administrator with inventory.view-cost, when the same receipt is posted twice, then averageCost is shown, sale columns stay null, and nothing is queued; both screen tests show `Costo promedio 4` when the response includes it | ✅ COMPLIANT |

**Compliance summary**: 10/17 scenarios compliant. 0 failing. 0 untested in-scope defects. 7 deferred by proposal out of scope and by the design statement that support documents, supplier XML, and hybrid offline receipt are not built.

The Receipt requirement also says a hybrid site node must accept receipts offline. That sentence has no scenario of its own. Design leaves it unbuilt. The three named receipt scenarios passed.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Suppliers | ✅ Implemented for the in-scope rule | Same NIT is rejected inside one company. Another company may reuse it. `issuesEInvoices` and lead time are stored. No Factus and no VAT split. |
| Purchase Orders | ✅ Implemented | One supplier, one location, purchase units, open, frozen factor. Partial 6 of 10 leaves 4 pending, then received. Cancel writes no movement. A later receipt is rejected. |
| Receipt at Real Cost | ✅ Implemented for cloud receipt | Direct 5 kg at 4000 COP/kg is 5000 g at 4 COP/g. Waiter is denied. Offline cloud screens do not keep a local receipt. `actorId` is stored. Sale columns stay null. |
| Weighted Average Cost | ✅ Implemented | 1000 g at 10 then 1000 g at 14 is 12. Waste leaves the purchase average at 12. 4500 COP/kg becomes 5 COP/g and the line keeps 4500. |
| Support Document | Deferred | Not in tasks. Design forbids Factus. The HTTP test rejects a body that names a support document with 400. |
| Supplier E-invoice Intake | Deferred | Not in tasks. No XML intake in this change. |
| Cost Visibility | ✅ Implemented | Keeper response omits `averageCost`. Administrator response includes it. Screens render the average only when the field is present. |

Live routes do not render the old purchase controls. Admin `inventory/orders/oc-0418` loads `PurchaseScreen`. Venue `purchasing` loads `ReceiveScreen`. `PurchaseView` is defined in `inventory-view.tsx` and has no importer. Both screen tests that passed assert the absence of invoice photo, invoice price, and WhatsApp.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Host is `api-cloud` with `purchasingEnabled` | ✅ Yes | Flag-off test passed: route skipped, nothing listening. No purchasing matches under `apps/local-node`. |
| No Factus, support document, or supplier XML | ✅ Yes | Excluded by proposal and design. HTTP rejects `supportDocument` / `vat` with 400. |
| `confirm`, not `append`; purchases skip the outbox | ✅ Yes | Receive tests passed, including same `receiptId` as a no-op. The design opening sentence still says `append`; the decision table says `confirm`. Implementation follows the table. |
| Average is whole COP; waste does not change it | ✅ Yes | Covered by the receive tests that passed in this run. |
| Entered cost is not split into VAT; 4500 COP/kg stays on the line | ✅ Yes | Domain purchasing test passed. |
| Frozen order factor; direct receipt uses the published factor | ✅ Yes | Domain and receive tests passed. |
| `inventory.receive-purchase`; hide average without `inventory.view-cost` | ✅ Yes | Waiter, keeper, and administrator HTTP tests passed. |
| Neither app stores a receipt locally | ✅ Yes | Both offline screen tests passed. `localStorage` / `sessionStorage` stay empty in the venue test. |
| SQLite is columns only, not a purchasing runtime | ✅ Yes on inspection | SQLite hits are recipe purchase units, not receipt wiring. This run did not re-execute the SQLite contract. |
| Strict Zod in `shared/contracts`; admin parses with it | ✅ Yes for admin | `PurchaseScreen` uses `purchaseReceipt` from `@blackhole/contracts`. |
| Venue uses the same contract package | ⚠️ Deviation | `apps/venue-app/package.json` does not depend on `@blackhole/contracts`. `ReceiveScreen` checks the receipt shape locally. The accepted command is still `receiptId`, `locationId`, optional `purchaseOrderId`, and purchase lines. |
| Receipt has no venue column | ⚠️ Deviation | `stock_movements.venue_id` is inserted with `input.locationId`, the same value as `location_id`. Sale columns are null. |

### Issues Found

**CRITICAL**: None

**WARNING**:

1. `PurchaseView` in `apps/admin-web/src/inventory/inventory-view.tsx` still contains "Enviar por WhatsApp", "Precio factura", and the invoice photo note. The live admin route renders `PurchaseScreen`, and the live venue route renders `ReceiveScreen`. The screen tests that passed do not show those controls. Leftover view, not a spec miss.
2. Venue receipt parsing is local because `venue-app` does not depend on `@blackhole/contracts`. The posted command matches the contract. The screen can drift from the Zod schema later.
3. Postgres writes `locationId` into `stock_movements.venue_id` because that column is NOT NULL and a receipt has no venue.
4. This run did not re-execute the memory or PGlite purchasing contracts, the stock-ledger domain file, typecheck, lint, or architecture. Other agents are editing production SQL, transfers, counts, shortage alerts, no-restock, inventory report HTTP, and menu. Those commands would not be evidence for this change.
5. The spec still contains Support Document, Supplier E-invoice Intake, and the non-invoicing support-document outcome. Proposal and design leave them out. They are not implemented.

**SUGGESTION**:

- The design opening line still says `ReceivePurchase` appends a purchase movement. The decision table and the code use `PurchasingRepository.confirm` so the sale outbox is not enqueued.

### Archive

Archive is not allowed yet. `depends_on` includes `p2-02-sale-consumption`. That change is still at `openspec/changes/p2-02-sale-consumption`, with `status: applied`, `artifacts.verify: fail`, and `archive: pending`. It is not under `openspec/changes/archive`. This run does not archive and does not start archive.

### Verdict

PASS WITH WARNINGS

22/22 tasks are checked. The four allowed test commands exited 0: 36 tests passed. 10/17 spec scenarios are compliant from tests that passed in this run. Seven fiscal scenarios are deferred by D-14 and are not defects of this slice. The purchasing routes render `PurchaseScreen` and `ReceiveScreen`. No CRITICAL spec miss.
