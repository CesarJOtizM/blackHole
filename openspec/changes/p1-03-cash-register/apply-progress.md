# Apply Progress: Cash Register

## Unit 1 — Open shift

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. This batch is work unit 1 only (tasks 1.1–1.3). No `size:exception`. Not committed. No pull request.

### Completed

- [x] 1.1 Add `contexts/cash-register/package.json`, `tsconfig.json`, root reference, vitest `cash-register`, skeleton context allow.
- [x] 1.2 RED `domain/cash-shift.test.ts`: 200000 opens; `ShiftAlreadyOpen`.
- [x] 1.3 GREEN `domain/cash-shift.ts`, `domain/index.ts`. Prefix `shift_`.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1. `Cannot find module '#domain/cash-shift.js'`. `Test Files  1 failed (1)`. `Tests  no tests`.
- GREEN: `pnpm vitest run --project cash-register` exited 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`.
- `pnpm vitest run --project skeleton skeleton.test.ts` exited 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0.
- `pnpm exec biome check contexts/cash-register` exited 0 after formatting that folder.

`pnpm vitest run --project skeleton` exited 1 on `route-permission-declaration.test.ts`: `local-node/tax.controller.ts` POST `tax-quotes` and POST `fiscal-profiles/adopt` declare no permission. This batch did not edit `apps/local-node`. That file is outside the allowed edit roots.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/package.json` | Created `@blackhole/cash-register` with `#domain/*` |
| `contexts/cash-register/tsconfig.json` | Created composite project, include `domain` |
| `contexts/cash-register/domain/cash-shift.test.ts` | RED then kept green |
| `contexts/cash-register/domain/cash-shift.ts` | Open shift and `ShiftAlreadyOpen` |
| `contexts/cash-register/domain/index.ts` | Exported the domain layer |
| `tsconfig.json` | Added the `contexts/cash-register` reference |
| `vitest.config.ts` | Added project `cash-register` |
| `tools/skeleton/skeleton.test.ts` | Allowed context `cash-register` |
| `pnpm-lock.yaml` | Linked `contexts/cash-register` and catalog `@types/node` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 1.1–1.3 done |
| `openspec/changes/p1-03-cash-register/state.yaml` | Set `apply` to `partial` |

### Notes

`CashShift.forRegister` binds the organization register id. `open` with cashier `user_cashier` and opening float `200000` stores shift id `shift_front_1`, state `open`, and that cashier on that register. A second `open` throws `ShiftAlreadyOpen` before any field changes. Identifiers must use the `shift_` prefix (`InvalidShiftId`). Amounts must be non-negative integer COP (`InvalidCashAmount`). The domain does not import Nest, SQL, Zod, or `node:crypto`. The caller supplies the shift id.

The opening float in this unit is one integer total. Denomination lines are not part of tasks 1.1–1.3. States `counting` and `closed` stay for later tasks.

### Remaining

Tasks 1.4 onward stay unchecked. Next batch is unit 2 (tasks 1.4–1.5). Next unchecked task is 1.4.

## Unit 2 — Movements

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. This batch is work unit 2 only (tasks 1.4–1.5). No `size:exception`. Not committed. No pull request. `apps/local-node` was not edited. `openspec/changes/p0-09-monitoring-and-errors/` was not edited.

### Completed

- [x] 1.4 RED `domain/cash-movement.test.ts`: 300000 drops cash; `MissingReason`.
- [x] 1.5 GREEN append-only movements on `domain/cash-shift.ts`. Prefix `movement_`.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before `recordMovement` existed. The withdrawal test failed with `shift.recordMovement is not a function`. The cash-out test failed with `MissingReason is not a constructor` while that class was still absent. `Test Files  1 failed | 1 passed (2)`. `Tests  2 failed | 2 passed (4)`. The two passing tests are the unit 1 shift tests.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after `recordMovement`. `Test Files  2 passed (2)`. `Tests  4 passed (4)`. Repeated after Biome format; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0.
- `pnpm exec biome check` on the three touched domain files exited 0 after formatting line endings and wraps.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/domain/cash-movement.test.ts` | RED then kept green |
| `contexts/cash-register/domain/cash-shift.ts` | Append-only cash in, cash out, and withdrawal |
| `contexts/cash-register/domain/index.ts` | Exported movement types and `MissingReason` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 1.4–1.5 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Merged unit 2; unit 1 evidence kept |
| `openspec/changes/p1-03-cash-register/state.yaml` | Left `apply: partial` |

### Notes

An open shift with opening float `200000` records withdrawal `movement_safe_1` of `300000` with reason `Safe drop`. Expected cash is `200000 - 300000`. The opening float and state `open` stay. The movement list gains that row and has no delete.

A cash out with an empty reason throws `MissingReason` before the list changes. Expected cash stays at the opening float. A whitespace-only reason is the same rejection. Amounts stay non-negative integer COP. Movement ids use the `movement_` prefix (`InvalidMovementId`).

Expected cash for this unit is opening float plus cash in, minus cash out, minus withdrawals. Payments, tips, counts, and close are not in this unit. `cash_in` is accepted with amount and reason and increases expected cash; this batch has no scenario that records one.

`recordMovement` before any `open` throws unexported `OpenShiftRequired`. The spec scenarios start from an open shift, so that guard is not in the tests.

### Remaining

Tasks 1.6 onward stay unchecked. Next batch is unit 3 (tasks 1.6–1.7). Next unchecked task is 1.6.

## Unit 3 — Payment and tip

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. This batch is work unit 3 only (tasks 1.6–1.7). No `size:exception`. Not committed. No pull request. `apps/local-node` was not edited. `openspec/changes/p0-09-monitoring-and-errors/` was not edited.

### Completed

- [x] 1.6 RED `domain/payment.test.ts`: change 5000; `IncompleteCard`; `ChangeExceedsCash`; `MissingTip`; tip apart; zero tip.
- [x] 1.7 GREEN `domain/payment.ts`. Terminal, approval, brand, last 4. Prefix `payment_`.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before `domain/payment.ts` existed. `Cannot find module '#domain/payment.js'`. `Test Files  1 failed | 2 passed (3)`. `Tests  4 passed (4)`. The four passing tests are the unit 1 shift tests and the unit 2 movement tests. The new file collected 0 tests.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after `Payment.record`. `Test Files  3 passed (3)`. `Tests  10 passed (10)`. Repeated after Biome normalized line endings; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0 before and after that format.
- `pnpm exec biome check` on `payment.ts`, `payment.test.ts`, and `domain/index.ts` exited 0 after the line-ending format.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/domain/payment.test.ts` | RED then kept green |
| `contexts/cash-register/domain/payment.ts` | Payment, tenders, change, and tip apart from the sale |
| `contexts/cash-register/domain/index.ts` | Exported payment types and errors |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 1.6–1.7 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Merged unit 3; unit 1 and unit 2 evidence kept |
| `openspec/changes/p1-03-cash-register/state.yaml` | Left `apply: partial` |

### Notes

`Payment.record` stores one payment. An account of `85000` with card `50000` and cash `40000` is paid with change `5000`. Card data copied onto the tender is terminal, approval number, brand, and last 4. The sale stays `85000`.

Change is the tendered total minus the sale. It is cash, and it cannot exceed the cash tender. Card `90000` plus cash `1000` on that account would need `6000` change, so `ChangeExceedsCash` throws before a payment exists.

A card tender with a blank approval number throws `IncompleteCard` and returns nothing. A missing `tip` throws `MissingTip` and returns nothing. An account of `100000` paid in cash, plus a card tip of `10000`, keeps `saleCop` at `100000` and the card tip at `10000`. The tip is not a sale tender. A declined tip is stored as cash `0`.

Identifiers use the `payment_` prefix (`InvalidPaymentId`). Amounts are non-negative integer COP via the existing `InvalidCashAmount`. Methods are `cash`, `card`, `transfer`, `wallet`, `voucher`, `customer_credit`, and `corporate_credit`. Tips stay off the sale. `CashShift` movements were not changed. This file imports `InvalidCashAmount`; it did not need a new export from `cash-shift.ts`.

A tendered total below the account throws unexported `AccountNotCovered` before anything is stored. The spec scenarios start from a covered account, so that guard is not in the tests. Last 4 must be four digits. No Nest, SQL, Zod, Factus, or tax math. No account split, counts, or HTTP.

### Remaining

Tasks 1.8 onward stay unchecked. Next batch is unit 4 (tasks 1.8–1.9). Next unchecked task is 1.8.

## Work unit 4 / account split

Tasks 1.8–1.9. The slice wrote only `account-split.ts` and `account-split.test.ts`. The orchestrator added the barrel exports and marked the tasks. Cash count stayed untouched.

| Evidence | Result |
|----------|--------|
| RED | `pnpm vitest run --project cash-register account-split` exit 1. Missing `#domain/account-split.js`. |
| GREEN | Same command exit 0. 1 file, 5 passed. |
| Typecheck | `pnpm exec tsc -b contexts/cash-register --pretty false` exit 0 |
| Format | `pnpm exec biome check` on the two files exit 0 |

`AccountSplit.equal` splits 100000 into 33334, 33333, and 33333. `SplitImbalance` rejects a split that does not add up and stores nothing. One paid part stays open. Lines stay in orders and keep `originTableId`. Prefix `part_`.

Exports added to `domain/index.ts`: `AccountSplit`, `SplitImbalance`, `InvalidPartId`, `AccountPart`, `PayableLine`, `SplitLine`.

### Remaining

Next unchecked domain task is 1.10, while the cash-count slice is still in flight.

## Work unit 5 / blind count

Tasks 1.10–1.11. The slice wrote only `cash-count.ts` and `cash-count.test.ts`. The orchestrator added the barrel exports and marked the tasks.

| Evidence | Result |
|----------|--------|
| RED | `pnpm vitest run --project cash-register cash-count` exit 1. Missing `#domain/cash-count.js`. |
| GREEN | Same command exit 0. 1 file, 13 passed. |
| Typecheck | `pnpm exec tsc -b contexts/cash-register --pretty false` exit 0 |
| Format | Biome on the two files exit 0 |

Expected cash stays hidden until submit. A difference stays in `counting` until another person approves it. A partial close stays `open`. A final close rejects edits with `ShiftClosed` and a correction is a new movement. Prefix `count_`.

Exports added to `domain/index.ts`: `CashCount`, `InvalidCountId`, `VarianceNeedsApproval`, `SelfApprovalRejected`, `ShiftClosed`, `CountingRejectsCharges`, and the count input types.

### Remaining

Domain tasks 1.1–1.11 are checked. Next unchecked task is 2.1.

## Unit 6 — Open shift and record movement

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is work unit 6 only (tasks 2.1–2.2). No `size:exception`. Not committed. No pull request. Domain files were not edited. No memory adapter, Postgres, or HTTP.

### Completed

- [x] 2.1 RED `application/open-shift/open-shift.test.ts`, `application/record-movement/record-movement.test.ts`: unsaved; `UnknownRegister`.
- [x] 2.2 GREEN both, `ports/cash-register-repository.ts`, `ports/register-lookup.ts`, `application/entry-port.ts`.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before the use cases and ports existed. `Missing "#application/open-shift/open-shift.js" specifier` and `Missing "#application/ports/cash-register-repository.js" specifier`. The new files collected 0 tests. `Test Files  2 failed | 5 passed (7)`. `Tests  28 passed (28)`. The 28 passing tests are the domain tests from units 1–5.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after the use cases, ports, and entry port. `Test Files  7 passed (7)`. `Tests  38 passed (38)`. Repeated after Biome normalized the touched files; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0.
- `pnpm exec biome check` on `contexts/cash-register/application`, `package.json`, and `tsconfig.json` exited 0 after formatting those files.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/application/open-shift/open-shift.test.ts` | RED then kept green |
| `contexts/cash-register/application/open-shift/open-shift.ts` | Open a shift or reject before save |
| `contexts/cash-register/application/record-movement/record-movement.test.ts` | RED then kept green |
| `contexts/cash-register/application/record-movement/record-movement.ts` | Record a movement on the open shift |
| `contexts/cash-register/application/ports/cash-register-repository.ts` | `load` and `save`, keyed by tenant |
| `contexts/cash-register/application/ports/register-lookup.ts` | Register lookup and `UnknownRegister` |
| `contexts/cash-register/application/entry-port.ts` | Public use cases and errors |
| `contexts/cash-register/package.json` | `#application/*` patterns and the entry-port export |
| `contexts/cash-register/tsconfig.json` | Include `application` as well as `domain` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 2.1–2.2 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 6; units 1–5 kept |
| `openspec/changes/p1-03-cash-register/state.yaml` | Left `apply: partial` |

### Notes

`OpenShift` looks up the register, loads the shift for that tenant and venue, and opens `CashShift` with float `200000` and an id that uses the `shift_` prefix. A second open on the same register throws `ShiftAlreadyOpen` and does not save; the first shift stays. An id without the prefix throws `InvalidShiftId` and stays unsaved. An unknown register throws `UnknownRegister` and saves nothing.

`RecordMovement` uses the open shift. Withdrawal `movement_safe_1` of `300000` with reason `Safe drop` drops expected cash by `300000`. A cash out with an empty reason throws `MissingReason` and the shift stays. A movement id without the `movement_` prefix throws `InvalidMovementId` and stays unsaved. An unknown register throws `UnknownRegister` and saves nothing.

A save for tenant A is not visible as tenant B. `CashShift` has no tenant field, so `save` and `load` take `tenantId` and `venueId` beside the shift. The test double implements the real port and keys by tenant, venue, and register. Callers outside the context use `application/entry-port.ts` only.

`OpenShiftRequired` is an application error for a movement when that tenant has no open shift. The domain class of the same name stays unexported. No Nest, SQL, Zod, or SQLite.

### Remaining

Tasks 2.3 onward stay unchecked. Next batch is unit 7 (tasks 2.3–2.4). Next unchecked task is 2.3.

## Unit 7 — Charge check

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is work unit 7 only (tasks 2.3–2.4). No `size:exception`. Not committed. No pull request. Domain files were not edited. No split-account, count use cases, memory adapter, Postgres, HTTP, or orders `MarkAccountPaid`.

### Completed

- [x] 2.3 RED `application/charge-check/charge-check.test.ts`: one `queued` closure; `commandId` once; `MarkAccountPaid` once. No `CalculateTaxes`.
- [x] 2.4 GREEN `application/charge-check/charge-check.ts`, `ports/account-gateway.ts`, `ports/card-terminal.ts`. Prefix `closure_`.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before `charge-check.ts` existed. `Cannot find module '#application/charge-check/charge-check.js'`. The new file collected 0 tests. `Test Files  1 failed | 7 passed (8)`. `Tests  38 passed (38)`. The 38 passing tests are units 1–6.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after the use case and ports. `Test Files  8 passed (8)`. `Tests  49 passed (49)`. Repeated after Biome normalized line endings; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0 before and after that format.
- `pnpm exec biome check` on the charge-check folder, `account-gateway.ts`, `card-terminal.ts`, `entry-port.ts`, and `package.json` exited 0 after formatting the new files.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/application/charge-check/charge-check.test.ts` | RED then kept green |
| `contexts/cash-register/application/charge-check/charge-check.ts` | Charge a check once and store one queued closure |
| `contexts/cash-register/application/ports/account-gateway.ts` | Check lookup and `markPaid` |
| `contexts/cash-register/application/ports/card-terminal.ts` | Card capture |
| `contexts/cash-register/application/entry-port.ts` | Added charge exports; open-shift and movement exports kept |
| `contexts/cash-register/package.json` | `#application/charge-check/*` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 2.3–2.4 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 7; units 1–6 kept |

### Notes

`ChargeCheck` looks up the register, then returns an existing charge for the same tenant, venue, and `commandId` without calling the account port again. A new command records `Payment` from the check total. Card tenders and card tips take terminal, approval, brand, and last 4 from `CardTerminal.capture`. The stored card uses that capture. An account of `85000` with card `50000` and cash `40000` is paid with change `5000` and a zero tip. An account of `100000` with a card tip of `10000` keeps `saleCop` at `100000`.

A full payment inserts one closure. The id uses the `closure_` prefix and the status is `queued`. The closure copies check, table, line id, product id, price, `originTableId`, and `menuClass`. `markPaid` runs once, and only after that insert. `IncompleteCard`, `ChangeExceedsCash`, `MissingTip`, `InvalidCashAmount`, `InvalidClosureId`, `UnknownRegister`, and `UnknownAccount` save nothing and do not call `markPaid`.

The same `commandId` does not insert a second closure. Tenant B cannot load tenant A's charge. The test double implements `AccountGateway`, `CardTerminal`, `RegisterLookup`, and `ChargeLedger`. No `CalculateTaxes`, Nest, SQL, Zod, SQLite, or Factus.

`ChargeLedger` holds the payment and the closure. `CashRegisterRepository` was left unchanged so the open-shift and movement doubles keep compiling. `menuClass` is copied from the check the account port returns.

### Remaining

Tasks 2.5 onward stay unchecked. Next batch is split-account (tasks 2.5–2.6). Next unchecked task is 2.5.

## Unit 8 — Split account

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 2.5–2.6 only. No `size:exception`. Not committed. No pull request. Domain files were not edited. `CashRegisterRepository` and `charge-check.ts` were not edited. No submit-count, approve-variance, close-shift, adapters, or HTTP.

### Completed

- [x] 2.5 RED `application/split-account/split-account.test.ts`: remainder; `originTableId`; unsaved imbalance.
- [x] 2.6 GREEN `application/split-account/split-account.ts`.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before the use case and `AccountSplitStore` existed. `Cannot find module '#application/ports/account-split-store.js'`. The new file collected 0 tests. `Test Files  1 failed | 8 passed (9)`. `Tests  49 passed (49)`. The 49 passing tests are units 1–7.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after the use case, the split store port, and the entry-port exports. `Test Files  9 passed (9)`. `Tests  57 passed (57)`. Repeated after Biome normalized line endings and export order; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0 before and after that format.
- `pnpm exec biome check` on the split-account folder, `account-split-store.ts`, `entry-port.ts`, and `package.json` exited 0 after formatting those files.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/application/split-account/split-account.test.ts` | RED then kept green |
| `contexts/cash-register/application/split-account/split-account.ts` | Split an account through `AccountSplit` and store it |
| `contexts/cash-register/application/ports/account-split-store.ts` | `find` and `save`, keyed by tenant |
| `contexts/cash-register/application/entry-port.ts` | Added split exports; open, movement, and charge exports kept |
| `contexts/cash-register/package.json` | `#application/split-account/*` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 2.5–2.6 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 8; units 1–7 kept |

### Notes

`SplitAccount` looks up the register, then the check. An equal split of `100000` into `part_1`, `part_2`, and `part_3` is `33334`, `33333`, and `33333`. The peso rule stays in `AccountSplit.equal`. Each part copies `originTableId` from the check line. The order lines stay on the check, and `markPaid` is not called. A product split assigns each line once through `AccountSplit.assign` and copies that line's `originTableId`.

A declared split that adds up to `99999` throws `SplitImbalance` and saves nothing. A part id without the `part_` prefix throws `InvalidPartId` and saves nothing. An unknown register throws `UnknownRegister` before the account is read and saves nothing. An unknown account throws `UnknownAccount` and saves nothing.

Paying `part_1` leaves the stored split open. Paying the other two parts closes it. Tenant B cannot load tenant A's split. The test double implements `AccountSplitStore`. `CashRegisterRepository` was left unchanged so the open-shift and movement doubles keep compiling. `UnknownAccount` is the class already used by `ChargeCheck`. No Nest, SQL, Zod, or tax math.

### Remaining

Tasks 2.7 onward stay unchecked. Next batch is submit-count, approve-variance, and close-shift (tasks 2.7–2.8). Next unchecked task is 2.7.

## Unit 9 — Count and close

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 2.7–2.8 only. No `size:exception`. Not committed. No pull request. Domain files were not edited. `CashRegisterRepository`, `charge-check`, and `split-account` were not edited. No memory adapter, Postgres, orders `MarkAccountPaid`, or HTTP.

### Completed

- [x] 2.7 RED `application/submit-count/submit-count.test.ts`, `application/approve-variance/approve-variance.test.ts`, `application/close-shift/close-shift.test.ts`: after submit; `varianceCop`; partial `open`.
- [x] 2.8 GREEN those three. Recount only in `counting`.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before the use cases and `CashCountStore` existed. `Cannot find module '#application/ports/cash-count-store.js'`, `Cannot find module '#application/approve-variance/approve-variance.js'`, and `Cannot find module '#application/close-shift/close-shift.js'`. The new files collected 0 tests. `Test Files  3 failed | 9 passed (12)`. `Tests  57 passed (57)`. The 57 passing tests are units 1–8.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after the three use cases, the count store port, and the entry-port exports. `Test Files  12 passed (12)`. `Tests  89 passed (89)`. Repeated after Biome normalized line endings and export order; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0 before and after that format.
- `pnpm exec biome check` on the three use-case folders, `cash-count-store.ts`, `entry-port.ts`, and `package.json` exited 0 after formatting those files.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/application/submit-count/submit-count.test.ts` | RED then kept green |
| `contexts/cash-register/application/submit-count/submit-count.ts` | Submit and read a blind count through `CashCount` |
| `contexts/cash-register/application/approve-variance/approve-variance.test.ts` | RED then kept green |
| `contexts/cash-register/application/approve-variance/approve-variance.ts` | Another person approves inside `varianceCop` |
| `contexts/cash-register/application/close-shift/close-shift.test.ts` | RED then kept green |
| `contexts/cash-register/application/close-shift/close-shift.ts` | Partial close, final close, charge, and correction |
| `contexts/cash-register/application/ports/cash-count-store.ts` | `find` and `save`, keyed by tenant |
| `contexts/cash-register/application/entry-port.ts` | Added count exports; open, movement, charge, and split kept |
| `contexts/cash-register/package.json` | `#application/submit-count/*`, `#application/approve-variance/*`, `#application/close-shift/*` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 2.7–2.8 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 9; units 1–8 kept |

### Notes

`SubmitCount.read` does not show an expected total before submit. The open shift still holds `100000`. Submit copies that expected total into `CashCount.submit` and stores the count. A later read shows it. The command does not carry `expectedCashCop`.

A difference stays in `counting` until another person approves it with a reason. The counter cannot approve (`SelfApprovalRejected`). `varianceCop` is the approval cap, enforced here because the domain does not check it. A 10000 gap inside a 20000 cap still needs the other person. There is no silent auto-approve. A gap outside the cap throws `VarianceNeedsApproval` on approve and on final close, even after a higher cap already approved it. A terminal gap uses the same cap. A count with no gap can final-close without another person.

Partial close leaves the count `open` and able to take charges again. Final close is `closed`. A later edit or charge throws `ShiftClosed` and saves nothing. A correction is a new movement. Recount is allowed only while `counting`. After a partial close, recount throws `RecountRejected` and saves nothing. A closed recount throws `ShiftClosed`. A rejection saves nothing. Tenant A cannot see tenant B.

`CashCountStore` is a new port. `CashRegisterRepository` still stores only `CashShift`. The test double implements the real port. Expected cash for a count requires an open shift; otherwise `OpenShiftRequired`. No Nest, SQL, Zod, or Factus.

### Remaining

Tasks 3.1 onward stay unchecked. Next batch is the memory repository contract (tasks 3.1–3.2). Next unchecked task is 3.1.

## Unit 10 — Memory contract

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 3.1–3.2 only (tasks-table work unit 9, memory contract and manual terminal). No `size:exception`. Not committed. No pull request. Domain files, use-case test doubles, `CashRegisterRepository` signatures, Postgres, PGlite, HTTP, and orders were not edited.

### Completed

- [x] 3.1 RED `ports/cash-register-repository.contract.ts`, `adapters/memory/in-memory-cash-register-repository.contract.test.ts`: hidden tenant; insert-only; one open shift.
- [x] 3.2 GREEN `adapters/memory/in-memory-cash-register-repository.ts`, `adapters/manual-terminal/manual-card-terminal.ts`. No SQLite.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before the memory repository and the manual terminal existed. `Cannot find module '#adapters/memory/in-memory-cash-register-repository.js'` and `Cannot find module '#adapters/manual-terminal/manual-card-terminal.js'`. The new files collected 0 tests. `Test Files  2 failed | 12 passed (14)`. `Tests  89 passed (89)`. The 89 passing tests are units 1–9.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after the memory repository and the manual terminal. `Test Files  14 passed (14)`. `Tests  94 passed (94)`. Repeated after Biome normalized line endings and the type-only import; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0 before and after that format.
- `pnpm exec biome check` on the contract, both adapter folders, `package.json`, and `tsconfig.json` exited 0 after formatting those files.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/application/ports/cash-register-repository.contract.ts` | Shared contract: round-trip, hidden tenant, insert-only |
| `contexts/cash-register/adapters/memory/in-memory-cash-register-repository.contract.test.ts` | Calls the contract with the memory repository |
| `contexts/cash-register/adapters/memory/in-memory-cash-register-repository.ts` | Insert-only shift store keyed by tenant, venue, and register |
| `contexts/cash-register/adapters/manual-terminal/manual-card-terminal.test.ts` | Capture round-trip; no `fetch` |
| `contexts/cash-register/adapters/manual-terminal/manual-card-terminal.ts` | Records terminal, approval, brand, and last 4 |
| `contexts/cash-register/package.json` | `#adapters/memory/*`, `#adapters/manual-terminal/*`, and those two exports |
| `contexts/cash-register/tsconfig.json` | Include `adapters` as well as `domain` and `application` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 3.1–3.2 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 10; units 1–9 kept |

### Notes

`cashRegisterRepositoryContract` is the shared contract. The memory test only calls it. A saved open shift loads back as another `CashShift` with the same id, cashier, opening float, and movements. Tenant B cannot load tenant A's shift. Each tenant can store its own shift on the same register id.

The port has no update and no delete. A second save on the same tenant, venue, and register throws `ShiftAlreadyOpen` and the first shift stays. Another register, and the same register at another venue, can each hold one open shift. The store clones on save and on load. `ChargeLedger`, `AccountSplitStore`, and `CashCountStore` stay out of this repository.

`ManualCardTerminal.capture` returns terminal, approval number, brand, and last 4. It does not call `fetch` or any other network API. No SQLite and no Drizzle mock.

### Remaining

Tasks 3.3 onward stay unchecked. Next batch is the Postgres repository contract (tasks 3.3–3.4). Next unchecked task is 3.3.

## Unit 11 — Postgres core

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 3.3–3.4 only (tasks-table work unit 10, Postgres core). No `size:exception`. Not committed. No pull request. Domain files, use cases, memory adapters, and `CashRegisterRepository` signatures were not edited. `0009_tax.sql` and earlier migrations were not edited. Parts, counts, and closures were not added.

### Completed

- [x] 3.3 RED `adapters/postgres/drizzle-cash-register-repository.contract.test.ts`: PGlite, `cash_register_app`, forced RLS. No Drizzle mock.
- [x] 3.4 GREEN `adapters/postgres/0010_cash_register.sql`, `schema.ts`. Follow `0009_tax.sql`. Shifts, movements, payments.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before the Drizzle repository existed. `Cannot find module '#adapters/postgres/drizzle-cash-register-repository.js'`. The new file collected 0 tests. `Test Files  1 failed | 14 passed (15)`. `Tests  94 passed (94)`. The 94 passing tests are units 1–10.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after the migration, schema, and repository. `Test Files  15 passed (15)`. `Tests  103 passed (103)`. Repeated after Biome normalized line endings, and again after the open-or-counting unique index; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0.
- `pnpm exec biome check` on `adapters/postgres` and `package.json` exited 0 after formatting the TypeScript files.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/adapters/postgres/drizzle-cash-register-repository.contract.test.ts` | RED then kept green. Calls `cashRegisterRepositoryContract`. Each database test opens PGlite and `afterAll` closes it |
| `contexts/cash-register/adapters/postgres/0010_cash_register.sql` | Role `cash_register_app`, forced RLS, shifts, movements, payments |
| `contexts/cash-register/adapters/postgres/schema.ts` | Drizzle tables for those three |
| `contexts/cash-register/adapters/postgres/drizzle-cash-register-repository.ts` | `load` and `save` through `cash_register_app` |
| `contexts/cash-register/package.json` | `#adapters/postgres/*`, catalog `drizzle-orm` and `@electric-sql/pglite`, export of the Drizzle repository |
| `pnpm-lock.yaml` | Importer for `@blackhole/cash-register` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 3.3–3.4 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 11; units 1–10 kept |

### Notes

`cashRegisterRepositoryContract` is unchanged. The Postgres test only calls it, then adds the role, RLS, and mutation checks. A saved open shift loads back as another `CashShift` with the same id, cashier, opening float, and movements. Tenant B cannot load tenant A's shift. A second open shift on the same register throws `ShiftAlreadyOpen` and the first stays. The repository has no `update` and no `delete`.

`0010_cash_register.sql` is not a platform migration. Every table has `tenant_id`. Forced row level security uses `app.tenant_id`. A select as `cash_register_app` returns only the current tenant from shifts, movements, and payments. Movements and payments reject UPDATE, DELETE, and TRUNCATE with `append-only`, and the row stays. `cash_shifts` accepts a status change and rejects every other column change, DELETE, and TRUNCATE with `status only`. Amounts are integer COP. Identifiers keep the `shift_`, `movement_`, and `payment_` prefixes.

One open or counting shift per register is `cash_shifts_one_open`. A closed shift does not hold that slot. `DrizzleCashRegisterRepository` saves the shift and its movements. It does not insert payments: `CashRegisterRepository` still has only `load` and `save` for `CashShift`. The payments table is insert-only and covered by the SQL tests. Reloading calls `CashShift.open`, so a stored `counting` or `closed` status comes back as `open` until the domain can represent those states. This slice does not edit the domain. No SQLite, no Drizzle mock, and no `listen`.

This slice is about 649 lines (630 in `adapters/postgres`, 6 in `package.json`, 13 in `pnpm-lock.yaml`). That is over the 400-line budget. `size:exception` was not granted. Tasks 3.5 and 3.6 were not started.

### Remaining

Tasks 3.5 onward stay unchecked. Next batch is parts, counts, and closures (tasks 3.5–3.6). Next unchecked task is 3.5.

## Unit 12 — Postgres rest

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 3.5–3.6 only (tasks-table work unit 11, append `0010`). No `size:exception`. Not committed. No pull request. Domain files, use cases, memory adapters, and `CashRegisterRepository` `load` / `save` were not edited. The known gap where a saved `counting` or `closed` shift reloads as `open` was left as-is. `0011` was not created. MarkAccountPaid, HTTP, and the local node were not started.

### Completed

- [x] 3.5 RED parts, counts, closures: one closure; read omits expected.
- [x] 3.6 GREEN append those tables to `0010_cash_register.sql` only.

### RED / GREEN

- RED: `pnpm vitest run --project cash-register` exited 1 before the ledger existed. `Cannot find module '#adapters/postgres/drizzle-cash-register-ledger.js'`. The new file collected 0 tests. `Test Files  1 failed | 15 passed (16)`. `Tests  103 passed (103)`. The 103 passing tests are units 1–11.
- GREEN: `pnpm vitest run --project cash-register` exited 0 after the appended tables, schema, and ledger. `Test Files  16 passed (16)`. `Tests  110 passed (110)`. Repeated after Biome normalized the TypeScript files; same result.
- `pnpm exec tsc -b contexts/cash-register --pretty false` exited 0 before and after that format.
- `pnpm exec biome check --write` on the ledger, its contract test, and `schema.ts` exited 0.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/cash-register/adapters/postgres/drizzle-cash-register-ledger.contract.test.ts` | RED then kept green. PGlite contract for parts, counts, and closures |
| `contexts/cash-register/adapters/postgres/0010_cash_register.sql` | Appended `account_parts`, `cash_counts`, and `sale_closures`. Existing shifts, movements, payments, grants, and role were not rewritten |
| `contexts/cash-register/adapters/postgres/schema.ts` | Drizzle tables for those three |
| `contexts/cash-register/adapters/postgres/drizzle-cash-register-ledger.ts` | Insert and read mappers. `readCount` omits expected cash |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 3.5–3.6 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 12; units 1–11 kept |

### Notes

`account_parts` uses the `part_` prefix and stores `origin_table_id` on the part and on each line. `cash_counts` uses `count_`. `sale_closures` uses `closure_` and status `queued`. Every new table has `tenant_id`, forced row level security for `cash_register_app`, and `SELECT, INSERT` only. Amounts are integer COP. A negative amount is rejected. A non-integer text literal is rejected. Parts, counts, and closures reject UPDATE, DELETE, and TRUNCATE with `append-only`, and the row stays. A correction is a new count row.

One closure per check is `sale_closures_one_check` on tenant, venue, and check. Inserting the same closure again, or another closure id for that check, does not add a row and does not change the first closure. A different check gets its own row. `insertClosure` uses `ON CONFLICT DO NOTHING`.

`readCount` does not select `expected_cash_cop`. A count read before submit omits it. After submit the stored row keeps the figure, and the cashier read still omits it. Tenant B cannot see tenant A's parts, counts, or closures. No Drizzle mock and no `listen`. `DrizzleCashRegisterRepository.load` and `save` were not changed.

This slice is about 1037 lines (test 488, ledger 316, SQL append 144, schema 89). That is over the 400-line budget. `size:exception` was not granted. Task 4.1 was not started.

### Remaining

Tasks 4.1 onward stay unchecked. Next batch is MarkAccountPaid (tasks 4.1–4.2). Next unchecked task is 4.1.

## Unit 13 — Mark account paid

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 4.1–4.2 only (tasks-table work unit 12, orders). No `size:exception`. Not committed. No pull request. `release()` and `ReleaseTable` were not edited. Cash-register domain, adapters, and apps were not edited. HTTP and the local node were not started.

### Completed

- [x] 4.1 RED `contexts/orders/application/mark-account-paid/mark-account-paid.test.ts`: `to_clean`; second call stays; free rejected. Leave `ReleaseTable`.
- [x] 4.2 GREEN `mark-account-paid.ts`, `entry-port.ts`, `#application/mark-account-paid/*`. Only `dining_tables`.

### RED / GREEN

- RED: `pnpm vitest run --project orders mark-account-paid dining-table release-table` exited 1 before `mark-account-paid.ts` existed. `Cannot find module '#application/mark-account-paid/mark-account-paid.js'`. The new file collected 0 tests. `Test Files  1 failed | 2 passed (3)`. `Tests  9 passed (9)`. The 9 passing tests are `dining-table` and `release-table`.
- GREEN: the same command exited 0 after the use case and the entry-port export. `Test Files  3 passed (3)`. `Tests  13 passed (13)`. Repeated after Biome normalized line endings; same result. The `release-table` tests still pass.
- `pnpm exec tsc -b contexts/orders --pretty false` exited 0.
- `pnpm exec biome check` on the mark-account-paid folder, `entry-port.ts`, and `package.json` exited 0 after formatting those files.

The full skeleton project was not run. The full orders project was not run.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/mark-account-paid/mark-account-paid.test.ts` | RED then kept green |
| `contexts/orders/application/mark-account-paid/mark-account-paid.ts` | Mark an account paid through `DiningTable.release` |
| `contexts/orders/application/entry-port.ts` | Added mark-account-paid exports; existing exports kept |
| `contexts/orders/package.json` | `#application/mark-account-paid/*` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 4.1–4.2 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 13; units 1–12 kept |

### Notes

`MarkAccountPaid` loads the table from `DiningRoomRepository`. An occupied table, or a table in `check_requested`, calls `release()` and becomes `to_clean`. Diners stay. The use case then `save`s that table once. A check and its line stay on the same table: `saveCheck` and `saveChecks` are not called, and `originTableId` stays. There is no cash-register repository, so no cash-register row moves.

A second call on a table that is already `to_clean` returns that table. It does not throw and it does not save. The state and the diner count stay. `release()` still throws `TableAlreadyOccupied` for `to_clean`, so the use case returns before calling it. `markPaid()` was not added.

A free table hits `release()`, throws `TableAlreadyOccupied`, and saves nothing. The stored state stays `free`. A missing table throws the same error before save, matching `ReleaseTable`. That missing-table path is not in the new tests.

The test double extends `DiningRoomRepository`. No Nest, SQL, or migration.

### Remaining

Tasks 5.1 onward stay unchecked. Next batch is the HTTP shift (tasks 5.1–5.2). Next unchecked task is 5.1.

## Unit 14 — HTTP shift

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 5.1–5.2 only (tasks-table work unit 13, HTTP shift). No `size:exception`. Not committed. No pull request. Charge HTTP, count HTTP, and the local node were not started. `authorization.ts` was not edited. `apps/local-node` was not edited.

### Completed

- [x] 5.1 RED `apps/api-cloud/test/http/cash-shift.controller.test.ts`: `inject`; 200; 403/400 save nothing; 409 `ShiftAlreadyOpen`.
- [x] 5.2 GREEN `apps/api-cloud/src/http/cash-shift.controller.ts`, `shared/contracts/cash-register.ts`, `index.ts`, `composition/register-directory.ts`. `safeParse`, audit. Not `authorization.ts`.

### RED / GREEN

- RED: `pnpm vitest run --project api-cloud cash-shift.controller` exited 1 before the controller existed. `Cannot find module '#src/http/cash-shift.controller.js'`. The new file collected 0 tests. `Test Files  1 failed (1)`. `Tests  no tests`.
- GREEN: the same command exited 0 after the controller, contract, register directory, and composition wiring. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. Repeated after Biome; same result.
- `pnpm exec tsc -b apps/api-cloud --pretty false` exited 0.
- `pnpm exec biome check --write` on the touched TypeScript and JSON files exited 0.

The full skeleton project was not run. The pre-existing local-node tax route failure was left untouched.

### Files

| File | Action |
|------|--------|
| `apps/api-cloud/test/http/cash-shift.controller.test.ts` | RED then kept green. Nest `inject`, header `x-session-id`, no `listen` |
| `apps/api-cloud/src/http/cash-shift.controller.ts` | POST open shift. `safeParse`, `cash.open-shift`, `RecordAuditEvent` after save |
| `apps/api-cloud/src/composition/register-directory.ts` | Resolves a venue register from the organization |
| `apps/api-cloud/src/composition/application-module.ts` | Registered `CashShiftController` and `OpenShift` only |
| `shared/contracts/cash-register.ts` | Open command and opened shift. No expected total |
| `shared/contracts/index.ts` | Re-exported those schemas |
| `shared/contracts/tsconfig.json` | Included `cash-register.ts` so the contracts project compiles it |
| `apps/api-cloud/package.json` | Workspace dependency `@blackhole/cash-register` |
| `apps/api-cloud/tsconfig.json` | Project reference, matching orders |
| `pnpm-lock.yaml` | Linked that dependency. Also recorded the cash-register importer that was missing from HEAD |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 5.1–5.2 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 14; units 1–13 kept |

### Notes

`POST /tenants/:tenantId/venues/:venueId/cash-registers/:registerId/open` returns 200 when the body float is `200000` and the shift id uses the `shift_` prefix. The stored shift keeps that id, the session user as cashier, and state `open`. The response omits expected cash.

A kitchen chief, who lacks `cash.open-shift`, gets 403 `{ error: "CashOpenShiftDenied" }`. Nothing is saved and nothing is audited. A body that fails Zod `safeParse` (missing fields, or an extra `occurredAt`) is 400 and saves nothing. A second open on the same register is 409 `{ error: "ShiftAlreadyOpen" }`. The first shift stays, and that rejection does not add an audit event.

`RecordAuditEvent` runs only after `OpenShift` saves and the response schema accepts the shift. The route text is `"POST cash-registers/:registerId/open": "cash.open-shift"`, the same declaration shape as `sale.open-table`. The controller imports `OpenShift`, `ShiftAlreadyOpen`, `UnknownRegister`, `InvalidShiftId`, and `InvalidCashAmount` from the cash-register entry port. `ShiftAlreadyOpen` was already exported, so `entry-port.ts` was not edited.

The opening body is the integer total `openingFloatCop`. Denomination lines stay out of this slice, matching the use case. `OrganizationRegisterDirectory` does not subclass `RegisterLookup` because that port is not a package export. TypeScript accepted it as the lookup argument. No Nest `listen`.

This slice is about 594 lines (551 in the four new files, 43 insertions in the tracked files). That is over the 400-line budget. `size:exception` was not granted. Task 5.3 was not started.

### Remaining

Tasks 5.3 onward stay unchecked. Next batch is charge HTTP (tasks 5.3–5.4). Next unchecked task is 5.3.

## Unit 15 — HTTP charge

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 5.3–5.4 only (tasks-table work unit 14, HTTP charge). No `size:exception`. Not committed. No pull request. Count HTTP and the local node were not started. `authorization.ts` was not edited. `apps/local-node` was not edited. The pre-existing tax route permission failure was left untouched.

### Completed

- [x] 5.3 RED `apps/api-cloud/test/http/charge-check.controller.test.ts`: pay once; `to_clean`; 403 saves nothing.
- [x] 5.4 GREEN `apps/api-cloud/src/http/charge-check.controller.ts`, `composition/orders-account.ts` (`GetCheck`, `ViewVenueMenu`, `MarkAccountPaid`).

### RED / GREEN

- RED: `pnpm vitest run --project api-cloud charge-check.controller` exited 1 before the adapter existed. `Cannot find module '#src/composition/orders-account.js'`. The new file collected 0 tests. `Test Files  1 failed (1)`. `Tests  no tests`.
- GREEN: the same command exited 0 after the controller, account adapter, contract, and composition wiring. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. Repeated after Biome together with the open-shift file. `Test Files  2 passed (2)`. `Tests  8 passed (8)` (4 charge, 4 open shift).
- `pnpm exec tsc -b apps/api-cloud --pretty false` exited 0.
- `pnpm exec biome check --write` on the touched TypeScript files exited 0.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `apps/api-cloud/test/http/charge-check.controller.test.ts` | RED then kept green. Nest `inject`, header `x-session-id`, no `listen` |
| `apps/api-cloud/src/http/charge-check.controller.ts` | POST charge. `safeParse`, `sale.charge`, `RecordAuditEvent` after a new save |
| `apps/api-cloud/src/composition/orders-account.ts` | Adapts `GetCheck`, `ViewVenueMenu`, and `MarkAccountPaid` to `AccountGateway` |
| `apps/api-cloud/src/composition/application-module.ts` | Registered `ChargeCheckController`, `OrdersAccount`, and `ChargeCheck`. Kept the cash-shift registration |
| `shared/contracts/cash-register.ts` | Charge command and charged check. Strict body |
| `shared/contracts/index.ts` | Re-exported those schemas |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 5.3–5.4 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 15; units 1–14 kept |

### Notes

`POST /tenants/:tenantId/venues/:venueId/cash-registers/:registerId/checks/:checkId/charge` returns 200 when cash covers the sent check. The stored closure uses the `closure_` prefix and status `queued`. The table becomes `to_clean` once. The same `commandId` returns that closure again, does not insert another row, and does not mark the table again. A kitchen chief, who lacks `sale.charge`, gets 403 `{ error: "SaleChargeDenied" }`. Nothing is saved and the table stays occupied. A body that fails Zod `safeParse` (missing fields, or an extra `occurredAt`) is 400 and saves nothing.

The route text is `"POST cash-registers/:registerId/checks/:checkId/charge": "sale.charge"`. The controller imports `ChargeCheck` and the payment rejections from the cash-register entry port. Those errors were already exported, so `entry-port.ts` was not edited. `OrdersAccount` calls `GetCheck`, `ViewVenueMenu`, and `MarkAccountPaid`. It copies `taxClassification` onto `menuClass` and does not calculate tax. Held lines stay out of the account total. `RecordAuditEvent` runs only when `markPaid` actually ran, so a replay and a rejected request add no audit. No `CalculateTaxes` and no Factus on this path. No Nest `listen`.

`shared/contracts/index.ts` was updated so the new schemas are reachable from `@blackhole/contracts`. `ChargeCheck` is provided next to the account adapter because the controller injects that use case. `MemoryChargeLedger` lives in the composition module because `ChargeLedger` is not a package export; TypeScript accepted it structurally.

This slice is about 964 lines (720 in the three new files, 114 added to the charge contract, 130 insertions in the tracked module and contract index). That is over the 400-line budget. `size:exception` was not granted. Task 5.5 was not started.

### Remaining

Tasks 5.5 onward stay unchecked. Next batch is cash-count HTTP (tasks 5.5–5.6). Next unchecked task is 5.5.

## Unit 16 — HTTP count

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 5.5–5.6 only (tasks-table work unit 15, HTTP count). No `size:exception`. Not committed. No pull request. The local node was not started. `authorization.ts` was not edited. `apps/local-node` was not edited. The pre-existing tax route permission failure was left untouched.

### Completed

- [x] 5.5 RED `apps/api-cloud/test/http/cash-count.controller.test.ts`: GET omits expected; `SelfApprovalRejected`; final 409.
- [x] 5.6 GREEN `apps/api-cloud/src/http/cash-count.controller.ts`. `cash.open-shift`, `cash.approve-variance`. Audit after save.

### RED / GREEN

- RED: `pnpm vitest run --project api-cloud cash-count.controller` exited 1 before the controller existed. `Cannot find module '#src/http/cash-count.controller.js'`. The new file collected 0 tests. `Test Files  1 failed (1)`. `Tests  no tests`.
- GREEN: the same command exited 0 after the controller, contract, entry-port errors, and composition wiring. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. Repeated after Biome; same result.
- `pnpm vitest run --project api-cloud cash-shift.controller charge-check.controller` exited 0. `Test Files  2 passed (2)`. `Tests  8 passed (8)`.
- `pnpm exec tsc -b apps/api-cloud --pretty false` exited 0.
- `pnpm exec biome check --write` on the touched TypeScript files exited 0.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `apps/api-cloud/test/http/cash-count.controller.test.ts` | RED then kept green. Nest `inject`, header `x-session-id`, no `listen` |
| `apps/api-cloud/src/http/cash-count.controller.ts` | GET, submit, approve, partial close, final close. `safeParse`, permissions, `RecordAuditEvent` after a successful save |
| `apps/api-cloud/src/composition/application-module.ts` | Registered `CashCountController`, `SubmitCount`, `ApproveVariance`, and `CloseShift`. Kept cash-shift and charge-check |
| `shared/contracts/cash-register.ts` | Count, approve, partial close, and final close bodies. Count view omits expected cash |
| `shared/contracts/index.ts` | Re-exported those schemas |
| `contexts/cash-register/application/entry-port.ts` | Exported `SelfApprovalRejected` and `VarianceNeedsApproval` |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 5.5–5.6 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 16; units 1–15 kept |

### Notes

Routes sit under `tenants/:tenantId/venues/:venueId/cash-registers/:registerId/count`. Submit, read, partial close, and final close declare `cash.open-shift`. Approve declares `cash.approve-variance`. The controller calls `SubmitCount`, `ApproveVariance`, and `CloseShift` from the cash-register entry port. It does not import domain files.

GET before submit is `{ state: "open" }`. After a count of nine 10,000 notes against a 100,000 float, GET and the submit response are `{ state: "counting", countedCashCop: 90000, differenceCop: -10000 }`. Neither JSON contains `expectedCashCop` or the word `expected`. A partial close returns that count with `state: "open"`, and the cash shift stays `open`.

The owner who submitted cannot approve. That call is 409 `{ error: "SelfApprovalRejected" }`. The count stays `counting`, the save count does not move, and a later final close is still 409 `{ error: "VarianceNeedsApproval" }`. A final close while the difference is unapproved is the same 409 and does not close the shift. A kitchen chief, who lacks `cash.open-shift`, gets 403 `{ error: "CashOpenShiftDenied" }` and nothing is saved. A body that fails Zod `safeParse` (missing fields, or an extra `occurredAt`) is 400 and saves nothing.

`RecordAuditEvent` runs only after submit, partial close, or final close saves and the response schema accepts the view. A rejected approve or final close adds no audit. Approve checks `cash.approve-variance` with `abs(differenceCop)`. `MemoryCashCounts` lives in the composition module because `CashCountStore` is not a package export. The use cases receive that store through a cast. No Nest `listen`.

This slice is about 1223 lines (controller 460, test 478, module insertions 188, count contract 73, contract index 20, entry-port export 4). That is over the 400-line budget. `size:exception` was not granted. Task 6.1 was not started.

### Remaining

Tasks 6.1 onward stay unchecked. Next batch is the local-node rejection (tasks 6.1–6.2). Next unchecked task is 6.1.

## Unit 17 — Node 403

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017. `strict-tdd.md` was not loaded.
**Chain**: stacked-to-main. The user confirmed this slice. This batch is tasks 6.1–6.2 only (tasks-table work unit 16, node 403). No `size:exception`. Not committed. No pull request. `apps/api-cloud` and `contexts/` were not edited. The pre-existing tax route permission failure was left untouched.

### Completed

- [x] 6.1 RED `apps/local-node/test/http/cash-register.controller.test.ts`: 403 `CashRegisterRejected`; nothing stored.
- [x] 6.2 GREEN `apps/local-node/src/http/cash-register.controller.ts`, `application-module.ts`, skeleton allow. No repository.

### RED / GREEN

- RED: `pnpm vitest run --project local-node cash-register.controller` exited 1 before the controller existed. `Cannot find module '#src/http/cash-register.controller.js'`. The new file collected 0 tests. `Test Files  1 failed (1)`. `Tests  no tests`.
- GREEN: the same command exited 0 after the controller, module registration, and allow-list entry. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. Repeated after Biome normalized line endings; same result.
- `pnpm vitest run --project skeleton skeleton.test.ts` exited 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`. Repeated after Biome; same result.
- `pnpm exec tsc -b apps/local-node --pretty false` exited 0.
- `pnpm exec biome check --write` on the four touched TypeScript files exited 0 after fixing line endings.

The full skeleton project was not run.

### Files

| File | Action |
|------|--------|
| `apps/local-node/test/http/cash-register.controller.test.ts` | RED then kept green. Nest `inject`, no `listen` |
| `apps/local-node/src/http/cash-register.controller.ts` | Every cash route returns 403 `CashRegisterRejected` |
| `apps/local-node/src/composition/application-module.ts` | Registered `CashRegisterController`. Existing controllers kept |
| `tools/skeleton/skeleton.test.ts` | Allowed `http/cash-register.controller.ts` only |
| `openspec/changes/p1-03-cash-register/tasks.md` | Marked 6.1–6.2 done |
| `openspec/changes/p1-03-cash-register/apply-progress.md` | Appended unit 17; units 1–16 kept |

### Notes

Routes sit under `tenants/:tenantId/venues/:venueId`. Open declares `cash.open-shift`. Charge declares `sale.charge`. Count read, submit, partial close, and final close declare `cash.open-shift`. Approve declares `cash.approve-variance`. Each POST permission is a string literal `"POST path": "permission"`, the same shape as dining-room. GET count is declared the same way and also returns 403. The mutation scanner does not read GET.

Every response is `{ error: "CashRegisterRejected" }`. The module has no providers and no imports, so nothing is stored. There is no repository, no Zod body parsing, and no SQLite. The node does not call the cash-register context.

This slice is 143 lines (controller 64, test 76, module 2, allow-list 1). That is under the 400-line budget. `size:exception` was not needed.

### Remaining

Tasks 6.1–6.2 are the last implementation tasks. None remain. Next step is sdd-verify. Verify was not started. Nothing was committed.
