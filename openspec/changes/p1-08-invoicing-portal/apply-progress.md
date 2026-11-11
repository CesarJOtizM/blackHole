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

