# Apply progress: Anti-Theft Controls

**Change**: p1-07-anti-theft-controls
**Mode**: Standard (ADR-017 test-first; `strict_tdd` is false)
**PR slice**: PR2 `feat/anti-theft-consume` targeting `feat/anti-theft-binding`
**Work unit**: 2 — Consume (task 2.1 only)

## Completed tasks

- [x] 1.1 Domain binding: `targetId`, one consume, mismatch unconsumed, second consume throws, `compShiftCop`
- [x] 2.1 Consume use case: a failed write after consume needs a new grant

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

## Deviations

- Binding fields stay optional on the persisted request so current callers and the Postgres mapper keep compiling. `restore` fills the migration defaults. Task 2.3 passes `targetId` and shift totals from `OperateAuthorization`. Task 3.1 adds the columns.
- `compShiftCop` is optional and treated as 0 when absent. The domain does not count audits.
- The design `after` shape was not added. This slice does not record the audit event. `resolution.action` remains the permission code.
- `ConsumeAuthorization.execute` also takes `tenantId` and reads `AuthorizationClock`. `AuthorizationRepository.load` is keyed by tenant, and `consumeAuthorization` requires `at`. `authorizationId` is the request id.
- `AuthorizationAlreadyConsumed` is re-exported from the use case because `domain/index` does not export it and this slice must not edit domain files.

## Remaining

Tasks 2.2–7.1 are pending. Next assigned batch should stay on work unit 2, task 2.2. Task 2.1 is the only checkbox newly marked in this batch.
