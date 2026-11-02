# Apply progress: p1-05-electronic-invoicing

Work unit 1. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 1, the base of the invoicing chain, and stops at tasks 1.1–1.2. Not committed. `size:exception` was not granted.

## Completed tasks

- [x] 1.1 RED `sales-document.test.ts`: one closure; repeat returns it. Statuses `generated|sending|accepted|rejected|pending_issuance|uncertain`. UUIDv7. Buyer `13`, `222222222222`, Consumidor final, `R-99-PN`, taxpayer email. Bad modulus-11 fails.
- [x] 1.2 GREEN `sales-document.ts`, `index.ts`. No Nest/SQL/Zod/Factus/crypto.
- [x] 1.3 RED `document-content.test.ts`: cash=10, card=48, transfer/wallet=47, voucher=72, credit=ZZZ form 2, else form 1. Tip `03`/`propina` off 100000+10000. Excluded: no code. Exempt 01 at 0. Register range else site. No channel, bags, 49.
- [x] 1.4 GREEN `document-content.ts` from `CalculateTaxes`.

## Work Unit Evidence

### Unit 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing sales-document` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. The run is after `pnpm biome check --write` on the touched domain files. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `createSalesDocument` and `assertNitCheckDigit` do not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/domain/sales-document.ts`, `contexts/invoicing/domain/sales-document.test.ts`, and the `sales-document` exports in `contexts/invoicing/domain/index.ts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm vitest run --project invoicing sales-document` exit 1. `FAIL contexts/invoicing/domain/sales-document.test.ts` — `Cannot find module '#domain/sales-document.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/sales-document.ts`, the `domain/index.ts` export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |

## Deviations from Design

None for this unit. `createSalesDocument` returns the recorded document for the same closure id and does not replace its UUIDv7. A different closure gets its own document. The reference is supplied by the caller and must be a lowercase UUIDv7; a version-4 UUID throws `InvalidReferenceCode`. There is no `node:crypto` generator.

`pending_issuance` is only a status value here. The `no_balance` reason stays with task 2.1. Sale date, `validated_at`, and buyer attachment stay with later tasks. `assertNitCheckDigit` rejects a bad modulus-11 digit and accepts a valid one, including remainder 0 and remainder 1. The generic buyer is document type `13` and is not passed through that check.

## Issues Found

None.

## Remaining Tasks

- [ ] 2.1 RED `issue-document.test.ts`
- [ ] 2.2 onward

## Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 1. Document. PR 1
- Boundary: tasks 1.1 and 1.2 only
- Files: `contexts/invoicing/domain/sales-document.test.ts`, `contexts/invoicing/domain/sales-document.ts`, `contexts/invoicing/domain/index.ts`, `openspec/changes/p1-05-electronic-invoicing/tasks.md`, `openspec/changes/p1-05-electronic-invoicing/apply-progress.md`
- Estimated review budget impact: this slice is well under 400 lines. The change forecast stays High.

## Work unit 2

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 2 of the invoicing chain. It starts after tasks 1.1–1.2 and stops at tasks 1.3–1.4. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 1.3 RED `document-content.test.ts`: cash=10, card=48, transfer/wallet=47, voucher=72, credit=ZZZ form 2, else form 1. Tip `03`/`propina` off 100000+10000. Excluded: no code. Exempt 01 at 0. Register range else site. No channel, bags, 49.
- [x] 1.4 GREEN `document-content.ts` from `CalculateTaxes`.

### Work Unit Evidence

#### Unit 2

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing document-content` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. The run is after `pnpm biome check --write` on the touched domain files. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `createDocumentContent` calls `calculateTaxes` in memory and does not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/domain/document-content.ts`, `contexts/invoicing/domain/document-content.test.ts`, and the `document-content` exports in `contexts/invoicing/domain/index.ts`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.3 → 1.4 | `pnpm vitest run --project invoicing document-content` exit 1. `FAIL contexts/invoicing/domain/document-content.test.ts` — `Cannot find module '#domain/document-content.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/document-content.ts`, the `domain/index.ts` export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |

### Deviations from Design

None for this unit. Payment codes are cash `10`, card `48`, transfer and wallet `47`, voucher `72`, credit `ZZZ` with form `2`. Every other method uses form `1`. There is no code `49`. The 100000 sale with a 10000 tip keeps the tip as surcharge `03` / `propina`, and `calculateTaxes` sees only the 100000 sale. An `is_excluded` marker is sent to `calculateTaxes` with no tax components, so the line keeps its price and carries no tax code. Exempt stays code `01` at amount 0. The numbering range is the register range when present, otherwise the site range. The call does not pass channel, bag count, or delivery bags, and the content has no bag line.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 2. Content. PR 2
- Boundary: tasks 1.3 and 1.4 only
- Files: `contexts/invoicing/domain/document-content.test.ts`, `contexts/invoicing/domain/document-content.ts`, `contexts/invoicing/domain/index.ts`, `openspec/changes/p1-05-electronic-invoicing/tasks.md`, `openspec/changes/p1-05-electronic-invoicing/apply-progress.md`
- Estimated review budget impact: this slice stays under 400 lines. The change forecast stays High.

## Work unit 3

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 3 of the invoicing chain. It starts after tasks 1.1–1.4 and stops at tasks 2.1–2.2. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 2.1 RED `issue-document.test.ts`: queued closure; tax lines and sale total, no tip. Zero balance `pending_issuance`/`no_balance`, no validate. Repeat returns it.
- [x] 2.2 GREEN `issue-document.ts`, `queued-closure-reader`, `sales-document-repository`, `invoicing-provider`.

### Work Unit Evidence

#### Unit 3

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing issue-document` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm biome check --write` on the touched application files. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `IssueDocument` runs against in-test memory adapters and does not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/application/issue-document/issue-document.ts`, `contexts/invoicing/application/issue-document/issue-document.test.ts`, `contexts/invoicing/application/ports/queued-closure-reader.ts`, `contexts/invoicing/application/ports/sales-document-repository.ts`, `contexts/invoicing/application/ports/invoicing-provider.ts`, and the `#application/issue-document/*` import in `contexts/invoicing/package.json`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.1 → 2.2 | `pnpm vitest run --project invoicing issue-document` exit 1. `FAIL contexts/invoicing/application/issue-document/issue-document.test.ts` — `Cannot find module '#application/ports/queued-closure-reader.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, the three ports, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |

### Deviations from Design

The tax call uses the domain `calculateTaxes` function with the closure lines and `paidCop` set to the sale total. Channel, bag count, and the tip are not arguments. The application `CalculateTaxes` class requires a channel and bag flags, so this unit does not call that class. `createDocumentContent` still builds the surcharge `03` / `propina` from the tip.

`InvoicingProvider` exposes `validate` only. `findByReference`, `deleteAttempt`, `lookupAcquirer`, and `validateCreditNote` stay with later tasks. A positive document balance calls `validate` and stores the generated document with a null hold reason. The provider returns no outcome, so the status stays `generated`. The rate gate is task 2.11. Zero balance does not call `validate`.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 3. Issue. PR 3
- Boundary: tasks 2.1 and 2.2 only
- Files: `contexts/invoicing/application/issue-document/issue-document.test.ts`, `contexts/invoicing/application/issue-document/issue-document.ts`, `contexts/invoicing/application/ports/queued-closure-reader.ts`, `contexts/invoicing/application/ports/sales-document-repository.ts`, `contexts/invoicing/application/ports/invoicing-provider.ts`, `contexts/invoicing/package.json`, `openspec/changes/p1-05-electronic-invoicing/tasks.md`, `openspec/changes/p1-05-electronic-invoicing/apply-progress.md`
- Estimated review budget impact: this slice stays under 400 lines. The change forecast stays High.

## Work unit 4

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 4 of the invoicing chain. It starts after tasks 1.1–2.2 and stops at tasks 2.3–2.4. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 2.3 RED `verify-issuance.test.ts`: empty→`uncertain`. Validated keeps number+CUFE. Pending `deleteAttempt`, same reference. Missing resends. Failed query backs off. Rejection alerts, new reference.
- [x] 2.4 GREEN `verify-issuance.ts`.

### Work Unit Evidence

#### Unit 4

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing verify-issuance` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. The run is after `pnpm biome check --write` on the touched application files. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `VerifyIssuance` runs against in-test memory adapters and does not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/application/verify-issuance/verify-issuance.ts`, `contexts/invoicing/application/verify-issuance/verify-issuance.test.ts`, the lookup types plus `findByReference` and `deleteAttempt` on `contexts/invoicing/application/ports/invoicing-provider.ts` (`validate` stays), and the `#application/verify-issuance/*` import in `contexts/invoicing/package.json`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.3 → 2.4 | `pnpm vitest run --project invoicing verify-issuance` exit 1. `FAIL contexts/invoicing/application/verify-issuance/verify-issuance.test.ts` — `Cannot find module '#application/verify-issuance/verify-issuance.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `verify-issuance.ts`, the provider lookup methods, the import map, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |

### Deviations from Design

Number and CUFE are fields of `VerifiedIssuance`. `SalesDocument` has neither field, and that domain file was outside this unit. A validated lookup sets status `accepted` and follow-up `none`. A resend sets status `sending`. An empty lookup and a failed query set status `uncertain`.

`findByReference` and `deleteAttempt` are concrete methods that reject with `ReferenceQueryFailed`. `validate` stays `Promise<void>`, so the issue-document memory provider still typechecks. `lookupAcquirer` and `validateCreditNote` stay with later tasks.

`RejectionAlert` lives in `verify-issuance.ts`. A new file under `application/ports/` was outside the allowed roots. The use case returns the outcome and does not save it. `SalesDocumentRepository` has no update, and that port was outside the allowed roots.

An empty provider response is the lookup outcome `empty`. A failed query is `ReferenceQueryFailed`, which sets follow-up `backoff` and does not resend. No delay duration was added. Rejection builds the replacement with `createSalesDocument` so the new reference stays a UUIDv7, raises the alert for the old reference, then calls `validate` with the new reference. Pending calls `deleteAttempt` and then `validate` on the same reference. Missing calls `validate` on the same reference and does not delete.

`contexts/invoicing/package.json` gained `#application/verify-issuance/*`. The alias rule requires that import, and the file was outside the listed roots. The `#application/issue-document/*` line was already in the working tree from unit 3.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 4. Uncertain. PR 4
- Boundary: tasks 2.3 and 2.4 only
- Files: `contexts/invoicing/application/verify-issuance/verify-issuance.test.ts`, `contexts/invoicing/application/verify-issuance/verify-issuance.ts`, `contexts/invoicing/application/ports/invoicing-provider.ts`, `contexts/invoicing/package.json`, `openspec/changes/p1-05-electronic-invoicing/tasks.md`, `openspec/changes/p1-05-electronic-invoicing/apply-progress.md`
- Estimated review budget impact: about 410 lines (233 test, 125 use case, the lookup methods on the provider, one import). Just over the 400-line budget. The assigned unit was not split. The change forecast stays High.

## Work unit 5

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 5 of the invoicing chain. It starts after tasks 1.1–2.4 and stops at tasks 2.5–2.6. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 2.5 RED `attach-buyer.test.ts`: lookup returns name+email. Else GenericBuyer. Bad digit blocks. No email column.
- [x] 2.6 GREEN `attach-buyer.ts`.

### Work Unit Evidence

#### Unit 5

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing attach-buyer` — exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. The run is after `pnpm biome check --write` on the touched application files. A later `pnpm biome check` on those files applied no further fixes. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `AttachBuyer` runs against an in-test memory provider and does not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/application/attach-buyer/attach-buyer.ts`, `contexts/invoicing/application/attach-buyer/attach-buyer.test.ts`, the acquirer lookup types plus `lookupAcquirer` on `contexts/invoicing/application/ports/invoicing-provider.ts` (`validate`, `findByReference`, and `deleteAttempt` stay), and the `#application/attach-buyer/*` import in `contexts/invoicing/package.json`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.5 → 2.6 | `pnpm vitest run --project invoicing attach-buyer` exit 1. `FAIL contexts/invoicing/application/attach-buyer/attach-buyer.test.ts` — `Missing "#application/attach-buyer/attach-buyer.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `attach-buyer.ts`, `lookupAcquirer` on the provider, the import map, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. |

### Deviations from Design

The NIT document code is `31`. An ID card stays `13` and is not passed through modulus-11. Only `31` calls `assertNitCheckDigit`. A cédula lookup is the same path and has no separate test.

A found lookup returns name and email. The stored buyer for that path is document type, document number, and name. It has no email property. An empty lookup, or a command without a document, returns `GenericBuyer`: `13` / `222222222222` / Consumidor final / `R-99-PN` / the taxpayer email from the command. That email is the value object, not a new column. The fiscal profile is not read.

`lookupAcquirer` is a concrete method that rejects with `AcquirerLookupFailed`. `validate`, `findByReference`, and `deleteAttempt` are unchanged. There is no repository update: `SalesDocumentRepository` was outside this unit, so nothing is written to a buyer row.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 5. Buyer. PR 5
- Boundary: tasks 2.5 and 2.6 only
- Files: `contexts/invoicing/application/attach-buyer/attach-buyer.test.ts`, `contexts/invoicing/application/attach-buyer/attach-buyer.ts`, `contexts/invoicing/application/ports/invoicing-provider.ts`, `contexts/invoicing/package.json`, `openspec/changes/p1-05-electronic-invoicing/tasks.md`, `openspec/changes/p1-05-electronic-invoicing/apply-progress.md`
- Estimated review budget impact: about 320 lines. Under the 400-line budget. The change forecast stays High.

## Work unit 6

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 6 of the invoicing chain. It starts after tasks 1.1–2.6 and stops at tasks 2.7–2.8. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 2.7 RED `issue-credit-note.test.ts`: cites the original. Missing `sale.credit-note` sends nothing. Audit after save.
- [x] 2.8 GREEN `issue-credit-note.ts` reusing `PERMISSION.SALE_CREDIT_NOTE`.

### Work Unit Evidence

#### Unit 6

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing issue-credit-note` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm biome check --write` on the touched files. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `IssueCreditNote` runs against in-test memory adapters and does not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/application/issue-credit-note/issue-credit-note.ts`, `contexts/invoicing/application/issue-credit-note/issue-credit-note.test.ts`, `contexts/invoicing/application/ports/credit-note-audit.ts`, `validateCreditNote` on `contexts/invoicing/application/ports/invoicing-provider.ts` (`validate`, `findByReference`, `deleteAttempt`, and `lookupAcquirer` stay), the `PERMISSION` re-export in `contexts/platform/application/entry-port.ts`, the `@blackhole/platform` dependency plus `#application/issue-credit-note/*` in `contexts/invoicing/package.json`, and the platform project reference in `contexts/invoicing/tsconfig.json`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.7 → 2.8 | `pnpm vitest run --project invoicing issue-credit-note` exit 1. `FAIL contexts/invoicing/application/issue-credit-note/issue-credit-note.test.ts` — `Missing "#application/issue-credit-note/issue-credit-note.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `issue-credit-note.ts`, the audit port, `validateCreditNote`, the `PERMISSION` re-export, the import map, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |

### Deviations from Design

`PERMISSION` is re-exported from `#domain/permission-catalog.js` through `contexts/platform/application/entry-port.ts`. The catalog and `contexts/platform/domain/index.ts` were not edited. Invoicing imports `PERMISSION` from `@blackhole/platform/application/entry-port`.

`CreditNoteRepository` lives in `issue-credit-note.ts`. The new port file is `credit-note-audit.ts`. A missing `sale.credit-note` returns `{ outcome: "denied" }` and does not call `validate`, `validateCreditNote`, `insert`, or `record`. An issued note copies `originalReferenceCode` from the original sales document and does not write that document. `validateCreditNote` then `insert` then `record`. A failed insert leaves the audit empty. `validateCreditNote` rejects with `CreditNoteValidationFailed` unless overridden. `validate`, `findByReference`, `deleteAttempt`, and `lookupAcquirer` are unchanged.

`pnpm-lock.yaml` records the new `@blackhole/platform` workspace link under `contexts/invoicing`. That file was outside the allowed roots. The unrelated telemetry lines already in the working tree were left in place.

dependency-cruiser on the use case and the platform entry port exited 0: `no dependency violations found (42 modules, 81 dependencies cruised)`. No extra file was required. The known TypeScript 7 transpiler warning remains.

### Issues Found

None. `pnpm vitest run --project invoicing issue-document verify-issuance attach-buyer` after the provider change: exit 0. `Test Files  3 passed (3)`. `Tests  15 passed (15)`.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 6. Credit note. PR 6
- Boundary: tasks 2.7 and 2.8 only. Starts after tasks 1.1–2.6. Does not include 2.9.
- Files: `contexts/invoicing/application/issue-credit-note/issue-credit-note.test.ts`, `contexts/invoicing/application/issue-credit-note/issue-credit-note.ts`, `contexts/invoicing/application/ports/credit-note-audit.ts`, `contexts/invoicing/application/ports/invoicing-provider.ts`, `contexts/platform/application/entry-port.ts`, `contexts/invoicing/package.json`, `contexts/invoicing/tsconfig.json`, `pnpm-lock.yaml` (workspace link only), `openspec/changes/p1-05-electronic-invoicing/tasks.md`, `openspec/changes/p1-05-electronic-invoicing/apply-progress.md`
- Estimated review budget impact: about 340 lines. Under the 400-line budget. The change forecast stays High.

## Work unit 7

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 7 of the invoicing chain. It starts after tasks 1.1–2.8 and stops at tasks 2.9–2.10. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 2.9 RED `document-balance.test.ts`: +1 per company/NIT/site. Days=remaining/pace. 0:no-color. <15 yellow. <5 red. `SetDocumentBalance` sets remaining.
- [x] 2.10 GREEN `document-balance.ts`.

### Work Unit Evidence

#### Unit 7

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing document-balance` — exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. The run is after `pnpm biome check --write` on the touched files. `pnpm exec tsc -b contexts/invoicing` exit 0. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `SetDocumentBalance` and `CountDocumentAcceptance` run against in-test memory adapters and do not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/application/document-balance/document-balance.ts`, `contexts/invoicing/application/document-balance/document-balance.test.ts`, and the `#application/document-balance/*` import in `contexts/invoicing/package.json`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.9 → 2.10 | `pnpm vitest run --project invoicing document-balance` exit 1. `FAIL contexts/invoicing/application/document-balance/document-balance.test.ts` — `Missing "#application/document-balance/document-balance.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `document-balance.ts`, the import map, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |

### Deviations from Design

None for this unit. One acceptance adds 1 to the company, 1 to the NIT, and 1 to the site. A second site of the same company and NIT increments the company and the NIT again and starts its own site count at 1. `SetDocumentBalance` stores the opening remaining for that company, NIT, and site and does not change those counts. Counting does not change remaining. Days are `remaining / pace`. Pace 0 leaves days unset, keeps the color empty, and still counts. Under 5 days is red. Under 15 and not under 5 is yellow, so 5 days is yellow and 15 days has no color. Yellow and red each raise one alert to the company admin and support. No Nest, SQL, Zod, or Factus JSON.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 7. Balance. PR 7
- Boundary: tasks 2.9 and 2.10 only. Starts after tasks 1.1–2.8. Does not include 2.11.
- Files: `contexts/invoicing/application/document-balance/document-balance.test.ts`, `contexts/invoicing/application/document-balance/document-balance.ts`, `contexts/invoicing/package.json`, `openspec/changes/p1-05-electronic-invoicing/tasks.md`, `openspec/changes/p1-05-electronic-invoicing/apply-progress.md`
- Estimated review budget impact: 406 lines (225 test, 180 use case, one import). Just over the 400-line budget. The assigned unit was not split. The change forecast stays High.

## Work unit 8

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 8 of the invoicing chain. It starts after tasks 1.1–2.10 and stops at tasks 2.11–2.12. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 2.11 RED `issuance-gate.test.ts`: 80/min first. Same-range validate waits. Other ranges may run.
- [x] 2.12 GREEN `issuance-gate.ts` via `ProviderRateGate`.

### Work Unit Evidence

#### Unit 8

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing issuance-gate` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. The run is after `pnpm biome check --write` on the touched files. `pnpm exec tsc -b contexts/invoicing` exit 0. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `IssuanceGate` runs against an in-test memory `ProviderRateGate` and an in-test memory `InvoicingProvider`. It does not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/application/issuance-gate/issuance-gate.ts`, `contexts/invoicing/application/issuance-gate/issuance-gate.test.ts`, the `ProviderRateGate` re-export in `contexts/platform/application/entry-port.ts`, and the `#application/issuance-gate/*` import in `contexts/invoicing/package.json`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.11 → 2.12 | `pnpm vitest run --project invoicing issuance-gate` exit 1. `FAIL contexts/invoicing/application/issuance-gate/issuance-gate.test.ts` — `Missing "#application/issuance-gate/issuance-gate.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `issuance-gate.ts`, the `ProviderRateGate` re-export, the import map, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

### Deviations from Design

None for this unit. `IssuanceGate` calls `ProviderRateGate.acquire` before the per-range lock and before `validate`. A refusal returns `{ outcome: "waiting", retryAfterSeconds }` from the gate and does not validate, including when the numbering range is different. A second validate on the same range also acquires first, then stays pending until the in-flight validate finishes, and then validates. Two ranges of the same NIT validate together while both acquires are allowed. The test's memory gate allows 80 requests per NIT per minute. No Nest, SQL, Zod, or Factus JSON.

`ProviderRateGate` is re-exported from `contexts/platform/application/entry-port.ts`. The gate class, the Drizzle adapter, and the in-memory adapter were not edited. Invoicing imports the class from `@blackhole/platform/application/entry-port`. The use case imports it as a type. The test extends it.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 8. Gate. PR 8
- Boundary: tasks 2.11 and 2.12 only. Starts after tasks 1.1–2.10. Does not include 3.1.
- Files: `contexts/invoicing/application/issuance-gate/issuance-gate.test.ts`, `contexts/invoicing/application/issuance-gate/issuance-gate.ts`, `contexts/platform/application/entry-port.ts` (re-export only), `contexts/invoicing/package.json` (one import), `openspec/changes/p1-05-electronic-invoicing/tasks.md`, `openspec/changes/p1-05-electronic-invoicing/apply-progress.md`
- Estimated review budget impact: about 265 lines (190 test, 73 use case, one re-export, one import). Under the 400-line budget. The change forecast stays High.

## Work unit 9

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 9 of the invoicing chain. It starts after tasks 1.1–2.12 and stops at tasks 3.1–3.2. Not committed. `size:exception` was not granted. The pair was not split.

### Completed tasks

- [x] 3.1 RED memory+PGlite: round-trip, hidden tenant, one row, forced RLS. No mock/SQLite.
- [x] 3.2 GREEN repos, `0011_electronic_invoicing.sql`, `schema.ts`. Reuse `invoicing_app`.

### Work Unit Evidence

#### Unit 9

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing adapters/memory adapters/postgres` — exit 0. `Test Files  6 passed (6)`. `Tests  53 passed (53)`. The run is after `pnpm biome check --write` on the touched files and after `pnpm exec tsc -b contexts/invoicing` exit 0. |
| Runtime harness command/scenario and exact result | The same command opens PGlite, applies `0009_tax.sql` then `0011_electronic_invoicing.sql`, and checks forced RLS plus refused UPDATE, DELETE, and TRUNCATE. Exit 0. |
| Rollback boundary | `contexts/invoicing/application/ports/sales-document-repository.contract.ts`, `contexts/invoicing/adapters/memory/in-memory-sales-document-repository.ts`, `contexts/invoicing/adapters/memory/in-memory-sales-document-repository.contract.test.ts`, `contexts/invoicing/adapters/postgres/drizzle-sales-document-repository.ts`, `contexts/invoicing/adapters/postgres/drizzle-sales-document-repository.contract.test.ts`, `contexts/invoicing/adapters/postgres/0011_electronic_invoicing.sql`, the `salesDocuments` table in `contexts/invoicing/adapters/postgres/schema.ts`, and `SALES_DOCUMENT_DUPLICATE` in `contexts/invoicing/application/ports/sales-document-repository.ts`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.1 → 3.2 | `pnpm vitest run --project invoicing adapters/memory adapters/postgres` exit 1. `FAIL` both new suites — `Cannot find module '#adapters/memory/in-memory-sales-document-repository.js'` and `Cannot find module '#adapters/postgres/drizzle-sales-document-repository.js'`. `Test Files  2 failed | 4 passed (6)`. `Tests  38 passed (38)`. | Same command after the repositories, `0011_electronic_invoicing.sql`, `schema.ts`, Biome, and the contract type fix: exit 0. `Test Files  6 passed (6)`. `Tests  53 passed (53)`. |

### Deviations from Design

`0011_electronic_invoicing.sql` was free. Cash register already owns `0010`. This migration does not create a role. It reuses `invoicing_app` and `invoicing_reject_mutation()` from `0009_tax.sql`. The PGlite test applies `0009` first.

The tenant is bound on the repository constructor. `findByClosureId` and `insert` do not take a tenant. The returned document has no `tenantId`. The Drizzle query filters by closure id only; forced RLS hides the other tenant. One `sales_documents` row per tenant and closure, with buyer and content in jsonb. A second insert of that closure throws `SALES_DOCUMENT_DUPLICATE` and leaves the first row. UPDATE, DELETE, and TRUNCATE hit the same append-only trigger as `tax_rules`. The grant is `SELECT, INSERT`.

Credit notes and document balances stay on the ports that already live in their use-case files. This unit does not edit those use cases, so `0011` does not add their tables.

No Nest and no Factus JSON. `package.json` already mapped `#adapters/memory/*` and `#adapters/postgres/*`.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 9. Store. PR 9
- Boundary: tasks 3.1 and 3.2 only. Starts after tasks 1.1–2.12. Does not include 3.3.
- Target: the previous invoicing PR branch, not `main`.
- Files: the contract, both repositories, both contract tests, `0011_electronic_invoicing.sql`, `schema.ts`, `SALES_DOCUMENT_DUPLICATE` on the existing sales-document port, `tasks.md`, `apply-progress.md`
- Estimated review budget impact: about 600 changed lines. Over the 400-line budget. The assigned RED/GREEN pair was not split. The change forecast stays High.

## Work unit 10

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 10 of the invoicing chain. It starts after tasks 1.1–3.2 and stops at tasks 3.3–3.4. Not committed. `size:exception` was not granted. The pair was not split.

### Completed tasks

- [x] 3.3 RED `factus-invoicing-provider.test.ts`: validate, findByReference, deleteAttempt, lookupAcquirer, validateCreditNote. JSON in ACL. Host passes Secrets.
- [x] 3.4 GREEN `#adapters/factus`. Import first.

### Work Unit Evidence

#### Unit 10

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing factus-invoicing-provider` — exit 0. `Test Files  1 passed (1)`. `Tests  15 passed (15)`. Re-run after `pnpm exec biome check --write` on the touched files, still exit 0. |
| Runtime harness command/scenario and exact result | The same command is the recorded-HTTP harness. `fetch` is replaced with recorded responses. No live Factus and no Nest. Exit 0. |
| Rollback boundary | `contexts/invoicing/adapters/factus/factus-invoicing-provider.ts`, `contexts/invoicing/adapters/factus/factus-invoicing-provider.test.ts`, the `#adapters/factus/*` import in `contexts/invoicing/package.json`, and the `Secrets` re-export in `contexts/platform/application/entry-port.ts`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.3 → 3.4 | `pnpm vitest run --project invoicing factus-invoicing-provider` exit 1. `FAIL` the new suite — `Missing "#adapters/factus/factus-invoicing-provider.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the adapter, the `#adapters/factus/*` import, the `Secrets` re-export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  15 passed (15)`. |

### Deviations from Design

`InvoiceValidation` only carries `referenceCode`, and `CreditNoteValidation` only carries the two reference codes. The anti-corruption layer maps those fields to Factus JSON and does not invent items, customer, payments, or a numbering range. `POST /v2/bills/validate` sends `document: "01"` and `reference_code`. `POST /v2/credit-notes/validate` sends `reference_code`, `correction_concept_code: "2"`, `customization_id: "20"`, and `bill_number`. `bill_number` receives `originalReferenceCode` because the port has no printed bill number.

Inbound JSON stays in the adapter. A list item with `status` 1 becomes validated and keeps `number` and `cufe`. `status` 0 is pending. An empty `data.data` array is missing. `data: null` is empty. An `errors` value containing `rechazo` is rejected. `GET /v2/dian/acquirer` maps `identification_document_code` and `identification_number` to `name` and `email`.

The host passes `Secrets`. The adapter reads `factus.base-url`, `factus.client-id`, `factus.client-secret`, `factus.username`, and `factus.password`. It does not read environment variables. OAuth is `POST /oauth/token` with `grant_type=password`. The HTTP client is `fetch`. No new npm dependency.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 10. Factus. PR 10
- Boundary: tasks 3.3 and 3.4 only. Starts after tasks 1.1–3.2. Does not include 4.1.
- Target: the previous invoicing PR branch, not `main`.
- Files: `contexts/invoicing/adapters/factus/factus-invoicing-provider.ts`, `contexts/invoicing/adapters/factus/factus-invoicing-provider.test.ts`, `#adapters/factus/*` in `contexts/invoicing/package.json`, `Secrets` re-export in `contexts/platform/application/entry-port.ts`, `tasks.md`, `apply-progress.md`
- Estimated review budget impact: about 803 changed lines (356 adapter, 443 test, 2 package-import, 1 re-export, 1 replaced comma). Over the 400-line budget. The assigned RED/GREEN pair was not split. The change forecast stays High.

## Work unit 11

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is the HTTP half of PR 11. It starts after tasks 1.1–3.4 and stops at tasks 4.1–4.2. Tasks 4.3 and 4.4 stay open. Not committed. `size:exception` was not granted. The HTTP pair was not split from itself. The worker was left out.

### Completed tasks

- [x] 4.1 RED `invoicing.controller.test.ts`: inject, `x-session-id`, prefix `/tenants/:tenantId/venues/:venueId`. `sale.charge` on lookup+buyer. `tax.configure` on balance+ranges. `sale.credit-note` on notes. 200; 403/400 store nothing. `z.email()`, strict, no `z.any()`.
- [x] 4.2 GREEN `shared/contracts/e-invoicing.ts`, controller, `safeParse`, `application-module.ts`. Paths `acquirers/lookup`, `closures/:closureId/buyer`, `document-balance`, `numbering-ranges`, `credit-notes`.

### Work Unit Evidence

#### Unit 11

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud invoicing.controller` — exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. The run is after `pnpm exec biome check --write` on the touched files. |
| Runtime harness command/scenario and exact result | The same command boots Nest through `createApplication` (`FastifyAdapter` + `init`) and calls `inject`. No `listen`. Exit 0. |
| Rollback boundary | `apps/api-cloud/test/http/invoicing.controller.test.ts`, `apps/api-cloud/src/http/invoicing.controller.ts`, the invoicing providers and memory stores added to `apps/api-cloud/src/composition/application-module.ts`, `shared/contracts/e-invoicing.ts`, the e-invoicing export in `shared/contracts/index.ts`, and the invoicing re-exports in `contexts/invoicing/application/entry-port.ts`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.1 → 4.2 | `pnpm exec vitest run --project api-cloud invoicing.controller` exit 1. `FAIL apps/api-cloud/test/http/invoicing.controller.test.ts` — `Cannot find module '#src/http/invoicing.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the contract, controller, composition providers, entry-port re-exports, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |

### Deviations from Design

`contexts/invoicing/application/entry-port.ts` was outside the allowed edit roots. The cloud host can only import `@blackhole/invoicing/application/entry-port`, so this unit re-exports `AttachBuyer`, `SetDocumentBalance`, `IssueCreditNote`, `InvoicingProvider`, `DocumentBalanceStore`, `CreditNoteRepository`, `CreditNoteAudit`, and `InvalidNitCheckDigit`. Those use cases were not changed.

There is no numbering-range use case. `POST numbering-ranges` stores the assignment in `MemoryNumberingRanges` inside `application-module.ts`. Permission is `tax.configure`. A 403 or 400 does not increment `saves`.

The credit-note route builds the original `SalesDocument` from the body (`originalReferenceCode`, generic buyer, taxpayer email). It does not load `SalesDocumentRepository`. `IssueCreditNote` still cites that original reference, and the audit records only after the note is inserted.

`application-module.ts` gained invoicing providers only. Telemetry, `main.ts`, and `worker.ts` were not rewritten.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 11. Cloud HTTP. HTTP half of PR 11
- Boundary: tasks 4.1 and 4.2 only. Starts after tasks 1.1–3.4. Does not include 4.3 or 4.4.
- Target: the previous invoicing PR branch, not `main`.
- Files: `apps/api-cloud/test/http/invoicing.controller.test.ts` (606), `apps/api-cloud/src/http/invoicing.controller.ts` (340), `shared/contracts/e-invoicing.ts` (159), `apps/api-cloud/src/composition/application-module.ts` (+131), `contexts/invoicing/application/entry-port.ts` (+34), `shared/contracts/index.ts` (+22), `tasks.md`, `apply-progress.md`
- Changed lines: 1292 additions, 0 deletions (340 + 606 + 159 + 131 + 34 + 22). Over the 400-line budget. The assigned HTTP pair was not split. The worker stays in the next slice. The change forecast stays High.
- Not committed. Not pushed. No pull request.

## Work unit 12

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is the worker half split off the HTTP slice of PR 11. It starts after tasks 4.1–4.2 and stops at tasks 4.3–4.4. Tasks 5.1–5.3 stay open. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 4.3 RED `issue-document.worker.test.ts`: read `queued`, `CalculateTaxes`, `InvoicingProvider`.
- [x] 4.4 GREEN beside `startWorker`. Keep 0.9.

### Work Unit Evidence

#### Unit 12

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud issue-document.worker` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. The run is after `pnpm exec biome check --write` on the touched worker files. |
| Runtime harness command/scenario and exact result | N/A for a listening server. The job runs in-process against memory doubles and does not call `listen`. `startWorker` was not booted: it opens PgBoss on `DATABASE_URL`. The same command is the runtime path for this job. The existing `worker.test.ts` file still passes (exit 0, 7 tests) after the registration line. |
| Rollback boundary | `apps/api-cloud/src/composition/issue-document.worker.ts`, `apps/api-cloud/test/composition/issue-document.worker.test.ts`, and the `registerIssueDocument` import plus `await registerIssueDocument(boss)` in `apps/api-cloud/src/composition/worker.ts`. The pre-existing telemetry hunk in `worker.ts` stays. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.3 → 4.4 | `pnpm exec vitest run --project api-cloud issue-document.worker` exit 1. `FAIL apps/api-cloud/test/composition/issue-document.worker.test.ts` — `Cannot find module '#src/composition/issue-document.worker.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `issue-document.worker.ts`, the `startWorker` registration, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

### Deviations from Design

`IssueDocument` is not called. `IssueDocument`, `QueuedClosureReader`, and `SalesDocumentRepository` are not exports of `@blackhole/invoicing`, and `contexts/invoicing/application/entry-port.ts` plus `contexts/invoicing/package.json` were outside the allowed roots. The job reads an injected closure, calls the domain `calculateTaxes` function, and calls `InvoicingProvider.validate`.

The application `CalculateTaxes` class was not used. Its command requires a channel and bag flags. This job passes lines and `paidCop` equal to the sale total, and it does not pass the tip, a channel, or bags.

A zero document balance returns after taxes and does not call `validate`. The focused test uses balance `4`, so `validate` runs. The job does not insert a sales document.

`startWorker` registers `invoicing.issue-document` with an idle reader and `IdleInvoicingProvider`. A live job reads nothing and does not emit. `issuePending` and `FactusSimulator` are unchanged. The telemetry call in `startWorker` was already uncommitted and was not rewritten. `application-module.ts` was not edited.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 12. Cloud worker. Worker half of PR 11
- Boundary: tasks 4.3 and 4.4 only. Starts after tasks 4.1–4.2. Does not include 5.1–5.3.
- Target: the previous invoicing PR branch (the HTTP half), not `main`.
- Files: `apps/api-cloud/test/composition/issue-document.worker.test.ts` (145), `apps/api-cloud/src/composition/issue-document.worker.ts` (108), `apps/api-cloud/src/composition/worker.ts` (+2: the import and `await registerIssueDocument(boss)`), `tasks.md`, `apply-progress.md`
- Changed lines: 255 additions, 0 deletions (145 + 108 + 2). Under the 400-line budget. `git diff` against HEAD also shows the pre-existing telemetry hunk in `worker.ts` (5 insertions, 2 deletions). That hunk is not part of this unit. The change forecast stays High.
- Not committed. Not pushed. No pull request.

## Work unit 13

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 12, the last invoicing unit. It starts after tasks 4.1–4.4 and stops at tasks 5.1–5.3. Not committed. `size:exception` was not granted.

### Completed tasks

- [x] 5.1 RED `apps/local-node/test/http/invoicing.controller.test.ts`: same routes, 403 `InvoicingRejected`, nothing stored.
- [x] 5.2 GREEN `src/http/invoicing.controller.ts`. No import/store.
- [x] 5.3 Allow it in `tools/skeleton/skeleton.test.ts`.

### Work Unit Evidence

#### Unit 13

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project local-node invoicing.controller` — exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. The run is after `pnpm exec biome check --write` on the new controller, its test, and `application-module.ts`. |
| Runtime harness command/scenario and exact result | The same command boots Nest through `createApplication` (`FastifyAdapter` + `init`) and calls `inject` on the five routes. No `listen`. Exit 0. `pnpm exec vitest run --project skeleton -t "structure rejection"` — exit 0. `Tests  1 passed | 9 skipped (10)`. |
| Rollback boundary | `apps/local-node/src/http/invoicing.controller.ts`, `apps/local-node/test/http/invoicing.controller.test.ts`, the `InvoicingController` import and controllers entry in `apps/local-node/src/composition/application-module.ts`, and the `http/invoicing.controller.ts` allow-list line in `tools/skeleton/skeleton.test.ts`. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 5.1 → 5.2 and 5.3 | `pnpm exec vitest run --project local-node invoicing.controller` exit 1. `FAIL apps/local-node/test/http/invoicing.controller.test.ts` — `Cannot find module '#src/http/invoicing.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the controller, the module registration, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. Skeleton allow-list: `pnpm exec vitest run --project skeleton -t "structure rejection"` exit 0. `Tests  1 passed | 9 skipped (10)`. |

### Deviations from Design

None for this unit. Every route uses the cloud prefix `/tenants/:tenantId/venues/:venueId` and returns 403 `{ error: "InvoicingRejected" }`. The paths are `acquirers/lookup`, `closures/:closureId/buyer`, `document-balance`, `numbering-ranges`, and `credit-notes`. All five are POST. `routePermissions` repeats the cloud map (`sale.charge`, `tax.configure`, `sale.credit-note`) and is not enforced. The module providers and imports stay empty. There is no repository, no Zod schema, and no import of `contexts/invoicing`.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 13. Node. PR 12
- Boundary: tasks 5.1, 5.2, and 5.3 only. Starts after tasks 4.1–4.4.
- Target: the previous invoicing PR branch (the worker half of PR 11), not `main`.
- Files: `apps/local-node/test/http/invoicing.controller.test.ts` (62), `apps/local-node/src/http/invoicing.controller.ts` (50), `apps/local-node/src/composition/application-module.ts` (+2), `tools/skeleton/skeleton.test.ts` (+1), `tasks.md`, `apply-progress.md`
- Changed lines: 115 additions, 0 deletions (62 + 50 + 2 + 1). Under the 400-line budget. The change forecast stays High.
- Not committed. Not pushed. No pull request.

## Work unit 14

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 13 of the invoicing chain. It starts after tasks 5.1–5.3 and stops at tasks 6.1–6.3. It targets the node slice, not `main`. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

### Completed tasks

- [x] 6.1 Typecheck: await the Factus rejection callbacks so they return void. Include `e-invoicing.ts` in `shared/contracts/tsconfig.json`.
- [x] 6.2 RED: a closed sale with a working provider delivers number, CUFE, and QR. The worker saves through `IssueDocument`; a second run returns the stored document and does not validate again.
- [x] 6.3 GREEN: persist number, CUFE, and QR from the validate result. Register `IssueDocument` with a configurable provider. Keep the 0.9 probe. Zero balance stays `pending_issuance` / `no_balance` without those fields.

### Work Unit Evidence

#### Unit 14

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing` — exit 0. `Test Files  20 passed (20)`. `Tests  142 passed (142)`. `pnpm exec vitest run --project api-cloud issue-document.worker` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. `pnpm exec vitest run --project invoicing factus-invoicing-provider` — exit 0. `Test Files  1 passed (1)`. `Tests  15 passed (15)`. |
| Runtime harness command/scenario and exact result | The worker command runs the job in process. It does not call `listen` and does not boot `startWorker` (that opens PgBoss). The Factus command is the recorded-HTTP harness. `pnpm exec tsc -b contexts/invoicing apps/api-cloud apps/local-node --pretty false` — exit 0. |
| Rollback boundary | `IssueDocument` persistence of number, CUFE, and QR; `DocumentIssuance` on `validate`; the Factus ACL map of `data.qr`; nullable `invoice_number`, `cufe`, and `qr` on `sales_documents`; `openIssueDocument` plus the `startWorker` registration. |

#### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 6.2 → 6.3 | `pnpm vitest run --project invoicing issue-document -t "working provider"` exit 1. `FAIL contexts/invoicing/application/issue-document/issue-document.test.ts` — `expected undefined to be 'SETP990000550'`. `Test Files  1 failed (1)`. `Tests  1 failed \| 4 skipped (5)`. | The three commands above, plus `tsc -b`, all exit 0. |

### Deviations from Design

`validate` stays `Promise<void>` for the default `InvoicingProvider`. `FactusInvoicingProvider` and `IssueDocument` use `InvoicingProvider<DocumentIssuance>`. Existing `Promise<void>` overrides were left in place, including the cloud HTTP test, `IssuanceGate`, and `UnconfiguredInvoicingProvider`. The production lookup methods were not changed to `void`.

After a successful validate, the use case stores `number`, `cufe`, and `qr` on the sales document. The Factus ACL reads those three strings from `data` on `POST /v2/bills/validate`. `qr` is the recorded JSON field. `findByReference` still returns number and CUFE only. A repeat of the same closure returns the stored document and does not validate again.

Zero balance still stores `pending_issuance` / `no_balance` and does not validate. Those rows have no number, CUFE, or QR. `0011_electronic_invoicing.sql` gained nullable `invoice_number`, `cufe`, and `qr`, with checks that the three are all present or all absent, and that `no_balance` has none. The migration was still unreleased in this change, so it was extended in place.

`startWorker` registers `openIssueDocument(runtime.secrets)`. That builds `IssueDocument` with `FactusInvoicingProvider`. `IdleInvoicingProvider` is gone. The default closure reader returns null, so a live job does not call Factus until a queued-closure reader is supplied. `issuePending` still uses `FactusSimulator`. `IssuanceGate` was not wired. `application-module.ts` was not edited.

`contexts/invoicing/application/entry-port.ts` re-exports `IssueDocument`, `QueuedClosureNotFound`, `DocumentIssuance`, `QueuedClosureReader`, `SalesDocumentRepository`, and the types this wiring needs. It does not import the Factus adapter. `package.json` exports `@blackhole/invoicing/adapters/factus/factus-invoicing-provider` so the worker can construct it.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 14. Correction. PR 13
- Boundary: tasks 6.1, 6.2, and 6.3 only. Starts after tasks 5.1–5.3. Does not include verify.
- Target: the previous invoicing PR branch (the node slice), not `main`.
- Estimated review budget impact: about 650 changed lines (additions + deletions) against the previous slice. Net growth measured from the files at the start of this batch is about +306 lines. The worker and its test were rewritten, so the review diff is larger than the net. Over the 400-line budget. The assigned RED/GREEN pair was not split. `size:exception` was not granted. The change forecast stays High.
- Not committed. Not pushed. No pull request.
