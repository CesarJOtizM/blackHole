# Apply progress: Anti-Theft Controls

**Change**: p1-07-anti-theft-controls
**Mode**: Standard (ADR-017 test-first; `strict_tdd` is false)
**PR slice**: PR1 `feat/anti-theft-binding` targeting `feat/anti-theft`
**Work unit**: 1 — Bind

## Completed tasks

- [x] 1.1 Domain binding: `targetId`, one consume, mismatch unconsumed, second consume throws, `compShiftCop`

## Work Unit Evidence

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/domain/authorization.test.ts contexts/platform/domain/evaluate.test.ts`. RED exit 1: 8 failed, 16 passed (24). GREEN exit 0: 2 files, 24 passed. |
| Runtime harness command/scenario and exact result | N/A. Domain only; tasks forecast says runtime harness N/A. |
| Rollback boundary | `contexts/platform/domain/authorization.ts`, `contexts/platform/domain/authorization.test.ts`, `contexts/platform/domain/evaluate.ts`, `contexts/platform/domain/evaluate.test.ts` |

### RED

Command: `pnpm vitest run --project platform contexts/platform/domain/authorization.test.ts contexts/platform/domain/evaluate.test.ts`

Result: exit 1. Test files 2 failed. Tests 8 failed, 16 passed (24).

Failures before production changes:

- Request snapshot had no `targetId`, `shiftTotals`, or `consumedAt`.
- `consumeAuthorization` was not a function.
- A 20,000 courtesy on top of 90,000 `compShiftCop` was `allowed` instead of `requires_authorization` (`compShiftCop` cap 100,000).

### GREEN

Same command. Exit 0. Test files 2 passed. Tests 24 passed.

Related regression, same project: in-memory and Postgres authorization contracts, `operate-authorization`, and `evaluate-permission`. Exit 0. 4 files, 25 passed. Postgres still round-trips because missing binding fields normalize to `targetId = venueId`, zero shift totals, and `consumedAt = null`.

## Deviations

- Binding fields stay optional on the persisted request so current callers and the Postgres mapper keep compiling. `restore` fills the migration defaults. Task 2.3 passes `targetId` and shift totals from `OperateAuthorization`. Task 3.1 adds the columns.
- `compShiftCop` is optional and treated as 0 when absent. The domain does not count audits.
- The design `after` shape was not added. This slice does not record the audit event. `resolution.action` remains the permission code.

## Remaining

Tasks 2.1–7.1 are pending. Next assigned batch should stay on work unit 2.
