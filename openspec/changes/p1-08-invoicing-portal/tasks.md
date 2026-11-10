# Tasks: Invoicing Portal

## Review Workload Forecast

4200–6200 lines. ask-on-risk. Bases if chained: PR1 = tracker; each next PR bases on the previous.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked RED/GREEN pairs. Each pair is one PR based on the previous. Domain pair 1.1–1.2 starts the chain.
400-line budget risk: High

Cloud only (D-37). No local-node, SQLite, outbox, shared/sync, or DEFERRED outage scenarios. Threats N/A. No captcha. strict_tdd false: RED then GREEN. English ids. `#imports` only. Factus emails the invoice; the portal code does not. Orders uses ports wired in api-cloud.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Domain | PR1 base tracker | `pnpm vitest run --project invoicing domain` | N/A: pure domain | domain files |
| 2 | Use cases | PR2 base PR1 | `pnpm vitest run --project invoicing application` | N/A: in-memory ports | use-case folders |
| 3 | Adapters | PR3 base PR2 | `pnpm vitest run --project platform provider-rate-gate` and `--project invoicing adapters` | N/A: stubbed fetch, PGlite | `0016` and adapters |
| 4 | Pre-bill | PR4 base PR3 | `pnpm vitest run --project orders request-check` | N/A: in-memory printer | QR and notice |
| 5 | HTTP | PR5 base PR4 | `pnpm vitest run --project api-cloud portal.controller reinvoice.controller` | Nest inject, no listen | controllers, contract |
| 6 | UI | PR6 base PR5 | `pnpm vitest run --project customer-portal --project venue-app --project admin-web` | N/A: no browser runner | those screens |

## 1. Domain

- [x] 1.1 RED `contexts/invoicing/domain/portal-link.test.ts`: expired or other account shows nothing. No crypto.
- [x] 1.2 GREEN `domain/portal-link.ts`, `domain/index.ts`.
- [x] 1.3 RED `domain/one-time-code.test.ts`: 6 digits, 10 min, 5 tries, single use, 60 s. Digest only.
- [x] 1.4 GREEN `domain/one-time-code.ts`. Not Twilio Verify.
- [x] 1.5 RED `domain/billing-data.test.ts`: bad NIT (`assertNitCheckDigit`); no consent stores nothing; email and DANE required; `deleted_at` keeps snapshots.
- [x] 1.6 GREEN `domain/billing-data.ts`.
- [x] 1.7 RED `domain/masking.test.ts`: `J*** P***`, `j***@gmail.com`.
- [x] 1.8 GREEN `domain/masking.ts`.
- [x] 1.9 RED `domain/reinvoice-window.test.ts`: `same_day` default, `same_month`, `off`, America/Bogota.
- [x] 1.10 GREEN `domain/reinvoice-window.ts`.

## 2. Use cases

- [x] 2.1 RED `application/look-up-portal-buyer/look-up-portal-buyer.test.ts`: masks plus `lookupId`; full row stays server-side; `acquire(taxId, at, 60)`; 30-day cache; failure reveals nothing; no bag use (D-21); shapeless refusal; no cross-tenant.
- [x] 2.2 GREEN that folder. `#application/look-up-portal-buyer/*`.
- [x] 2.3 RED `application/request-remembered-code/request-remembered-code.test.ts`: registered contact only. Sender gets channel, destination, code, companyName, expiresInMinutes. Unconfigured throws. Code not logged. Other company hidden.
- [x] 2.4 GREEN that folder. `ports/one-time-code-sender.ts` and `.contract.ts`.
- [x] 2.5 RED `application/verify-remembered-code/verify-remembered-code.test.ts`: valid code reveals; ID alone does not; fifth miss locks; spent code fails.
- [x] 2.6 GREEN that folder. `ports/code-digest.ts` and `.contract.ts`.
- [x] 2.7 RED `application/record-billing-data/record-billing-data.test.ts`: bad NIT is a field error; no consent writes nothing; consent stores date, policy, link; per company; `billing_data_received`.
- [x] 2.8 GREEN that folder. `municipality-catalog.ts`, `billing-data-notifier.ts`, and contracts.
- [x] 2.9 RED `application/request-data-deletion/request-data-deletion.test.ts`: code required; future use stops; snapshots kept.
- [x] 2.10 GREEN that folder.
- [x] 2.11 RED `application/get-portal-invoice/get-portal-invoice.test.ts`: in process, then `downloadPdf`. `/f/<referenceCode>.<hmac>`. Expired pre-bill empty. No Factus mail.
- [x] 2.12 GREEN that folder. `downloadPdf(number)` on `ports/invoicing-provider.ts`.
- [ ] 2.13 RED `application/request-reinvoice/request-reinvoice.test.ts`: outside window or `off` calls no provider. Inside, record only.
- [ ] 2.14 GREEN that folder.
- [ ] 2.15 RED `application/approve-reinvoice/approve-reinvoice.test.ts`: `sale.credit-note` only. Audit, code 2, new invoice after accept, two documents. Recheck window; no provider if closed. Do not edit consumer-final.
- [ ] 2.16 GREEN that folder via `IssueCreditNote`. Ports `link-signer.ts`, `portal-repository.ts`, `portal-request-limiter.ts` and contracts. Export eight from `entry-port.ts`. One `#application/<folder>/*` each.

## 3. Ceiling and adapters

- [ ] 3.1 RED `contexts/platform/application/ports/provider-rate-gate.contract.ts`: default stops at 80; ceiling 60 stops at 60.
- [ ] 3.2 GREEN `acquire(taxId, at, ceiling = 80)` on port, memory, and drizzle gates.
- [ ] 3.3 RED `contexts/invoicing/adapters/twilio`: stubbed `fetch`. SMS Twilio Messages. Email SendGrid v3. Secrets via `Secrets`: `twilio.account-sid`, `twilio.auth-token`, `twilio.sms-from`, `sendgrid.api-key`, `sendgrid.from-email`. `OneTimeCodeDeliveryFailed`. Not Verify, Bird, SES, SNS.
- [ ] 3.4 GREEN `adapters/twilio`, `#adapters/twilio/*`. Tests: `adapters/memory`. No secret files.
- [ ] 3.5 RED `adapters/crypto`: HMAC-SHA256, key `portal.link-key`. `/f/` suffix verifies. Digest matches.
- [ ] 3.6 GREEN `HmacLinkSigner`, `#adapters/crypto/*`. Domain stays crypto-free.
- [ ] 3.7 RED memory and PGlite: forced RLS. No SQLite. Unknown DANE fails. Seed the committed Factus municipalities JSON. No DIVIPOLA. Stop if that JSON is absent.
- [ ] 3.8 GREEN `adapters/postgres/0016_invoicing_portal.sql` and repos: `remembered_buyers`, `consents`, `one_time_codes`, `portal_lookups`, `acquirer_cache`, `portal_submissions`, `reinvoice_requests`, `portal_settings`, `portal_rate_windows`, `dane_municipalities`. Default enabled false, window `same_day`.
- [ ] 3.9 RED `adapters/factus/factus-invoicing-provider.test.ts`: `downloadPdf` GET. `lookupAcquirer` GET does not validate a bill.
- [ ] 3.10 GREEN `downloadPdf` in `adapters/factus`.

## 4. Pre-bill

- [ ] 4.1 RED `contexts/orders/application/request-check/request-check.test.ts`: enabled signs `/d/` into `qr`. Disabled leaves `qr` empty.
- [ ] 4.2 GREEN `ports/pre-bill-link.ts`. Add `billing_data_received` on `realtime-hub.ts`. Wire in api-cloud. No invoicing interior import.

## 5. HTTP

- [ ] 5.1 RED `apps/api-cloud/test/http/portal.controller.test.ts`: no session. One shapeless refusal. Masks. `.strict()`. No `z.any()`.
- [ ] 5.2 GREEN `shared/contracts/invoicing-portal.ts`, `index.ts`, `portal.controller.ts`, composition. Unconfigured sender throws at boot.
- [ ] 5.3 RED `apps/api-cloud/test/http/reinvoice.controller.test.ts`: missing `sale.credit-note` is 403 and stores nothing. Outside window does not call Factus.
- [ ] 5.4 GREEN `reinvoice.controller.ts`. Touch `dining-room.ts` only if the pre-bill payload gains a link.

## 6. UI

- [ ] 6.1 RED: vitest project `customer-portal` (jsdom). `/d/:token` form. `/f/:link` in process, then PDF.
- [ ] 6.2 GREEN `apps/customer-portal/src/`. Screen does not send the code.
- [ ] 6.3 RED: vitest project `venue-app`. Data received. Charge stays off until the cashier chooses. UI only.
- [ ] 6.4 GREEN `apps/venue-app/src/cash-register/register-screen.tsx`.
- [ ] 6.5 RED: vitest project `admin-web`. Window `same_day`, `same_month`, or `off`. Approval only with `sale.credit-note`.
- [ ] 6.6 GREEN `apps/admin-web/src/` window and approvals.
