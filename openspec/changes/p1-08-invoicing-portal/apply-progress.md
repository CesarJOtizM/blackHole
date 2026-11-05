# Apply progress: p1-08-invoicing-portal

Work units: domain pairs 1.1–1.2, 1.3–1.4, and 1.5–1.6. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked RED/GREEN pairs. Pair 1.1–1.2 started the chain. Pair 1.3–1.4 followed. This batch adds pair 1.5–1.6 and stops there. Not committed. `size:exception` was not granted.

## Completed tasks

- [x] 1.1 RED `contexts/invoicing/domain/portal-link.test.ts`: expired or other account shows nothing. No crypto.
- [x] 1.2 GREEN `domain/portal-link.ts`, `domain/index.ts`.
- [x] 1.3 RED `contexts/invoicing/domain/one-time-code.test.ts`: 6 digits, 10 min, 5 tries, single use, 60 s. Digest only.
- [x] 1.4 GREEN `domain/one-time-code.ts` and its export in `domain/index.ts`. Not Twilio Verify. The domain does not call the network.
- [x] 1.5 RED `contexts/invoicing/domain/billing-data.test.ts`: bad NIT (`assertNitCheckDigit`); no consent stores nothing; email and DANE required; `deleted_at` keeps snapshots.
- [x] 1.6 GREEN `domain/billing-data.ts` and its export in `domain/index.ts`. No catalog lookup. The domain does not call the network.

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

- [ ] 1.7 RED `domain/masking.test.ts`
- [ ] 1.8 onward

## Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous.
- Completed work units: domain pair 1.1–1.2, domain pair 1.3–1.4, then domain pair 1.5–1.6
- Previous batch boundary (kept): tasks 1.3 and 1.4 only. Files: `contexts/invoicing/domain/one-time-code.test.ts`, `contexts/invoicing/domain/one-time-code.ts`, `contexts/invoicing/domain/index.ts` (one-time-code exports). About 490 domain lines. Above the 400-line review budget for that slice. `size:exception` was not granted.
- Current batch boundary: tasks 1.5 and 1.6 only. No use cases, adapters, HTTP, UI, SQL, or D-48 docs.
- Files in this batch: `contexts/invoicing/domain/billing-data.test.ts`, `contexts/invoicing/domain/billing-data.ts`, `contexts/invoicing/domain/index.ts` (billing-data exports only), `openspec/changes/p1-08-invoicing-portal/tasks.md`, `openspec/changes/p1-08-invoicing-portal/apply-progress.md`
- Estimated review budget impact: this pair is 394 lines (`billing-data.test.ts` 203, `billing-data.ts` 176, plus 15 `index.ts` export lines). That stays under the 400-line review budget. The change forecast stays High. `size:exception` was not granted.
