# Archive Report

**Change**: p2-08-shortage-alerts
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `p2-11/rollout-status` `750d0f365f7f2ed36d6eaa57d40ab3fed54bab20`

## Gate

Persistence is openspec. Filesystem artifacts were read from `openspec/changes/p2-08-shortage-alerts/`: `proposal.md`, `specs/shortage-alerts/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`. No Engram review receipt exists in this change folder. The orchestrator authorized archive when tasks are complete and the verify report has zero CRITICAL.

`verify-report.md` front matter is `verdict: pass_with_warnings`, `critical_findings: 0`, `archive_allowed: false`. The body says **CRITICAL**: None and **Verdict**: PASS WITH WARNINGS. `archive_allowed: false` names `p2-02-sale-consumption`, `p2-03-purchasing`, `p2-05-warehouses-and-transfers`, and `p2-07-producible-quantity` as not archived. Those rows are stale. All four are now under `openspec/changes/archive/` with the 2026-11-19 prefix, except p2-03 which is also `2026-11-19-p2-03-purchasing`. `p0-05-roles-and-permissions` and `p0-06-audit` were already archived.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The shortage-alerts artifact is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/shortage-alerts/spec.md` did not exist. The merge creates that spec and deletes nothing. No extra confirmation was required. Proposal capabilities list `shortage-alerts` as new and modified capabilities as none.

This phase did not commit, did not re-verify, did not edit product code, and did not update `docs/roadmap.md`.

`state.yaml` `artifacts.archive` was set to `done` before the folder move. `status` stays `applied`. `verify` stays `pass` as written in that file. `archive_blocked` and `dependency_verification` were left as the verifier wrote them.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/proposal.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/specs/shortage-alerts/spec.md` | none (openspec filesystem) |
| design | `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/design.md` | none (openspec filesystem) |
| tasks | `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/tasks.md` | none (openspec filesystem) |
| apply-progress | `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/apply-progress.md` | none (openspec filesystem) |
| verify-report | `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/verify-report.md` | none (openspec filesystem) |
| archive-report | `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/archive-report.md` | Engram `1396` (`obs-a22fd5eacbfda16e`), topic `sdd/p2-08-shortage-alerts/archive-report` |

## Task Completion Gate

`tasks.md` has 29/29 implementation tasks checked (1.1–1.2, 2.1–2.6, 3.1–3.6, 4.1–4.4, 5.1–5.5, 6.1–6.4, 7.1–7.2). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was performed. The verify report records 29/29 tasks checked.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| shortage-alerts | Created | Full spec copied. 8 requirements, 16 scenarios. 0 modified, 0 removed, 0 renamed. |

SHA-256 at sync time, main spec equals the change spec: `5ADEDD276FCB3997C5251A18239EA3672212854C346E57265A57BBEC33CA9968`.

Copied requirements: Stock Levels, Level Evaluation, Coverage Alert, Dish Alert, Lifecycle And Hysteresis, Notification And Escalation, One-Tap Action, Suggested Levels.

The verify report marks 15/16 scenarios compliant. The offline hybrid scenario is design-deferred. The copied spec keeps that text.

## Warnings Preserved

- Offline hybrid notification has no passing test. Delivery stays on `api-cloud`. No SQLite shortage store.
- `shortageAlertsEnabled` defaults off.
- Coverage uses UTC, not America/Bogota.
- The first notice is `siteAdministrator` only. `generalManager` is added at twice the limit. There is no `kitchenChief` notice.
- The worker cron payload is empty and does not list venues.
- `findLevelAlert` opens its own transaction. HTTP restock is not wrapped in the ledger transaction.
- The SSE handler lists stored notices and does not push a notice saved after the socket opens.
- `StockLevelsScreen` is not mounted in the admin router.
- Kitchen and cash one-tap sends `purchaseUnit: 1` with null warehouse and supplier.
- The Postgres stock entry and the alert are not one SQL transaction. Cloud sale, return, and waste factories do not receive `EvaluateStockLevels`.
- This run did not execute typecheck, lint, architecture, or the full vitest suite.

## Archive Contents

- proposal.md
- specs/shortage-alerts/spec.md
- design.md
- tasks.md (29/29 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml (`artifacts.archive: done`)
- archive-report.md

Active `openspec/changes/p2-08-shortage-alerts/` is gone.

## Source of Truth Updated

- `openspec/specs/shortage-alerts/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/archive-report.md`, `openspec/specs/shortage-alerts/spec.md`
**Learned**: `archive_allowed: false` was a stale dependency set. Zero CRITICAL and complete tasks allowed archive as intentional-with-warnings.
