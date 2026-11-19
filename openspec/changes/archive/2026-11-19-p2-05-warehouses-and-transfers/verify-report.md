```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:23f0bf9ecc80fb3755424b1b4ffe820a6b1838627c5ef70ea4ce080b6e34c400
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 4/8
scenarios: 11/17
test_command: pnpm exec vitest run --project inventory contexts/inventory/domain/transfer.test.ts contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/application/request-transfer/request-transfer.test.ts contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts contexts/inventory/application/receive-transfer/receive-transfer.test.ts contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts contexts/inventory/application/ports/transfer-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-transfer-repository.contract.test.ts && pnpm exec vitest run --project platform contexts/platform/application/declare-warehouse-supply/declare-warehouse-supply.test.ts && pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/transfers.controller.test.ts && pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/transfer-screen.test.tsx apps/admin-web/test/inventory/purchase-screen.test.tsx apps/admin-web/test/inventory/production-screen.test.tsx && pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/transfers/transfer-screen.test.tsx apps/venue-app/test/purchasing/receive-screen.test.tsx
test_exit_code: 0
test_output_hash: sha256:118996466641ad65802f44d9619393e30320e013b7b1fbb0e59ad5a4c5698a3e
build_command: N/A
build_exit_code: N/A
build_output_hash: sha256:b49f0e32b089c38a7030b383cd2cb7f8bc9a0f5089213cb0135d0f3724de089b
archive_allowed: false
```

## Verification Report

**Change**: p2-05-warehouses-and-transfers
**Version**: N/A
**Mode**: Standard
**Workspace**: `C:\Users\csar-\Proyectos\blackHole`
**Strict TDD**: inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded.
**Persistence**: openspec. Engram `sdd/p2-05-warehouses-and-transfers/verify-report` is saved with `capture_prompt: false`.

`tasks.md` has 25 implementation checkboxes, 1.1–5.2, all `[x]`, and no unchecked task line. Proposal success criteria stay unchecked. They describe a pilot cycle with a site offline at receipt, which this delivery leaves hybrid. Before this run `state.yaml` was `status: applying`, `apply: partial`, `verify: pending`, `archive: pending`. This run sets `status: applied`, `apply: done`, and `artifacts.verify` to `pass`. The report verdict remains `pass_with_warnings`.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 25 |
| Tasks complete | 25 |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: N/A — not executed

```text
N/A. Orchestrator forbade pnpm typecheck, pnpm lint, pnpm architecture, and the full vitest suite. Other agents own apps/api-cloud/src/composition/application-module.ts, apps/api-cloud/src/composition/worker.ts, contexts/inventory/package.json, apps/venue-app/src/service/venue-cloud.ts, apps/venue-app/src/service/service-session.tsx, and apps/api-cloud/src/http/orders-realtime.controller.ts.
sha256:b49f0e32b089c38a7030b383cd2cb7f8bc9a0f5089213cb0135d0f3724de089b
```

**Tests**: 95 passed, 0 failed, 0 skipped. All five commands exited 0. No listed path was missing. No foreign-file failure occurred.

`test_output_hash` is the SHA-256 of the five result blocks below, concatenated in this order with a blank line between blocks, UTF-8, LF, and no trailing newline. PowerShell profile noise is not part of that digest. `evidence_revision` is the SHA-256 of those five blocks followed by one LF and the build skip sentence above. The platform project name is `platform`. `contexts/inventory/application/ports/transfer-repository.contract.ts` defines the suite and does not execute by itself. The PGlite file calls it, so those three cases are inside the 52.

```text
pnpm exec vitest run --project inventory contexts/inventory/domain/transfer.test.ts contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/application/request-transfer/request-transfer.test.ts contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts contexts/inventory/application/receive-transfer/receive-transfer.test.ts contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts contexts/inventory/application/ports/transfer-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-transfer-repository.contract.test.ts
exit 0
Test Files  8 passed (8)
Tests  52 passed (52)
Duration  6.01s

pnpm exec vitest run --project platform contexts/platform/application/declare-warehouse-supply/declare-warehouse-supply.test.ts
exit 0
Test Files  1 passed (1)
Tests  2 passed (2)
Duration  268ms

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/transfers.controller.test.ts
exit 0
Test Files  1 passed (1)
Tests  8 passed (8)
Duration  16.30s

pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/transfer-screen.test.tsx apps/admin-web/test/inventory/purchase-screen.test.tsx apps/admin-web/test/inventory/production-screen.test.tsx
exit 0
Test Files  3 passed (3)
Tests  19 passed (19)
Duration  4.24s

pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/transfers/transfer-screen.test.tsx apps/venue-app/test/purchasing/receive-screen.test.tsx
exit 0
Test Files  2 passed (2)
Tests  14 passed (14)
Duration  3.73s
```

**Coverage**: N/A. No coverage command was allowed.

**Not run, and not used as compliance evidence**: `contexts/inventory/adapters/memory/in-memory-transfer-repository.contract.test.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm architecture`, and the full vitest suite.

### Spec Compliance Matrix

The spec has 8 requirements and 17 scenarios. A scenario is compliant only when a covering test passed in this run. Warehouse-node, same-node offline, out-of-order halves, and receipt-before-sync stay design-deferred (D-37, PA-44, tasks: no `local-node`, no `shared/sync`, no SQLite transfer repository). Those six are warnings, not slice defects, and they are not sent back to apply.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Warehouses and Supply | Supplying warehouse | `declare-warehouse-supply.test.ts` > given Central is the company warehouse, when site A declares it, then the supply link is stored; `request-transfer.test.ts` > given Central supplies site A, when site A requests lines, then those lines stay requested and no stock movement is written | ✅ COMPLIANT |
| Warehouses and Supply | Unrelated warehouse | `request-transfer.test.ts` > given North does not supply site A, when site A requests from it, then the request is rejected and no stock movement is stored; `declare-warehouse-supply.test.ts` rejects a warehouse of another site | ✅ COMPLIANT |
| General Warehouse Node | Warehouse node offline | (none; design leaves the warehouse node, local store, and later sync unbuilt) | deferred — not a slice defect |
| General Warehouse Node | No dining room on the warehouse node | (none; warehouse mode on a node is not built) | deferred — not a slice defect |
| General Warehouse Node | General warehouse without node | (none; PA-44 and the design leave web dispatch without a node unbuilt) | deferred — not a slice defect |
| Transfer Lifecycle | Same-node transfer offline | (none; design and tasks leave hybrid and `local-node` unbuilt). Admin and venue tests assert nothing is stored on the screen | deferred — not a slice defect |
| Transfer Lifecycle | Receipt before dispatch | `transfer.test.ts` > given a requested transfer, when receipt is attempted before dispatch, then it is rejected; `receive-transfer.test.ts` > given a requested transfer, when receipt is attempted, then it is rejected and nothing is stored | ✅ COMPLIANT |
| Two Halves, One Identifier | Reconciled | `dispatch-transfer.test.ts` stores `transfer_out` with the transfer id; `receive-transfer.test.ts` stores `transfer_in` on that id and marks `received`; the PGlite contract stores the receipt at average 11 and status `received`; HTTP request, dispatch, and receipt return 200 | ✅ COMPLIANT |
| Two Halves, One Identifier | Out of order | (none; design says out-of-order halves and receipt-before-sync are not built) | deferred — not a slice defect |
| QR Voucher Reception | Site offline at receipt | (none; venue `transfer-screen.test.tsx` asserts the receipt stays on the cloud and nothing is stored locally) | deferred — not a slice defect |
| QR Voucher Reception | Unregistered device | `transfers.controller.test.ts` > given an unregistered device, when a transfer is requested, then nothing is recorded | ✅ COMPLIANT |
| Received with Differences | Short delivery | `transfer.test.ts` and `receive-transfer.test.ts` > given 10 dispatched, when 9 are received with an authorizer, then the line keeps shortfall 1 and `transfer_in` quantity is 9 at the copied cost; HTTP accepts the authorized short receipt as `received_with_differences` | ✅ COMPLIANT |
| Received with Differences | No authorization | `receive-transfer.test.ts` > given 10 are in transit, when 9 are received without an authorizer, then nothing is stored; HTTP keeper short receipt without an authorizer returns 403 and stays `in_transit` | ✅ COMPLIANT |
| Transfer Cost | Cost travels | `transfer.test.ts` and `receive-transfer.test.ts` > given origin cost 12 and destination 1000 g at 10, when 1000 g are received, then the destination average is 11; the PGlite contract stores that average | ✅ COMPLIANT |
| Transfer Cost | Short receipt valued | `transfer.test.ts` > given 10 base units dispatched at 12, when 9 are received, then the shortfall stays on the line at that cost | ✅ COMPLIANT |
| Replenishment Suggestion | Below minimum | `transfer.test.ts` and `suggest-replenishment.test.ts` > given minimum 5, maximum 20 and on-hand 4, when replenishment is suggested, then the suggestion is 16 and no transfer is stored | ✅ COMPLIANT |
| Replenishment Suggestion | No levels | `suggest-replenishment.test.ts` > given an ingredient without levels, when its balance is read, then nothing is suggested | ✅ COMPLIANT |

**Compliance summary**: 11/17 scenarios compliant. 0 partial. 0 failing. 6 design-deferred. Those six are not CRITICAL.

Received with Differences, Transfer Cost, and Replenishment Suggestion are fully compliant. Warehouses and Supply is fully compliant for the declare and request rules. General Warehouse Node, Transfer Lifecycle, Two Halves, and QR Voucher Reception are not, because each still has a deferred hybrid scenario.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Warehouses and Supply | ✅ Implemented for declare and request | An unlinked warehouse is rejected and no movement is stored. A linked Central request stays `requested` with lines and no movement. The HTTP adapter does not read `warehouse_supplies`; it treats an organization warehouse location with `venueId` null or equal to the venue as linked. |
| General Warehouse Node | ⚠️ Not built | No warehouse-mode node, no dining-room rejection on that node, and no web dispatch that requires a paired node. |
| Transfer Lifecycle | ✅ Implemented for cloud order | Dispatch stamps `dispatched` and `in_transit` together. Receipt before that throws and stores nothing. Same-node offline recording is not built. |
| Two Halves, One Identifier | ✅ Implemented in order | `transfer_out` is the full negative dispatch. `transfer_in` is the positive received quantity. Both carry the origin average and the same transfer id. A repeated receipt stores nothing. Out-of-order arrival is not built. |
| QR Voucher Reception | ⚠️ Payload only | Dispatch records a `transfer` draft with transfer id and lines. `PendingTransferVoucher.print` resolves without a printer queue. The screens post a QR text field to the cloud. An unregistered session records nothing. Offline local receipt is not built. |
| Received with Differences | ✅ Implemented | Shortfall stays on the line. No authorizer stores nothing for a keeper. A site administrator may accept the difference without `authorizerId`. Audit is written on an authorized receipt. |
| Transfer Cost | ✅ Implemented | 1000 g at 10 plus 1000 g at 12 becomes 11 through `nextAverageCost`. On-hand at or below zero takes the receipt cost. The 1-unit shortfall stays valued at 12. `transfer_out` does not change the origin average. Ledger signs reject a positive out and a negative in. |
| Replenishment Suggestion | ✅ Implemented on demand | Below minimum returns `maximum - onHand` (16 for 5/20/4). No levels returns nothing. The call does not open an alert or create a transfer. |

`transfersEnabled` is on only when `dependencies.transfersEnabled === true`, so the default is off. The flag-off HTTP test passed with 404 and nothing listening. Cost is omitted when `unitCost` is absent and when the caller lacks `inventory.view-cost`. Admin `TransfersScreen` and `TransferDetailScreen` render the request, dispatch, and QR receipt form. Purchase and production screen tests passed. Venue receipt stays a cloud post. No SQLite transfer repository is present. `0004_transfers.sql` says SQLite is not a transfer runtime.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Host is `api-cloud`, flag `transfersEnabled` | ✅ Yes | Flag-off test passed. No transfer runtime under `apps/local-node` or `shared/sync`. |
| Supply is `warehouse_supplies` per venue | ⚠️ Deviation | Declare-warehouse-supply stores and rejects through that use case, and its two tests passed. The HTTP test does not insert `warehouse_supplies`. `OrganizationWarehouseSupply` resolves the link from the organization location. |
| States: dispatch stamps `dispatched` and `in_transit` together; receipt only from `in_transit` | ✅ Yes | Domain and receive tests passed. |
| Halves are append-only, same id; no dispatch means receipt is rejected | ✅ Yes | Out-of-order reconciliation is not built, as the design says. |
| Copy origin `averageCost`; `transfer_in` calls `nextAverageCost` | ✅ Yes | 11 COP/g and the empty-balance receipt cost passed in domain, use case, and PGlite. |
| Shortfall stays on the line; on-hand grows by the received quantity | ✅ Yes | 9 of 10 passed. Over origin on-hand is rejected. |
| Company out stores the destination `venueId`; site-to-site stores the origin venue | ✅ Yes | Both dispatch tests passed. Sale columns stay null. |
| Suggestion is `maximum - onHand` below minimum; no alerts | ✅ Yes | 16 and the no-levels case passed. Location levels store scaled units and open no alert. |
| Request permission, keeper or receive permission, difference needs YES or `authorizerId`; hide cost without `inventory.view-cost` | ✅ Yes | Waiter denied, unregistered device 403, short receipt 403, authorized short receipt hides `unitCost`, site administrator accepts the difference. |
| Audit on dispatch and receipt; voucher is document `transfer` | ⚠️ Intended | Use-case audit and the printed draft passed. The HTTP voucher accepts the print and does not enqueue a transfer printer job. |
| One PostgreSQL transaction for receipt; skip `stock_movement_outbox` | ✅ Yes on the PGlite contract | Rollback of movements, status, and average cost passed. Tenant B cannot read tenant A. Outbox count stays unchanged. |
| No `local-node`, `shared/sync`, printing edit, or SQLite transfer runtime | ✅ Yes | Confirmed by the design limit and the absence of a SQLite transfer repository. Screens do not store a local receipt. |

### Issues Found

**CRITICAL**: None

**WARNING**:

1. Six spec scenarios are design-deferred and have no passing test: warehouse node offline, no dining room on the warehouse node, general warehouse without a node, same-node transfer offline, out-of-order halves, and site offline at receipt. Design and tasks keep this delivery on `api-cloud` (D-37, PA-44).
2. `transfersEnabled` defaults off. The flag-off HTTP test passed.
3. Cost stays hidden when `unitCost` is absent and when the session lacks `inventory.view-cost`. Admin and venue tests passed for both cases.
4. There is no local receipt and no SQLite transfer repository. Venue tests assert the cloud post and store nothing on the screen.
5. The HTTP supply check is resolved from the organization. The test does not insert `warehouse_supplies`. A company warehouse (`venueId` null) or a warehouse of that venue counts as linked.
6. The print voucher is accepted without a transfer printer queue. `PendingTransferVoucher.print` returns immediately. The use-case draft still carries document `transfer`, the transfer id, and the lines.
7. Admin no longer mounts the static transfer list or the print prototype. `TransfersScreen` and `TransferDetailScreen` render the request, dispatch, and QR receipt form. Purchase and production screens still passed (admin purchase 5, production 6, venue receive 6, inside the 19 and 14). `TransfersView` and `TransferDetailView` remain in `inventory-view.tsx` and are not mounted.
8. This run did not execute the in-memory transfer contract, typecheck, lint, or architecture. The PGlite contract passed, including the blended average, tenant isolation, and rollback. No failure came from the files other agents are writing.

**SUGGESTION**:

- The unregistered-device test posts a request. Dispatch and receipt use the same session actor check, and that scan path is not a separate HTTP case.
- The suggestion is computed when asked. It is not fired by a balance change, and it does not create the transfer. Roadmap 2.8 still owns alerts.

### Archive

Archive is not allowed. This run does not archive and does not start archive.

`depends_on` includes `p2-02-sale-consumption` and `p2-03-purchasing`.

- `p2-02-sale-consumption` is at `openspec/changes/p2-02-sale-consumption`, with `status: applied`, `artifacts.verify: fail`, and `archive: pending`.
- `p2-03-purchasing` is at `openspec/changes/p2-03-purchasing`, with `status: applied`, `artifacts.verify: pass`, and `archive: pending`. It is not archived.

Archive stays blocked until those two are archived. `p0-03-organization`, `p0-04-identity-and-devices`, `p0-05-roles-and-permissions`, and `p1-06-printing` are already under `openspec/changes/archive`. `p0-07-hybrid-resilience` is still `status: specified` and is not archived.

### Verdict

PASS WITH WARNINGS

25/25 tasks are checked. The five allowed test commands exited 0: 95 tests passed (52 inventory, 2 platform, 8 HTTP, 19 admin, 14 venue). 11/17 spec scenarios are compliant from tests that passed in this run. Six hybrid scenarios are design-deferred and are warnings. No CRITICAL spec miss. No product source was modified.
