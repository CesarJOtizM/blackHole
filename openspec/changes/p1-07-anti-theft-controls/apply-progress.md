# Apply progress: Anti-Theft Controls

**Change**: p1-07-anti-theft-controls
**Mode**: Standard (ADR-017 test-first; `strict_tdd` is false)
**PR slice**: `feat/anti-theft-prebill-http` targeting `feat/anti-theft-discount-http` (`86f14d8`). Not `main`. No commit or pull request in this batch.
**Work unit**: Check HTTP (task 6.4)
**Chain strategy**: feature-branch-chain
**size:exception**: not granted

## Completed tasks

- [x] 1.1 Domain binding: `targetId`, one consume, mismatch unconsumed, second consume throws, `compShiftCop`
- [x] 2.1 Consume use case: a failed write after consume needs a new grant
- [x] 2.2 Count executed operations: successful audits only
- [x] 2.3 Operate authorization: request carries `targetId` and shift totals; a rejected PIN appends `pin.confirmation-failed` without the PIN
- [x] 2.4 Detect unusual behavior: void seed 5; every self-authorization alerts; discount, pair, and failed-PIN seeds are venue rows defaulting to 5
- [x] 2.5 Read control report: voids, discounts, courtesies, cash differences, drawer openings, and accounts reopened or edited after the pre-bill. `audit.view`. Successful audits only
- [x] 3.1 Postgres binding: `target_id` copied from `venue_id`, `consumed_at` null on existing rows, updatable venue thresholds, insert-only alerts, RLS for `authorization_app`
- [x] 4.1 Void a line: `held` or `sent` within the before-kitchen cap leaves the account; `in_preparation` and later stay. A missing grant, a mismatch, or a closed shift leaves the line unchanged
- [x] 4.2 Void an account: a matching `sale.void-account` grant is consumed before the account is cleared. A missing grant, a mismatch, a denied permission, a closed shift, or an unknown reference leaves the account unchanged. A second consume throws
- [x] 4.3 Apply a discount: over the percent cap the discount waits until a matching `sale.discount` grant is consumed. The same value and the same target apply. A mismatch, a missing grant, a denied permission, a closed shift, or an unknown reference leaves the account unchanged. A second consume throws. Line prices stay. The discount is stored on the audit
- [x] 4.4 Apply a courtesy: `compShiftCop` comes from executed operations. Over the shift cap the courtesy waits until a matching `sale.comp` grant is consumed. The same amount and the same account apply. A mismatch, a missing grant, a denied permission, a closed shift, or an unknown reference leaves the account unchanged. A second consume throws. Line prices stay and the account is not cleared. The courtesy is stored on the audit
- [x] 4.5 Change a line price: the new price is stored on that line. The menu stays. `sale.change-price` is the existing permission. Shift totals come from executed operations. A matching grant (same price and same line id) is consumed before the save when authorization is required. `allowed` does not consume. A missing grant, a mismatch, a denied permission, a closed shift, or an unknown reference leaves the line price unchanged. A second consume throws. The audit `after` is `{ value, shiftId, kitchen: null }` and the check is saved
- [x] 4.6 Add a line after the printed pre-bill: without `sale.edit-printed-check` the account stays as it was saved. Shift totals come from executed operations. `allowed` does not consume a grant. `requires_authorization` consumes a grant for the check and the added line's quoted price before the save. A missing grant, a mismatch, a denial, a closed shift, or an unknown reference leaves the account unchanged. A second consume throws. The successful audit `after` is `{ value, shiftId, kitchen: null }`
- [x] 4.7 Transfer a table to another waiter: `sale.transfer-table` runs before the write. Shift totals come from executed operations. `allowed` does not consume. `requires_authorization` consumes a grant for the check before the reassignment. A missing grant, a mismatch, a denial, a closed shift, or an unknown reference leaves the current waiter. A second consume throws. The audit `after` is `{ value, shiftId, kitchen: null }` plus the new waiter id
- [x] 5.1 Open the drawer without a sale: one `drawer_open` job with `kickDrawer: true` on the cash-register `Printer` port. A missing register or a drawer other than `present` is `absent`. A null `printerId` does not enqueue. `cash.open-drawer` consumes a matching grant only when the decision is `requires_authorization`. `allowed` does not consume. No job and no `cash.drawer-opened` audit when the grant is missing, mismatched, denied, unknown, the drawer is absent, or there is no printer. `AuthorizationAlreadyConsumed` is rethrown. No receipt and no `@blackhole/printing` import
- [x] 5.2 Reopen a paid account: the reversal is stored on the open `CashShift` and points at the original payment. The closed shift is not saved and gains no reversal. `sale.reopen-paid` runs before the write. Shift totals come from `CountExecutedOperations` for the open shift. `allowed` does not consume. `requires_authorization` consumes a grant for the same payment id and the same amount. A missing grant, a mismatch, a denial, an unknown reference, a missing account, a missing open shift, or a loaded shift that is the payment's own shift leaves both shifts unchanged. `AuthorizationAlreadyConsumed` is rethrown. The audit `after` is `{ value, shiftId, kitchen: null }` with the open shift id. The original payment id is the reversal's `originalPaymentId` and the audit `entity`
- [x] 5.3 Change a payment method: the reversal and the new payment are stored on the open `CashShift` and both point at the original payment. The closed shift is not saved and gains neither. `sale.change-tender` runs before the write. Shift totals come from `CountExecutedOperations` for the open shift. `allowed` does not consume. `requires_authorization` consumes a grant for the same payment id and the same amount before both writes. A missing grant, a mismatch, a denial, an unknown reference, a missing payment, a missing open shift, or a loaded shift that is the payment's own shift leaves both shifts unchanged. `AuthorizationAlreadyConsumed` is rethrown. One audit runs after both writes. `after` is `{ value, shiftId, kitchen: null }` with the open shift id. The original payment id is `originalPaymentId` on the reversal and on the new payment. A cash-to-card change stores method `card` and the original amount
- [x] 6.1 Cloud authorization HTTP boundary: a request may carry optional `targetId` and `shiftTotals`. The controller passes them to `OperateAuthorization`. The sensitive-action envelope validates with `safeParse`. No void, discount, courtesy, price, drawer, reopen, or tender routes
- [x] 6.2 Cloud void HTTP: a denied session leaves the line or the account and writes no void audit. A waiter inside the before-kitchen cap, with an open shift, voids the line and the audit authorizer is null. A cashier with a matching grant clears the account and the audit authorizer is the grant's authorizer. A missing session, an unknown session, or a body carrying `authorizerId` or shift totals is 400 and stores nothing
- [x] 6.3 Cloud discount, courtesy, and price HTTP: a kitchen chief on an open shift leaves line prices unchanged and writes no success audit. An owner on an open shift audits `sale.discount` with `after.value` equal to the percent and leaves line prices unchanged. An owner courtesy audits `sale.comp` with `after.value` equal to the COP amount and leaves line prices unchanged. An owner price change saves the new line price, leaves the menu unchanged, and audits `sale.change-price` with `before.value` equal to the previous line price
- [x] 6.4 Cloud pre-bill and waiter-transfer HTTP: a printed pre-bill refuses a new line when the session is denied or the edit fields are absent, and audits `sale.edit-printed-check` when an owner sends those fields on an open shift. `POST checks/:checkId/transfer-table` audits `sale.transfer-table` with the previous and next waiter. Join and move-lines stay on `POST checks/reassign`

## Work Unit Evidence

### Unit 1 — Bind

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/domain/authorization.test.ts contexts/platform/domain/evaluate.test.ts`. RED exit 1: 8 failed, 16 passed (24). GREEN exit 0: 2 files, 24 passed. |
| Runtime harness command/scenario and exact result | N/A. Domain only; tasks forecast says runtime harness N/A. |
| Rollback boundary | `contexts/platform/domain/authorization.ts`, `contexts/platform/domain/authorization.test.ts`, `contexts/platform/domain/evaluate.ts`, `contexts/platform/domain/evaluate.test.ts` |

#### RED

Command: `pnpm vitest run --project platform contexts/platform/domain/authorization.test.ts contexts/platform/domain/evaluate.test.ts`

Result: exit 1. Test files 2 failed. Tests 8 failed, 16 passed (24).

Failures before production changes:

- Request snapshot had no `targetId`, `shiftTotals`, or `consumedAt`.
- `consumeAuthorization` was not a function.
- A 20,000 courtesy on top of 90,000 `compShiftCop` was `allowed` instead of `requires_authorization` (`compShiftCop` cap 100,000).

#### GREEN

Same command. Exit 0. Test files 2 passed. Tests 24 passed.

Related regression, same project: in-memory and Postgres authorization contracts, `operate-authorization`, and `evaluate-permission`. Exit 0. 4 files, 25 passed. Postgres still round-trips because missing binding fields normalize to `targetId = venueId`, zero shift totals, and `consumedAt = null`.

### Unit 2 — Consume (task 2.1)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/application/consume-authorization/consume-authorization.test.ts`. RED exit 1: 1 failed file, no tests (missing module). GREEN exit 0: 1 file, 1 passed. |
| Runtime harness command/scenario and exact result | N/A. Application use case and in-memory port only. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/platform/application/consume-authorization/`, the `ConsumeAuthorization` export in `contexts/platform/application/entry-port.ts`, and the `#application/consume-authorization/*` import in `contexts/platform/package.json` |

#### RED

Command: `pnpm vitest run --project platform contexts/platform/application/consume-authorization/consume-authorization.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Cannot find module `#application/consume-authorization/consume-authorization.js`.

#### GREEN

Same command, after `ConsumeAuthorization` delegated to `Authorization.consumeAuthorization` and saved the grant. Exit 0. Test files 1 passed. Tests 1 passed.

### Unit 2 — Consume (task 2.2)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/application/count-executed-operations/count-executed-operations.test.ts`. RED exit 1: 1 failed file, no tests (missing module). GREEN exit 0: 1 file, 1 passed. Re-run after Biome format: exit 0, 1 file, 1 passed. |
| Runtime harness command/scenario and exact result | N/A. Application use case reading the existing in-memory audit port. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/platform/application/count-executed-operations/`, the `CountExecutedOperations` export in `contexts/platform/application/entry-port.ts`, and the `#application/count-executed-operations/*` import in `contexts/platform/package.json` |

#### RED

Command: `pnpm vitest run --project platform contexts/platform/application/count-executed-operations/count-executed-operations.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Cannot find module `#application/count-executed-operations/count-executed-operations.js`.

#### GREEN

Same command, after `CountExecutedOperations` listed `AuditRepository` events and returned shift totals. Exit 0. Test files 1 passed. Tests 1 passed.

The same command after `pnpm biome check --write` on the slice. Exit 0. Test files 1 passed. Tests 1 passed.

### Unit 3 — PIN (task 2.3)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/application/operate-authorization/operate-authorization.test.ts`. RED exit 1: 1 failed, 12 passed (13). GREEN exit 0: 1 file, 13 passed. |
| Runtime harness command/scenario and exact result | N/A. Application use case with in-memory ports. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/platform/application/operate-authorization/operate-authorization.ts` and `contexts/platform/application/operate-authorization/operate-authorization.test.ts` |

#### RED

Command: `pnpm vitest run --project platform contexts/platform/application/operate-authorization/operate-authorization.test.ts`

Result: exit 1. Test files 1 failed. Tests 1 failed, 12 passed (13).

Failure before production changes, on `given a discount request carrying the target and shift totals, when the supervisor PIN is rejected, then those facts stay on the request and the audit records pin.confirmation-failed without the PIN`:

- `targetId` was `organization_venue_1` instead of `check_1`.
- `shiftTotals` were `{ waiterVoidsBeforeKitchen: 0, compShiftCop: 0 }` instead of `{ waiterVoidsBeforeKitchen: 2, compShiftCop: 90000 }`.
- `action` was `undefined` instead of `pin.confirmation-failed`.
- The request stayed `pending` with no resolution, and the PIN value was not stored.

#### GREEN

Same command, after `OperateAuthorization` passed `targetId` and shift totals into the domain request and appended `pin.confirmation-failed` through `RecordAuditEvent` when the PIN was rejected. Exit 0. Test files 1 passed. Tests 13 passed.

`pnpm exec biome check --formatter-enabled=false` on the two edited operate-authorization files. Exit 0. No fixes applied.

### Unit 5 — Alerts detector (task 2.4)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/application/detect-unusual-behavior/detect-unusual-behavior.test.ts`. RED exit 1: 1 failed file, no tests (missing module). GREEN exit 0: 1 file, 3 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory application use case. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/platform/application/detect-unusual-behavior/`, the `DetectUnusualBehavior` export in `contexts/platform/application/entry-port.ts`, and the `#application/detect-unusual-behavior/*` import in `contexts/platform/package.json` |

#### RED

Command: `pnpm vitest run --project platform contexts/platform/application/detect-unusual-behavior/detect-unusual-behavior.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Cannot find module `#application/detect-unusual-behavior/detect-unusual-behavior.js`.

#### GREEN

Same command, after `DetectUnusualBehavior` counted successful audits and exported the use case from the platform entry port. Exit 0. Test files 1 passed. Tests 3 passed.

`pnpm exec biome check --formatter-enabled=false` on the detector files, `entry-port.ts`, and `contexts/platform/package.json`. Exit 0. No fixes applied.

### Unit 6 — Control report (task 2.5)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/application/read-control-report/read-control-report.test.ts`. RED exit 1: 1 failed file, no tests (missing module). GREEN exit 0: 1 file, 2 passed. Re-run after the `import type` lint fix: exit 0, 1 file, 2 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory application projection. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/platform/application/read-control-report/`, the `ReadControlReport` export in `contexts/platform/application/entry-port.ts`, and the `#application/read-control-report/*` import in `contexts/platform/package.json` |

#### RED

Command: `pnpm vitest run --project platform contexts/platform/application/read-control-report/read-control-report.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Cannot find module `#application/read-control-report/read-control-report.js`.

#### GREEN

Same command, after `ReadControlReport` projected successful audits and exported the use case from the platform entry port. Exit 0. Test files 1 passed. Tests 2 passed.

The same command after changing `EvaluatePermission` to `import type`. Exit 0. Test files 1 passed. Tests 2 passed.

`pnpm exec biome check --formatter-enabled=false` on the report files, `entry-port.ts`, and `contexts/platform/package.json`. Exit 0. No fixes applied.

### Unit 4 — SQL (task 3.1)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-authorization-repository.contract.test.ts`. RED exit 1: 6 failed, 5 passed (11). GREEN exit 0: 1 file, 11 passed. Re-run after the import-order lint fix: exit 0, 1 file, 11 passed. |
| Runtime harness command/scenario and exact result | PGlite executes `0004_authorization.sql`, then `0014_authorization_binding.sql`, as `authorization_app` with forced RLS. An existing request copies `venue_id` into `target_id` and leaves `consumed_at` null. A saved discount keeps `targetId` `account_a`. A mismatched target or value stays unconsumed. The matching consume stores `consumedAt`, and a second consume throws `AuthorizationAlreadyConsumed`. Venue threshold columns start at 5 and `authorization_app` can update them; the other tenant stays hidden. Alerts accept insert. The table owner cannot update, delete, or truncate them (`insert-only`). The role cannot update or delete them (`permission denied`). No SQLite. Drizzle is not mocked. No HTTP. |
| Rollback boundary | `contexts/platform/adapters/postgres/0014_authorization_binding.sql`, `contexts/platform/adapters/postgres/schema.ts`, `contexts/platform/adapters/postgres/drizzle-authorization-repository.ts`, and `contexts/platform/adapters/postgres/drizzle-authorization-repository.contract.test.ts` |

#### RED

Command: `pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-authorization-repository.contract.test.ts`

Result: exit 1. Test files 1 failed. Tests 6 failed, 5 passed (11).

Failure before the migration and adapter mapping existed:

- `ENOENT` for `contexts/platform/adapters/postgres/0014_authorization_binding.sql` on all six new tests. The five existing contract tests passed.

#### GREEN

Same command, after `0014_authorization_binding.sql`, the Drizzle schema, and the request mapping for `targetId` and `consumedAt`. Exit 0. Test files 1 passed. Tests 11 passed.

The same command after sorting the authorization imports for Biome. Exit 0. Test files 1 passed. Tests 11 passed.

`pnpm exec biome check --formatter-enabled=false` on the contract test, `drizzle-authorization-repository.ts`, and `schema.ts`. Exit 0. No fixes applied.

`node tools/infra/check-forward-migrations.mjs`. Exit 0. Migrations stay forward-only and keep `0001` and `0002`.

### Unit 6 — Voids (task 4.1)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project orders contexts/orders/application/void-line/void-line.test.ts`. RED exit 1: 1 failed file, no tests (missing module). GREEN exit 0: 1 file, 8 passed. Re-run after the Biome import fixes: exit 0, 1 file, 8 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory dining room and an in-memory open-shift double. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/orders/application/void-line/`, `contexts/orders/application/ports/open-shift-reader.ts`, the `VoidLine` and `OpenShiftReader` exports in `contexts/orders/application/entry-port.ts`, the `#application/void-line/*` import and `@blackhole/platform` dependency in `contexts/orders/package.json`, and the matching workspace link in `pnpm-lock.yaml` |

#### RED

Command: `pnpm vitest run --project orders contexts/orders/application/void-line/void-line.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case and the open-shift port existed:

- Cannot find module `#application/ports/open-shift-reader.js`.

#### GREEN

Same command, after `VoidLine` counted executed operations, evaluated `sale.void-before-kitchen`, consumed a matching grant only when the cap required one, and detached a `held` or `sent` line. Exit 0. Test files 1 passed. Tests 8 passed.

The same command after the Biome import-type and import-order fixes. Exit 0. Test files 1 passed. Tests 8 passed.

`pnpm exec biome check --formatter-enabled=false` on `void-line.ts`, `void-line.test.ts`, `open-shift-reader.ts`, and `entry-port.ts`. Exit 0. No fixes applied.

### Unit 6 — Voids (task 4.2)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project orders contexts/orders/application/void-account/void-account.test.ts`. RED exit 1: 1 failed file, no tests (missing import). GREEN exit 0: 1 file, 8 passed. Re-run after Biome format: exit 0, 1 file, 8 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory dining room and the existing open-shift double. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/orders/application/void-account/`, the `VoidAccount` export in `contexts/orders/application/entry-port.ts`, and the `#application/void-account/*` import in `contexts/orders/package.json` |

#### RED

Command: `pnpm vitest run --project orders contexts/orders/application/void-account/void-account.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Missing `#application/void-account/void-account.js` specifier in `@blackhole/orders`.

#### GREEN

Same command, after `VoidAccount` evaluated `sale.void-account`, consumed a matching grant before any write, and replaced the saved account with an empty check of the same identity. Exit 0. Test files 1 passed. Tests 8 passed.

The same command after `pnpm exec biome check --write` on the slice. Exit 0. Test files 1 passed. Tests 8 passed.

`pnpm exec biome check --formatter-enabled=false` on `void-account.ts`, `void-account.test.ts`, and `entry-port.ts`. Exit 0. No fixes applied.

### Unit 7 — Discount (task 4.3)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project orders contexts/orders/application/apply-discount/apply-discount.test.ts`. RED exit 1: 1 failed file, no tests (missing import). GREEN exit 0: 1 file, 9 passed. Re-run after the shared harness and Biome: exit 0, 1 file, 9 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory dining room and the existing open-shift double. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/orders/application/apply-discount/`, the `ApplyDiscount` export in `contexts/orders/application/entry-port.ts`, and the `#application/apply-discount/*` import in `contexts/orders/package.json` |

#### RED

Command: `pnpm vitest run --project orders contexts/orders/application/apply-discount/apply-discount.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Missing `#application/apply-discount/apply-discount.js` specifier in `@blackhole/orders`.

#### GREEN

Same command, after `ApplyDiscount` evaluated `sale.discount`, consumed a matching grant before the audit, and left every line price unchanged. Exit 0. Test files 1 passed. Tests 9 passed.

The same command after sharing one harness and `pnpm exec biome check --write` on the slice. Exit 0. Test files 1 passed. Tests 9 passed.

`pnpm exec biome check --formatter-enabled=false` on `apply-discount.ts`, `apply-discount.test.ts`, and `entry-port.ts`. Exit 0. No fixes applied.

### Unit 7 — Courtesy (task 4.4)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project orders contexts/orders/application/apply-courtesy/apply-courtesy.test.ts`. RED exit 1: 1 failed file, no tests (missing import). GREEN exit 0: 1 file, 9 passed. Re-run after Biome: exit 0, 1 file, 9 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory dining room and the existing open-shift double. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/orders/application/apply-courtesy/`, the `ApplyCourtesy` export in `contexts/orders/application/entry-port.ts`, and the `#application/apply-courtesy/*` import in `contexts/orders/package.json` |

#### RED

Command: `pnpm vitest run --project orders contexts/orders/application/apply-courtesy/apply-courtesy.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Missing `#application/apply-courtesy/apply-courtesy.js` specifier in `@blackhole/orders`.

#### GREEN

Same command, after `ApplyCourtesy` evaluated `sale.comp`, passed counted `compShiftCop` into `EvaluatePermission`, consumed a matching grant before the audit, and left every line price and the account unchanged. Exit 0. Test files 1 passed. Tests 9 passed.

The same command after `pnpm exec biome check --write` on the slice. Exit 0. Test files 1 passed. Tests 9 passed.

`pnpm exec biome check --formatter-enabled=false` on `apply-courtesy.ts`, `apply-courtesy.test.ts`, and `entry-port.ts`. Exit 0. No fixes applied.

### Unit 8 — Price (task 4.5)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | Domain: `pnpm vitest run --project orders contexts/orders/domain/check.test.ts`. RED exit 1: 2 failed, 15 passed (17). GREEN exit 0: 1 file, 17 passed. Application: `pnpm vitest run --project orders contexts/orders/application/change-price/change-price.test.ts`. RED exit 1: 1 failed file, no tests (missing import). GREEN with the domain file: exit 0, 2 files, 26 passed (9 application + 17 domain). Re-run after Biome: exit 0, 2 files, 26 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory dining room, an in-memory open-shift double, and a menu that the use case does not receive. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/orders/application/change-price/`, `Check.changePrice` in `contexts/orders/domain/check.ts` and the two tests in `contexts/orders/domain/check.test.ts`, the `ChangePrice` export in `contexts/orders/application/entry-port.ts`, and the `#application/change-price/*` import in `contexts/orders/package.json` |

#### RED

Domain command: `pnpm vitest run --project orders contexts/orders/domain/check.test.ts`

Result: exit 1. Test files 1 failed. Tests 2 failed, 15 passed (17).

Failure before `Check` could change one line's price:

- `check.changePrice` was not a function. The non-integer case therefore threw `TypeError` instead of `InvalidCheckPrice`.

Application command: `pnpm vitest run --project orders contexts/orders/application/change-price/change-price.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Missing `#application/change-price/change-price.js` specifier in `@blackhole/orders`.

#### GREEN

Domain command, after `Check.changePrice`. Exit 0. Test files 1 passed. Tests 17 passed.

Application and domain together, after `ChangePrice` evaluated `sale.change-price`, consumed a matching grant before the save, wrote the new price on that line, and left the menu untouched. Exit 0. Test files 2 passed. Tests 26 passed.

The same two files after `pnpm exec biome check --write` on the slice. Exit 0. Test files 2 passed. Tests 26 passed.

`pnpm exec biome check --formatter-enabled=false` on `change-price.ts`, `change-price.test.ts`, `check.ts`, `check.test.ts`, and `entry-port.ts`. Exit 0. No fixes applied.

### Unit 8 — Pre-bill (task 4.6)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project orders contexts/orders/application/take-order/take-order.test.ts`. RED exit 1: 1 failed, 11 passed (12). GREEN exit 0: 1 file, 12 passed. Re-run after Biome: exit 0, 1 file, 12 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory dining room, menu, stations, printer, and hub already used by `TakeOrder`. The printed-check guard is an in-memory double of the platform entry port. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/orders/application/take-order/take-order.ts` and `contexts/orders/application/take-order/take-order.test.ts` |

#### RED

Command: `pnpm vitest run --project orders contexts/orders/application/take-order/take-order.test.ts`

Result: exit 1. Test files 1 failed. Tests 1 failed, 11 passed (12).

Failure before `TakeOrder` refused a post-pre-bill add, on `given a printed pre-bill, when a waiter adds a product without sale.edit-printed-check, then the account stays unchanged`:

- Stored line ids were `["line_soup", "line_soda"]` instead of `["line_soup"]`. The soda was saved after the pre-bill.

#### GREEN

Same command, after `hold` and `execute` ask `sale.edit-printed-check` once `preBillRequest` is set, pass counted shift totals, and return the loaded check without `addLine` or `saveCheck` when the decision is `denied`. Exit 0. Test files 1 passed. Tests 12 passed.

The same command after `pnpm exec biome check --write` on the two take-order files. Exit 0. Test files 1 passed. Tests 12 passed.

`pnpm exec biome check --formatter-enabled=false` on `take-order.ts` and `take-order.test.ts`. Exit 0. No fixes applied.

### Unit 8 — Table transfer (task 4.7)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project orders contexts/orders/application/reassign-check/reassign-check.test.ts`. RED exit 1: 10 failed, 4 passed (14). GREEN after the use case, before folding the refusal titles: exit 0, 1 file, 14 passed. Final GREEN after that fold and Biome: exit 0, 1 file, 9 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory dining room and an in-memory double of the platform entry port. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/orders/application/reassign-check/reassign-check.ts` and `contexts/orders/application/reassign-check/reassign-check.test.ts` |

#### RED

Command: `pnpm vitest run --project orders contexts/orders/application/reassign-check/reassign-check.test.ts`

Result: exit 1. Test files 1 failed. Tests 10 failed, 4 passed (14).

Failure before `ReassignCheck` guarded a waiter transfer, on the new transfer cases:

- `loadCheck` threw `TableNotOpen`. `kind: "transfer-table"` still followed the line move and looked up a missing `targetCheckId`.
- The already-consumed case expected `AuthorizationAlreadyConsumed` and received `TableNotOpen`.
- The four existing join and line-transfer tests passed.

#### GREEN

Same command, after `transferTable` evaluates `sale.transfer-table`, passes counted shift totals, consumes a matching grant only when required, assigns the new waiter, and audits. Exit 0. Test files 1 passed. Tests 14 passed.

The same command after folding the six refusal cases into one `it`, matching the existing reassign loop, and after `pnpm exec biome check --write` on the two files. Exit 0. Test files 1 passed. Tests 9 passed. The refusal loop still checks the waiter, the empty audit, the grant calls, and the step order.

`pnpm exec biome check --formatter-enabled=false` on `reassign-check.ts` and `reassign-check.test.ts`. Exit 0. No fixes applied.

### Unit 9 — No-sale drawer (task 5.1)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project cash-register contexts/cash-register/application/open-drawer/open-drawer.test.ts`. RED exit 1: 1 failed file, no tests (missing module). GREEN exit 0: 1 file, 10 passed. Re-run after Biome: exit 0, 1 file, 10 passed. Charge-check regression: `pnpm vitest run --project cash-register contexts/cash-register/application/charge-check/charge-check.test.ts`. Exit 0: 1 file, 22 passed. Re-run after the printer-port format: exit 0, 1 file, 22 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory register lookup, printer, and platform entry-port doubles. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. `PendingSalePrinter` stays unwired. |
| Rollback boundary | `contexts/cash-register/application/open-drawer/`, the `DrawerOpenJob` member of `SaleReceiptJob` in `contexts/cash-register/application/ports/printer.ts`, the `OpenDrawer` export in `contexts/cash-register/application/entry-port.ts`, the `#application/open-drawer/*` import and `@blackhole/platform` dependency in `contexts/cash-register/package.json`, and the matching workspace link in `pnpm-lock.yaml` |

#### RED

Command: `pnpm vitest run --project cash-register contexts/cash-register/application/open-drawer/open-drawer.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Cannot find module `#application/open-drawer/open-drawer.js`.

#### GREEN

Same command, after `OpenDrawer` evaluates `cash.open-drawer`, consumes a matching grant only when required, enqueues `{ document: "drawer_open", kickDrawer: true }`, and audits `cash.drawer-opened` once. Exit 0. Test files 1 passed. Tests 10 passed.

The same command after `pnpm exec biome check --write` on the slice. Exit 0. Test files 1 passed. Tests 10 passed.

`pnpm vitest run --project cash-register contexts/cash-register/application/charge-check/charge-check.test.ts`, because the printer port union grew. Exit 0. Test files 1 passed. Tests 22 passed. The same command after Biome formatted `printer.ts`. Exit 0. Test files 1 passed. Tests 22 passed.

`pnpm exec biome check --formatter-enabled=false` on `open-drawer.ts`, `open-drawer.test.ts`, `printer.ts`, and `entry-port.ts`. Exit 0. No fixes applied.

### Unit 10 — Reopen a paid account (task 5.2)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project cash-register contexts/cash-register/application/reopen-paid-account/reopen-paid-account.test.ts`. RED exit 1: 1 failed file, no tests (missing module). GREEN exit 0: 1 file, 11 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory paid-account reader, open-shift book, and platform entry-port doubles. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/cash-register/application/reopen-paid-account/`, `CashShift.recordReversal` and `PaymentReversal` in `contexts/cash-register/domain/cash-shift.ts`, the matching exports in `contexts/cash-register/domain/index.ts`, the `ReopenPaidAccount` export in `contexts/cash-register/application/entry-port.ts`, and the `#application/reopen-paid-account/*` import in `contexts/cash-register/package.json` |

#### RED

Command: `pnpm vitest run --project cash-register contexts/cash-register/application/reopen-paid-account/reopen-paid-account.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Cannot find module `#application/reopen-paid-account/reopen-paid-account.js`.

#### GREEN

Same command, after `ReopenPaidAccount` evaluates `sale.reopen-paid`, consumes a matching grant only when required, records the reversal on the open shift, and `pnpm exec biome check --write` formatted the slice. Exit 0. Test files 1 passed. Tests 11 passed.

`pnpm exec biome check --formatter-enabled=false` on `reopen-paid-account.ts`, `reopen-paid-account.test.ts`, `cash-shift.ts`, `domain/index.ts`, and `entry-port.ts`. Exit 0. No fixes applied.

Related regression, same project: `contexts/cash-register/domain/cash-shift.test.ts` and `contexts/cash-register/domain/cash-movement.test.ts`. Exit 0. 2 files, 4 passed.

### Unit 10 — Change a payment method (task 5.3)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project cash-register contexts/cash-register/application/change-tender/change-tender.test.ts`. RED exit 1: 1 failed file, no tests (missing module). GREEN exit 0: 1 file, 11 passed. |
| Runtime harness command/scenario and exact result | N/A. In-memory original-payment reader, open-shift book, and platform entry-port doubles. Tasks forecast says runtime harness N/A. No HTTP or SQL in this slice. |
| Rollback boundary | `contexts/cash-register/application/change-tender/`, `CashShift.recordPayment` and `ShiftPayment` in `contexts/cash-register/domain/cash-shift.ts`, the matching exports in `contexts/cash-register/domain/index.ts`, the `ChangeTender` export in `contexts/cash-register/application/entry-port.ts`, and the `#application/change-tender/*` import in `contexts/cash-register/package.json` |

#### RED

Command: `pnpm vitest run --project cash-register contexts/cash-register/application/change-tender/change-tender.test.ts`

Result: exit 1. Test files 1 failed. Tests: no tests.

Failure before the use case existed:

- Cannot find module `#application/change-tender/change-tender.js`.

#### GREEN

Same command, after `ChangeTender` evaluates `sale.change-tender`, consumes a matching grant only when required, records the reversal and the replacement payment on the open shift, and `pnpm exec biome check --write` formatted the slice. Exit 0. Test files 1 passed. Tests 11 passed.

`pnpm exec biome check --formatter-enabled=false` on `change-tender.ts`, `change-tender.test.ts`, `cash-shift.ts`, `domain/index.ts`, and `entry-port.ts`. Exit 0. No fixes applied.

Related regression, same project, because `cash-shift.ts` changed: `pnpm vitest run --project cash-register contexts/cash-register/domain/cash-shift.test.ts`. Exit 0. 1 file, 2 passed.

### Unit 11 — Authorization HTTP boundary (task 6.1)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project api-cloud test/http/authorization.controller.test.ts test/contracts/sensitive-actions.test.ts`. RED exit 1: 2 failed, 6 passed (8). GREEN exit 0: 2 files, 8 passed. Re-run after Biome: exit 0, 2 files, 8 passed. |
| Runtime harness command/scenario and exact result | N/A. Nest `inject` covers the HTTP boundary. Tasks forecast says runtime harness N/A. No listening port, no SQL, and no alert write. |
| Rollback boundary | `shared/contracts/authorization.ts`, `shared/contracts/sensitive-actions.ts`, `shared/contracts/index.ts`, `apps/api-cloud/src/http/authorization.controller.ts`, `apps/api-cloud/test/http/authorization.controller.test.ts`, and `apps/api-cloud/test/contracts/sensitive-actions.test.ts` |

#### RED

Command: `pnpm vitest run --project api-cloud test/http/authorization.controller.test.ts test/contracts/sensitive-actions.test.ts`

Result: exit 1. Test files 2 failed. Tests 2 failed, 6 passed (8).

Failures before the schema and the request fields existed:

- `sensitiveActionEnvelope` was missing. `safeParse` threw `TypeError: Cannot read properties of undefined (reading 'safeParse')`.
- On `given a cashier request carrying the target and shift totals, when it is posted, then OperateAuthorization stores those values`, the stored request had `targetId` `organization_venue_1` instead of `check_1`, and `shiftTotals` `{ waiterVoidsBeforeKitchen: 0, compShiftCop: 0 }` instead of `{ waiterVoidsBeforeKitchen: 2, compShiftCop: 90000 }`. The HTTP fields were not on `requestCommand`, so the domain kept the migration defaults.

#### GREEN

Same command, after `requestCommand` accepted optional `targetId` and `shiftTotals`, `operateCommand` passed them into `OperateAuthorization`, and `sensitiveActionEnvelope` validated the envelope with `safeParse`. Exit 0. Test files 2 passed. Tests 8 passed. The six existing authorization controller tests stayed green.

The same command after `pnpm exec biome check --write` on the six TypeScript files. Exit 0. Test files 2 passed. Tests 8 passed.

`pnpm exec biome check --formatter-enabled=false` on those same files. Exit 0. No fixes applied.

### Unit 11 — Void HTTP (task 6.2)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project api-cloud test/http/void-line.controller.test.ts test/http/void-account.controller.test.ts`. RED exit 1: 2 failed files, no tests (missing modules). GREEN exit 0: 2 files, 8 passed. Re-run after Biome: exit 0, 2 files, 8 passed. |
| Runtime harness command/scenario and exact result | N/A. Nest `inject` covers the HTTP boundary. Tasks forecast says runtime harness N/A. No listening port and no SQL. |
| Rollback boundary | `apps/api-cloud/src/http/void-line.controller.ts`, `apps/api-cloud/src/http/void-account.controller.ts`, `apps/api-cloud/src/http/void-command.ts`, `apps/api-cloud/src/composition/closed-shift-reader.ts`, the `VoidLine` and `VoidAccount` providers in `apps/api-cloud/src/composition/application-module.ts`, `apps/api-cloud/test/http/void-line.controller.test.ts`, `apps/api-cloud/test/http/void-account.controller.test.ts`, and the optional `shifts`, `people`, and `authorizations` return on `apps/api-cloud/test/http/dining-room-session.ts` |

#### RED

Command: `pnpm vitest run --project api-cloud test/http/void-line.controller.test.ts test/http/void-account.controller.test.ts`

Result: exit 1. Test files 2 failed. Tests: no tests.

Failures before the controllers existed:

- Cannot find module `#src/http/void-line.controller.js`.
- Cannot find module `#src/http/void-account.controller.js`.

#### GREEN

Same command, after `VoidLineController` and `VoidAccountController` called the existing use cases, `ClosedShiftReader` answered closed unless the test replaced it, and the strict body rejected `authorizerId` and shift totals. Exit 0. Test files 2 passed. Tests 8 passed.

The same command after `pnpm exec biome check --write` on the eight TypeScript files. Exit 0. Test files 2 passed. Tests 8 passed.

`pnpm exec biome check --formatter-enabled=false` on those same files. Exit 0. No fixes applied.

### Unit 12 — Comp HTTP (task 6.3)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project api-cloud test/http/apply-discount.controller.test.ts test/http/apply-courtesy.controller.test.ts test/http/change-price.controller.test.ts`. RED exit 1: 3 failed files, no tests (missing controller modules). GREEN exit 0: 3 files, 6 passed. Same command after Biome: exit 0, 3 files, 6 passed. |
| Runtime harness command/scenario and exact result | N/A. Tasks forecast says runtime harness N/A. The focused tests boot Nest through `openDiningCloud` and inject the three routes. No listening port. |
| Rollback boundary | `apps/api-cloud/src/http/apply-discount.controller.ts`, `apps/api-cloud/src/http/apply-courtesy.controller.ts`, `apps/api-cloud/src/http/change-price.controller.ts`, their three HTTP tests, and the `ApplyDiscount`, `ApplyCourtesy`, and `ChangePrice` providers plus controller registrations in `apps/api-cloud/src/composition/application-module.ts` |

#### RED

Command: `pnpm vitest run --project api-cloud test/http/apply-discount.controller.test.ts test/http/apply-courtesy.controller.test.ts test/http/change-price.controller.test.ts`

Result: exit 1. Test files 3 failed. Tests: no tests.

Failures before the controllers existed:

- Cannot find module `#src/http/apply-discount.controller.js`.
- Cannot find module `#src/http/apply-courtesy.controller.js`.
- Cannot find module `#src/http/change-price.controller.js`.

#### GREEN

Same command, after the three controllers called the existing use cases, reused `readText` and `authorizerOf`, and rejected `authorizerId` and shift totals with a strict body. Exit 0. Test files 3 passed. Tests 6 passed.

The same command after `pnpm exec biome check --write` on the seven TypeScript files. Exit 0. Test files 3 passed. Tests 6 passed.

`pnpm exec biome check --formatter-enabled=false` on those same files. Exit 0. No fixes applied.

Each controller has one denial and one success. A kitchen chief on an open shift gets 200, the line price stays, and the audit list stays empty. An owner on an open shift audits `sale.discount` with `after.value` 10 and does not change the line price. An owner courtesy audits `sale.comp` with `after.value` 15000 and does not change the line price. An owner price change stores 18000 on the line, leaves catalog price 20000 and venue price 24000, and audits `sale.change-price` with `before.value` 22000. `authorizationId` is null, so `authorizerId` is null. `actorId` is the session user. The open shift reader accepts `OpenShiftQuery`.

The pair is 855 additions and 0 deletions: `apply-discount.controller.ts` 96, `apply-courtesy.controller.ts` 96, `change-price.controller.ts` 98, `apply-discount.controller.test.ts` 128, `apply-courtesy.controller.test.ts` 128, `change-price.controller.test.ts` 186, and `application-module.ts` 123. `size:exception` was not granted. The pair is over the 400-line review budget and was not split. It stays on `feat/anti-theft-discount-http`, based on `feat/anti-theft-void-http` (`754d1ac`). No commit, push, or pull request.

### Unit 13 — Check HTTP (task 6.4)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project api-cloud test/http/take-order.controller.test.ts test/http/reassign-check.controller.test.ts`. RED exit 1: 10 failed, 21 passed (31). GREEN exit 0: 2 files, 31 passed. Same command after Biome: exit 0, 2 files, 31 passed. |
| Runtime harness command/scenario and exact result | N/A. Tasks forecast says runtime harness N/A. The focused tests boot Nest through `openDiningCloud` and inject the lines and transfer routes. No listening port. |
| Rollback boundary | `apps/api-cloud/src/http/take-order.controller.ts`, `apps/api-cloud/src/http/reassign-check.controller.ts`, their two HTTP tests, the `TakeOrder` and `ReassignCheck` factories in `apps/api-cloud/src/composition/application-module.ts`, and `addOrderLineCommand` in `shared/contracts/dining-room.ts` |

#### RED

Command: `pnpm vitest run --project api-cloud test/http/take-order.controller.test.ts test/http/reassign-check.controller.test.ts`

Result: exit 1. Test files 2 failed. Tests 10 failed, 21 passed (31).

Failures before the routes and the edit fields existed:

- `routePermissions` was only `POST checks/reassign` → `sale.move-items`. The `POST checks/:checkId/transfer-table` entry was missing.
- `POST checks/:checkId/transfer-table` returned 404 for a kitchen chief, a closed shift, an owner on an open shift, a missing session, an unknown session, and a body carrying shift totals or `authorizerId`.
- A kitchen chief posting edit fields after the pre-bill got 400. The strict add-line schema rejected `reason`, `shiftId`, and `authorizationId` before the `sale.open-table` gate.
- An owner posting the old body after the pre-bill got 409 `{ error: "TableNotOpen" }`. `presentLine` threw `TableNotOpen` because the returned check did not contain the new line.
- An owner posting the edit fields on an open shift got 400, so the line was not held and `sale.edit-printed-check` was not audited.

#### GREEN

Same command, after `TakeOrder` received `PrintedCheckGuard`, `ReassignCheck` received `TableTransferGuard`, the add-line contract accepted the three optional edit fields, a missing new line returned 409 `PrintedCheckEditRefused`, and `POST checks/:checkId/transfer-table` called `kind: "transfer-table"`. Exit 0. Test files 2 passed. Tests 31 passed. The existing take-order and reassign tests stayed green.

The same command after `pnpm exec biome check --write` on the six TypeScript files. Exit 0. Test files 2 passed. Tests 31 passed.

`pnpm exec biome check --formatter-enabled=false` on those same files. Exit 0. No fixes applied.

The catalog marks `sale.edit-printed-check` and `sale.transfer-table` as yes for owner, general manager, site administrator, and shift supervisor; with authorization for cashier and waiter; and no for kitchen chief and warehouse keeper. The tests use owner and kitchen chief. A kitchen chief still stops at the existing `sale.open-table` gate with 403 `SaleOpenTableDenied`. An owner without the edit fields gets 409 `PrintedCheckEditRefused`, the new line is absent, and no `sale.edit-printed-check` audit is stored. An owner, an open `OpenShiftReader`, and the three edit fields hold the line and audit `sale.edit-printed-check` with `before.value` 0 and `after.value` equal to the quoted price. A check with no pre-bill still accepts the old body. A kitchen chief or a closed shift leaves the waiter unchanged and stores no `sale.transfer-table` audit. An owner on an open shift sets the in-memory waiter and audits `before.waiterId` and `after.waiterId`. A missing session, an unknown session, or a body carrying `authorizerId` or shift totals is 400 and stores nothing. `isOpen` accepts `OpenShiftQuery`.

The pair is 552 additions and 16 deletions: `application-module.ts` 78/5, `reassign-check.controller.ts` 73/1, `take-order.controller.ts` 49/8, `reassign-check.controller.test.ts` 195/0, `take-order.controller.test.ts` 150/1, and `dining-room.ts` 7/1. `size:exception` was not granted. The pair is over the 400-line review budget and was not split. It stays on `feat/anti-theft-prebill-http`, based on `feat/anti-theft-discount-http` (`86f14d8`). No commit, push, or pull request.

## Deviations

- Binding fields stay optional on the persisted request so current callers and the Postgres mapper keep compiling. `restore` fills the migration defaults. Task 2.3 passes `targetId` and shift totals from `OperateAuthorization`. Task 3.1 adds the columns.
- `compShiftCop` is optional and treated as 0 when absent. The domain does not count audits.
- The design `after` shape was not added in the consume slice. `resolution.action` remains the permission code. Task 2.3 records only the failed-PIN audit.
- `ConsumeAuthorization.execute` also takes `tenantId` and reads `AuthorizationClock`. `AuthorizationRepository.load` is keyed by tenant, and `consumeAuthorization` requires `at`. `authorizationId` is the request id.
- `AuthorizationAlreadyConsumed` is re-exported from the use case because `domain/index` does not export it and this slice must not edit domain files.
- `CountExecutedOperations` does not accept a client total. It lists the existing audit port (`list(tenantId, null)`) and returns `AuthorizationShiftTotals`: one `sale.void-before-kitchen` event adds 1 to `waiterVoidsBeforeKitchen`; `sale.comp` adds `after.value` to `compShiftCop`.
- A counted audit is `kind: "event"`, for that actor and `after.shiftId`, with `after` shaped `{ value, shiftId, kitchen }` and `before` different from `after`. `pin.confirmation-failed`, `after.approved === false`, and `kind: "altered"` do not count. No new audit type and no SQL migration.
- `RequestCommand.targetId` and `RequestCommand.shiftTotals` stay optional. When present, `OperateAuthorization` passes them to `evaluateFor` and `requestAuthorization`. When absent, evaluation still uses `waiterVoidsBeforeKitchen: 0` and the domain keeps the migration defaults. This slice does not edit the HTTP contract.
- `RecordAuditEvent` is an optional last constructor argument so `authorization.controller.ts` keeps compiling with five arguments. A `PinConfirmationRejected` error appends `pin.confirmation-failed` only when that collaborator is present. The audit stores actor, device, site, request id, target, shift, and the reason `PIN confirmation failed`. It does not store the PIN. `PinConfirmationLocked` does not append this action. This use case does not count audits.
- `DetectUnusualBehavior` does not call `CountExecutedOperations`. That use case returns only before-kitchen voids and courtesy totals for one actor. The detector repeats the same successful-audit predicate: `kind: "event"`, `after` shaped `{ value, shiftId, kitchen }`, action other than `pin.confirmation-failed`, `after.approved` not false, and `before` different from `after`. It also filters by site and shift. It does not consume grants.
- Post-kitchen voids use the published seed 5 only. Discount, requester-authorizer pair, and failed-PIN seeds use that same integer unless the caller passes venue rows. Self-authorization has no numeric seed: every successful audit with `authorizerId === actorId` or `after.selfAuthorized === true` alerts.
- A repeated pair is any successful audit in the shift whose authorizer is a different person. A failed PIN is `pin.confirmation-failed` on one device in the shift, counted when the count is over the seed. The alert does not copy a PIN. The detector does not write a mark back onto the void.
- `ReadControlReport` does not call `CountExecutedOperations`. That use case returns only before-kitchen voids and courtesy totals for one actor. The report repeats the same successful-audit predicate: `kind: "event"`, `after` shaped `{ value, shiftId, kitchen }`, action other than `pin.confirmation-failed`, `after.approved` not false, and `before` different from `after`. It also keeps the event site. It does not write an audit or an authorization change.
- A caller whose `EvaluatePermission` result for existing `audit.view` is not `allowed` gets an empty report. The catalog already declares `audit.view`. No second entry was added. Denial does not throw `AuditReadDenied`.
- `Check` has no discount operation, and this slice does not add one. `ApplyDiscount` does not save the check, does not clear it, and does not use `check_void_sink`. Line prices stay. The applied discount is the audit `after` shape `{ value, shiftId, kitchen: null }`, where `value` is the percent. `before` is `{ value: 0 }` so the two states differ. The action is the existing catalog code `sale.discount`. Task 4.5 owns price changes.
- Over the percent cap the decision is `requires_authorization` and nothing is written until `ConsumeAuthorization` returns true for the same percent and the same check id. `allowed` writes the audit and does not consume. A null `authorizationId`, a `false` consume, or `UnknownAuthorizationReference` leaves the account unchanged. `AuthorizationAlreadyConsumed` is rethrown. A closed shift returns after `OpenShiftReader` and before count, evaluate, or consume. A denied permission does not consume.
- Shift totals come from `CountExecutedOperations`. The command carries `percent` and does not carry a caller total.
- `Check` has no courtesy operation, and this slice does not add one. `ApplyCourtesy` does not save the check, does not clear it, and does not change line prices. The applied courtesy is the audit `after` shape `{ value, shiftId, kitchen: null }`, where `value` is the courtesy amount in the same unit `CountExecutedOperations` adds to `compShiftCop`. `before` is `{ value: 0 }` so the two states differ and the next courtesy sees the used amount. The action is the existing catalog code `sale.comp`. No second permission code was added.
- Over the shift cap the decision is `requires_authorization` and nothing is written until `ConsumeAuthorization` returns true for the same amount and the same check id. `allowed` writes the audit and does not consume. A null `authorizationId`, a `false` consume, or `UnknownAuthorizationReference` leaves the account unchanged. `AuthorizationAlreadyConsumed` is rethrown. A closed shift returns after `OpenShiftReader` and before count, evaluate, or consume. A denied permission does not consume.
- The courtesy command carries `value` and does not carry a caller total. `CountExecutedOperations` returns `compShiftCop`. `ApplyCourtesy` passes those totals and the courtesy value into `EvaluatePermission`. The domain adds `compShiftCop` to the value before comparing the shift cap. This use case does not add them itself.
- `Check` could not change one line's price. This slice adds `changePrice({ lineId, price })`. A non-integer price throws `InvalidCheckPrice` and an unknown line throws `InvalidLineId`. Other lines stay. The method does not write the menu.
- `ChangePrice` uses the existing catalog code `sale.change-price`. No second code was added. The command carries `price` and does not carry a caller total. Shift totals come from `CountExecutedOperations` and are passed into `EvaluatePermission` with that price. The menu is not a collaborator.
- `requires_authorization` consumes a grant for the same price and the same line id before `changePrice` and `saveCheck`. `allowed` saves and audits and does not consume. A null `authorizationId`, a `false` consume, or `UnknownAuthorizationReference` leaves the line price unchanged. `AuthorizationAlreadyConsumed` is rethrown. A closed shift returns after `OpenShiftReader` and before count, evaluate, or consume. A denied permission does not consume.
- The audit action is `sale.change-price`. `entity` is the line id. `after` is `{ value, shiftId, kitchen: null }`, where `value` is the new price. `before` is `{ value: previous line price }` so the two states differ. Discount and courtesy used `{ value: 0 }` because those amounts are not stored on the check. The site price stays on the menu object the use case never receives.
- Discounts and courtesies are separate lists. Both carry user, authorizer, and value. Voids carry user, authorizer, reason, and `before kitchen` or `after kitchen`. Cash differences carry cashier and shift. Drawer openings carry the user. Reopened accounts and post-pre-bill edits share one list and are distinguished by `reopened` or `edited-after-pre-bill`. Offline hybrid rows stay deferred.
- `0014_authorization_binding.sql` adds `target_id` and nullable `consumed_at` on `authorization_requests`. Existing rows copy `venue_id` into `target_id` and leave `consumed_at` null. The Drizzle repository writes and reads both fields. A mismatch stays unconsumed in the domain. A second consume throws `AuthorizationAlreadyConsumed`. Shift totals stay on the domain request and are filled by `completeRequest` on restore. This migration does not add shift-total columns.
- Venue thresholds are `authorization_venue_thresholds`: `discount`, `requester_authorizer_pair`, and `failed_pin`, each `NOT NULL DEFAULT 5`. `authorization_app` may select, insert, update, and delete them under forced RLS. The void-after-kitchen seed stays the published 5 in the detector. The domain snapshot and the authorization port were not changed.
- Alerts are `authorization_alerts`. `authorization_app` receives `SELECT` and `INSERT` only. A trigger rejects update, delete, and truncate with `authorization alerts are insert-only`, including for the table owner. The role's update and delete fail with permission denied. Saving an authorization does not delete alerts. The migration does not create a role and does not grant `authorization_app` update on unrelated tables. `node tools/infra/check-forward-migrations.mjs` accepts the file. No `DROP` or `RENAME`.
- `Check` has no void operation, and this slice cannot edit the orders domain. `VoidLine` detaches the line with the public `transfer` onto an unsaved sink check (`check_void_sink`) and saves only the original account. The line leaves that account. The sink is not persisted.
- A line in `held` or `sent` whose evaluation is `allowed` is voided without a grant. `requires_authorization` consumes first. A null `authorizationId` does not call consume. `UnknownAuthorizationReference` and a `false` consume leave the line unchanged. `in_preparation`, `ready`, and `delivered` return before the platform calls. A closed shift returns after the open-shift read and before count, evaluate, or consume.
- The consumed value is `1` and `targetId` is the line id. The audit action is `sale.void-before-kitchen`. `after` is `{ value: 1, shiftId, kitchen: "before" }`. `before` is `{ state }` so the successful audit is not the same state twice.
- `Check` still has no void. `DiningTable.release` and `MarkAccountPaid` only move the table to `to_clean`, which is the paid lifecycle, so this slice does not call them. `VoidAccount` keeps the mutation in the use case: after the platform calls, it saves `Check.open` with the same id, tenant, venue, table, and `openedAt`. That drops every line. It does not transfer them to `check_void_sink`. No new domain method was added.
- The permission is the existing catalog code `sale.void-account`. The consumed value is the sum of every line price, `targetId` is the check id, and `after.kitchen` is `null`. `allowed` clears the account without a grant. `requires_authorization` consumes first. A null `authorizationId`, a `false` consume, or `UnknownAuthorizationReference` leaves the account unchanged. `AuthorizationAlreadyConsumed` is rethrown. A closed shift returns after `OpenShiftReader` and before count, evaluate, or consume. A denied permission does not consume.
- The printed pre-bill is `check.preBillRequest`. `requestCheck()` without a stamp only moves `tableState` to `check_requested`, so the existing send still returns the table to `occupied`. Orders before that stamp do not call the platform.
- `PrintedCheckGuard` is an optional last constructor argument. `application-module.ts` still builds `TakeOrder` with six arguments, which this slice cannot edit. A stamped pre-bill with no guard, or with no `edit`, leaves the account unchanged. Task 6.4 wires the guard. No new use case, no entry-port export, and no package import.
- `hold` and `execute` share the gate. `fire` and `resend` do not add a line. The permission is the existing catalog code `sale.edit-printed-check`. Shift totals come from `CountExecutedOperations` and are passed into `EvaluatePermission` with the quoted price of the added line. One `execute` that adds several lines uses their sum. The grant `targetId` is the check id.
- `allowed` adds the line and audits, and does not consume. `requires_authorization` consumes before `addLine` and `saveCheck`. A null `authorizationId`, a `false` consume, or `UnknownAuthorizationReference` leaves the account unchanged. `AuthorizationAlreadyConsumed` is rethrown. A closed shift returns after `OpenShiftReader` and before count, evaluate, or consume. A denied permission does not consume and does not audit.
- The audit action is `sale.edit-printed-check`. `entity` is the check id. `after` is `{ value, shiftId, kitchen: null }`, where `value` is that quoted price. `before` is `{ value: 0 }` so the two states differ. The assigned test covers the denied add. The allowed, grant, mismatch, closed-shift, and second-consume paths use that same gate and are not separate tests in this pair.
- `Check` has no waiter. This slice stores `waiterId` as an own property on the loaded check and saves that same check. The audit `after` repeats it. `before` is `{ waiterId }` so the two states differ. Postgres does not map the property. No domain method and no SQL in this slice.
- The permission is the existing catalog code `sale.transfer-table`. No second code was added. The command carries the new waiter and does not carry a caller total. `value` is `check.total`. Shift totals come from `CountExecutedOperations` and are passed into `EvaluatePermission`. The grant `targetId` is the check id.
- `requires_authorization` consumes before `assignWaiter` and `saveCheck`. `allowed` saves and audits and does not consume. A null `authorizationId`, a `false` consume, or `UnknownAuthorizationReference` leaves the waiter. `AuthorizationAlreadyConsumed` is rethrown. A closed shift returns after `OpenShiftReader` and before count, evaluate, or consume. A denied permission does not consume and does not audit.
- The audit action is `sale.transfer-table`. `entity` is the check id. `after` is `{ value, shiftId, kitchen: null, waiterId }`. It does not store a PIN. Join and line transfer do not call the platform.
- `TableTransferGuard` is an optional last constructor argument. `application-module.ts` still builds `ReassignCheck` with one argument (`new ReassignCheck(diningRoom)`), which this slice cannot edit. A `transfer-table` command with no guard leaves the current waiter and writes no audit. Task 6.4 wires the guard. No new use case, no entry-port export, and no package import.
- A missing register, a drawer other than `present`, or a null `printerId` returns before count, evaluate, and consume. The use case does not throw `UnknownRegister`. A grant is not burned when the drawer cannot open. A cash sale still kicks on charge through `ChargeCheck`; this pair does not edit that path and does not enqueue `offline_receipt`.
- The opening audit action is `cash.drawer-opened`. `ReadControlReport` lists a drawer opening only when the action is `cash.open-drawer`. This slice does not edit the report. `after` is `{ value: 1, shiftId, kitchen: null }` and `before` is `{ value: 0 }`. The grant uses permission `cash.open-drawer`, `targetId` the register id, and value `1`. `allowed` does not consume, even when an authorization id is present.
- `CountExecutedOperations` runs only after the drawer and printer are usable, and those totals are passed into `EvaluatePermission`. `cash.open-drawer` has no numeric cap. This pair has no `OpenShiftReader`. Task 5.2 owns open-shift reversals.
- `@blackhole/cash-register` depends on `@blackhole/platform` at `workspace:*` and imports only `@blackhole/platform/application/entry-port`. It does not depend on `@blackhole/printing`. `PendingSalePrinter` is not wired here.
- `CashMovement` cannot point at a payment. `CashShift.recordReversal` stores `{ id, originalPaymentId, amountCop }` on that shift. It does not append a cash movement and does not change `expectedCashCop`. `InvalidReversalId` and `InvalidOriginalPayment` guard the prefixes `reversal_` and `payment_`.
- The use case loads one shift for the register. It records the reversal only when that shift is open and its id is not the payment's shift id. The closed shift is a separate object the use case never receives, so it is not saved and gains no reversal. A loaded shift whose id is the payment's shift returns before count, evaluate, and consume.
- `PaidAccountReader` lives in the use case file. `ports/` is outside this slice. The reader returns the original payment id, the amount, and the shift that owns the payment.
- The permission is the existing catalog code `sale.reopen-paid`. No second code was added. The command carries the payment id and the reversal id. It does not carry a caller total or a caller shift id. `value` is the payment amount. Shift totals come from `CountExecutedOperations` for the open shift id and are passed into `EvaluatePermission`.
- `requires_authorization` consumes a grant for that payment id and that amount before `recordReversal` and `save`. `allowed` saves and audits and does not consume, even when an authorization id is present. A null `authorizationId`, a `false` consume, or `UnknownAuthorizationReference` leaves both shifts unchanged. `AuthorizationAlreadyConsumed` is rethrown. A denied permission does not consume and does not audit.
- The audit action is `sale.reopen-paid`. `entity` is the original payment id. `after` is `{ value, shiftId, kitchen: null }`, where `shiftId` is the open shift and `value` is the payment amount. `before` is `{ value: 0 }` so the two states differ. The same payment id is `PaymentReversal.originalPaymentId`.
- The cash-register repository remains insert-only. This slice does not edit it or the SQL mapper. The test double replaces the open shift on `save`. Drizzle still persists movements only, so a later adapter must store `reversals` before this use case is wired. No `@blackhole/printing` import.
- `CashShift` could not store a replacement payment next to `recordReversal`. This slice adds `recordPayment` and `payments`. A `ShiftPayment` is `{ id, originalPaymentId, method, amountCop }`. `Payment` is not embedded: `payment.ts` already imports `cash-shift.ts`. The replacement id uses the `payment_` prefix. The method is one of the existing tender methods. The amount is the original payment amount. `expectedCashCop` stays the opening float because neither write appends a cash movement.
- The new payment is in memory on the open shift, the same way reversals are. `DrizzleCashRegisterRepository` still loads and saves movements only. This pair adds no migration.
- Card capture stays on `ChargeCheck`. This payment stores the method `card` and the original amount. It does not store terminal, approval, brand, or last 4.
- `OriginalPaymentReader` lives in the use case file. `ports/` is outside this slice. The reader returns the original payment id, the amount, and the shift that owns the payment.
- The permission is the existing catalog code `sale.change-tender`. No second code was added. The command carries the reversal id, the replacement id, and the method. It does not carry a caller total or a caller shift id. `value` is the original amount. Shift totals come from `CountExecutedOperations` for the open shift id and are passed into `EvaluatePermission`.
- `requires_authorization` consumes a grant for that payment id and that amount before `recordReversal`, `recordPayment`, and `save`. `allowed` saves and audits and does not consume, even when an authorization id is present. A null `authorizationId`, a `false` consume, or `UnknownAuthorizationReference` leaves both shifts unchanged. `AuthorizationAlreadyConsumed` is rethrown. A denied permission does not consume and does not audit.
- The use case loads one shift for the register. It records both facts only when that shift is open and its id is not the payment's shift id. The closed shift is a separate object the use case never receives, so it is not saved and gains no reversal and no payment. A loaded shift whose id is the payment's shift returns before count, evaluate, and consume.
- The audit action is `sale.change-tender`. It is written once, after both domain writes and the save. `entity` is the original payment id. `after` is `{ value, shiftId, kitchen: null }`, where `shiftId` is the open shift and `value` is the original amount. `before` is `{ value: 0 }` so the two states differ. The same payment id is `PaymentReversal.originalPaymentId` and `ShiftPayment.originalPaymentId`.
- No `@blackhole/printing` import. The cash-register repository and the SQL mapper are unchanged.
- `requestCommand.targetId` and `requestCommand.shiftTotals` stay optional. When present, `operateCommand` copies them onto the command passed to `OperateAuthorization.execute`, and the existing `request` method stores them. When absent, the copies are undefined and the domain keeps the migration defaults. `OperateAuthorization` is still constructed with five arguments. `RecordAuditEvent` is not injected.
- `authorizationShiftTotals` is one Zod object shared by the request and `sensitiveActionEnvelope`. The package index exports `sensitiveActionEnvelope` and `SensitiveActionEnvelope` only. `shared/contracts` is not a vitest project, so the envelope test lives in `apps/api-cloud/test/contracts/sensitive-actions.test.ts` and imports `@blackhole/contracts`. This slice validates the envelope with `safeParse` and adds no void, discount, courtesy, price, drawer, reopen, or tender route. No migration and no alert write.
- Both void routes share `void-command.ts`. The body is a strict Zod 4 object: `reason`, `shiftId`, and `authorizationId` (`string` or `null`). `authorizerId` and shift totals fail `safeParse`, return 400, and store nothing. `authorizationId` null passes `authorizerId` null. A present id loads the approved resolution and passes that `authorizerId`. The use cases count shift totals. The client total is not forwarded.
- `ClosedShiftReader` is the default `OpenShiftReader` and answers closed. The HTTP test replaces it through `CloudApplicationDependencies.shifts`, the same way `diningRooms` is replaced. The cash-register repository is not asked to list a shift. No SQL and no migration.
- A missing header or an unknown session is 400 before the use case. A denied decision is 200: the use case returns the check, and the response lists the remaining line ids. `TableNotOpen` and `InvalidLineId` map to 409. The line success is a waiter inside the cap. The account success consumes a matching `sale.void-account` grant. `TakeOrder` stays a six-argument construction. No discount, courtesy, price, drawer, reopen, tender, reprint, or report route.
- This pair is 740 additions and 3 deletions. It was not split. `size:exception` was not granted.
- The three discount, courtesy, and price routes return the same `{ checkId, lineIds }` listing as a void, through the existing `presentVoid` and `rejectionOf` helpers. `voidCommand` was not widened. `percent`, `value`, and `price` live on the controller schemas. A missing session, an unknown session, or a body carrying `authorizerId` or shift totals is 400 before the use case. Those 400 paths are the void controller behavior and are not separate assertions in this pair. The assigned tests are one denial and one success per controller.
- `TakeOrder` stays a six-argument construction. The existing `OpenShiftReader` provider is reused. No void, drawer, reopen, tender, reprint, pre-bill, or report route was added. The use cases were not edited. Shift totals come from `CountExecutedOperations` inside those use cases.
- `addOrderLineCommand` extends the existing strict draft with optional `reason`, `shiftId`, and `authorizationId` (`string` or `null`). `orderLineDraft` is unchanged, so send still rejects those fields. `shiftTotals` and `authorizerId` still fail the strict parse. A normal add without the three fields still parses. When all three are present, `POST checks/:checkId/lines` passes them to `hold` as `edit`. `actorId` is `session.userId`, `deviceId` is `session.deviceId`, and `authorizerId` comes from `authorizerOf` when `authorizationId` is set, otherwise null. When the three fields are absent, `hold` is called without `edit`. The `sale.open-table` gate still runs first.
- A returned check that does not contain the new line is 409 `{ error: "PrintedCheckEditRefused" }`. `presentLine` is not called, so `TableNotOpen` is not thrown and the response is not 500. The use case already skipped the save and the audit.
- The catalog has no role that is `yes` for `sale.open-table` and `no` for `sale.edit-printed-check`. Kitchen chief is `no` for both, so the existing gate returns 403 `SaleOpenTableDenied` before `hold`. Owner is `yes` for `sale.edit-printed-check`. Cashier and waiter are `with_authorization` and are not used as the allowed session.
- `TakeOrder` is now constructed with seven arguments. The seventh is `PrintedCheckGuard`, built from the same ports `VoidLine` uses: the existing `OpenShiftReader`, `CountExecutedOperations`, `EvaluatePermission`, `ConsumeAuthorization`, and `RecordAuditEvent`. `ReassignCheck` receives `TableTransferGuard` as the second argument from those same ports. `TakeOrder`, `ReassignCheck`, `Check`, and their application tests were not edited. No migration. Postgres still does not map `waiterId`.
- `POST checks/reassign` still handles join and move-lines, including its `sale.move-items` gate and `PlatformDiningAudit`. `POST checks/:checkId/transfer-table` is a separate route with permission `sale.transfer-table`. It calls `reassignCheck.execute` with `kind: "transfer-table"` and does not write the move-items audit. The use case writes `sale.transfer-table`. A missing or unknown `x-session-id` is 400 before the use case. A denied session or a closed shift leaves the in-memory waiter unchanged and stores no transfer audit. An authorized session and an open shift set the waiter and audit `before.waiterId` and `after.waiterId`.
- This pair is 552 additions and 16 deletions. It was not split. `size:exception` was not granted.

## Remaining

Tasks 6.5–7.1 are pending. The next checkbox is 6.5. Task 6.4 is the only checkbox newly marked in this batch. 21/25 tasks complete. No migration. No local-node. No drawer, reopen, tender, reprint, or report route in this batch.
