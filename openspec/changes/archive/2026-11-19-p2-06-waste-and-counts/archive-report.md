# Archive Report

**Change**: p2-06-waste-and-counts
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `p2-11/rollout-status` `750d0f365f7f2ed36d6eaa57d40ab3fed54bab20`

## Gate

Persistence is openspec. Filesystem artifacts were read from `openspec/changes/p2-06-waste-and-counts/`: `proposal.md`, `specs/waste-and-counts/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`. No Engram review receipt exists in this change folder. The orchestrator authorized archive when tasks are complete and the verify report has zero CRITICAL.

`verify-report.md` front matter is `verdict: pass_with_warnings`, `critical_findings: 0`, `archive_allowed: false`. The body says **CRITICAL**: None and **Verdict**: PASS WITH WARNINGS. `archive_allowed: false` names `p2-02-sale-consumption` and `p2-03-purchasing` as still active. Those rows are stale. Both are archived under `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/` and `openspec/changes/archive/2026-11-19-p2-03-purchasing/`. `p0-05-roles-and-permissions` and `p0-06-audit` were already under `openspec/changes/archive`.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The waste-and-counts artifact is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/waste-and-counts/spec.md` did not exist. The merge creates that spec and deletes nothing. No extra confirmation was required. Proposal capabilities list `waste-and-counts` as new and modified capabilities as none.

This phase did not commit, did not re-verify, did not edit product code, and did not update `docs/roadmap.md`.

`state.yaml` `artifacts.archive` was set to `done` before the folder move. `status` stays `applied`. `verify` stays `pass` as written in that file. `archive_blocked` and `dependency_verification` were left as the verifier wrote them.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/proposal.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/specs/waste-and-counts/spec.md` | none (openspec filesystem) |
| design | `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/design.md` | none (openspec filesystem) |
| tasks | `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/tasks.md` | none (openspec filesystem) |
| apply-progress | `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/apply-progress.md` | none (openspec filesystem) |
| verify-report | `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/verify-report.md` | none (openspec filesystem) |
| archive-report | `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/archive-report.md` | Engram `1394` (`obs-e0be53e54f38341f`), topic `sdd/p2-06-waste-and-counts/archive-report` |

## Task Completion Gate

`tasks.md` has 24/24 implementation tasks checked (1.1–1.6, 2.1–2.10, 3.1–3.6, 4.1–4.2). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was performed. The verify report records 24/24 tasks checked.

Proposal success criteria stay unchecked. They are not implementation tasks.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| waste-and-counts | Created | Full spec copied. 6 requirements, 15 scenarios. 0 modified, 0 removed, 0 renamed. |

SHA-256 at sync time, main spec equals the change spec: `8FF532236CD77ED1ECB68EA43170EDDE0B8E225DD4941B01F9D74E536879DF28`.

Copied requirements: Waste with Reason, Waste Cap, Physical Count, Variance Against Theoretical, Approval and Adjustment, Operation by Mode.

The verify report marks 13/15 scenarios compliant. Two hybrid scenarios are design-deferred. The copied spec keeps those texts.

## Warnings Preserved

- Offline hybrid count and cloud-mode outage have no passing test. Delivery stays on `api-cloud`. There is no SQLite count repository.
- `wasteAndCountsEnabled` defaults off.
- PA-42 is not decided. Blind count is neither hidden nor shown. Variance is computed after submit.
- The HTTP test does not exercise reject or self-approval. Those behaviors passed in the use case and, for reject, in the repository contract.
- `EvaluatePermission` still sends `shiftId: null`. The shift self-authorization flag is proven by the `ApproveAdjustment` double and is not proven over HTTP.
- Sale consumption rows stay. A unique retry does not apply the balance twice.
- This run did not add a separate rollback-failure test beyond the stored PGlite result.
- This run did not execute typecheck, lint, architecture, or the full vitest suite.
- The proposal still lists a site PWA. This delivery does not add those screens.

## Archive Contents

- proposal.md
- specs/waste-and-counts/spec.md
- design.md
- tasks.md (24/24 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml (`artifacts.archive: done`)
- archive-report.md

Active `openspec/changes/p2-06-waste-and-counts/` is gone.

## Source of Truth Updated

- `openspec/specs/waste-and-counts/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-19-p2-06-waste-and-counts/archive-report.md`, `openspec/specs/waste-and-counts/spec.md`
**Learned**: `archive_allowed: false` was a stale p2-02 and p2-03 dependency. Zero CRITICAL and complete tasks allowed archive as intentional-with-warnings.
