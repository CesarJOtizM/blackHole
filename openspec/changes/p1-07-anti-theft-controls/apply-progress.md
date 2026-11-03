# Apply progress: Anti-Theft Controls

**Change**: p1-07-anti-theft-controls
**Mode**: Standard (ADR-017 test-first; `strict_tdd` is false)
**PR slice**: `feat/anti-theft-report` targeting `feat/anti-theft-alerts` (PR #72). Not the SQL branch.
**Work unit**: 6 — in-memory control report (task 2.5)
**Chain strategy**: feature-branch-chain
**size:exception**: not granted

## Completed tasks

- [x] 1.1 Domain binding: `targetId`, one consume, mismatch unconsumed, second consume throws, `compShiftCop`
- [x] 2.1 Consume use case: a failed write after consume needs a new grant
- [x] 2.2 Count executed operations: successful audits only
- [x] 2.3 Operate authorization: request carries `targetId` and shift totals; a rejected PIN appends `pin.confirmation-failed` without the PIN
- [x] 2.4 Detect unusual behavior: void seed 5; every self-authorization alerts; discount, pair, and failed-PIN seeds are venue rows defaulting to 5
- [x] 2.5 Read control report: voids, discounts, courtesies, cash differences, drawer openings, and accounts reopened or edited after the pre-bill. `audit.view`. Successful audits only

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

## Remaining

Tasks 3.1–7.1 are pending. The next checkbox is 3.1. Task 2.5 is the only checkbox newly marked in this batch. 6/25 tasks complete.
