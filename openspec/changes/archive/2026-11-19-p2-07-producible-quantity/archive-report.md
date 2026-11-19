# Archive Report

**Change**: p2-07-producible-quantity
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `p2-11/rollout-status` `750d0f365f7f2ed36d6eaa57d40ab3fed54bab20`

## Gate

Persistence is openspec. Filesystem artifacts were read from `openspec/changes/p2-07-producible-quantity/`: `proposal.md`, `specs/producible-quantity/spec.md`, `specs/catalog/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`. No Engram review receipt exists in this change folder. The orchestrator authorized archive when tasks are complete and the verify report has zero CRITICAL.

`verify-report.md` front matter is `verdict: pass_with_warnings`, `critical_findings: 0`, `archive_allowed: false`. The body says **CRITICAL**: None and **Verdict**: PASS WITH WARNINGS. `archive_allowed: false` names `p2-02-sale-consumption`, `p2-04-production`, and `p2-05-warehouses-and-transfers` as still active, and notes that p2-02 failed verify. Those rows are stale. All three are archived under `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/`, `2026-11-19-p2-04-production/`, and `2026-11-19-p2-05-warehouses-and-transfers/`. p2-02's archived verify report is pass with warnings and zero CRITICAL. Also already archived: `2026-10-30-p1-01-menu-and-catalog`, `2026-10-28-p1-02-dining-room-and-kitchen`, `2026-11-13-p2-01-ingredients-and-recipes`.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The producible-quantity artifact is a full specification with no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/producible-quantity/spec.md` did not exist. The catalog artifact is an `ADDED` delta only. It appends three requirements and deletes nothing. No extra confirmation was required.

This phase did not commit, did not re-verify, did not edit product code, and did not update `docs/roadmap.md`.

`state.yaml` `artifacts.archive` was set to `done` before the folder move. `status` stays `applied`. `verify` stays `pass-with-warnings`. `archive_blocked` and `dependency_verification` were left as the verifier wrote them.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/proposal.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/specs/producible-quantity/spec.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/specs/catalog/spec.md` | none (openspec filesystem) |
| design | `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/design.md` | none (openspec filesystem) |
| tasks | `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/tasks.md` | none (openspec filesystem) |
| apply-progress | `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/apply-progress.md` | none (openspec filesystem) |
| verify-report | `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/verify-report.md` | none (openspec filesystem) |
| archive-report | `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/archive-report.md` | Engram `1395` (`obs-3e6246e46a54a964`), topic `sdd/p2-07-producible-quantity/archive-report` |

## Task Completion Gate

`tasks.md` has 14/14 implementation tasks checked (1.1–1.2, 2.1–2.2, 3.1–3.4, 4.1–4.4, 5.1–5.2). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was performed. The verify report records 14/14 tasks checked.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| producible-quantity | Created | Full spec copied. 6 requirements, 12 scenarios. 0 modified, 0 removed, 0 renamed. |
| catalog | Updated | 3 requirements appended. 7 scenarios. 0 modified, 0 removed, 0 renamed. Prior 7 requirements kept. |

SHA-256 of the new producible-quantity spec, main equals the change spec: `0E8C8E54E958C9F247DF3F714D985FE0D0BA5C594A6710EB02B8C8C2304F7EE4`.

Appended catalog requirements: Effective Menu Availability, Products Without Recipe, Low-Units Threshold Per Product.

Copied producible-quantity requirements: Units Producible From Point Stock, Limiting Ingredient, Units With Restocking, Recalculation On Stock Change, Availability State, Real-Time Availability Event.

The verify report marks 16/19 scenarios compliant. Three hybrid scenarios are design-deferred. The synced text keeps those scenarios.

## Warnings Preserved

- General warehouse offline, hybrid site offline within 2 s, and a threshold change while a hybrid site is offline have no passing test. Delivery stays on `api-cloud`.
- The projector runs after sale, return, order-line waste, and publish. It does not run after purchase, production, transfer, or `RecordOperationalWaste`.
- `isOrderable` stays manual availability plus schedule. `sold_out` still sends.
- 30 to 29 emits nothing. A null `lowUnitsThreshold` skips `low_units`.
- `EmptySupplyingLocations` means cloud replenishment does not add supplying-warehouse stock.
- `availability_changed` lives on the existing dining-room realtime contract.
- `menu_inventory_states` is in orders `0008_low_units_threshold.sql`. The inventory projection is `0005_producible_quantity.sql`, not the next file after `0002`.
- This run did not execute typecheck, lint, architecture, or the full vitest suite. The 2 s p90 is not measured.

## Archive Contents

- proposal.md
- specs/producible-quantity/spec.md
- specs/catalog/spec.md
- design.md
- tasks.md (14/14 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml (`artifacts.archive: done`)
- archive-report.md

Active `openspec/changes/p2-07-producible-quantity/` is gone.

## Source of Truth Updated

- `openspec/specs/producible-quantity/spec.md`
- `openspec/specs/catalog/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/archive-report.md`, `openspec/specs/producible-quantity/spec.md`, `openspec/specs/catalog/spec.md`
**Learned**: The catalog delta was append-only. `archive_allowed: false` was a stale p2-02, p2-04, and p2-05 dependency. Zero CRITICAL and complete tasks allowed archive as intentional-with-warnings.
