## Verification Report

**Change**: p1-06-printing
**Version**: N/A
**Mode**: Standard
**Checkout**: `feat/printing-node` at `74dcb1c` (74dcb1cf793495d56b8d12685fb375e0026de6d3)

Strict TDD is inactive (`strict_tdd: false`). `strict-tdd-verify.md` was not loaded. This is the D-37 cloud slice. Hybrid work (SQLite, the outbox, a node queue, offline node printing, and a bridge on the venue LAN) is deferred, not a failure of this delivery. Physical 80 mm and 58 mm proof stays blocked on p0-01. This run did not use a live printer or a cloud deploy.

`DEFERRED` means the proposal and the design leave that scenario out of this delivery. It is not a cloud-slice failure and does not block archive. A scenario that belongs to this delivery is compliant only when a covering test passed in this run. Source inspection alone is not compliance.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 32 |
| Tasks complete | 32 |
| Tasks incomplete | 0 |

Tasks 1.1 through 6.6 are checked in `tasks.md`. `apply-progress.md` records the same 32/32. No unchecked implementation task remains.

Git status lists line-ending stat noise under `contexts/orders`, `contexts/platform`, `shared/printing`, and `tools/delivery`. For every listed path, the worktree blob hash equals the index hash and `HEAD`. `git diff --numstat` is empty. That noise was not reverted and is not a product change.

### Build & Tests Execution

**Build**: ✅ Passed

```text
pnpm exec tsc -b shared/printing contexts/cash-register contexts/invoicing contexts/orders apps/api-cloud apps/local-node shared/contracts --pretty false
exit 0
```

**Tests**: ✅ 144 passed / ❌ 0 failed / ⚠️ 0 skipped

```text
pnpm exec vitest run --project printing
exit 0. Test Files  7 passed (7). Tests  36 passed (36).

pnpm exec vitest run --project cash-register charge-check close-shift
exit 0. Test Files  2 passed (2). Tests  40 passed (40).

pnpm exec vitest run --project invoicing print-document
exit 0. Test Files  1 passed (1). Tests  2 passed (2).

pnpm exec vitest run --project orders take-order request-check
exit 0. Test Files  2 passed (2). Tests  15 passed (15).

pnpm exec vitest run --project api-cloud test/http/charge-check.controller.test.ts test/http/request-check.controller.test.ts test/http/take-order.controller.test.ts test/http/cash-count.controller.test.ts test/http/printing.controller.test.ts test/http/update-structure.controller.test.ts test/composition/bootstrap.test.ts
exit 0. Test Files  7 passed (7). Tests  50 passed (50).

pnpm exec vitest run --project local-node test/http/printing.controller.test.ts
exit 0. Test Files  1 passed (1). Tests  1 passed (1).
```

**Coverage**: ➖ Not available / threshold: 0%

`pnpm test`, `pnpm lint`, and `pnpm architecture` were not run. The verify instructions named these focused suites. `contexts/platform` drawer tests were not in that list, so `0013_register_drawer.sql` was not re-executed here. The printing PGlite contract is inside the printing project that passed.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Templates and Widths | Invoice on 58 mm | `shared/printing/domain/sale-templates.test.ts` > given a 58 mm invoice, when it is rendered, then the number, CUFE, and QR stay on 32 columns | ✅ COMPLIANT |
| Templates and Widths | Offline receipt | `shared/printing/domain/sale-templates.test.ts` > given an offline receipt, when it is rendered, then it says it is not an invoice and includes the lookup QR; `contexts/invoicing/application/print-document/print-document.test.ts` > given a sale whose document is pending issuance, when its print payload is built, then it says it is not an invoice, carries the lookup QR, and does not kick | ✅ COMPLIANT |
| Where Printing Runs | Hybrid offline | Design and D-37 defer the node queue, SQLite, and offline node printing. The node test returns 403 `PrintingRejected` and stores nothing. | ⏸ DEFERRED |
| Where Printing Runs | Bridge off (cloud mode) | `apps/api-cloud/test/http/cash-count.controller.test.ts` > given a register with a printer, when the shift is closed, then the cash close stays waiting, kickDrawer is false, and the response says printed false | ✅ COMPLIANT |
| Queue, Retries and Status | Transient failure | `shared/printing/application/dispatch-print-jobs/dispatch-print-jobs.test.ts` > given the primary accepts the job inside the retry limit, when it is dispatched, then it prints once and the backup is not used | ✅ COMPLIANT |
| Queue, Retries and Status | Retries exhausted | `shared/printing/application/dispatch-print-jobs/dispatch-print-jobs.test.ts` > given retries are exhausted and the printer has no backup, when the job is dispatched, then the job is marked failed | ⚠️ PARTIAL |
| Backup Printer | Primary down | `shared/printing/application/dispatch-print-jobs/dispatch-print-jobs.test.ts` > given the primary fails for every retry, when the job is dispatched, then the transport sends it to the backup printer | ✅ COMPLIANT |
| Backup Printer | Both down | `shared/printing/application/dispatch-print-jobs/dispatch-print-jobs.test.ts` > given the primary and the backup both fail, when the job is dispatched, then the job is marked failed | ⚠️ PARTIAL |
| Audited Reprint | Reprint within cap | `shared/printing/application/reprint-document/reprint-document.test.ts` > given a cashier under the reprint cap, when she reprints a document, then sale.reprint carries the actor, device, document, and time; `apps/api-cloud/test/http/printing.controller.test.ts` > given a numeric reprint cap, when a document is reprinted, then one sale.reprint records the actor, device, document, and time | ⚠️ PARTIAL |
| Audited Reprint | Over cap | Proposal out of scope, design decision, and tasks send authorization of an over-cap reprint to 1.7. There is no authorizer and no over-cap branch. | ⏸ DEFERRED |
| Cash Drawer | Cash sale opens drawer | `contexts/cash-register/application/charge-check/charge-check.test.ts` > given a present drawer and a cash sale, when the charge is saved, then that printer is kicked and cash.drawer-opened is audited once; `apps/api-cloud/test/http/charge-check.controller.test.ts` > given a present drawer and a saved cash tender, when POST charge is injected, then the receipt stays waiting, the response says printed false, and cash.drawer-opened is audited once | ✅ COMPLIANT |
| Cash Drawer | Drawer on kitchen printer | `shared/printing/domain/operation-templates.test.ts` > given a kick on a kitchen, pre-bill, cash close, transfer, or tips job, when it is rendered, then the drawer kick is rejected; `contexts/orders/application/take-order/take-order.test.ts` > given a kitchen job that is already printed, when a product is sent, then the ticket is enqueued with no kick and printer_failed is not published | ✅ COMPLIANT |

**Compliance summary**: 7/10 in-scope scenarios compliant, 3 partial, 2 deferred (12 scenarios in the delta). Deferred scenarios are not failures.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Templates and Widths | ✅ Implemented | Seven templates. 80 mm is 48 columns and 58 mm is 32. Invoice text keeps number, CUFE, and the QR URL. Offline text contains "not an invoice" and the lookup QR. The QR is wrapped text, not an ESC/POS graphic. |
| Where Printing Runs | ✅ Implemented for cloud | Cloud HTTP returns `printed: false` while the accepted job is `waiting`. The node rejects `POST /reprints`. Hybrid printing is not built. |
| Queue, Retries and Status | ⚠️ Partial | Memory dispatch retries, then prints once, or marks `failed`. That dispatch is not called by HTTP. Sale jobs sit on `PendingSalePrinter`. |
| Backup Printer | ⚠️ Partial | Memory dispatch sends to `backupPrinterId` after the primary attempts fail. Structure backup is a different in-memory record. |
| Audited Reprint | ⚠️ Partial | Under a numeric cap, one `sale.reprint` is stored. `ReprintDocument` does not enqueue. A null cap is 409 `ReprintCapUnconfigured` and stores nothing. Over cap is 1.7. |
| Cash Drawer | ✅ Implemented | Cash on `drawer: present` sets `kickDrawer: true` and audits `cash.drawer-opened` once after the charge is saved. Absent, non-cash, cash close, and kitchen do not kick. The HTTP job does not carry pulse bytes. The pulse `1B 70 00 19 FA` is on a kicked invoice or offline receipt inside `shared/printing`. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| `shared/printing` owns templates, bytes, jobs, retries, and backup. Contexts do not import it. | ✅ Yes | `contexts/` has no `@blackhole/printing` import. Orders, cash-register, and invoicing keep their own ports. |
| D-37: Postgres on `api-cloud`. No SQLite, outbox, or node queue. | ⚠️ Partial | `0012_printing.sql` and the PGlite contract passed in the printing project. Charge, kitchen, pre-bill, and close do not insert `print_jobs`. They use `PendingSalePrinter`. |
| Cloud does not open TCP 9100. Jobs stay `waiting`. Tests use a memory transport. | ✅ Yes | Dispatch and enqueue tests record no `node:net` connect. HTTP returns `printed: false`. |
| Do not import the ESC/POS spike. Physical 80/58 proof is a later gate. | ✅ Yes | Widths 48 and 32 and pulse `1B-70-00-19-FA` are the render contract. No live printer in this run. |
| `drawer: present \| absent`. A missing drawer is `absent`. A venue may mix both. | ✅ Yes | Charge tests and the structure HTTP test passed for present, absent, and `printerId`. The platform PGlite file was not in this command list. |
| Kick only a cash tender on that register's printer. `cash_close` and kitchen never kick. | ✅ Yes | Charge, close, kitchen, and pre-bill tests passed. `DrawerKickRejected` passed for the five operation templates. |
| Audited open is the command, not a physical drawer. No open-without-sale. | ✅ Yes | `cash.drawer-opened` is one audit after the saved cash tender. `p0-01` still has no `drawerOpened` visit. |
| No over-cap authorizer. `limit: number \| null`. Null returns `ReprintCapUnconfigured`. | ✅ Yes | Matches the design and conflicts with the spec's over-cap scenario, which stays in 1.7. A number does not compare a consumption count. |
| `local-node` returns 403 `PrintingRejected` and stores nothing. | ✅ Yes | One passing HTTP test. The controller has no repository. Only `POST /reprints` exists. |
| Producers call `application/entry-port.ts`, then the job is inserted `waiting`. | ⚠️ Partial | Reprint and `savePrinter` use the entry port. `DispatchPrintJobs` is not exported. Sale producers do not call `EnqueuePrintJob`. |
| Paper and backup are configured with the structure command. | ⚠️ Partial | The passing structure test stores paper and backup on `StructurePrinters` in api-cloud memory. `0012_printing.sql` `printers` has `paper` and no backup column. |
| `printing_app` is SELECT and INSERT only. | ✅ Yes | The passing contract test expects `GRANT SELECT, INSERT`. The role cannot update `printed` or `failed`. |
| `PrintDocument` returns invoice and offline-receipt payloads and does not enqueue. | ✅ Yes | Both invoicing tests passed. The charge HTTP response does not call `PrintDocument`. |
| Transfer and tips templates take caller payloads. Real producers stay in 2.5 and 1.10. | ✅ Yes | Operation-template tests passed. No transfer or tips producer was added. |

### Issues Found

**CRITICAL**: None

**WARNING**:

- Reprint within cap records `sale.reprint` with actor, device, document, and time, and that test passed. `ReprintDocument` does not enqueue and does not print. The spec sentence "it prints" is not covered.
- Retries exhausted marks the job `failed` when there is no backup, and that test passed. `DispatchPrintJobs` does not alert a screen. `TakeOrder` publishes `printer_failed` for a waiting or failed orders printer, including a waiting kitchen send, which is not this retry window.
- Both printers down marks the job `failed`, and that test passed. Nothing alerts the cash register.
- The cashier, kitchen, pre-bill, and cash-close HTTP paths keep `waiting` jobs on `PendingSalePrinter`. They do not insert `print_jobs` and do not call `EnqueuePrintJob`. `PrintDocument` is not called by the charge response, so that queued receipt has no "not an invoice" statement, lookup QR, number, CUFE, or pulse.
- Paper and backup from the structure command live on `StructurePrinters` in api-cloud memory. They are not written to `0012_printing.sql`. Dispatch backup is a separate in-memory route, so the backup saved with the structure command is not the backup used when the primary fails.
- `printing_app` is SELECT and INSERT only, and the contract test locks that grant in. A later worker cannot mark a Postgres job `printed` or `failed` with this role.
- The local node rejects only `POST /tenants/:tenantId/reprints` with 403 `PrintingRejected`. That is the designed cloud-slice behavior. It does not host a queue. Offline node printing stays deferred.
- The delta still contains "Over cap". The proposal, the design decision, and the tasks leave it in 1.7, with no route and no authorizer. A numeric cap is treated as already under the limit. That absence is not a failure of this slice.

**SUGGESTION**:

- When a bridge worker is added, point the sale HTTP paths at `EnqueuePrintJob` and `PrintDocument`, and give the worker a role that can update job status. Persist backup on the printer row that dispatch reads.
- Keep the on-paper 80/58 mm scan and the physical drawer open on p0-01. The QR in the 58 mm invoice test is the URL wrapped to 32 columns.
- Work units 7, 10, 14, and 15 were over the 400-line review budget and were not split. They are already on the feature-branch chain. This verify run does not reopen them.

### Verdict

PASS WITH WARNINGS

7/10 in-scope scenarios are compliant, 3 are partial, and 2 are deferred. All 32 tasks are checked. The six commanded Vitest suites passed (144 tests) and the named `tsc -b` exited 0. No CRITICAL remains. Archive is allowed. This phase did not archive.
