# Archive Report

**Change**: p0-09-monitoring-and-errors
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-10-30
**Archived to**: `openspec/changes/archive/2026-10-30-p0-09-monitoring-and-errors/`
**Verification verdict**: PASS WITH WARNINGS
**Engram**: not used. No observation IDs. Orchestrator forbade Engram for this archive.

## Gate

`reviewGate.result` from the orchestrator is `allow`. This repo has no Engram review receipt. The current `verify-report.md` is the receipt. There is no transaction, ledger, or receipt file. That absence is not a blocker.

`verify-report.md` records **PASS WITH WARNINGS**, `CRITICAL: None`, and 14/15 cloud-MVP scenarios compliant (1 partial, 0 failing, 0 untested). The verifier named sdd-archive as next. `state.yaml` has `apply: done` and `verify: done`. Tasks 17/17 are checked. No CRITICAL finding and no unchecked implementation task blocked this archive.

The orchestrator accepted the warnings and instructed this phase not to fix them. They are recorded under Residual Warnings.

`state.yaml` was not edited. The orchestrator owns that file. The archived copy still says `status: applying` and `archive: pending`. The artifact map in that same file says `apply: done` and `verify: done`, which matches the task artifact and the verify report.

This phase did not commit, did not edit product source, and did not revert uncommitted telemetry, alarm, or Sentry files.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-10-30-p0-09-monitoring-and-errors/proposal.md` | n/a (openspec) |
| spec | `openspec/changes/archive/2026-10-30-p0-09-monitoring-and-errors/specs/observability/spec.md` | n/a (openspec) |
| design | `openspec/changes/archive/2026-10-30-p0-09-monitoring-and-errors/design.md` | n/a (openspec) |
| tasks | `openspec/changes/archive/2026-10-30-p0-09-monitoring-and-errors/tasks.md` | n/a (openspec) |
| apply-progress | `openspec/changes/archive/2026-10-30-p0-09-monitoring-and-errors/apply-progress.md` | n/a (openspec) |
| verify-report | `openspec/changes/archive/2026-10-30-p0-09-monitoring-and-errors/verify-report.md` | n/a (openspec) |
| archive-report | `openspec/changes/archive/2026-10-30-p0-09-monitoring-and-errors/archive-report.md` | n/a (openspec) |

## Task Completion Gate

`tasks.md` has 17/17 implementation tasks checked (1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 5.1, 5.2, 5.3, 6.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. The test suite was not run in this phase.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks:

- A disconnected node appears in Grafana and triggers its alarm; an invoice pending for more than 30 minutes also does; an error in a PWA without internet reaches Sentry on reconnect, with no personal data; in a load test the workers scale up and down without exceeding Factus' per-NIT limit.
- Every metric in the catalog has a dashboard panel.
- Alarms fire when cloud availability falls below 99.5% in the month and when sync delay p95 exceeds 1 minute at a connected site (TRD-00 15).

The first and third criteria still name a disconnected node, a PWA error after reconnect, and a sync-delay alarm. The delta removed those. This archive does not mark those proposal criteria done.

## Spec Reconciliation

No sentence or scenario was rewritten. The orchestrator instructed a straight copy when the main spec does not exist, and said not to fix the warnings.

`openspec/specs/observability/spec.md` did not exist. The delta was copied there unchanged before the folder move. SHA-256 of both copies at sync time: `D41AE987D2F3E8DBACBD15477331A7C6189FAE92D0F7B7448C2489E401F0EC23`.

The copied file keeps its delta sections:

- ADDED: Metric Catalog; Worker Scaling Within Provider Limit; Export Stays Off the Request Path.
- MODIFIED: Signals Through a Collector; Dashboards and Alarms as Code; Cloud Error Tracking; No Personal Data. Each block includes its `(Previously: ...)` note.
- REMOVED, each with `(Reason: ...)` and `(Migration: ...)`: Node Telemetry at Lowest Priority; Node Disconnected Alarm; Sync Delay Alarm; Offline PWA Error Queue and Deferred Browser Sentry; PWA-to-Node Trace.
- RENAMED: Error Tracking with Deferred Sending → Cloud Error Tracking, with Reason and Migration.

No prior main-spec requirement was deleted. `openspec/config.yaml` `rules.archive` ("Warn before merging destructive deltas") is recorded here: the delta lists five removals and one rename, and those sections were copied with the file. They were not applied as deletions against an existing source of truth, because none existed. The delta itself says REMOVED items are not acceptance criteria. Other domains were not touched. Invoicing, catalog, attendance, cash-register, and product code were not touched.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| observability | Created | Delta copied unchanged. 3 added, 4 modified, 5 removed, 1 renamed. 0 requirements deleted from a prior main spec. |

Source of truth: `openspec/specs/observability/spec.md`.

Judged scenarios in the verify report are the ADDED and MODIFIED scenarios only: 15 scenarios, 14 compliant, 1 partial.

## Residual Warnings (not blocking)

Accepted by the orchestrator. This archive does not treat them as resolved and does not change product source:

1. Load test: the 80-per-minute ceiling passed (gate, worker reschedule, and `factus-rate.mjs`). Workers are not scaled up and then down. Phase 7 still defers that as a D-37 warning, and `factus-rate.mjs` states that it does not change cloud scale-out. Scenario "Load test" under Worker Scaling Within Provider Limit stays PARTIAL.
2. `proposal.md` success criteria still require a disconnected node, a PWA error after reconnect, and a sync-delay alarm. The current spec removed those. They were not judged.
3. the phase-7 behavior was verified on the uncommitted working tree above HEAD 208b303, not inside that commit.

Suggestion left as a delivery note, not a blocker: `invoice_age` is `max(invoices_max_age_seconds) > bool 1800`. The 31-minute pending series fires and the 30-minute series does not. The expression does not filter `pending_issuance`.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, zero CRITICAL, 14/15 cloud-MVP scenarios), copied unchanged into the main spec, and archived. Active `openspec/changes/` no longer contains `p0-09-monitoring-and-errors`.
