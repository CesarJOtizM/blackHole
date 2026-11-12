# Archive Report

**Change**: p1-12-qr-table-ordering
**Project**: blackhole
**Artifact store**: hybrid (openspec on disk + Engram project `blackhole`)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-11
**Archived to**: `openspec/changes/archive/2026-11-11-p1-12-qr-table-ordering/`
**Verdict**: PASS WITH WARNINGS
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Product code**: not edited
**Commit**: not created

## Intentional archive reason

The orchestrator instructed archive to proceed. Verification has no CRITICAL issues. All 36 implementation tasks are checked. These warnings do not block archive and were not fixed:

- Venue floor, kitchen, and register badges stay demo copy.
- The portal send is local state, and `/m/$token` does not pass `acceptance="rejected"` from the route.
- The outage queue and PA-52 stay deferred.

`openspec/config.yaml` `rules.archive` says to warn before merging destructive deltas. This merge only appended two dining-room requirements and created `qr-table-ordering`. Nothing was removed or renamed.

Archived folders `openspec/changes/archive/2026-11-11-p1-11-site-reports` and `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment` were not reopened or modified.

## Task completion gate

`openspec/changes/p1-12-qr-table-ordering/tasks.md` has 36/36 implementation tasks checked (`1.1`–`5.4`). No `- [ ]` remains in `tasks.md`. No stale-checkbox reconciliation was required.

Proposal success criteria in `proposal.md` stay unchecked. The verify report treats them as pilot outcomes, not implementation tasks. They were left unchanged.

Engram tasks observation `#1238` is the planning snapshot (revision 1). It does not contain the checkbox list. Completion evidence is `tasks.md` plus verify-report `#1263` (36/36, 0 incomplete).

`state.yaml` still says `apply: pending`, `verify: pending`, and `archive: pending`. Later phases did not update that DAG file. It was left as the historical record. Completion evidence is `tasks.md` and `verify-report.md`.

## Observation IDs

| Artifact | Topic key | Observation | Retrieval |
|----------|-----------|-------------|-----------|
| proposal | `sdd/p1-12-qr-table-ordering/proposal` | not found | Filesystem `proposal.md` used |
| spec | `sdd/p1-12-qr-table-ordering/spec` | not found | Filesystem delta specs used |
| design | `sdd/p1-12-qr-table-ordering/design` | `#1235` | Full observation loaded |
| tasks | `sdd/p1-12-qr-table-ordering/tasks` | `#1238` | Full observation loaded |
| verify-report | `sdd/p1-12-qr-table-ordering/verify-report` | `#1263` | Full observation loaded |
| apply-progress | `sdd/p1-12-qr-table-ordering/apply-progress` | `#1260` | Found while searching; not required for the merge |

Searches used project `blackhole` and an unscoped repeat. Neither returned a proposal or spec observation.

## Specs synced

| Domain | Action | Details |
|--------|--------|---------|
| dining-room | Updated | 2 added, 0 modified, 0 removed, 0 renamed |
| qr-table-ordering | Created | Full spec copied. 7 requirements. |

### dining-room (`openspec/specs/dining-room/spec.md`)

Existing requirements were preserved. Appended from `## ADDED Requirements`:

- QR Table Channel Visibility (scenarios: Waiter sees a QR order; Staff voids a QR line)
- Pending QR Intent Alert (scenarios: Long outage; Below threshold)

### qr-table-ordering (`openspec/specs/qr-table-ordering/spec.md`)

No main spec existed. The change spec is a full spec, not a delta, and was copied as the source of truth:

- Fixed Table QR
- Customer Menu
- Idempotent Order Intent
- Intent Application
- Optional Register Acceptance
- Customer Restrictions
- Outage Queue

The Outage Queue requirement stays in the main spec as written. Implementation of that queue remains deferred with PA-52. Archive did not rewrite the spec to match the deferral.

## Warnings preserved

Not fixed. Not treated as archive blockers.

- Floor, kitchen, and register badges do not read the queue. They stay hardcoded demo rows (`05`, `k-05`, and a seeded `intent_1`). The station-queue test does expose `qr_table`.
- `TableOrderScreen` does not call `GET` or `POST /m/:token`. "Enviar pedido" only flips local state. The rejection sentence exists when `acceptance` is `rejected`, but `/m/$token` never passes `acceptance="rejected"`.
- Sold-out at apply time is reported once in memory. Node reconnection and the outage queue stay deferred with PA-52. Not a defect of this slice.
- The portal menu is the `SITE_MENU` constant. HTTP GET/POST cover the real menu and intent.

Suggestions left for a later change, not applied here:

- Read `channel === "qr_table"` from the queue or check when demo badges are replaced.
- Pass cashier rejection into `TableOrderRoute` from order status.

## Verify evidence cited

- Verdict: PASS WITH WARNINGS. CRITICAL: none.
- Tasks: 36 complete, 0 incomplete.
- Tests cited by verify: 47 passed, 0 failed, 0 skipped.
- Build cited by verify: scoped `tsc -b shared/contracts` exit 0. Full `pnpm typecheck` was not re-run in that verify.
- Compliance cited by verify: 15/18 scenarios compliant; waiter badge partial; dish unavailable on reconnection partial; order during outage deferred and not scored as a defect.

## Archive contents

- `proposal.md`
- `specs/dining-room/spec.md`
- `specs/qr-table-ordering/spec.md`
- `design.md`
- `tasks.md` (36/36 implementation tasks checked)
- `verify-report.md`
- `apply-progress.md`
- `state.yaml`
- `archive-report.md`

## Source of truth updated

- `openspec/specs/dining-room/spec.md`
- `openspec/specs/qr-table-ordering/spec.md`

## SDD cycle

Planned, implemented, verified, and archived. Ready for the next change. Next recommended phase: none.
