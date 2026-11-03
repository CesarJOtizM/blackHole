# Apply progress: Anti-Theft Controls

**Change**: p1-07-anti-theft-controls
**Mode**: Standard (ADR-017 test-first; `strict_tdd` is false)
**PR slice**: `feat/anti-theft-voids` targeting `feat/anti-theft-sql` (PR #74). Not `main`.
**Work unit**: 6 — Voids (task 4.1)
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
- Discounts and courtesies are separate lists. Both carry user, authorizer, and value. Voids carry user, authorizer, reason, and `before kitchen` or `after kitchen`. Cash differences carry cashier and shift. Drawer openings carry the user. Reopened accounts and post-pre-bill edits share one list and are distinguished by `reopened` or `edited-after-pre-bill`. Offline hybrid rows stay deferred.
- `0014_authorization_binding.sql` adds `target_id` and nullable `consumed_at` on `authorization_requests`. Existing rows copy `venue_id` into `target_id` and leave `consumed_at` null. The Drizzle repository writes and reads both fields. A mismatch stays unconsumed in the domain. A second consume throws `AuthorizationAlreadyConsumed`. Shift totals stay on the domain request and are filled by `completeRequest` on restore. This migration does not add shift-total columns.
- Venue thresholds are `authorization_venue_thresholds`: `discount`, `requester_authorizer_pair`, and `failed_pin`, each `NOT NULL DEFAULT 5`. `authorization_app` may select, insert, update, and delete them under forced RLS. The void-after-kitchen seed stays the published 5 in the detector. The domain snapshot and the authorization port were not changed.
- Alerts are `authorization_alerts`. `authorization_app` receives `SELECT` and `INSERT` only. A trigger rejects update, delete, and truncate with `authorization alerts are insert-only`, including for the table owner. The role's update and delete fail with permission denied. Saving an authorization does not delete alerts. The migration does not create a role and does not grant `authorization_app` update on unrelated tables. `node tools/infra/check-forward-migrations.mjs` accepts the file. No `DROP` or `RENAME`.
- `Check` has no void operation, and this slice cannot edit the orders domain. `VoidLine` detaches the line with the public `transfer` onto an unsaved sink check (`check_void_sink`) and saves only the original account. The line leaves that account. The sink is not persisted.
- A line in `held` or `sent` whose evaluation is `allowed` is voided without a grant. `requires_authorization` consumes first. A null `authorizationId` does not call consume. `UnknownAuthorizationReference` and a `false` consume leave the line unchanged. `in_preparation`, `ready`, and `delivered` return before the platform calls. A closed shift returns after the open-shift read and before count, evaluate, or consume.
- The consumed value is `1` and `targetId` is the line id. The audit action is `sale.void-before-kitchen`. `after` is `{ value: 1, shiftId, kitchen: "before" }`. `before` is `{ state }` so the successful audit is not the same state twice.

## Remaining

Tasks 4.2–7.1 are pending. The next checkbox is 4.2. Task 4.1 is the only checkbox newly marked in this batch. 8/25 tasks complete.
