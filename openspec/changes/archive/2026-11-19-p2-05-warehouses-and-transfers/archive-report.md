# Archive Report

**Change**: p2-05-warehouses-and-transfers
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `p2-11/rollout-status` `750d0f365f7f2ed36d6eaa57d40ab3fed54bab20`

## Gate

Persistence is openspec. Filesystem artifacts were read from `openspec/changes/p2-05-warehouses-and-transfers/`: `proposal.md`, `specs/warehouses-and-transfers/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`. No Engram review receipt exists in this change folder. The orchestrator authorized archive when tasks are complete and the verify report has zero CRITICAL.

`verify-report.md` front matter is `verdict: pass_with_warnings`, `critical_findings: 0`, `archive_allowed: false`. The body says **CRITICAL**: None and **Verdict**: PASS WITH WARNINGS. `archive_allowed: false` names `p2-02-sale-consumption` and `p2-03-purchasing` as still active. Those rows are stale. Both are archived under `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/` and `openspec/changes/archive/2026-11-19-p2-03-purchasing/`.

Also archived: `2026-11-02-p0-03-organization`, `2026-11-02-p0-04-identity-and-devices`, `2026-11-02-p0-05-roles-and-permissions`, `2026-11-03-p1-06-printing`.

`p0-07-hybrid-resilience` has no archive folder. It remains an active change at `openspec/changes/p0-07-hybrid-resilience` with `status: specified`. The verify report records that fact and does not mark it CRITICAL. Hybrid transfer scenarios are design-deferred warnings (D-37, PA-44). This archive does not close `p0-07-hybrid-resilience`. `state.yaml` still has `archive_blocked: true` and the stale `dependency_verification` rows. Only `artifacts.archive` was set to `done`.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The warehouses artifact is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/warehouses-and-transfers/spec.md` did not exist. The merge creates that spec and deletes nothing. No extra confirmation was required. Proposal capabilities list `warehouses-and-transfers` as new and modified capabilities as none.

This phase did not commit, did not re-verify, did not edit product code, and did not update `docs/roadmap.md`.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/proposal.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/specs/warehouses-and-transfers/spec.md` | none (openspec filesystem) |
| design | `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/design.md` | none (openspec filesystem) |
| tasks | `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/tasks.md` | none (openspec filesystem) |
| apply-progress | `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/apply-progress.md` | none (openspec filesystem) |
| verify-report | `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/verify-report.md` | none (openspec filesystem) |
| archive-report | `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/archive-report.md` | Engram `1393` (`obs-490d74daaedb0073`), topic `sdd/p2-05-warehouses-and-transfers/archive-report` |

## Task Completion Gate

`tasks.md` has 25/25 implementation tasks checked (1.1–1.4, 2.1–2.10, 3.1–3.6, 4.1–4.3, 5.1–5.2). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was performed. The verify report records 25/25 tasks checked.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| warehouses-and-transfers | Created | Full spec copied. 8 requirements, 17 scenarios. 0 modified, 0 removed, 0 renamed. |

SHA-256 at sync time, main spec equals the change spec: `4A2601FDC28A8A4B96E2E56DDD21570C42275B5F26B70C91ED2E0229DB76132F`.

Copied requirements: Warehouses and Supply, General Warehouse Node, Transfer Lifecycle, Two Halves One Identifier, QR Voucher Reception, Received with Differences, Transfer Cost, Replenishment Suggestion.

The verify report marks 11/17 scenarios compliant. Six hybrid scenarios are design-deferred. The copied spec keeps those texts.

## Warnings Preserved

- Six spec scenarios have no passing test: warehouse node offline, no dining room on the warehouse node, general warehouse without a node, same-node transfer offline, out-of-order halves, and site offline at receipt.
- `transfersEnabled` defaults off.
- Cost stays hidden when `unitCost` is absent and when the session lacks `inventory.view-cost`.
- There is no local receipt and no SQLite transfer repository.
- The HTTP supply check is resolved from the organization. The test does not insert `warehouse_supplies`.
- The print voucher is accepted without a transfer printer queue.
- `TransfersView` and `TransferDetailView` remain in `inventory-view.tsx` and are not mounted.
- This run did not execute the in-memory transfer contract, typecheck, lint, or architecture.
- `p0-07-hybrid-resilience` is not archived. It is not a CRITICAL finding of this change.

## Archive Contents

- proposal.md
- specs/warehouses-and-transfers/spec.md
- design.md
- tasks.md (25/25 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml (`artifacts.archive: done`; `archive_blocked` left as the verifier wrote it)
- archive-report.md

Active `openspec/changes/p2-05-warehouses-and-transfers/` is gone.

## Source of Truth Updated

- `openspec/specs/warehouses-and-transfers/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings, including hybrid resilience, is a new change or the still-open `p0-07-hybrid-resilience`, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/archive-report.md`, `openspec/specs/warehouses-and-transfers/spec.md`
**Learned**: The operative archive block was stale p2-02 and p2-03 status. Zero CRITICAL and complete tasks allowed archive as intentional-with-warnings. p0-07 stays open outside this archive.
