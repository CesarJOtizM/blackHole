# Apply progress: p1-08-invoicing-portal

Work units: domain pairs 1.1–1.2, 1.3–1.4, 1.5–1.6, and 1.7–1.8. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked RED/GREEN pairs. Pair 1.1–1.2 started the chain. Pair 1.3–1.4 followed. This batch adds pair 1.5–1.6 and stops there. Not committed. `size:exception` was not granted.

## Completed tasks

- [x] 1.1 RED `contexts/invoicing/domain/portal-link.test.ts`: expired or other account shows nothing. No crypto.
- [x] 1.2 GREEN `domain/portal-link.ts`, `domain/index.ts`.
- [x] 1.3 RED `contexts/invoicing/domain/one-time-code.test.ts`: 6 digits, 10 min, 5 tries, single use, 60 s. Digest only.
- [x] 1.4 GREEN `domain/one-time-code.ts` and its export in `domain/index.ts`. Not Twilio Verify. The domain does not call the network.
- [x] 1.5 RED `contexts/invoicing/domain/billing-data.test.ts`: bad NIT (`assertNitCheckDigit`); no consent stores nothing; email and DANE required; `deleted_at` keeps snapshots.
- [x] 1.6 GREEN `domain/billing-data.ts` and its export in `domain/index.ts`. No catalog lookup. The domain does not call the network.
- [x] 1.7 RED `contexts/invoicing/domain/masking.test.ts`: `J*** P***`, `j***@gmail.com`.
- [x] 1.8 GREEN `domain/masking.ts` and its export in `domain/index.ts`. No catalog lookup. The domain does not call the network.
- [x] 1.9 RED `contexts/invoicing/domain/reinvoice-window.test.ts`: `same_day` default, `same_month`, `off`, America/Bogota.
- [x] 1.10 GREEN `domain/reinvoice-window.ts` and its export in `domain/index.ts`. No provider call. The domain does not call the network.
- [x] 2.1 RED `contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.test.ts`: masks plus `lookupId`; full row stays server-side; `acquire(taxId, at, 60)`; 30-day cache; failure reveals nothing; no bag use (D-21); shapeless refusal; no cross-tenant.
- [x] 2.2 GREEN `application/look-up-portal-buyer/look-up-portal-buyer.ts`. `#application/look-up-portal-buyer/*`. Not exported from `entry-port.ts`. `ProviderRateGate` unchanged.
- [x] 2.3 RED `contexts/invoicing/application/request-remembered-code/request-remembered-code.test.ts`: registered contact only. Sender gets channel, destination, code, companyName, expiresInMinutes. Unconfigured throws. Code not logged. Other company hidden.
- [x] 2.4 GREEN `application/request-remembered-code/request-remembered-code.ts`. `ports/one-time-code-sender.ts` and `.contract.ts`. Not exported from `entry-port.ts`.

## Work Unit Evidence

### Pair 1.1–1.2

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm exec biome check --write` on the touched domain files. Re-run after pair 1.3–1.4: same command, exit 0, `Test Files  1 passed (1)`, `Tests  4 passed (4)`. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `revealPortalLink` compares an already-evaluated expiry and account in memory. It does not open files, sockets, or a database, and it does not sign or verify HMAC. |
| Rollback boundary | `contexts/invoicing/domain/portal-link.test.ts`, `contexts/invoicing/domain/portal-link.ts`, and the `portal-link` exports in `contexts/invoicing/domain/index.ts`. |

### Pair 1.3–1.4

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/one-time-code.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`. The run is after `pnpm exec biome check --write` on the touched domain files. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `issueOneTimeCode`, `verifyOneTimeCode`, and `resendOneTimeCode` compare instants and a caller-supplied digest in memory. They do not open sockets, call Twilio, or compute link-signing HMAC. |
| Rollback boundary | `contexts/invoicing/domain/one-time-code.test.ts`, `contexts/invoicing/domain/one-time-code.ts`, and the `one-time-code` exports in `contexts/invoicing/domain/index.ts`. Reverting those leaves the portal-link pair in place. |

### Pair 1.5–1.6

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/billing-data.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. The run is after `pnpm exec biome check --write` on the touched domain files, including a test-only trim that removed a duplicated draft type. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `recordBillingData` and `deleteBillingData` compare caller-supplied fields in memory. They do not open sockets, read a municipality catalog, call Factus, or sign HMAC. Unknown DANE codes are stored. |
| Rollback boundary | `contexts/invoicing/domain/billing-data.test.ts`, `contexts/invoicing/domain/billing-data.ts`, and the `billing-data` exports in `contexts/invoicing/domain/index.ts`. Reverting those leaves the portal-link and one-time-code pairs in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts contexts/invoicing/domain/one-time-code.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  13 passed (13)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts` exit 1. `FAIL contexts/invoicing/domain/portal-link.test.ts` — `Cannot find module '#domain/portal-link.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/portal-link.ts`, the `domain/index.ts` export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |
| 1.3 → 1.4 | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/one-time-code.test.ts` exit 1. `FAIL contexts/invoicing/domain/one-time-code.test.ts` — `Cannot find module '#domain/one-time-code.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/one-time-code.ts`, the `domain/index.ts` export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`. |
| 1.5 → 1.6 | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/billing-data.test.ts` exit 1. `FAIL contexts/invoicing/domain/billing-data.test.ts` — `Cannot find module '#domain/billing-data.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/billing-data.ts`, the `domain/index.ts` export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |

## Deviations from Design

None for either pair. `revealPortalLink` receives an already-evaluated link (`purpose`, `tenantId`, `venueId`, `checkId`, `expiresAt`) and the account being opened. At or after `expiresAt`, or when tenant, venue, or check differs, the result is `{ outcome: "hidden" }` and carries no account fields. A current link for the same account returns that account and its purpose. An unreadable instant fails closed as hidden. Signing and HMAC verification stay in `HmacLinkSigner` (tasks 3.5–3.6). Invoice issuance closes a pre-bill link by the evaluated `expiresAt`; this pair does not read invoice status.

`issueOneTimeCode` returns the six-digit code once for delivery and stores `digest`, `sentAt`, `expiresAt`, `attemptsRemaining`, and `spent`. The record has no clear code. A digest equal to the code, or empty, is refused. Expiry is ten minutes; at or after `expiresAt` verification is `expired`. Five wrong checks lock the record (`attemptsRemaining` 0); a later check stays locked. One accepted check sets `spent`, and a second check is `spent`. Resend before 60 seconds is `too_soon` and does not read a new digit. At 60 seconds a new code and digest replace the record, and the previous code no longer matches. The domain does not hash: the caller passes `digest`. HMAC stays behind `ports/code-digest.ts` (task 2.6) and `adapters/crypto` (tasks 3.5–3.6).

`recordBillingData` stores a record only when id type, number, person type, name, email, and a non-blank municipality code are present, and consent includes acceptance, a policy version, and a policy link. The consent date is the caller-supplied `at`. Document type `"31"` reuses `assertNitCheckDigit`; type `"13"` does not. A missing or unaccepted policy returns no record. `deleteBillingData` sets `deletedAt` (the domain name for `deleted_at`, camelCase like `expiresAt`) and copies `invoiceSnapshots` unchanged. An unknown municipality code is stored; rejecting it stays in tasks 3.7–3.8.

## Issues Found

None.

## Remaining Tasks

- [x] 1.9 RED `domain/reinvoice-window.test.ts`
- [x] 1.10 GREEN `domain/reinvoice-window.ts`
- [x] 2.1–2.2 `look-up-portal-buyer`
- [x] 2.3–2.4 `request-remembered-code`
- [ ] 2.5 onward

## Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Completed work units: domain pair 1.1–1.2, domain pair 1.3–1.4, then domain pair 1.5–1.6
- Previous batch boundary (kept): tasks 1.3 and 1.4 only. Files: `contexts/invoicing/domain/one-time-code.test.ts`, `contexts/invoicing/domain/one-time-code.ts`, `contexts/invoicing/domain/index.ts` (one-time-code exports). About 490 domain lines. Above the 400-line review budget for that slice. `size:exception` was not granted.
- Current batch boundary: tasks 1.5 and 1.6 only. No use cases, adapters, HTTP, UI, SQL, or D-48 docs.
- Files in this batch: `contexts/invoicing/domain/billing-data.test.ts`, `contexts/invoicing/domain/billing-data.ts`, `contexts/invoicing/domain/index.ts` (billing-data exports only), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 394 lines (`billing-data.test.ts` 203, `billing-data.ts` 176, plus 15 `index.ts` export lines). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted.

## Pair 1.7–1.8

This batch adds domain pair 1.7–1.8 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/masking.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. The run is after `pnpm exec biome check --write` on the touched domain files. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `maskName` and `maskEmail` copy one character and a fixed tail in memory. They do not open sockets, call Factus or Twilio, or sign HMAC. |
| Rollback boundary | `contexts/invoicing/domain/masking.test.ts`, `contexts/invoicing/domain/masking.ts`, and the `masking` export in `contexts/invoicing/domain/index.ts`. Reverting those leaves the portal-link, one-time-code, and billing-data pairs in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts contexts/invoicing/domain/one-time-code.test.ts contexts/invoicing/domain/billing-data.test.ts` — exit 0. `Test Files  3 passed (3)`. `Tests  23 passed (23)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.7 → 1.8 | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/masking.test.ts` exit 1. `FAIL contexts/invoicing/domain/masking.test.ts` — `Cannot find module '#domain/masking.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/masking.ts`, the `domain/index.ts` export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |

### Deviations from Design

None. `maskName("Juan Perez")` is `"J*** P***"`. `maskEmail("juan@gmail.com")` is `"j***@gmail.com"`. Each whitespace-separated word keeps its first character and exactly three asterisks. The local part keeps its first character, exactly three asterisks, then `@` and the domain unchanged. The kept character stays in its original case. A one-word name, a one-character local part, and a longer value that would leak if the remainder were appended are covered. The star count does not follow the hidden length.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 1.7 and 1.8 only. No use cases, adapters, HTTP, UI, SQL, or D-48 docs.
- Files in this batch: `contexts/invoicing/domain/masking.test.ts`, `contexts/invoicing/domain/masking.ts`, `contexts/invoicing/domain/index.ts` (one masking export), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 79 lines (`masking.test.ts` 58, `masking.ts` 20, plus 1 `index.ts` export line). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted.
- Next unchecked task: 1.9

## Pair 1.9–1.10

This batch adds domain pair 1.9–1.10 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/reinvoice-window.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. The run is after `pnpm exec biome check --write` on the touched domain files. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `isReinvoiceWindowOpen` compares caller-supplied ISO instants on the America/Bogota calendar (UTC-5, no daylight saving). It does not open sockets, call Factus, or sign HMAC. |
| Rollback boundary | `contexts/invoicing/domain/reinvoice-window.test.ts`, `contexts/invoicing/domain/reinvoice-window.ts`, and the `reinvoice-window` exports in `contexts/invoicing/domain/index.ts`. Reverting those leaves the portal-link, one-time-code, billing-data, and masking pairs in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts contexts/invoicing/domain/one-time-code.test.ts contexts/invoicing/domain/billing-data.test.ts contexts/invoicing/domain/masking.test.ts` — exit 0. `Test Files  4 passed (4)`. `Tests  31 passed (31)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.9 → 1.10 | `pnpm exec vitest run --project invoicing contexts/invoicing/domain/reinvoice-window.test.ts` exit 1. `FAIL contexts/invoicing/domain/reinvoice-window.test.ts` — `Cannot find module '#domain/reinvoice-window.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/reinvoice-window.ts`, the `domain/index.ts` export, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |

### Deviations from Design

None. `isReinvoiceWindowOpen` answers whether the window is open. The default mode is `same_day`. `same_day` is open only when `issuedAt` and `at` share a Bogota calendar date and `at` is not before `issuedAt`. `same_month` is open only when both instants share a Bogota calendar month and year and `at` is not before `issuedAt`. `off` is always closed. An unreadable instant is closed. This pair does not call a provider.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 1.9 and 1.10 only. No use cases, adapters, HTTP, UI, SQL, or D-48 docs.
- Files in this batch: `contexts/invoicing/domain/reinvoice-window.test.ts`, `contexts/invoicing/domain/reinvoice-window.ts`, `contexts/invoicing/domain/index.ts` (reinvoice-window exports), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 190 lines (`reinvoice-window.test.ts` 110, `reinvoice-window.ts` 74, plus 6 `index.ts` export lines). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted.
- Next unchecked task: 2.1

## Pair 2.1–2.2

This batch adds use-case pair 2.1–2.2 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. The run is after `pnpm exec biome check --write` on the touched files. |
| Runtime harness command/scenario and exact result | N/A, in-memory ports. `LookUpPortalBuyer` calls the injected store, limiter, and `lookupAcquirer` only. It does not open sockets, call Factus or Twilio, sign HMAC, or touch Postgres. |
| Rollback boundary | `contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.test.ts`, `contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.ts`, and the `#application/look-up-portal-buyer/*` import in `contexts/invoicing/package.json`. Reverting those leaves domain pairs 1.1–1.10 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts contexts/invoicing/domain/one-time-code.test.ts contexts/invoicing/domain/billing-data.test.ts contexts/invoicing/domain/masking.test.ts contexts/invoicing/domain/reinvoice-window.test.ts` — exit 0. `Test Files  5 passed (5)`. `Tests  41 passed (41)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.1 → 2.2 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.test.ts` exit 1. `FAIL contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.test.ts` — `Cannot find module '#application/look-up-portal-buyer/look-up-portal-buyer.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `look-up-portal-buyer.ts` and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |

### Deviations from Design

The limiter is `PortalLookupLimiter.acquire(taxId, at, ceiling)` beside the use case. `ProviderRateGate` is unchanged (tasks 3.1–3.2). The use case is not exported from `entry-port.ts` (task 2.16). Cache and `portal_lookups` are one injected `PortalBuyerLookupStore`, not Postgres. A row exactly 30 days old is still a hit. A row older than 30 days, or one whose company does not match, is a miss. Hidden link, limiter throw, provider throw, empty lookup, and a company with no cache all return `{ outcome: "hidden" }`.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 2.1 and 2.2 only. No postgres, Twilio, HTTP, UI, `ProviderRateGate`, or `entry-port.ts` export.
- Files in this batch: `contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.test.ts`, `contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.ts`, `contexts/invoicing/package.json` (one import), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 474 lines (`look-up-portal-buyer.test.ts` 281, `look-up-portal-buyer.ts` 192, plus 1 `package.json` import). That is 74 lines over the 400-line review budget. `size:exception` was not granted.
- Next unchecked task: 2.3

## Pair 2.3–2.4

This batch adds use-case pair 2.3–2.4 and stops there. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/application/request-remembered-code/request-remembered-code.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. The run is after `pnpm exec biome check --write` on the touched files. |
| Runtime harness command/scenario and exact result | N/A, in-memory ports. `RequestRememberedCode` calls the injected store, the caller-supplied digest and digits, and `OneTimeCodeSender.send` only. It does not open sockets, call Twilio or SendGrid, sign HMAC, or touch Postgres. `oneTimeCodeSenderContract` is not executed in this slice; an adapter imports it in task 3.4. |
| Rollback boundary | `contexts/invoicing/application/request-remembered-code/request-remembered-code.test.ts`, `contexts/invoicing/application/request-remembered-code/request-remembered-code.ts`, `contexts/invoicing/application/ports/one-time-code-sender.ts`, `contexts/invoicing/application/ports/one-time-code-sender.contract.ts`, and the `#application/request-remembered-code/*` import in `contexts/invoicing/package.json`. Reverting those leaves domain pairs 1.1–1.10 and use-case pair 2.1–2.2 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.3 → 2.4 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/request-remembered-code/request-remembered-code.test.ts` exit 1. `FAIL contexts/invoicing/application/request-remembered-code/request-remembered-code.test.ts` — `Cannot find module '#application/ports/one-time-code-sender.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `request-remembered-code.ts`, `ports/one-time-code-sender.ts`, `ports/one-time-code-sender.contract.ts`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

### Deviations from Design

The sender message matches the design: `channel`, `destination`, `code`, `companyName`, `expiresInMinutes`. `expiresInMinutes` is 10, from `ONE_TIME_CODE_TTL_MS`. An unconfigured sender throws `OneTimeCodeDeliveryFailed`; the use case does not catch it and does not store the record. The clear code is passed only to `send`. It is absent from the result, the stored record, and console logs. A remembered contact for another company, or no contact, returns `{ outcome: "hidden" }` and does not send. The result does not include billing data.

`RememberedContactStore` lives in the use case file, as `PortalBuyerLookupStore` does. `portal-repository.ts` stays in task 2.16. Digest and digits are constructor arguments. `ports/code-digest.ts` stays in task 2.6. The use case is not exported from `entry-port.ts`. The contract suite is written and not run here.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 2.3 and 2.4 only. No HTTP, UI, SQL, Twilio adapter, crypto, `code-digest`, or `entry-port.ts` export.
- Files in this batch: `contexts/invoicing/application/request-remembered-code/request-remembered-code.test.ts`, `contexts/invoicing/application/request-remembered-code/request-remembered-code.ts`, `contexts/invoicing/application/ports/one-time-code-sender.ts`, `contexts/invoicing/application/ports/one-time-code-sender.contract.ts`, `contexts/invoicing/package.json` (one import), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 458 lines (`request-remembered-code.test.ts` 285, `request-remembered-code.ts` 115, `one-time-code-sender.ts` 26, `one-time-code-sender.contract.ts` 31, plus 1 `package.json` import). That is 58 lines over the 400-line review budget. `size:exception` was not granted.
- Next unchecked task: 2.5

## Pair 2.5–2.6

This batch adds use-case pair 2.5–2.6 and stops there. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/application/verify-remembered-code/verify-remembered-code.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm exec biome check --write` on the touched files. |
| Runtime harness command/scenario and exact result | N/A, in-memory ports. `VerifyRememberedCode` calls the injected store and `CodeDigest.matches` only, then `verifyOneTimeCode`. It does not open sockets, call Twilio, Factus, or Postgres, and it does not sign HMAC. `codeDigestContract` is not executed in this slice; a crypto adapter imports it in tasks 3.5–3.6. |
| Rollback boundary | `contexts/invoicing/application/verify-remembered-code/verify-remembered-code.test.ts`, `contexts/invoicing/application/verify-remembered-code/verify-remembered-code.ts`, `contexts/invoicing/application/ports/code-digest.ts`, `contexts/invoicing/application/ports/code-digest.contract.ts`, and the `#application/verify-remembered-code/*` import in `contexts/invoicing/package.json`. Reverting those leaves domain pairs 1.1–1.10 and use-case pairs 2.1–2.4 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/application/request-remembered-code/request-remembered-code.test.ts contexts/invoicing/application/look-up-portal-buyer/look-up-portal-buyer.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  9 passed (9)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.5 → 2.6 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/verify-remembered-code/verify-remembered-code.test.ts` exit 1. With no import pattern yet, the same command failed as `Missing "#application/verify-remembered-code/verify-remembered-code.js" specifier in "@blackhole/invoicing" package`. After adding only `#application/verify-remembered-code/*` and with no use case file yet: `FAIL contexts/invoicing/application/verify-remembered-code/verify-remembered-code.test.ts` — `Cannot find module '#application/verify-remembered-code/verify-remembered-code.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `verify-remembered-code.ts`, `ports/code-digest.ts`, `ports/code-digest.contract.ts`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |

### Deviations from Design

The sequence diagram labels the customer response "remembered data (masked)". This use case returns the stored billing fields for confirmation (`documentType`, `documentNumber`, `personType`, `name`, `email`, `municipalityCode`) and does not mask them. HTTP masking is not this slice.

`RememberedCodeStore` lives in the use case file, as `RememberedContactStore` does. `portal-repository.ts` stays in task 2.16. The use case is not exported from `entry-port.ts`. `codeDigestContract` is written and not run here. `CodeDigest.matches` answers whether the clear code matches the stored digest. `verifyOneTimeCode` still applies expiry, attempts, spent, and lock. When `matches` is true the use case passes the stored digest through; when it is not, it passes a different string so the domain comparison stays in the domain. The use case does not hash. A blank code, a missing row, or another company's row returns `{ outcome: "hidden" }` and does not call `matches`. The fifth wrong check saves `attemptsRemaining` 0. A later check stays locked, does not call `matches`, and reveals nothing. A spent code saves the spent record and reveals nothing.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 2.5 and 2.6 only. No HTTP, UI, SQL, Twilio, crypto adapter, Postgres, or `entry-port.ts` export. Task 2.7 was not started.
- Files in this batch: `contexts/invoicing/application/verify-remembered-code/verify-remembered-code.test.ts`, `contexts/invoicing/application/verify-remembered-code/verify-remembered-code.ts`, `contexts/invoicing/application/ports/code-digest.ts`, `contexts/invoicing/application/ports/code-digest.contract.ts`, `contexts/invoicing/package.json` (one import), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 371 lines (`verify-remembered-code.test.ts` 230, `verify-remembered-code.ts` 111, `code-digest.ts` 3, `code-digest.contract.ts` 26, plus 1 `package.json` import). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted.
- Next unchecked task: 2.7

## Pair 2.7–2.8

This batch adds use-case pair 2.7–2.8 and stops there. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/application/record-billing-data/record-billing-data.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm exec biome check --write` on the touched files. |
| Runtime harness command/scenario and exact result | N/A, in-memory ports. `RecordBillingData` calls `recordBillingData`, the injected store, `MunicipalityCatalog.find`, and `BillingDataNotifier.billingDataReceived` only. It does not open sockets, call Factus, Twilio, or Postgres, and it does not seed municipalities. `municipalityCatalogContract` and `billingDataNotifierContract` are not executed in this slice; an adapter imports them in tasks 3.7–3.8 and 4.2. |
| Rollback boundary | `contexts/invoicing/application/record-billing-data/record-billing-data.test.ts`, `contexts/invoicing/application/record-billing-data/record-billing-data.ts`, `contexts/invoicing/application/ports/municipality-catalog.ts`, `contexts/invoicing/application/ports/municipality-catalog.contract.ts`, `contexts/invoicing/application/ports/billing-data-notifier.ts`, `contexts/invoicing/application/ports/billing-data-notifier.contract.ts`, and the `#application/record-billing-data/*` import in `contexts/invoicing/package.json`. Reverting those leaves domain pairs 1.1–1.10 and use-case pairs 2.1–2.6 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/application/verify-remembered-code/verify-remembered-code.test.ts contexts/invoicing/domain/billing-data.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  14 passed (14)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.7 → 2.8 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/record-billing-data/record-billing-data.test.ts` exit 1. With no import pattern yet: `Missing "#application/record-billing-data/record-billing-data.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. After adding only `#application/record-billing-data/*` and with no use case file yet: `FAIL contexts/invoicing/application/record-billing-data/record-billing-data.test.ts` — `Cannot find module '#application/record-billing-data/record-billing-data.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `record-billing-data.ts`, `ports/municipality-catalog.ts`, `ports/municipality-catalog.contract.ts`, `ports/billing-data-notifier.ts`, `ports/billing-data-notifier.contract.ts`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |

### Deviations from Design

The sequence says validate DANE before store. This use case calls `MunicipalityCatalog.find` and passes a hit through to `recordBillingData`. A miss, including `99999`, still follows `recordBillingData`, so an unknown code is stored. Rejecting an unknown DANE code stays in tasks 3.7–3.8. A blank code stays `MissingMunicipalityCode` from the domain. `InvalidNitCheckDigit` is the only domain error mapped to `{ outcome: "field_error", field: "documentNumber" }`. Other domain throws propagate.

`BillingDataStore` lives in the use case file, as `RememberedCodeStore` does. `portal-repository.ts` stays in task 2.16. The use case is not exported from `entry-port.ts`. `realtime-hub.ts` is not edited. The notifier stand-in is `billingDataReceived({ checkId })`. The contracts are written and not run here. No Factus municipalities JSON and no SQL. The use case does not log the billing payload.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 2.7 and 2.8 only. No HTTP, UI, SQL, Twilio, Postgres, local-node, sqlite, sync, Factus, or `entry-port.ts` export. Task 2.9 was not started.
- Files in this batch: `contexts/invoicing/application/record-billing-data/record-billing-data.test.ts`, `contexts/invoicing/application/record-billing-data/record-billing-data.ts`, `contexts/invoicing/application/ports/municipality-catalog.ts`, `contexts/invoicing/application/ports/municipality-catalog.contract.ts`, `contexts/invoicing/application/ports/billing-data-notifier.ts`, `contexts/invoicing/application/ports/billing-data-notifier.contract.ts`, `contexts/invoicing/package.json` (one import), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 377 lines (`record-billing-data.test.ts` 213, `record-billing-data.ts` 105, `municipality-catalog.ts` 3, `municipality-catalog.contract.ts` 22, `billing-data-notifier.ts` 7, `billing-data-notifier.contract.ts` 26, plus 1 `package.json` import). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted.
- Next unchecked task: 2.9

## Pair 2.9–2.10

This batch adds use-case pair 2.9–2.10 and stops there. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/application/request-data-deletion/request-data-deletion.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. The run is after `pnpm exec biome check --write` on the touched files. The final Biome run reported `Checked 3 files in 18ms. No fixes applied.` |
| Runtime harness command/scenario and exact result | N/A, in-memory store. `RequestDataDeletion` calls `verifyOneTimeCode`, `deleteBillingData`, the injected store, and `CodeDigest.matches` only. It does not open sockets, call Twilio, Factus, or Postgres. |
| Rollback boundary | `contexts/invoicing/application/request-data-deletion/request-data-deletion.test.ts`, `contexts/invoicing/application/request-data-deletion/request-data-deletion.ts`, and the `#application/request-data-deletion/*` import in `contexts/invoicing/package.json`. Reverting those leaves domain pairs 1.1–1.10 and use-case pairs 2.1–2.8 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/application/verify-remembered-code/verify-remembered-code.test.ts contexts/invoicing/domain/billing-data.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  14 passed (14)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.9 → 2.10 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/request-data-deletion/request-data-deletion.test.ts` exit 1. With no import pattern yet: `Missing "#application/request-data-deletion/request-data-deletion.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. After adding only `#application/request-data-deletion/*` and with no use case file yet: `FAIL contexts/invoicing/application/request-data-deletion/request-data-deletion.test.ts` — `Cannot find module '#application/request-data-deletion/request-data-deletion.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `request-data-deletion.ts` and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

### Deviations from Design

None — implementation matches design. The code is the one already stored for the registered row. `CodeDigest.matches` and `verifyOneTimeCode` decide it. A blank code, a missing row, or another company's row returns `{ outcome: "hidden" }` and does not save. A rejected, locked, expired, or spent code saves the updated one-time-code record and leaves `deletedAt` null with the same invoice numbers. An accepted code saves the record returned by `deleteBillingData({ record, at })`: `deletedAt` is the command `at`, the invoice numbers stay, and the spent code is stored on that same row. `findUsable` offers billing fields only while `deletedAt` is null, so a later lookup for that company and document returns nothing while the saved row still holds the snapshots. `DataDeletionStore` lives in the use case file. No new port. The use case is not exported from `entry-port.ts`. It does not log the code or the billing payload.

### Issues Found

None. The first executable draft expected `matches` to record the rejected code. `CodeDigest.matches` receives the stored digest, as in `VerifyRememberedCode`. That expectation was corrected before the passing run.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 2.9 and 2.10 only. No HTTP, UI, SQL, Twilio, Postgres, local-node, sqlite, sync, Factus, `entry-port.ts`, or `realtime-hub.ts`. Task 2.11 was not started.
- Files in this batch: `contexts/invoicing/application/request-data-deletion/request-data-deletion.test.ts`, `contexts/invoicing/application/request-data-deletion/request-data-deletion.ts`, `contexts/invoicing/package.json` (one import), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 486 lines (`request-data-deletion.test.ts` 339, `request-data-deletion.ts` 146, plus 1 `package.json` import). That is 86 lines over the 400-line review budget. The change forecast stays High. `size:exception` was not granted. This batch is included in the pull request.
- Next unchecked task: 2.11

## Pair 2.11–2.12

This batch adds use-case pair 2.11–2.12 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/application/get-portal-invoice/get-portal-invoice.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. The run is after `pnpm exec biome check --write` on the touched files. That Biome run reported `Checked 4 files in 16ms. Fixed 3 files.` |
| Runtime harness command/scenario and exact result | N/A, in-memory provider double. `GetPortalInvoice` calls `revealPortalLink`, `isReinvoiceWindowOpen`, and the injected `downloadPdf` only. It does not open sockets, call Factus or mail, sign HMAC, or touch Postgres. |
| Rollback boundary | `contexts/invoicing/application/get-portal-invoice/get-portal-invoice.test.ts`, `contexts/invoicing/application/get-portal-invoice/get-portal-invoice.ts`, the `downloadPdf` default and `InvoicePdfDownloadFailed` in `contexts/invoicing/application/ports/invoicing-provider.ts`, and the `#application/get-portal-invoice/*` import in `contexts/invoicing/package.json`. Reverting those leaves domain pairs 1.1–1.10 and use-case pairs 2.1–2.10 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/domain/portal-link.test.ts contexts/invoicing/domain/reinvoice-window.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  14 passed (14)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.11 → 2.12 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/get-portal-invoice/get-portal-invoice.test.ts` exit 1. With no import pattern yet: `Missing "#application/get-portal-invoice/get-portal-invoice.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. After adding only `#application/get-portal-invoice/*` and with no use case file yet: `FAIL contexts/invoicing/application/get-portal-invoice/get-portal-invoice.test.ts` — `Cannot find module '#application/get-portal-invoice/get-portal-invoice.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `get-portal-invoice.ts`, `downloadPdf(number)` on `ports/invoicing-provider.ts`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. |

### Deviations from Design

None — implementation matches design. The public path stays `/f/<referenceCode>.<hmac>`. This slice does not compute HMAC: the command carries `referenceCode` and `suffixAccepted`. The already-loaded document (`pending`, or `accepted` with `number` and `issuedAt`) and optional `windowMode` are on the command because the use case does not open a repository. A hidden link, a missing suffix on an invoice link, a reference that does not match the document, a pending document, and a closed window (`same_day` next Bogota day, or `off`) do not call `downloadPdf`. A visible `pre_bill` returns `{ outcome: "empty" }` without account fields. The issued pre-bill is still time-valid under `revealPortalLink`; expiry is not reimplemented. `downloadPdf` is a concrete method that rejects with `InvoicePdfDownloadFailed`, same as `lookupAcquirer`. Factus and memory do not override it. No mail method exists and none is called. Provider failure returns `{ outcome: "empty" }` and does not reveal account fields. The use case is not exported from `entry-port.ts`. The hybrid outage scenario stays deferred under D-37 and is not a test of this slice.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 2.11 and 2.12 only. No HTTP, UI, Twilio, Postgres, local-node, sqlite, sync, Factus fetch, `ports/link-signer.ts`, or `entry-port.ts` export. Task 2.13 was not started.
- Files in this batch: `contexts/invoicing/application/get-portal-invoice/get-portal-invoice.test.ts`, `contexts/invoicing/application/get-portal-invoice/get-portal-invoice.ts`, `contexts/invoicing/application/ports/invoicing-provider.ts` (`downloadPdf` default and `InvoicePdfDownloadFailed`), `contexts/invoicing/package.json` (one import), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 335 lines (`get-portal-invoice.test.ts` 215, `get-portal-invoice.ts` 108, `invoicing-provider.ts` 11, plus 1 `package.json` import). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted. This batch is not committed.
- Next unchecked task: 2.13

## Pair 2.13–2.14

This batch adds use-case pair 2.13–2.14 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/application/request-reinvoice/request-reinvoice.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm exec biome check --write` on the touched files. That Biome run reported `Checked 3 files in 12ms. No fixes applied.` |
| Runtime harness command/scenario and exact result | N/A, in-memory store and a provider double. `RequestReinvoice` calls `isReinvoiceWindowOpen` and the injected store only. It does not open sockets or call Factus. The provider argument is accepted and not called. |
| Rollback boundary | `contexts/invoicing/application/request-reinvoice/request-reinvoice.test.ts`, `contexts/invoicing/application/request-reinvoice/request-reinvoice.ts`, and the `#application/request-reinvoice/*` import in `contexts/invoicing/package.json`. Reverting those leaves domain pairs 1.1–1.10 and use-case pairs 2.1–2.12 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/domain/reinvoice-window.test.ts contexts/invoicing/application/get-portal-invoice/get-portal-invoice.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  15 passed (15)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.13 → 2.14 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/request-reinvoice/request-reinvoice.test.ts` exit 1. With no import pattern yet: `Missing "#application/request-reinvoice/request-reinvoice.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. After adding only `#application/request-reinvoice/*` and with no use case file yet: `FAIL contexts/invoicing/application/request-reinvoice/request-reinvoice.test.ts` — `Cannot find module '#application/request-reinvoice/request-reinvoice.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `request-reinvoice.ts` and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |

### Deviations from Design

None — implementation matches design. The request calls `isReinvoiceWindowOpen` and does not reimplement the Bogota calendar. Outside the window, mode `off`, an unreadable instant, or an earlier instant returns `{ outcome: "rejected" }`, stores nothing, and does not call the provider. Inside the window, including the omitted mode (`same_day` default) and `same_month` across a Bogota date change, it stores one pending request (`companyId`, invoice number, `issuedAt`, `requestedAt` = command `at`) and returns `{ outcome: "recorded" }` without the provider. A second request for the same company and invoice number does not create a second record. Another company's invoice is not stored against this company. The consumer-final document is not changed and the invoice payload is not logged. The store lives in the use case file. No new port, no `link-signer.ts`, `portal-repository.ts`, or `portal-request-limiter.ts`, no `entry-port.ts` export, and no `IssueCreditNote` call. The provider stays an unused constructor argument because this slice never calls it; Biome rejects an unread private field. Approval, the credit note, and the second invoice remain task 2.15.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 2.13 and 2.14 only. No HTTP, UI, Twilio, Postgres, local-node, sqlite, sync, Factus fetch, `ports/link-signer.ts`, `portal-repository.ts`, `portal-request-limiter.ts`, or `entry-port.ts` export. Task 2.15 was not started.
- Files in this batch: `contexts/invoicing/application/request-reinvoice/request-reinvoice.test.ts`, `contexts/invoicing/application/request-reinvoice/request-reinvoice.ts`, `contexts/invoicing/package.json` (one import), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 387 lines (`request-reinvoice.test.ts` 295, `request-reinvoice.ts` 91, plus 1 `package.json` import). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted. This batch is not committed.
- Next unchecked task: 2.15


## Pair 2.15–2.16

This batch adds use-case pair 2.15–2.16 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/application/approve-reinvoice/approve-reinvoice.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm exec biome check --write` on the touched files. That Biome run reported `Checked 10 files in 28ms. Fixed 9 files.` |
| Runtime harness command/scenario and exact result | N/A. In-memory doubles only. `ApproveReinvoice` reads the stored request, delegates the credit note to `IssueCreditNote`, and then calls the injected `IssueDocument` once. It does not open sockets, and it does not call Factus, HTTP, Twilio, or Postgres. |
| Rollback boundary | `contexts/invoicing/application/approve-reinvoice/approve-reinvoice.test.ts`, `contexts/invoicing/application/approve-reinvoice/approve-reinvoice.ts`, `contexts/invoicing/application/ports/link-signer.ts`, `contexts/invoicing/application/ports/link-signer.contract.ts`, `contexts/invoicing/application/ports/portal-repository.ts`, `contexts/invoicing/application/ports/portal-repository.contract.ts`, `contexts/invoicing/application/ports/portal-request-limiter.ts`, `contexts/invoicing/application/ports/portal-request-limiter.contract.ts`, the eight portal exports in `contexts/invoicing/application/entry-port.ts`, and the `#application/approve-reinvoice/*` import in `contexts/invoicing/package.json`. Reverting those leaves domain pairs 1.1–1.10 and use-case pairs 2.1–2.14 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/application/issue-credit-note/issue-credit-note.test.ts contexts/invoicing/application/request-reinvoice/request-reinvoice.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  8 passed (8)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.15 → 2.16 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/approve-reinvoice/approve-reinvoice.test.ts` exit 1. With no import pattern yet: `Missing "#application/approve-reinvoice/approve-reinvoice.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. After adding only `#application/approve-reinvoice/*` and with no use case file yet: `FAIL contexts/invoicing/application/approve-reinvoice/approve-reinvoice.test.ts` — `Cannot find module '#application/approve-reinvoice/approve-reinvoice.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, the three ports and contracts, the eight `entry-port.ts` exports, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |

### Deviations from Design

`ApproveReinvoice` delegates the credit note to `IssueCreditNote` and does not call `validateCreditNote` or send a second concept code. Factus already stamps `correction_concept_code` `"2"` inside that validation. The application test cannot import `adapters/factus` (dependency-cruiser). It asserts one `validateCreditNote` payload whose only keys are `referenceCode` and `originalReferenceCode`, then one new-invoice call. The literal `"2"` is not repeated on the use-case payload.

`IssueDocument` needs a queued closure, tax rules, a matching sale base, and a document balance, so the test injects a subclass that records `execute` and does not call the provider. The two document operations are that credit note and that one `execute`. The document provider stays at zero calls.

The approval rechecks `isReinvoiceWindowOpen` with the stored `issuedAt`, the approval `at`, and the company mode. A closed window, mode `off`, or an unreadable stored instant returns `{ outcome: "rejected" }` and calls neither `IssueCreditNote` nor the provider. The pending row stays pending and the consumer-final document keeps the same field values. Missing `sale.credit-note` still calls `IssueCreditNote` once; that call returns `{ outcome: "denied" }` before the provider, the note store, and the audit, and the new invoice is not issued. The single audit on the open path is the `sale.credit-note` audit written by `IssueCreditNote`. No second audit is written. Another company's invoice number is rejected. The invoice payload is not logged.

`PortalRepository.find` is the stored request. After the credit note is issued and the new invoice is executed, `save` writes the same row with `status: approved`. A later approval finds that status and returns `{ outcome: "rejected" }` before `IssueCreditNote`. A denied or closed-window approval does not save, so the row stays pending. `LinkSigner` signs and verifies an `EvaluatedPortalLink` (`expiresAt`, the domain field) and does no HMAC. `PortalRequestLimiter.acquire` takes a token and an IP and has no window table. Neither is called by this approval: it is a staff permission check, not a public token or a signed link. The contract suites are not executed against a live adapter.

### Issues Found

A second approval of the same row is rejected. The first success saves `status: approved`, and a later approval does not call `IssueCreditNote` or `IssueDocument`.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 2.15 and 2.16 only. No HTTP, UI, Twilio, Postgres, local-node, sqlite, sync, or Factus fetch. `adapters/factus` was not edited. Task 3.1 was not started.
- Files in this batch: `contexts/invoicing/application/approve-reinvoice/approve-reinvoice.test.ts`, `contexts/invoicing/application/approve-reinvoice/approve-reinvoice.ts`, `contexts/invoicing/application/ports/link-signer.ts`, `contexts/invoicing/application/ports/link-signer.contract.ts`, `contexts/invoicing/application/ports/portal-repository.ts`, `contexts/invoicing/application/ports/portal-repository.contract.ts`, `contexts/invoicing/application/ports/portal-request-limiter.ts`, `contexts/invoicing/application/ports/portal-request-limiter.contract.ts`, `contexts/invoicing/application/entry-port.ts` (eight exports), `contexts/invoicing/package.json` (one import), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 790 lines (`approve-reinvoice.test.ts` 535, `approve-reinvoice.ts` 94, `link-signer.ts` 11, `link-signer.contract.ts` 24, `portal-repository.ts` 20, `portal-repository.contract.ts` 31, `portal-request-limiter.ts` 8, `portal-request-limiter.contract.ts` 26, `entry-port.ts` 40 added, plus 1 `package.json` import). That is 390 lines over the 400-line review budget. The ports and the eight exports were kept. The change forecast stays High. `size:exception` was not granted. This batch is not committed.
- Next unchecked task: 3.1


## Pair 3.1–3.2

This batch adds ceiling pair 3.1–3.2 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project platform contexts/platform/adapters/memory/in-memory-provider-rate-gate.contract.test.ts contexts/platform/adapters/postgres/drizzle-provider-rate-gate.contract.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  11 passed (11)`. Memory file is the shared contract (5). Drizzle file is that contract plus the existing shared-window case (6). The run is after `pnpm exec biome check --write` on the four touched source files. That Biome run reported `Checked 4 files in 10ms. Fixed 4 files.` |
| Runtime harness command/scenario and exact result | The drizzle contract is the runtime boundary. It opens PGlite, applies `0005_provider_rate.sql`, and runs `providerRateGateContract` plus the two-caller window. Same command as the focused test, exit 0. `Test Files  2 passed (2)`. `Tests  11 passed (11)`. Not N/A. |
| Rollback boundary | `contexts/platform/application/ports/provider-rate-gate.contract.ts`, `contexts/platform/application/ports/provider-rate-gate.ts`, `contexts/platform/adapters/memory/in-memory-provider-rate-gate.ts`, and `contexts/platform/adapters/postgres/drizzle-provider-rate-gate.ts`. Reverting those restores `acquire(taxId, at)` and the fixed 80 comparison. Use-case pairs 1.1–2.16 stay in place. No migration was added. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.1 → 3.2 | `pnpm exec vitest run --project platform contexts/platform/adapters/memory/in-memory-provider-rate-gate.contract.test.ts` exit 1. Vitest ran the new case; it did not reject the third argument before the body. `FAIL \|platform\| contexts/platform/adapters/memory/in-memory-provider-rate-gate.contract.test.ts > given a caller that passes ceiling 60, when the 61st acquire runs, then it is refused with the seconds left in the minute`. `AssertionError: expected { allowed: true } to deeply equal { allowed: false, retryAfterSeconds: 50 }`. Expected `allowed: false` and `retryAfterSeconds: 50`; received `{ allowed: true }`. `Test Files  1 failed (1)`. `Tests  1 failed \| 4 passed (5)`. The four existing two-argument cases passed. | Same memory file plus `contexts/platform/adapters/postgres/drizzle-provider-rate-gate.contract.test.ts` after `acquire(taxId, at, ceiling = providerRequestsPerMinute)` on the port, the memory gate, and the drizzle gate, and after Biome: exit 0. `Test Files  2 passed (2)`. `Tests  11 passed (11)`. |

### Deviations from Design

TypeScript rejects a parameter default on an abstract method (`TS2371`). The port takes `ceiling?: number`. The memory gate and the drizzle gate default that argument to `providerRequestsPerMinute` (80). A caller that passes `60` stops at 60. A call that omits the third argument still stops at 80. The drizzle comparison uses the ceiling argument. No column and no migration. Two-argument callers in `issuance-gate.ts`, `worker.ts`, and `worker.test.ts` were not edited. `PortalLookupLimiter` and `look-up-portal-buyer.ts` were not edited. Twilio was not pulled in.

### Issues Found

None. A ceiling below 1 or above 80 is out of this pair and is passed through with no clamp.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 3.1 and 3.2 only. No Twilio, HTTP, UI, Factus, local-node, sqlite, sync, or portal lookup retune. Task 3.3 was not started.
- Files in this batch: `contexts/platform/application/ports/provider-rate-gate.contract.ts`, `contexts/platform/application/ports/provider-rate-gate.ts`, `contexts/platform/adapters/memory/in-memory-provider-rate-gate.ts`, `contexts/platform/adapters/postgres/drizzle-provider-rate-gate.ts`, `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 30 lines (27 additions + 3 deletions): contract +18, port +5/−1, memory +2/−1, drizzle +2/−1. That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted. This batch is not committed.
- Next unchecked task: 3.3

## Pair 3.3–3.4

This batch adds adapter pair 3.3–3.4 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. Task 3.5 was not started.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. The run is after `pnpm exec biome check --write` on the two TypeScript files and `contexts/invoicing/package.json`. That Biome run reported `Checked 3 files in 14ms. Fixed 3 files.` |
| Runtime harness command/scenario and exact result | Same command. `globalThis.fetch` is stubbed. SMS is asserted as `POST https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json`. Email is asserted as `POST https://api.sendgrid.com/v3/mail/send`. No live Twilio or SendGrid call. Not N/A. |
| Rollback boundary | `contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.test.ts`, `contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.ts`, and the `#adapters/twilio/*` import in `contexts/invoicing/package.json`. Reverting those leaves pairs 1.1–3.2 in place. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/application/request-remembered-code/request-remembered-code.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.3 → 3.4 | `pnpm exec vitest run --project invoicing contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.test.ts` exit 1. `FAIL \|invoicing\| contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.test.ts` — `Missing "#adapters/twilio/twilio-one-time-code-sender.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `twilio-one-time-code-sender.ts`, `#adapters/twilio/*`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |

### Deviations from Design

The design does not specify the message copy. The body is `{companyName} code {code}. It expires in {minutes} minutes.` The email subject is `{companyName} verification code` and does not contain the code. SMS is `POST /2010-04-01/Accounts/{AccountSid}/Messages.json` with Basic auth and form fields `To`, `From`, and `Body`. Email is `POST https://api.sendgrid.com/v3/mail/send` with `Authorization: Bearer` and a `text/plain` body. A missing secret, a blank secret, a non-OK response, or a rejected `fetch` throws `OneTimeCodeDeliveryFailed` with the fixed port message. The clear code is not written to the console and is not put in the error.

The RED test lives at `contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.test.ts`, the folder task 3.3 names. No file was added under `adapters/memory`. The test's secrets double is an in-memory `Secrets` subclass in that file. `InMemorySecrets` from `contexts/platform` is another context's adapter, which dependency-cruiser forbids. No secret file and no `FileSecrets`. `oneTimeCodeSenderContract` runs here. `delivered()` is filled by a test wrapper after `send` resolves. The adapter does not keep the clear code. The SMS and email tests assert the request shape.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 3.3 and 3.4 only. No HMAC, Postgres, Factus `downloadPdf`, local-node, sqlite, outbox, or sync. Task 3.5 was not started.
- Files in this batch: `contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.test.ts`, `contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.ts`, `contexts/invoicing/package.json` (`#adapters/twilio/*`), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 434 lines (`twilio-one-time-code-sender.test.ts` 315, `twilio-one-time-code-sender.ts` 116, `package.json` +2/−1). That is 34 lines over the 400-line review budget. The change forecast stays High. `size:exception` was not granted. This batch is not committed.
- Next unchecked task: 3.5

## Pair 3.5–3.6

This batch adds adapter pair 3.5–3.6 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. Task 3.7 was not started. The Twilio adapter was not edited.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/adapters/crypto/hmac-link-signer.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. The run is after `pnpm exec biome check --write` on the two TypeScript files and `contexts/invoicing/package.json`. That Biome run reported `Checked 3 files in 10ms. Fixed 1 file.` |
| Runtime harness command/scenario and exact result | Same command. HMAC-SHA256 runs through `node:crypto`. `portal.link-key` is read from an in-memory `Secrets` double. No secret file and no network. Not N/A. |
| Rollback boundary | `contexts/invoicing/adapters/crypto/hmac-link-signer.test.ts`, `contexts/invoicing/adapters/crypto/hmac-link-signer.ts`, and the `#adapters/crypto/*` import in `contexts/invoicing/package.json`. Reverting those leaves pairs 1.1–3.4 in place. Domain and Twilio stay as they were. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/adapters/twilio/twilio-one-time-code-sender.test.ts contexts/invoicing/domain/portal-link.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  11 passed (11)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.5 → 3.6 | `pnpm exec vitest run --project invoicing contexts/invoicing/adapters/crypto/hmac-link-signer.test.ts` exit 1. `FAIL \|invoicing\| contexts/invoicing/adapters/crypto/hmac-link-signer.test.ts` — `Missing "#adapters/crypto/hmac-link-signer.js" specifier in "@blackhole/invoicing" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `hmac-link-signer.ts`, `#adapters/crypto/*`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. |

### Deviations from Design

The signed token is `/f/<base64url(canonical JSON)>.<hmac>`. The left segment is the link `{purpose, tenantId, venueId, checkId, exp}`, with `exp` copied from `expiresAt`. It is not the Factus reference code. `LinkSigner.sign` receives only `EvaluatedPortalLink`, and `verify` has to return that link. `GetPortalInvoice` still treats the Factus reference as `suffixAccepted`. A matching suffix verifies. A flipped payload, a flipped hmac, an appended `.other`, or a bare hmac returns null. Expiry stays in `revealPortalLink`.

`CodeDigest.matches` is synchronous, so `HmacCodeDigest.open` reads `portal.link-key` once and `matches` compares HMAC-SHA256 of the clear code, base64url, with `timingSafeEqual`. Same algorithm and the same secret as the link. No second hash. A missing or blank key throws `PortalLinkKeyUnavailable` from `sign` and `open`. `verify` returns null. The design does not name that error. An env value named `portal.link-key` is not read. No secret file.

`linkSignerContract` and `codeDigestContract` both run in this slice. The domain was not edited and does not import `node:crypto`.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 3.5 and 3.6 only. No Postgres, Factus `downloadPdf`, local-node, sqlite, outbox, or sync. The Twilio adapter was not edited. Task 3.7 was not started.
- Files in this batch: `contexts/invoicing/adapters/crypto/hmac-link-signer.test.ts`, `contexts/invoicing/adapters/crypto/hmac-link-signer.ts`, `contexts/invoicing/package.json` (`#adapters/crypto/*`), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 347 lines (`hmac-link-signer.test.ts` 158, `hmac-link-signer.ts` 186, `package.json` +2/−1). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted. This batch is not committed.
- Next unchecked task: 3.7

## Pair 3.9–3.10

This batch adds adapter pair 3.9–3.10 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. Tasks 3.7 and 3.8 were not started. The Factus municipalities JSON, SQL, and Postgres repos were not added.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing contexts/invoicing/adapters/factus/factus-invoicing-provider.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  18 passed (18)`. The run is after `pnpm exec biome check --write` on the two Factus files. That Biome run reported `Checked 2 files in 20ms. Fixed 2 files.` |
| Runtime harness command/scenario and exact result | Same command. `globalThis.fetch` is stubbed. `downloadPdf` is asserted as `GET {base}/v2/bills/{number}/download-pdf` and the returned bytes are the decoded `pdf_base_64_encoded` payload. `lookupAcquirer` stays `GET {base}/v2/dian/acquirer` and no recorded call hits `/v2/bills/validate`. No live Factus call. Not N/A. |
| Rollback boundary | `contexts/invoicing/adapters/factus/factus-invoicing-provider.test.ts` and `contexts/invoicing/adapters/factus/factus-invoicing-provider.ts`. Reverting those removes `downloadPdf` and the new assertions. `lookupAcquirer` returns to the same GET it already performed. Pairs 1.1–3.6 stay in place. Tasks 3.7 and 3.8 stay unchecked. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.9 → 3.10 | `pnpm exec vitest run --project invoicing contexts/invoicing/adapters/factus/factus-invoicing-provider.test.ts` exit 1. `FAIL \|invoicing\| contexts/invoicing/adapters/factus/factus-invoicing-provider.test.ts`. `Test Files  1 failed (1)`. `Tests  3 failed \| 15 passed (18)`. The success case threw `InvoicePdfDownloadFailed: The provider could not download the invoice PDF.` from the port default at `invoicing-provider.ts:119` (`Promise.reject(new InvoicePdfDownloadFailed())`). The failure cases then asserted `expected undefined to match object { method: "GET", url: "https://recorded.example.test/v2/bills/SETP990000550/download-pdf" }` and received `undefined`, because the default does not call Factus. | Same command after `downloadPdf` on `FactusInvoicingProvider` and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  18 passed (18)`. |

### Deviations from Design

`design.md` names `downloadPdf(number)` and does not name the HTTP path or the response field. The adapter GETs `/v2/bills/{number}/download-pdf` and returns `Uint8Array` decoded from Factus `data.pdf_base_64_encoded`. That is the published Factus v2 download (the same `/v2` bill family this adapter already calls) and the port's return type. `lookupAcquirer` was already `GET /v2/dian/acquirer`. Its method was not changed. The new assertion records two calls (token, then acquirer) and rejects any URL that contains `/v2/bills/validate`. No municipalities JSON, SQL, or Postgres repo was added. Task 3.7 stays unchecked.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 3.9 and 3.10 only. No municipalities JSON, SQL, Postgres, local-node, sqlite, outbox, or sync. Tasks 3.7, 3.8, and 4.1 were not started.
- Files in this batch: `contexts/invoicing/adapters/factus/factus-invoicing-provider.test.ts`, `contexts/invoicing/adapters/factus/factus-invoicing-provider.ts`, `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 114 lines (`factus-invoicing-provider.test.ts` +78, `factus-invoicing-provider.ts` +35/−1). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted. This batch is not committed.
- Next unchecked task: 3.7

## Pair 4.1–4.2

This batch adds pre-bill pair 4.1–4.2 and stops there. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. Tasks 3.7 and 3.8 stay unchecked: the committed Factus municipalities JSON is absent, and task 3.7 says to stop rather than seed DIVIPOLA.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project orders contexts/orders/application/request-check/request-check.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. The run is after `pnpm exec biome check --write` on the touched files. |
| Runtime harness command/scenario and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/composition/cloud-pre-bill-link.test.ts apps/api-cloud/test/composition/bootstrap.test.ts apps/api-cloud/test/http/orders-realtime.controller.test.ts apps/api-cloud/test/http/request-check.controller.test.ts` — exit 0. `Test Files  4 passed (4)`. `Tests  11 passed (11)`. HMAC-SHA256 runs through `node:crypto` with an in-memory secret. No live Factus or Postgres. The realtime case publishes `billing_data_received` and the SSE stream returns that kind. |
| Rollback boundary | `contexts/orders/application/ports/pre-bill-link.ts`, `contexts/orders/application/request-check/request-check.ts`, `contexts/orders/application/request-check/request-check.test.ts`, the `PreBillLink` export in `contexts/orders/application/entry-port.ts`, `BillingDataReceived` in `contexts/orders/application/ports/realtime-hub.ts`, `billing_data_received` in `shared/contracts/dining-room.ts`, `apps/api-cloud/src/http/orders-realtime.controller.ts`, `apps/api-cloud/src/composition/cloud-pre-bill-link.ts`, `apps/api-cloud/src/composition/application-module.ts`, `apps/api-cloud/test/composition/bootstrap.test.ts`, `apps/api-cloud/test/composition/cloud-pre-bill-link.test.ts`, `apps/api-cloud/test/http/orders-realtime.controller.test.ts`, the `/d/` accept in `contexts/invoicing/adapters/crypto/hmac-link-signer.ts` and its test, and the crypto export in `contexts/invoicing/package.json`. Reverting those leaves pairs 1.1–3.6 and 3.9–3.10 in place. Tasks 3.7 and 3.8 stay unchecked. |

Sibling re-run after GREEN: `pnpm exec vitest run --project invoicing contexts/invoicing/adapters/crypto/hmac-link-signer.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. `pnpm architecture` — exit 0. `no dependency violations found (913 modules, 2952 dependencies cruised)`.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.1 → 4.2 | `pnpm exec vitest run --project orders contexts/orders/application/request-check/request-check.test.ts` exit 1. `FAIL contexts/orders/application/request-check/request-check.test.ts` — `Cannot find module '#application/ports/pre-bill-link.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `pre-bill-link.ts`, the `RequestCheck` port argument, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |

### Deviations from Design

`HmacLinkSigner.sign` still returns `/f/<payload>.<hmac>`. `CloudPreBillLink` copies that payload under `/d/` when `portalPreBillEnabled` is true. `verify` accepts both prefixes. The default in api-cloud is enabled false, so a pre-bill qr stays empty until that flag is set. Orders does not import invoicing. The realtime contract for `billing_data_received` lives in `shared/contracts/dining-room.ts` because that file already owns `ordersRealtimeEvent`. The pre-bill HTTP body was not given a link. No municipalities JSON and no `0016` SQL.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 4.1 and 4.2 only. Tasks 3.7 and 3.8 were not started. Task 5.1 was not started.
- Files in this batch: the rollback boundary above, plus `openspec/changes/p1-08-invoicing-portal/tasks.md` and `openspec/changes/p1-08-invoicing-portal/apply-progress.md`.
- Estimated review budget impact: tracked diff is 207 additions and 11 deletions. Untracked files add `pre-bill-link.ts` (10), `cloud-pre-bill-link.ts` (40), and `cloud-pre-bill-link.test.ts` (40). About 297 additions. That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted. This batch is not committed.
- Next unchecked task: 3.7, blocked on the missing Factus municipalities JSON. The next implementable task is 5.1.

## Pair 5.1–5.2

This batch adds HTTP pair 5.1–5.2 and continues into the assigned reinvoice and UI tasks. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. Tasks 3.7 and 3.8 stay unchecked.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud portal.controller.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The run is after `pnpm exec biome check --write` on the portal contract, its export, the controller, the test, and `application-module.ts`. That Biome run reported `Checked 5 files in 28ms. Fixed 4 files.` |
| Runtime harness command/scenario and exact result | Same command. Nest boots through `createApplication` and `inject` with no listening socket. HMAC-SHA256 uses `portal.link-key` from in-memory secrets. No live Factus. Not N/A. |
| Rollback boundary | `shared/contracts/invoicing-portal.ts`, the invoicing-portal export in `shared/contracts/index.ts`, `apps/api-cloud/src/http/portal.controller.ts`, `apps/api-cloud/test/http/portal.controller.test.ts`, and the portal registration in `apps/api-cloud/src/composition/application-module.ts`. Reverting those removes the public buyer lookup and the unconfigured-sender boot throw. Pairs 1.1–4.2 stay in place. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 5.1 → 5.2 | `pnpm exec vitest run --project api-cloud portal.controller.test.ts` exit 1. `FAIL \|api-cloud\| test/http/portal.controller.test.ts`. `Error: ENOENT: no such file or directory, open 'C:\Users\csar-\Proyectos\blackHole\shared\contracts\invoicing-portal.ts'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the contract, controller, composition, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |

### Deviations from Design

The signed pre-bill token is longer than Fastify's default parameter length, so `POST /portal/buyers` carries the token in a strict body instead of a path parameter. The customer route stays `/d/:token`. Unknown, expired, limited, and provider failure all return HTTP 404 with `{}`. A found lookup returns masks only. `OneTimeCodeSender` throws at boot only when composition is asked for `"unconfigured"`. The default sender does not throw, so existing `createApplication` callers still boot. The token is not placed on the pre-bill HTTP payload. `dining-room.ts` was not edited.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 5.1 and 5.2. Tasks 3.7 and 3.8 were not started.
- Next unchecked task in this assignment: 5.3.

## Pair 5.3–5.4

This batch adds HTTP pair 5.3–5.4. Not committed. `size:exception` was not granted. `strict-tdd.md` was not loaded. Mode stays Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. Tasks 3.7 and 3.8 stay unchecked. `dining-room.ts` was not edited: the pre-bill HTTP payload did not gain a link.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud portal.controller reinvoice.controller` — exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. The run is after `pnpm exec biome check --write` on the reinvoice controller, its test, and `application-module.ts`. That Biome run reported `Checked 3 files in 35ms. Fixed 3 files.` |
| Runtime harness command/scenario and exact result | Same command. Nest `inject` does not listen. The cashier session is 403 and the request store stays empty. A closed window and `off` return `rejected` with no provider call. Not N/A. |
| Rollback boundary | `apps/api-cloud/src/http/reinvoice.controller.ts`, `apps/api-cloud/test/http/reinvoice.controller.test.ts`, and the `RequestReinvoice` registration in `apps/api-cloud/src/composition/application-module.ts`. Reverting those removes the staff reinvoice route. Pair 5.1–5.2 stays in place. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 5.3 → 5.4 | `pnpm exec vitest run --project api-cloud reinvoice.controller.test.ts` exit 1. `FAIL \|api-cloud\| test/http/reinvoice.controller.test.ts` — `Cannot find module '#src/http/reinvoice.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | `pnpm exec vitest run --project api-cloud portal.controller reinvoice.controller` after the controller, composition, and Biome: exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. |

### Deviations from Design

Approval stays on the existing credit-note route. This controller records the request only. `RequestReinvoice` receives the provider and does not call it. Outside `same_day`, and when the window is `off`, the response is `rejected` and the counting provider records no call. A cashier without `sale.credit-note` gets 403 `{ error: "SaleCreditNoteDenied" }` and the store stays empty. No pre-bill link was added to the dining-room payload.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 5.3 and 5.4. Tasks 3.7 and 3.8 were not started.
- Next unchecked task in this assignment: 6.1.

## Pair 6.1–6.2

Customer portal `/d/:token` and `/f/:link`. No `/m`. Not committed. `strict-tdd.md` was not loaded. Tasks 3.7 and 3.8 stay unchecked. Root `vitest.config.ts` was not edited.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --config apps/customer-portal/vitest.config.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. After `pnpm exec biome check --write` on the UI files (`Checked 17 files in 27ms. Fixed 16 files.`). |
| Runtime harness command/scenario and exact result | jsdom. The form clears the one-time code on submit and `Storage.setItem` is not called. `/f/:link` shows `In process`, then a PDF link. Not N/A. |
| Rollback boundary | `apps/customer-portal/src/billing-data-screen.tsx`, `invoice-link-screen.tsx`, `router.tsx`, `apps/customer-portal/test/portal-screens.test.tsx`, `test/setup.ts`, `vitest.config.ts`, and the testing devDependencies in `apps/customer-portal/package.json`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 6.1 → 6.2 | The screen and the test landed in the same edit, so there is no captured missing-module failure for this pair. | Same config command after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

### Deviations from Design

`customer-portal` is not a project in the forbidden root `vitest.config.ts`. `pnpm exec vitest run --project customer-portal --project venue-app --project admin-web` exits 0 and the verbose reporter lists only `|admin-web|` files: `Test Files  8 passed (8)`, `Tests  25 passed (25)`. The customer evidence is the app config above. The one-time code stays in the typed field and is cleared on submit.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Current batch boundary: tasks 6.1 and 6.2. Tasks 3.7 and 3.8 were not started.
- Next unchecked task in this assignment: 6.3.

## Pair 6.3–6.4

Venue register shows data received and keeps charge off until the cashier chooses. UI only. Not committed. `contexts/cash-register` was not edited.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --config apps/venue-app/vitest.config.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. After the same Biome run (`Checked 17 files in 27ms. Fixed 16 files.`). |
| Runtime harness command/scenario and exact result | jsdom. With a check on the table, the screen shows `Datos recibidos` and `Cobrar e imprimir factura` stays disabled until `Usar datos del portal`. Not N/A. |
| Rollback boundary | `apps/venue-app/src/cash-register/register-screen.tsx`, `apps/venue-app/test/cash-register/register-screen.test.tsx`, `apps/venue-app/test/setup.ts`, `apps/venue-app/vitest.config.ts`, and the testing devDependencies in `apps/venue-app/package.json`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 6.3 → 6.4 | First run of `pnpm exec vitest run --config apps/venue-app/vitest.config.ts`: `Test Files  1 failed (1)`, `Tests  1 failed \| 1 passed (2)`. `getByRole("status", { name: "Datos recibidos" })` failed because the accessible name of `role=status` is empty. | After `getByText("Datos recibidos")` and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. |

### Deviations from Design

`venue-app` is not a project in the forbidden root `vitest.config.ts`. The passing command is the app config. Charge stays a UI gate. No cash-register domain change.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Current batch boundary: tasks 6.3 and 6.4. Tasks 3.7 and 3.8 were not started.
- Next unchecked task in this assignment: 6.5.

## Pair 6.5–6.6

Admin reinvoice window `same_day`, `same_month`, or `off`. Approval only with `sale.credit-note`. The reports route was not replaced. Not committed.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project admin-web test/fiscal/reinvoice-window.test.tsx` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. After the same Biome run (`Checked 17 files in 27ms. Fixed 16 files.`). The tasks.md command `pnpm exec vitest run --project customer-portal --project venue-app --project admin-web` also exits 0 with only admin-web files: `Test Files  8 passed (8)`. `Tests  25 passed (25)`. |
| Runtime harness command/scenario and exact result | jsdom. Radios expose `same_day`, `same_month`, and `off`. Without `sale.credit-note` the approve button stays disabled and the click does not call `onApprove`. With that permission, one click calls `onApprove` once. Not N/A. |
| Rollback boundary | `apps/admin-web/src/fiscal/reinvoice-view.tsx`, `reinvoice-screen.tsx`, the `/fiscal/reinvoice` route in `apps/admin-web/src/router.tsx`, the nav child in `apps/admin-web/src/shell/navigation.ts`, and `apps/admin-web/test/fiscal/reinvoice-window.test.tsx`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 6.5 → 6.6 | `pnpm exec vitest run --project admin-web test/fiscal/reinvoice-window.test.tsx` exit 1. `Failed to resolve import "#src/fiscal/reinvoice-view.js"`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the view, screen, route, nav, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

### Deviations from Design

Approval on this screen is UI only. The HTTP request route from pair 5.3–5.4 records a pending request and does not approve a credit note. `reports/sales` is unchanged. `dining-room.ts` was not edited.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Current batch boundary: tasks 6.1 through 6.6. Tasks 3.7 and 3.8 stay unchecked because the Factus municipalities JSON is absent. No DIVIPOLA download and no invented catalog.
- Assigned tasks 5.1–5.4 and 6.1–6.6 are done. This batch is not committed. `size:exception` was not granted.
- Next unchecked task: 3.7, blocked on the missing Factus municipalities JSON.

## Follow-up: staff approval

The admin button was local React state and the staff controller only ran `RequestReinvoice`. This follow-up adds the approval route. Tasks 5.1–6.6 were not redone. Tasks 3.7 and 3.8 stay unchecked. Not committed. `strict-tdd.md` was not loaded. `dining-room.ts`, orders, reporting, cash-register, customer-portal, venue register, and SQL were not edited.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud test/http/reinvoice.controller.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. `pnpm exec vitest run --project admin-web test/fiscal/reinvoice-window.test.tsx` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Both runs are after `pnpm exec biome check --write` on the seven touched files: `Checked 7 files in 35ms. Fixed 1 file.` |
| Runtime harness command/scenario and exact result | Nest `inject` does not listen. A cashier `POST /tenants/:tenantId/venues/:venueId/reinvoices/approve` is 403 `{ error: "SaleCreditNoteDenied" }`, `IssueCreditNote.execute` is not called, and the provider call list stays empty. A manager inside `same_day` gets 200 `{ outcome: "approved" }` and `ApproveReinvoice.execute` runs once; the provider records one `validateCreditNote`. The next Bogota day and `off` return 200 `{ outcome: "rejected" }` with no provider call. jsdom: the admin button posts that route and the test reads the request. Not N/A. |
| Rollback boundary | `POST reinvoices/approve` in `apps/api-cloud/src/http/reinvoice.controller.ts`, the `ApproveReinvoice` factory in `apps/api-cloud/src/composition/application-module.ts`, `approveReinvoiceCommand` and `reinvoiceApprovalResult` in `shared/contracts/invoicing-portal.ts` plus their export in `shared/contracts/index.ts`, the approval tests, and the fetch in `apps/admin-web/src/fiscal/reinvoice-screen.tsx`. Reverting those removes staff approval. The request route from pair 5.3–5.4 stays. |

### RED then GREEN

| Step | RED (command and result) | GREEN |
|---|---|---|
| HTTP approval | `pnpm exec vitest run --project api-cloud test/http/reinvoice.controller.test.ts` exit 1. `Test Files  1 failed (1)`. `Tests  3 failed \| 3 passed (6)`. The new permission was `undefined`, `application.get(ApproveReinvoice)` stopped the process, and the closed window returned 404. | Same command after the route, registration, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |
| Admin button | `pnpm exec vitest run --project admin-web test/fiscal/reinvoice-window.test.tsx` exit 1. `Tests  1 failed \| 2 passed (3)`. The status text appeared and `fetch` was called 0 times. | Same command after the screen posts the route, and after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

### Deviations from Design

The approval body is `approveReinvoiceCommand` (`.strict()`, no `z.any()`). `permissions` are not accepted from the client; after `sale.credit-note` is allowed, the route passes that permission into `ApproveReinvoice`. `tenantId` and `siteId` on the credit note come from the path. The same in-memory request rows back both the request and the approval. `IssueDocument` is registered with a zero queued closure and an empty document store so a replacement with `documentBalance: 0` does not call `validate`. Inside the window the credit note still calls `validateCreditNote` once. Outside the window that call does not happen. The admin window stays `same_day`, `same_month`, or `off`, and the button stays disabled without `sale.credit-note`. The screen posts `POST /tenants/pilot/venues/chapinero/reinvoices/approve`.

### Issues Found

None.

### Workload / PR Boundary

- Mode: chained PR slice
- Current batch boundary: staff approval follow-up only. Tasks 3.7 and 3.8 were not started.
- Next unchecked task: 3.7, blocked on the missing Factus municipalities JSON.


