# Archive Report

**Change**: p0-02-skeleton-and-sync
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-02
**Archived to**: `openspec/changes/archive/2026-11-02-p0-02-skeleton-and-sync/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false
**Engram review receipt**: none. `verify-report.md` is the review receipt. Source artifacts have no observation IDs that constitute a review receipt.
**Archive-report observation**: Engram `1167` (`obs-fc1cb70ee9422009`), project `blackhole`, topic `sdd/p0-02-skeleton-and-sync/archive-report`.

## Gate

Persistence mode is openspec. The orchestrator stated there is no Engram review receipt. `verify-report.md` is the receipt. This phase searched Engram for `sdd/p0-02-skeleton-and-sync/proposal`, `spec`, `design`, `tasks`, and `verify-report` on project `blackhole`.

- Proposal returned no memory.
- Spec returned no memory.
- Design returned observation `#1107` (`sdd/p0-02-skeleton-and-sync/design`). That observation is a summary of the cloud-slice design, not the full `design.md` and not a review receipt. Search reported it contested by `#obs-c3bd1c3ecbbf23d8` (pending). This phase did not judge that contest.
- Tasks returned no memory.
- Verify-report returned observation `#1165` (`sdd/p0-02-skeleton-and-sync/verify-report`). That observation is a summary of the cloud-slice verification, not the full report and not the review receipt. The filesystem file remains the receipt.

The recorded verdict is PASS WITH WARNINGS. CRITICAL count is 0. 3/3 cloud scenarios passed in the recorded verify (9 platform tests, 5 HTTP tests, `tsc` exit 0). 21 hybrid scenarios and the SQLite contract stay deferred under D-37. The orchestrator instructed an intentional archive with warnings. This phase did not re-run tests and does not claim a new test run.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. Both change specs were inspected before any write:

- `specs/sync/spec.md` is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/sync/spec.md` did not exist. The file was copied unchanged. The copy creates the source of truth and deletes nothing from a prior main spec.
- `specs/operating-mode/spec.md` is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/operating-mode/spec.md` already existed from the organization archive. Replacing that file with this full spec would delete the organization requirements `Site Mode in the Structure` and `Structure Copy Reaches the Node`. That replacement was not performed.

Requirements were merged by name. No requirement name overlapped, so nothing was replaced and nothing was removed. The merge is not destructive. No extra confirmation was required.

This phase did not edit product source, did not commit, and did not edit another change.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-02-p0-02-skeleton-and-sync/proposal.md` | n/a (openspec; Engram search returned no memory) |
| spec (operating-mode) | `openspec/changes/archive/2026-11-02-p0-02-skeleton-and-sync/specs/operating-mode/spec.md` | n/a (openspec; Engram search returned no memory) |
| spec (sync) | `openspec/changes/archive/2026-11-02-p0-02-skeleton-and-sync/specs/sync/spec.md` | n/a (openspec; Engram search returned no memory) |
| design | `openspec/changes/archive/2026-11-02-p0-02-skeleton-and-sync/design.md` | `#1107` is a summary only, not the full design and not a review receipt. Contested by `#obs-c3bd1c3ecbbf23d8` (pending); not judged here. |
| tasks | `openspec/changes/archive/2026-11-02-p0-02-skeleton-and-sync/tasks.md` | n/a (openspec; Engram search returned no memory) |
| verify-report | `openspec/changes/archive/2026-11-02-p0-02-skeleton-and-sync/verify-report.md` | File is the review receipt. Engram `#1165` is a summary only, not the receipt. |
| archive-report | `openspec/changes/archive/2026-11-02-p0-02-skeleton-and-sync/archive-report.md` | 1167 (`obs-fc1cb70ee9422009`) |

## Task Completion Gate

`tasks.md` has 27/27 implementation tasks checked (1.1–1.15, 2.1–2.3, 3.1–3.9). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. This change has no `apply-progress.md`. The verify report records tasks total 27, complete 27, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked except the skeleton criterion. Those are not implementation tasks:

- [ ] A site in cloud mode operates without a node.
- [ ] With hybrid activated, an event created without internet reaches the cloud after 2 h disconnected, not duplicated and in order.
- [ ] Every port has one contract suite (`<port>.contract.ts`, run by `<adapter>.contract.test.ts`) passing on memory, SQLite and PostgreSQL.
- [ ] With internet, sync delay stays at p95 < 1 min (TRD-00 15).
- [x] Skeleton: workspace, `contexts/platform`, `shared/contracts`, both hosts, `tools/cruiser`, `tools/skeleton` and architecture rules.

This archive does not mark those open proposal criteria done. The hybrid and SQLite criteria stay deferred under D-37.

## Spec Reconciliation

Specs were synced before the folder move.

`openspec/specs/sync/spec.md` is a byte copy of the change spec. SHA-256 `EF2094D956E985F9F31FB92D5941FDE149C1AACB7662E19AAAF0E76E73C9321D`, 4173 bytes, source and destination match. No sentence was rewritten. The copy keeps seven requirements and fourteen scenarios:

- Transactional Outbox
- Event Envelope
- Idempotent Inbox
- Compressed Resumable Batches
- Sync Delay
- Send Priority
- Configuration Cursor

Those scenarios stay deferred. The sync spec is the source of truth for that deferred behavior. This archive does not implement it, does not remove it, and does not add SQLite, `shared/sync`, an outbox, an inbox, a cursor, batches, or a node operation store.

`openspec/specs/operating-mode/spec.md` already held the organization archive. That file was the organization delta copied unchanged, including the heading `# Delta for Operating Mode` and the section `## ADDED Requirements`. This merge keeps both requirement bodies verbatim and places them under `## Requirements` of `# Operating Mode Specification`. The heading change is structural. No organization requirement sentence or scenario was rewritten or deleted.

Preserved from the existing main spec (2 requirements, 5 scenarios):

- Site Mode in the Structure
- Structure Copy Reaches the Node

Appended from this change (5 requirements, 11 scenarios). No name matched an existing requirement, so none were modified:

- Cloud Mode by Default
- Single Operation Owner and Generation
- Activate Hybrid
- Return to Cloud
- Same Behavior in Both Hosts

Resulting main spec: 7 requirements, 16 scenarios. 5 added, 0 modified, 0 removed, 0 renamed. 0 organization requirements deleted.

Other domains were not touched.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| sync | Created | Full spec copied unchanged. 7 requirements, 14 scenarios. 0 modified, 0 removed, 0 renamed. 0 requirements deleted from a prior main spec. Hybrid scenarios stay deferred under D-37. |
| operating-mode | Updated | Merged by requirement name into the existing organization spec. 2 organization requirements preserved (5 scenarios). 5 requirements appended (11 scenarios). 0 modified, 0 removed, 0 renamed. The full-spec replacement that would have deleted the organization requirements was not performed. |

Source of truth:

- `openspec/specs/sync/spec.md`
- `openspec/specs/operating-mode/spec.md`

## Recorded Verification (not re-run)

From `verify-report.md` only. HEAD is `cb71c4ad43c6963dc1bfe8d66c2cd906f93d02ab`. This archive did not run these commands again.

- `pnpm exec vitest run --project platform venue-operation` — exit 0. 3 files, 9 passed. Domain plus the memory and PGlite contract files.
- `pnpm exec vitest run --project api-cloud accept-cloud-write` — exit 0. 1 file, 5 passed.
- `pnpm exec tsc -b contexts/platform apps/api-cloud --pretty false` — exit 0.

Recorded total: 14 passed, 0 failed, 0 skipped. 3/3 cloud scenarios owned by this slice passed. 1 scenario is partial (PostgreSQL contract passed; SQLite dialect deferred by D-37). 21/21 hybrid sync and node-owner scenarios deferred. 0 CRITICAL.

## Residual Warnings (not blocking)

Accepted by the orchestrator as an intentional archive with warnings. This archive does not treat them as resolved and does not change product source:

1. The repository contract was proven on memory and PGlite only. SQLite stays deferred (D-37). Do not implement it.
2. `postgresVenueOperations` has no callers. `createApplication` receives the dependency bag.
3. `apps/local-node` is no longer an empty Nest host because later changes added routes. This change did not add an operation store on the node.
4. Hybrid sync scenarios stay deferred.

The verify report also records these non-blocking notes. They are not resolved here:

- Internet cut in cloud mode is deferred because the design records no node operation store and no sync. That scenario is not named verbatim in the design deferred list. No runtime test in the recorded run observed a connectivity cut.
- The controller and the Postgres binder live under `src/http/` and `src/postgres/`. The design named flat files under `apps/api-cloud/src/`.
- `contexts/platform/application/accept-cloud-write/accept-cloud-write.test.ts` was outside the `venue-operation` filename filter. The HTTP file covered accept, stale, and replay.

## State

`state.yaml` in this archive has `status: archived` and `archive: done`. `verify` stays `done`. `verify_verdict` stays `pass-with-warnings`. The active folder `openspec/changes/p0-02-skeleton-and-sync/` is removed by the move.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, zero CRITICAL, 3/3 cloud scenarios, 21 hybrid scenarios and the SQLite contract deferred), synced into the main specs, and archived with warnings. Active `openspec/changes/` no longer contains `p0-02-skeleton-and-sync`.
