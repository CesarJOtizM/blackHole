# Archive Report

**Change**: p0-05-roles-and-permissions
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-02
**Archived to**: `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions/`
**Verification verdict**: PARTIAL
**CRITICAL**: None
**strict_tdd**: false
**Engram review receipt**: none. `verify-report.md` is the review receipt. Source artifacts have no observation IDs.
**Archive-report observation**: Engram `1160` (`obs-c65663fc89f96c89`), project `blackhole`, topic `sdd/p0-05-roles-and-permissions/archive-report`.

## Gate

Persistence mode is openspec. The orchestrator stated there is no Engram review receipt. This phase did not search Engram for proposal, spec, design, tasks, or verify-report. Those artifacts were read from `openspec/changes/p0-05-roles-and-permissions/`. `verify-report.md` is the receipt (`schema: gentle-ai.verify-result/v1`, `evidence_revision: sha256:fcf2ef8b126497beca59c9a204cbf1a295dc2953d28bf88e57c95566841085f0`).

The recorded verdict is PARTIAL. `blockers: 0`. `critical_findings: 0`. Requirements 6/7. Scenarios 13/14. The missing scenario is "Remote approval offline" under Supervisor Authorization, marked DEFERRED. CRITICAL is None. The orchestrator instructed an intentional archive with warnings. This phase did not re-run tests and does not claim a new test run.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The delta at `specs/authorization/spec.md` is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/authorization/spec.md` did not exist. The copy creates the source of truth and deletes nothing from a prior main spec. The merge is not destructive. No extra confirmation was required.

This phase did not edit product source, did not commit, and did not edit another change.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions/proposal.md` | n/a (openspec; no Engram receipt) |
| spec | `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions/specs/authorization/spec.md` | n/a (openspec; no Engram receipt) |
| design | `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions/design.md` | n/a (openspec; no Engram receipt) |
| tasks | `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions/tasks.md` | n/a (openspec; no Engram receipt) |
| apply-progress | `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions/apply-progress.md` | n/a (openspec; no Engram receipt) |
| verify-report | `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions/verify-report.md` | n/a (openspec; this file is the review receipt) |
| archive-report | `openspec/changes/archive/2026-11-02-p0-05-roles-and-permissions/archive-report.md` | 1160 (`obs-c65663fc89f96c89`) |

## Task Completion Gate

`tasks.md` has 25/25 implementation tasks checked (1.1–1.6, 2.1–2.7, 3.1–3.3, 4.1–4.9). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. `apply-progress.md` records the same 25/25. The verify report records tasks total 25, complete 25, incomplete 0.

The "Unplaced" note in `tasks.md` is not a task. It states that remote approval offline (hybrid node, on-site phone, no internet) has no socket, Web Push, or offline evaluate.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks:

- Every permission in the matrix is proven by an automated case, and nobody can grant themselves more privileges than they hold.
- A supervisor cannot authorize their own void.
- A site-1 administrator cannot assign roles in site 2.
- A limit change reaches the owner as a notice.

This archive does not mark those proposal criteria done.

## Spec Reconciliation

No sentence or scenario was rewritten. The orchestrator instructed a straight copy because `openspec/specs/authorization/spec.md` did not exist.

The delta was copied there unchanged before the folder move. SHA-256 of both copies at sync time: `CC46B818EC51A6B9474FF83E7B5C49A16B72DF45C7CE4083018EC216CCAB851D`. Length 4280 bytes.

The copied file keeps seven requirements and fourteen scenarios:

- Permission Catalog and Matrix
- Scoped Assignments
- Server-Side Evaluation
- Limits and Site Adjustments
- No Privilege Escalation
- Supervisor Authorization, including the scenario "Remote approval offline"
- Support Access

That deferred scenario stays in the source of truth. This archive does not implement it, does not remove it, and does not add a socket, Web Push, or offline evaluate. The node behavior recorded by verify remains: 403 `PermissionCommandRejected`, and nothing is stored.

Other domains were not touched.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| authorization | Created | Full spec copied unchanged. 7 requirements, 14 scenarios. 0 delta add, 0 modify, 0 remove, 0 rename. 0 requirements deleted from a prior main spec. |

Source of truth: `openspec/specs/authorization/spec.md`.

## Recorded Verification (not re-run)

From `verify-report.md` only:

- Tests: `pnpm exec vitest run --project platform --project api-cloud --project local-node --project skeleton`. Exit 0. 567 passed, 0 failed, 0 skipped. `test_output_hash: sha256:e95c2b94eedc8900f63e3a29652b42615da77385582a4e4d0388396d33d717a2`.
- Typecheck: `pnpm typecheck`. Exit 0. `build_output_hash: sha256:fe6d5c722085097098478e6b87e60b5cec8444e0566b2694f3e0f2fe2d419961`.
- Authorize cap: the recorded report says `resolveAuthorization` calls `assertAuthorizerCovers` before it changes the request. A discount of 20 against the supervisor cap of 15, and a comp without an authorize grant, throw `AuthorizerRejected` and leave the request pending.

This archive did not run those commands again.

## Residual Warnings (not blocking)

Accepted by the orchestrator. This archive does not treat them as resolved and does not change product source:

1. Remote approval while the site is offline is a hybrid scenario. It stays deferred under D-37. It is not implemented. It must not be implemented in this archive. The node returns 403 `PermissionCommandRejected` and stores nothing. Do not add a socket, Web Push, or offline evaluate.
2. `RequestExpired` matches the required behavior (throw, no status change, no save) and has no behavioral test. Warning, not CRITICAL.
3. `revokeSupport` is implemented and untested. Warning, not CRITICAL.
4. Empty `reason` throws `ReasonRequired` and is untested. Warning, not CRITICAL.
5. Phases 2 and 3 have no separate captured RED run. Phase 4 HTTP tests were added in the same batch as the controllers. `strict_tdd` is false. The verify report treats these as process notes.
6. `pnpm lint` exit 1 is recorded repo noise (Biome CRLF) plus two `useImportType` findings in `authorization-access.ts`. The verify report does not fail the change on that exit.

## State

`state.yaml` in this archive has `status: archived` and `archive: done`. `verify` stays `partial`, matching the receipt. The active folder `openspec/changes/p0-05-roles-and-permissions/` is removed by the move.

## SDD Cycle

The change was planned, implemented, verified (PARTIAL, zero CRITICAL, 13/14 scenarios, remote approval offline deferred), copied unchanged into the main spec, and archived with warnings. Active `openspec/changes/` no longer contains `p0-05-roles-and-permissions`.
