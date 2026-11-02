## Verification Report

**Change**: p1-05-electronic-invoicing
**Version**: N/A
**Mode**: Standard
**Evidence**: uncommitted working tree above HEAD `208b303`. This run is not a clean commit. The same tree contains unrelated monitoring edits. Those edits were not reverted and are not part of this verdict.
**Spec**: `openspec/changes/p1-05-electronic-invoicing/specs/e-invoicing/spec.md`
**Design**: `openspec/changes/p1-05-electronic-invoicing/design.md`

Strict TDD is inactive (`openspec/config.yaml` `strict_tdd: false`). The strict-TDD module was not loaded. This run judges the current cloud slice. Hybrid behavior that the design records as deferred under D-37 and D-10 (SQLite, outbox, node documents, sync, deferred emission during a venue outage, contingency receipt, venue queue, and the 200-document drain) is excluded from the fail set. A cloud scenario is compliant only when a covering test passed in this run. The previous FAIL (Sale closed online UNTESTED, `tsc` exit 2) is superseded only by the commands below.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 30 |
| Tasks complete | 30 |
| Tasks incomplete | 0 |

Tasks 1.1–1.4, 2.1–2.12, 3.1–3.4, 4.1–4.4, 5.1–5.3, and 6.1–6.3 are checked. No implementation task is unchecked.

### Build & Tests Execution
**Build**: ✅ Passed
```text
pnpm exec tsc -b contexts/invoicing apps/api-cloud apps/local-node --pretty false
EXIT: 0
```

**Tests**: ✅ commanded test runs passed. `pnpm test` was not run.
```text
pnpm vitest run --project invoicing
  Test Files  20 passed (20)
  Tests       142 passed (142)
EXIT: 0

pnpm exec vitest run --project api-cloud invoicing
  Test Files  1 passed (1)
  Tests       10 passed (10)
EXIT: 0

pnpm exec vitest run --project api-cloud issue-document.worker
  Test Files  1 passed (1)
  Tests       6 passed (6)
EXIT: 0

pnpm exec vitest run --project local-node invoicing.controller
  Test Files  1 passed (1)
  Tests       1 passed (1)
EXIT: 0

pnpm exec vitest run --project skeleton -t "structure rejection"
  Test Files  1 passed | 1 skipped (2)
  Tests       1 passed | 9 skipped (10)
EXIT: 0
```

The api-cloud filter `invoicing` collected `invoicing.controller.test.ts` only (10 tests). `issue-document.worker.test.ts` ran in the third command and all 6 tests passed. Those 6 are runtime evidence for this run.

**Coverage**: ➖ Not available / threshold: 0%

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| One Sale, One Document | Sale closed online | `issue-document.test.ts` > given a closed sale and a working provider, when the document is emitted, then the caller receives number, CUFE, and QR; `issue-document.worker.test.ts` > given a queued closure and a working provider, when the worker emits it, then the saved document and the job carry number, CUFE, and QR, and a second run does not validate again | ✅ COMPLIANT |
| One Sale, One Document | Second document refused | `sales-document.test.ts` > given a closure already has a sales document, when another is requested, then that document is returned; `issue-document.test.ts` > given a closure that already has a document, when another is requested, then that document is returned | ✅ COMPLIANT |
| Buyer | Autocomplete | `attach-buyer.test.ts` > given a cashier enters a valid NIT, when the lookup returns, then name and email are filled; `invoicing.controller.test.ts` > given a cashier session, when POST closures/:closureId/buyer sends an acquirer, then the response is 200 with the looked-up name and email | ✅ COMPLIANT |
| Buyer | Invalid check digit | `sales-document.test.ts` > given a NIT with a wrong modulus-11 check digit, when it is submitted, then the buyer is rejected; `attach-buyer.test.ts` > given a NIT with a wrong modulus-11 check digit, when the buyer is attached, then the attach is blocked | ✅ COMPLIANT |
| Numbering and Content | Register-level range | `document-content.test.ts` > given a cash register range, when the document is built, then the invoice uses that range | ✅ COMPLIANT |
| Numbering and Content | Tip as surcharge | `document-content.test.ts` > given a 100000 sale with a 10000 tip, when the document is built, then the tip is surcharge 03 propina and the taxes match the 100000 sale | ✅ COMPLIANT |
| Deferred Emission | Hybrid cut | (design defers node documents, sync, and venue outage under D-37 and D-10) | ➖ DEFERRED |
| Deferred Emission | Rate limit | (design defers the venue queue and deferred emission on resume under D-10; the 80/minute gate test passed and is not this scenario) | ➖ DEFERRED |
| Queue Drain Time | 200 pending invoices | (design defers the 200-document drain) | ➖ DEFERRED |
| Queue Drain Time | Drain slower than target | (design defers the 200-document drain) | ➖ DEFERRED |
| Uncertain Send Verification | Already validated | `verify-issuance.test.ts` > given an uncertain document the provider validated, when verification runs, then its number and CUFE are kept and nothing is resent | ✅ COMPLIANT |
| Uncertain Send Verification | Verification fails | `verify-issuance.test.ts` > given an uncertain document and a failed query, when verification is attempted, then it stays uncertain and backs off without resending | ✅ COMPLIANT |
| Rejections and Credit Notes | Rejected then resent | `verify-issuance.test.ts` > given the provider rejects a document, when it is resent, then an alert is raised and the document uses a new reference | ✅ COMPLIANT |
| Rejections and Credit Notes | Credit note without permission | `issue-credit-note.test.ts` > given a cashier without sale.credit-note, when a credit note is requested, then nothing is sent | ✅ COMPLIANT |
| Document Consumption Counter | Yellow alert | `document-balance.test.ts` > given the balance covers 12 days, when a document is counted, then a yellow alert reaches the company admin and support | ✅ COMPLIANT |
| Document Consumption Counter | Balance exhausted | `issue-document.test.ts` > given zero document balance, when the sale closes, then the document is pending_issuance with no_balance and validate is not called; `issue-document.worker.test.ts` > given zero document balance, when the worker emits the closure, then the hold is pending_issuance with no_balance and validate is not called | ✅ COMPLIANT |

**Compliance summary**: 12/12 in-scope cloud scenarios compliant. 0 UNTESTED. 4 deferred scenarios excluded. 16 scenarios in the spec.

The passing 80/minute evidence is `issuance-gate.test.ts` > given eighty validations for one nit in the minute, when another range is requested, then the rate gate refuses it before the provider validates. That test does not stand in for “120 pending documents when emission resumes.”

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| One Sale, One Document | ✅ Implemented | A working provider returns number, CUFE, and QR. `IssueDocument` stores those fields. The worker calls `issue.execute` and returns them on the job. A second run returns the stored document and validates once. Stored status stays `generated`. |
| Buyer | ✅ Implemented | Generic buyer, lookup of name and email, and a bad modulus-11 digit fail closed. HTTP lookup and attach returned 200 in this run. |
| Numbering and Content | ✅ Implemented | Register range wins over the site range. Tip is surcharge `03` / `propina` outside the taxed sale total. |
| Deferred Emission | ➖ Deferred | Design keeps SQLite, outbox, node documents, sync, venue-outage emission, and the contingency receipt out of this slice. |
| Queue Drain Time | ➖ Deferred | Design lists the 200-document drain as not a task. |
| Uncertain Send Verification | ✅ Implemented | Validated keeps number and CUFE and does not resend. A failed query stays `uncertain` and backs off. |
| Rejections and Credit Notes | ✅ Implemented | Rejection raises an alert and resends on a new reference. A cashier without `sale.credit-note` sends nothing. |
| Document Consumption Counter | ✅ Implemented | Twelve days raises one yellow alert to `company_admin` and `support`. Zero balance stores `pending_issuance` / `no_balance` and does not validate, on the use case and on the worker. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cloud only; node returns 403 `InvoicingRejected` and stores nothing | ✅ Yes | `local-node` controller test passed. Skeleton structure-rejection filter passed. |
| Worker calls `IssueDocument` for a queued closure | ✅ Yes, when a reader is injected | The worker test passes a reader and a document store. `issueQueuedDocument` persists through `IssueDocument`. |
| Live `startWorker` reads a queued closure | ⚠️ No | `startWorker` calls `openIssueDocument(runtime.secrets)` with no ports. The default reader resolves null, so a PgBoss job returns null and does not emit. |
| Idempotent document per closure | ✅ Yes | A second worker run returns the stored document and does not validate again. |
| Empty balance is `pending_issuance` / `no_balance` | ✅ Yes | Use case and worker tests both store that hold and skip validate. Number, CUFE, and QR are absent. |
| Emission takes the 80/minute gate first, one validate in flight per range | ⚠️ Gate stays out | Phase 6 leaves `IssuanceGate` off the worker. The gate's own tests passed. The deferred rate-limit scenario is not this path. |
| Factus ACL stays in `adapters/factus`; the 0.9 probe does not emit | ✅ Yes | Factus HTTP tests passed inside the invoicing project. The worker test keeps `issuePending` on `FactusSimulator` and does not call `InvoicingProvider`. |
| Routes, permissions, `z.email()`, strict objects, no `z.any()` | ✅ Yes | Cloud controller tests passed, including 403 and 400 with nothing stored. |

Printing templates stay deferred to 1.6. That deferral does not remove “Sale closed online” from the current spec. This run's working-provider and worker tests cover number, CUFE, and QR.

### Phase 6 claims confirmed by this run
- A working provider returns number, CUFE, and QR. `issue-document.test.ts` and `issue-document.worker.test.ts` both passed inside the commands above.
- The worker saves through `IssueDocument`. The worker test expects one stored row with those three fields.
- A second run does not validate again. The same test expects one `validate` call and the second job equal to the first.
- `pnpm exec tsc -b contexts/invoicing apps/api-cloud apps/local-node --pretty false` exited 0.

### Notes judged, not fixed
The live queued-closure reader does not fail a current spec scenario. `Sale closed online` has passing tests that inject a reader and a working provider. `startWorker` does not pass that reader. `AbsentQueuedClosures.read` resolves null, `IssueDocument` throws `QueuedClosureNotFound`, and `issueQueuedDocument` returns null. A PgBoss job does not emit until a reader is passed. That is a composition warning. The default document store on that opener is the process-local `ProcessSalesDocuments`, not the postgres repository. The passing worker tests inject their own store.

`InvoicingProvider<DocumentIssuance>` is the type `IssueDocument` and `FactusInvoicingProvider` use. `IssuanceGate` is constructed with the default `InvoicingProvider` (`Promise<void>`). Phase 6 does not pass the Factus provider into the gate. The gate tests passed inside `pnpm vitest run --project invoicing`, and `tsc` exited 0. No current spec scenario lost its passing test.

### Issues Found
**CRITICAL**: None

**WARNING**:
- This run is not a clean commit. Evidence is the working tree above HEAD `208b303`, including unrelated monitoring edits.
- `startWorker` registers `openIssueDocument(runtime.secrets)` without a queued-closure reader. A live PgBoss job returns null and does not emit until a reader is passed. This does not remove the passing `Sale closed online` tests.
- `IssuanceGate` is not on the worker emission path. The design says emission takes the 80/minute gate first. Phase 6 leaves the gate out. The deferred rate-limit scenario is unchanged.

**SUGGESTION**:
- `IssuanceGate` still depends on the default `InvoicingProvider`, while emission uses `InvoicingProvider<DocumentIssuance>`. No in-scope scenario lost a passing test.

### Verdict
PASS WITH WARNINGS
12/12 in-scope cloud scenarios have a passing test from this run. Every commanded test command and the typecheck exited 0. No CRITICAL remains. The live reader hole and the gate left off the worker are warnings. Archive is allowed.
