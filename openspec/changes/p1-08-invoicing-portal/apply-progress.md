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

- [ ] 1.9 RED `domain/reinvoice-window.test.ts`
- [ ] 1.10 onward

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
