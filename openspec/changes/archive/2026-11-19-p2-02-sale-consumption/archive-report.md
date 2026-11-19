# Archive Report

**Change**: p2-02-sale-consumption
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `p2-11/rollout-status` `750d0f365f7f2ed36d6eaa57d40ab3fed54bab20`

## Gate

Persistence is openspec. Filesystem artifacts were read from `openspec/changes/p2-02-sale-consumption/`: `proposal.md`, `specs/inventory-ledger/spec.md`, `specs/stock-consumption/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`. No Engram review receipt exists in this change folder. The orchestrator authorized archive when tasks are complete and the verify report has zero CRITICAL. `verify-report.md` verdict is `pass_with_warnings`, `critical_findings: 0`, `archive_allowed: true`.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. Both artifacts are full specifications. They have no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/inventory-ledger/spec.md` and `openspec/specs/stock-consumption/spec.md` did not exist. The merge creates those specs and deletes nothing. No extra confirmation was required. Proposal capabilities list both as new and modified capabilities as none.

Dependencies are satisfied by archive folders, including stale `state.yaml` rows elsewhere: `2026-11-13-p2-01-ingredients-and-recipes`, `2026-10-28-p1-02-dining-room-and-kitchen`, `2026-11-02-p0-02-skeleton-and-sync`, `2026-10-28-p0-06-audit`.

This phase did not commit, did not re-verify, did not edit product code, and did not update `docs/roadmap.md`.

`state.yaml` `artifacts.archive` was set to `done` before the folder move. `status` stays `applied`. `verify` stays `pass-with-warnings`.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/proposal.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/specs/inventory-ledger/spec.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/specs/stock-consumption/spec.md` | none (openspec filesystem) |
| design | `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/design.md` | none (openspec filesystem) |
| tasks | `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/tasks.md` | none (openspec filesystem) |
| apply-progress | `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/apply-progress.md` | none (openspec filesystem) |
| verify-report | `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/verify-report.md` | none (openspec filesystem) |
| archive-report | `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/archive-report.md` | Engram `1390` (`obs-67fceb0fba10ee14`), topic `sdd/p2-02-sale-consumption/archive-report` |

## Task Completion Gate

`tasks.md` has 21/21 implementation tasks checked (1.1–1.2, 2.1–2.7, 3.1–3.6, 4.1–4.6). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was performed. The verify report records tasks total 21, complete 21, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked. Those are pilot outcomes, not implementation tasks. This archive does not mark them done.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| inventory-ledger | Created | Full spec copied. 5 requirements, 8 scenarios. 0 modified, 0 removed, 0 renamed. |
| stock-consumption | Created | Full spec copied. 7 requirements, 13 scenarios. 0 modified, 0 removed, 0 renamed. |

SHA-256 at sync time, main spec equals the change spec:

- `inventory-ledger`: `6088F3C012C01BDE5D51D819ACF6385E4737A1F98F073BA743BC39C063903326`
- `stock-consumption`: `C77833B268F8356BCFDDC7E6D7ADC64C4BCAF9F486F2428DFEE2C4F913109049`

Copied inventory-ledger requirements: Append-only Movements, Derived Balance, Location Ownership by Operating Mode, Upward Synchronization, Dialect Parity.

Copied stock-consumption requirements: Deduct on Send to Kitchen, Version Fixed at Send Time, Stocked Preparations, Void Before or After Kitchen Start, Negative Stock Never Blocks, Idempotent Consumption, Operation by Mode.

## Warnings Preserved

Accepted and left unfixed:

- The idempotency unique key includes `ingredient_id`. Design and task 2.4 name `(tenantId, orderLineId, role)`.
- `CatalogReferenceCostList.costOf` uses the first brand that contains the ingredient. No passing test covers that class. Waste keeps the stored unit cost.
- `NegativeStockNoticeLog` records `role: "siteAdministrator"`. The requirement text also names kitchen and cash screens. No passing test shows the alert on a cash screen.
- `registerStockLedger` and `sqliteStockLedger` have no local-node caller. The SQLite contract passed. Hybrid outage is not an acceptance scenario.

Also recorded, not a CRITICAL:

- A concurrent typecheck plus inventory, orders, and api-cloud run timed out unrelated PGlite contracts. The serial inventory and orders reruns passed and are the recorded evidence.

## Archive Contents

- proposal.md
- specs/inventory-ledger/spec.md
- specs/stock-consumption/spec.md
- design.md
- tasks.md (21/21 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml (`archive: done`)
- archive-report.md

Active `openspec/changes/p2-02-sale-consumption/` is gone.

## Source of Truth Updated

- `openspec/specs/inventory-ledger/spec.md`
- `openspec/specs/stock-consumption/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/archive-report.md`, `openspec/specs/inventory-ledger/spec.md`, `openspec/specs/stock-consumption/spec.md`
**Learned**: PASS WITH WARNINGS with zero CRITICAL was archived as intentional-with-warnings. The four accepted warnings stay open: ingredient_id in the idempotency key, first-mark reference cost, site-administrator-only notice, and the SQLite ledger with no local-node caller.
