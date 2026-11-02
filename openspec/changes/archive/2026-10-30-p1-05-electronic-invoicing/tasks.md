# Tasks: Electronic Invoicing

## Review Workload Forecast

2400–3600 lines. ask-on-risk. Test: `pnpm vitest run --project <filter>`.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Cloud only (D-37). Threats N/A. `no_balance` only. Not `FactusSimulator`. `entry-port.ts` only. Imports-first. Skip Deferred+cash.

Unit = goal, PR, filter, harness, rollback.

1. Document. PR1. invoicing sales-document. N/A:domain. `sales-document.ts`
2. Content. PR2. invoicing document-content. N/A:domain. `document-content.ts`
3. Issue. PR3. invoicing issue-document. N/A:memory. `issue-document/`
4. Uncertain. PR4. invoicing verify-issuance. N/A:memory. `verify-issuance/`
5. Buyer. PR5. invoicing attach-buyer. N/A:memory. `attach-buyer/`
6. Credit note. PR6. invoicing issue-credit-note. N/A:memory. `issue-credit-note/`
7. Balance. PR7. invoicing document-balance. N/A:memory. `document-balance/`
8. Gate. PR8. invoicing issuance-gate. N/A:memory. `issuance-gate/`
9. Store. PR9. invoicing adapters/memory adapters/postgres. N/A:PGlite. `0011_electronic_invoicing.sql`
10. Factus. PR10. invoicing adapters/factus. N/A:recorded-HTTP. `#adapters/factus`
11. Cloud. PR11. api-cloud invoicing. N/A:inject. controller+worker
12. Node. PR12. local-node invoicing.controller skeleton. N/A:inject. node-controller

## 1. Domain

- [x] 1.1 RED `sales-document.test.ts`: one closure; repeat returns it. Statuses `generated|sending|accepted|rejected|pending_issuance|uncertain`. UUIDv7. Buyer `13`, `222222222222`, Consumidor final, `R-99-PN`, taxpayer email. Bad modulus-11 fails.
- [x] 1.2 GREEN `sales-document.ts`, `index.ts`. No Nest/SQL/Zod/Factus/crypto.
- [x] 1.3 RED `document-content.test.ts`: cash=10, card=48, transfer/wallet=47, voucher=72, credit=ZZZ form 2, else form 1. Tip `03`/`propina` off 100000+10000. Excluded: no code. Exempt 01 at 0. Register range else site. No channel, bags, 49.
- [x] 1.4 GREEN `document-content.ts` from `CalculateTaxes`.

## 2. Use cases

- [x] 2.1 RED `issue-document.test.ts`: queued closure; tax lines and sale total, no tip. Zero balance `pending_issuance`/`no_balance`, no validate. Repeat returns it.
- [x] 2.2 GREEN `issue-document.ts`, `queued-closure-reader`, `sales-document-repository`, `invoicing-provider`.
- [x] 2.3 RED `verify-issuance.test.ts`: empty→`uncertain`. Validated keeps number+CUFE. Pending `deleteAttempt`, same reference. Missing resends. Failed query backs off. Rejection alerts, new reference.
- [x] 2.4 GREEN `verify-issuance.ts`.
- [x] 2.5 RED `attach-buyer.test.ts`: lookup returns name+email. Else GenericBuyer. Bad digit blocks. No email column.
- [x] 2.6 GREEN `attach-buyer.ts`.
- [x] 2.7 RED `issue-credit-note.test.ts`: cites the original. Missing `sale.credit-note` sends nothing. Audit after save.
- [x] 2.8 GREEN `issue-credit-note.ts` reusing `PERMISSION.SALE_CREDIT_NOTE`.
- [x] 2.9 RED `document-balance.test.ts`: +1 per company/NIT/site. Days=remaining/pace. 0:no-color. <15 yellow. <5 red. `SetDocumentBalance` sets remaining.
- [x] 2.10 GREEN `document-balance.ts`.
- [x] 2.11 RED `issuance-gate.test.ts`: 80/min first. Same-range validate waits. Other ranges may run.
- [x] 2.12 GREEN `issuance-gate.ts` via `ProviderRateGate`.

## 3. Adapters

- [x] 3.1 RED memory+PGlite: round-trip, hidden tenant, one row, forced RLS. No mock/SQLite.
- [x] 3.2 GREEN repos, `0011_electronic_invoicing.sql`, `schema.ts`. Reuse `invoicing_app`.
- [x] 3.3 RED `factus-invoicing-provider.test.ts`: validate, findByReference, deleteAttempt, lookupAcquirer, validateCreditNote. JSON in ACL. Host passes Secrets.
- [x] 3.4 GREEN `#adapters/factus`. Import first.

## 4. Cloud

- [x] 4.1 RED `invoicing.controller.test.ts`: inject, `x-session-id`, prefix `/tenants/:tenantId/venues/:venueId`. `sale.charge` on lookup+buyer. `tax.configure` on balance+ranges. `sale.credit-note` on notes. 200; 403/400 store nothing. `z.email()`, strict, no `z.any()`.
- [x] 4.2 GREEN `shared/contracts/e-invoicing.ts`, controller, `safeParse`, `application-module.ts`. Paths `acquirers/lookup`, `closures/:closureId/buyer`, `document-balance`, `numbering-ranges`, `credit-notes`.
- [x] 4.3 RED `issue-document.worker.test.ts`: read `queued`, `CalculateTaxes`, `InvoicingProvider`.
- [x] 4.4 GREEN beside `startWorker`. Keep 0.9.

## 5. Node

- [x] 5.1 RED `apps/local-node/test/http/invoicing.controller.test.ts`: same routes, 403 `InvoicingRejected`, nothing stored.
- [x] 5.2 GREEN `src/http/invoicing.controller.ts`. No import/store.
- [x] 5.3 Allow it in `tools/skeleton/skeleton.test.ts`.

## 6. Correction

Cloud only. PR 13 of the feature-branch chain. Targets the node slice, not main. `IssuanceGate` stays out.

- [x] 6.1 Typecheck: await the Factus rejection callbacks so they return void. Include `e-invoicing.ts` in `shared/contracts/tsconfig.json`.
- [x] 6.2 RED: a closed sale with a working provider delivers number, CUFE, and QR. The worker saves through `IssueDocument`; a second run returns the stored document and does not validate again.
- [x] 6.3 GREEN: persist number, CUFE, and QR from the validate result. Register `IssueDocument` with a configurable provider. Keep the 0.9 probe. Zero balance stays `pending_issuance` / `no_balance` without those fields.
