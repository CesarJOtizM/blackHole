# Archive Report

**Change**: p2-10-inventory-reports
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `p2-11/rollout-status` `750d0f365f7f2ed36d6eaa57d40ab3fed54bab20`

## Gate

Persistence is openspec. Filesystem artifacts were read from `openspec/changes/p2-10-inventory-reports/`: `proposal.md`, `specs/reporting/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`. No Engram review receipt exists in this change folder. The orchestrator authorized archive when tasks are complete and the verify report has zero CRITICAL.

`verify-report.md` front matter is `verdict: pass_with_warnings`, `critical_findings: 0`, `archive_allowed: false`. The body says **CRITICAL**: None and **Verdict**: PASS WITH WARNINGS. `archive_allowed: false` names `p2-05`, `p2-06`, `p2-08`, `p2-02`, `p2-03`, `p2-04`, and `p2-07` as unarchived. Those rows are stale. Each of those changes is now under `openspec/changes/archive/`. `p1-11-site-reports` and `p2-01-ingredients-and-recipes` were already archived.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The reporting artifact is an `ADDED` delta only. It appends six requirements to `openspec/specs/reporting/spec.md` and deletes nothing. The prior seven requirements stay: Shared Metric Definitions, Day Reports on the Operation Owner, Sales Reports, Time Reports, Cash Register and Staff Reports, Cloud History Projections, Role-Scoped Access. No extra confirmation was required. Proposal capabilities list no new capability and `reporting` as modified.

This phase did not commit, did not re-verify, did not edit product code, and did not update `docs/roadmap.md`.

`state.yaml` `artifacts.archive` was set to `done` before the folder move. `status` stays `applied`. `verify` stays `pass` as written in that file.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/proposal.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/specs/reporting/spec.md` | none (openspec filesystem) |
| design | `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/design.md` | none (openspec filesystem) |
| tasks | `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/tasks.md` | none (openspec filesystem) |
| apply-progress | `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/apply-progress.md` | none (openspec filesystem) |
| verify-report | `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/verify-report.md` | none (openspec filesystem) |
| archive-report | `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/archive-report.md` | Engram `1398` (`obs-fb4220be0aff42ff`), topic `sdd/p2-10-inventory-reports/archive-report` |

## Task Completion Gate

`tasks.md` has 16/16 implementation tasks checked (1.1–1.2, 2.1–2.6, 3.1–3.5, 4.1–4.3). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was performed. The verify report records 16/16 tasks checked.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| reporting | Updated | 6 requirements appended, 13 scenarios. 0 modified, 0 removed, 0 renamed. Prior 7 requirements kept. Main spec now has 13 requirements. |

Appended requirements: Food Cost Percentage, Theoretical Versus Actual, Waste Value And Rotation, Producible Dishes And Alerts, Day And History Sources, Cost Access.

The verify report marks 7/13 scenarios compliant. Six section 8.3 scenarios are design-deferred. The appended text keeps those scenarios. Cost Access also has a scenario named "Other site", distinct from the existing Role-Scoped Access scenario of the same name.

## Warnings Preserved

- Waste by reason, inventory value with a sync time, rotation and days of inventory, producible dishes, stockout and attention-time alerts, a hybrid node answer during an outage, and unchanged totals after a resent batch are in the spec and are not implemented. Design and tasks leave them out.
- Proposal success criteria for a hybrid outage and for complete totals after sync stay unchecked.
- This run did not re-execute typecheck, lint, architecture, a full Vitest project, or the memory, PostgreSQL, and SQLite `listByVenue` contracts.
- `InventoryCountFact` carries `averageCostCop`. The read model values the gap from the closing count.
- Admin-web still has a static `food-cost` section that does not call the new inventory-report endpoint.

## Archive Contents

- proposal.md
- specs/reporting/spec.md
- design.md
- tasks.md (16/16 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml (`artifacts.archive: done`)
- archive-report.md

Active `openspec/changes/p2-10-inventory-reports/` is gone.

## Source of Truth Updated

- `openspec/specs/reporting/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-19-p2-10-inventory-reports/archive-report.md`, `openspec/specs/reporting/spec.md`
**Learned**: The reporting merge was append-only. `archive_allowed: false` was a stale dependency set. Zero CRITICAL and complete tasks allowed archive as intentional-with-warnings.
