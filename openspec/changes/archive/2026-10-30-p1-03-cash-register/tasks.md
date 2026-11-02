# Tasks: Cash Register

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 4800–7000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Units 1–16 to master |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

PR 1 is 1.1–1.3. One unit per apply. Apply still asks. Cloud only (D-37). RED then GREEN. No SQLite, outbox, sync, or Factus.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Open shift | 1 | `cash-shift` |
| 2 | Movements | 2 | `cash-movement` |
| 3 | Payment, tip | 3 | `payment` |
| 4 | Equal split | 4 | `account-split` |
| 5 | Blind count | 5 | `cash-count` |
| 6 | Open, movement | 6 | memory |
| 7 | Charge, split | 7 | split if large |
| 8 | Count, close | 8 | memory |
| 9 | Memory contract | 9 | manual terminal |
| 10 | Postgres core | 10 | PGlite |
| 11 | Postgres rest | 11 | append `0010` |
| 12 | Mark paid | 12 | orders |
| 13 | HTTP shift | 13 | `inject` |
| 14 | HTTP charge | 14 | `to_clean` |
| 15 | HTTP count | 15 | no expected |
| 16 | Node 403 | 16 | stores nothing |

## Phase 1: Domain (units 1–5)

- [x] 1.1 Add `contexts/cash-register/package.json`, `tsconfig.json`, root reference, vitest `cash-register`, skeleton context allow.
- [x] 1.2 RED `domain/cash-shift.test.ts`: 200000 opens; `ShiftAlreadyOpen`.
- [x] 1.3 GREEN `domain/cash-shift.ts`, `domain/index.ts`. Prefix `shift_`.
- [x] 1.4 RED `domain/cash-movement.test.ts`: 300000 drops cash; `MissingReason`.
- [x] 1.5 GREEN append-only movements on `domain/cash-shift.ts`. Prefix `movement_`.
- [x] 1.6 RED `domain/payment.test.ts`: change 5000; `IncompleteCard`; `ChangeExceedsCash`; `MissingTip`; tip apart; zero tip.
- [x] 1.7 GREEN `domain/payment.ts`. Terminal, approval, brand, last 4. Prefix `payment_`.
- [x] 1.8 RED `domain/account-split.test.ts`: 33334, 33333, 33333; `SplitImbalance`; `originTableId`; partial stays open.
- [x] 1.9 GREEN `domain/account-split.ts`. Lines stay in orders. Prefix `part_`.
- [x] 1.10 RED `domain/cash-count.test.ts`: no expected yet; `VarianceNeedsApproval`; `SelfApprovalRejected`; gap 20000.
- [x] 1.11 GREEN `domain/cash-count.ts`. `counting` blocks charges. Partial stays `open`. `ShiftClosed`. New movement. Prefix `count_`.

## Phase 2: Use cases (units 6–8)

- [x] 2.1 RED `application/open-shift/open-shift.test.ts`, `application/record-movement/record-movement.test.ts`: unsaved; `UnknownRegister`.
- [x] 2.2 GREEN both, `ports/cash-register-repository.ts`, `ports/register-lookup.ts`, `application/entry-port.ts`.
- [x] 2.3 RED `application/charge-check/charge-check.test.ts`: one `queued` closure; `commandId` once; `MarkAccountPaid` once. No `CalculateTaxes`.
- [x] 2.4 GREEN `application/charge-check/charge-check.ts`, `ports/account-gateway.ts`, `ports/card-terminal.ts`. Prefix `closure_`.
- [x] 2.5 RED `application/split-account/split-account.test.ts`: remainder; `originTableId`; unsaved imbalance.
- [x] 2.6 GREEN `application/split-account/split-account.ts`.
- [x] 2.7 RED `application/submit-count/submit-count.test.ts`, `application/approve-variance/approve-variance.test.ts`, `application/close-shift/close-shift.test.ts`: after submit; `varianceCop`; partial `open`.
- [x] 2.8 GREEN those three. Recount only in `counting`.

## Phase 3: Adapters (units 9–11)

- [x] 3.1 RED `ports/cash-register-repository.contract.ts`, `adapters/memory/in-memory-cash-register-repository.contract.test.ts`: hidden tenant; insert-only; one open shift.
- [x] 3.2 GREEN `adapters/memory/in-memory-cash-register-repository.ts`, `adapters/manual-terminal/manual-card-terminal.ts`. No SQLite.
- [x] 3.3 RED `adapters/postgres/drizzle-cash-register-repository.contract.test.ts`: PGlite, `cash_register_app`, forced RLS. No Drizzle mock.
- [x] 3.4 GREEN `adapters/postgres/0010_cash_register.sql`, `schema.ts`. Follow `0009_tax.sql`. Shifts, movements, payments.
- [x] 3.5 RED parts, counts, closures: one closure; read omits expected.
- [x] 3.6 GREEN append those tables to `0010_cash_register.sql` only.

## Phase 4: Orders (unit 12)

- [x] 4.1 RED `contexts/orders/application/mark-account-paid/mark-account-paid.test.ts`: `to_clean`; second call stays; free rejected. Leave `ReleaseTable`.
- [x] 4.2 GREEN `mark-account-paid.ts`, `entry-port.ts`, `#application/mark-account-paid/*`. Only `dining_tables`.

## Phase 5: HTTP (units 13–15)

Routes under `tenants/:tenantId/venues/:venueId`. Permissions: `cash.open-shift`, `cash.movement`, `cash.partial-withdrawal`, `sale.charge`, `cash.approve-variance`. GET hides expected.

- [x] 5.1 RED `apps/api-cloud/test/http/cash-shift.controller.test.ts`: `inject`; 200; 403/400 save nothing; 409 `ShiftAlreadyOpen`.
- [x] 5.2 GREEN `apps/api-cloud/src/http/cash-shift.controller.ts`, `shared/contracts/cash-register.ts`, `index.ts`, `composition/register-directory.ts`. `safeParse`, audit. Not `authorization.ts`.
- [x] 5.3 RED `apps/api-cloud/test/http/charge-check.controller.test.ts`: pay once; `to_clean`; 403 saves nothing.
- [x] 5.4 GREEN `apps/api-cloud/src/http/charge-check.controller.ts`, `composition/orders-account.ts` (`GetCheck`, `ViewVenueMenu`, `MarkAccountPaid`).
- [x] 5.5 RED `apps/api-cloud/test/http/cash-count.controller.test.ts`: GET omits expected; `SelfApprovalRejected`; final 409.
- [x] 5.6 GREEN `apps/api-cloud/src/http/cash-count.controller.ts`. `cash.open-shift`, `cash.approve-variance`. Audit after save.

## Phase 6: Node (unit 16)

- [x] 6.1 RED `apps/local-node/test/http/cash-register.controller.test.ts`: 403 `CashRegisterRejected`; nothing stored.
- [x] 6.2 GREEN `apps/local-node/src/http/cash-register.controller.ts`, `application-module.ts`, skeleton allow. No repository.
