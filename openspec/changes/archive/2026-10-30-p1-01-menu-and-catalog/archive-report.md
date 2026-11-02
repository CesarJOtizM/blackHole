# Archive Report

**Change**: p1-01-menu-and-catalog
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-10-30
**Archived to**: `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog/`
**Verification verdict**: PASS WITH WARNINGS
**Engram**: not used. No observation IDs. Orchestrator forbade Engram for this archive.

## Gate

Archive was allowed. `reviewGate.result` is `allow`. This repository has no Engram review receipt. The 2026-10-28 archives of tax-engine, dining-room, and audit used `verify-report.md` as the gate. This archive does the same. No transaction, ledger, or receipt file was required.

`verify-report.md` records PASS WITH WARNINGS and `CRITICAL: None`. `state.yaml` `verify: partial` is the non-critical warning record, not a failed verify. `tasks.md` has 19/19 implementation tasks checked. No checkbox reconciliation was performed.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog/proposal.md` | n/a (openspec) |
| spec | `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog/specs/catalog/spec.md` | n/a (openspec) |
| design | `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog/design.md` | n/a (openspec) |
| tasks | `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog/tasks.md` | n/a (openspec) |
| apply-progress | `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog/apply-progress.md` | n/a (openspec) |
| verify-report | `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog/verify-report.md` | n/a (openspec) |
| archive-report | `openspec/changes/archive/2026-10-30-p1-01-menu-and-catalog/archive-report.md` | n/a (openspec) |

Artifacts were read from `openspec/changes/p1-01-menu-and-catalog/` before the move. The table lists their archived paths.

## Task Completion Gate

`tasks.md` has 19/19 implementation tasks checked (1.1–7.3). No `- [ ]` implementation task remains. Archive was allowed. The test suite was not run in this phase. Checkboxes were not reconciled.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks. The site-price criterion is covered by the passing quote tests. The waiter-phone criterion and the hybrid-reconnect criterion wait on the deferred UI and on D-37. See Residual Warnings.

`state.yaml` was not edited. The orchestrator owns that file. The archived copy still says `status: applied`, `verify: partial`, and `archive: pending`, which is the state observed before the move.

## Spec Reconciliation

No sentence or scenario was rewritten. The orchestrator instructed a direct copy and forbade fixing the verify warnings. The delta has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. It is a full spec. The main spec `openspec/specs/catalog/spec.md` did not exist, so the change spec was copied unchanged before the folder move. SHA-256 of both copies is `145D09B50463E1C318A08D6BAC0643F86D4CAD1284BE84BD801EA2485E7F2595`.

This merge adds requirements. It does not delete existing main-spec requirements. `openspec/config.yaml` `rules.archive` ("Warn before merging destructive deltas") does not apply as a destructive merge.

The copied spec still contains requirement "Menu Copy to the Operating Site" and scenario "Change during an internet cut (hybrid)". That scenario is not delivered behavior of this slice. The verify report records it as a spec/design conflict with D-37. A suggestion asked to move that scenario out of delivered behavior before the merge. That suggestion was left unresolved because this archive was told not to fix warnings.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| catalog | Created | Full spec copied unchanged. 7 requirements, 14 scenarios. 0 modified, 0 removed, 0 renamed in a prior main spec. |

Source of truth: `openspec/specs/catalog/spec.md`.

Other domains were not touched.

## Residual Warnings (not blocking)

These remain from the verify report. This archive does not treat them as resolved and does not treat the deferred hybrid copy as delivered behavior:

- The hybrid cut scenario remains in the catalog spec and is not implemented. The passing node test proves 403 `MenuRejected` and an empty module. That matches design D-37 and tasks 7.1–7.2. It contradicts the spec sentence that the node keeps its copy and applies the new version once after reconnection.
- The waiter-phone scenario is PARTIAL. The passing pin GET proves products, the site price, and `orderable` for a registered device. It does not publish variants, modifiers, or a combo. `apps/venue-app` and `apps/admin-web` stay deferred.
- `postgresMenus` is never called. A cloud process that does not pass `menus` stores the catalog in memory. The PGlite repository contract passed.
- The three proposal success checkboxes are still open.
- `apply-progress.md` records work units over the 400-line budget and `size:exception` was not granted. This phase did not recompute the diff.

Suggestions recorded there, left unresolved by this archive:

- Move the hybrid cut scenario out of this change's delivered behavior before the catalog delta becomes the main spec.
- A published modifier with price 0 is allowed. No test asserts that a free modifier leaves the line at the product price.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, no CRITICAL), synced unchanged, and archived. Active `openspec/changes/` no longer contains `p1-01-menu-and-catalog`.
