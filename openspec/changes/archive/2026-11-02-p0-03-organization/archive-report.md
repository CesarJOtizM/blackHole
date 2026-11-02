# Archive Report

**Change**: p0-03-organization
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-02
**Archived to**: `openspec/changes/archive/2026-11-02-p0-03-organization/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false
**Engram review receipt**: none. `verify-report.md` is the review receipt. Source artifacts have no observation IDs that constitute a review receipt.
**Archive-report observation**: Engram `1162` (`obs-97d02cb462c2e009`), project `blackhole`, topic `sdd/p0-03-organization/archive-report`.

## Gate

Persistence mode is openspec. The orchestrator stated there is no Engram review receipt. `verify-report.md` is the receipt. This phase searched Engram for `sdd/p0-03-organization/proposal`, `spec`, `design`, `tasks`, and `verify-report` on project `blackhole`. Proposal, spec, design, and tasks returned no memories. `verify-report` returned observation `#1117` (`sdd/p0-03-organization/verify-report`). That observation is a summary of the cloud-slice re-judgment, not the full report and not the review receipt. The filesystem file remains the receipt. `#1117` also reported a pending contest from `#obs-c3bd1c3ecbbf23d8`. This phase did not judge that contest.

The recorded verdict is PASS WITH WARNINGS. CRITICAL count is 0. 13/13 cloud scenarios passed in the latest verify. Six hybrid scenarios stay deferred under D-37. The orchestrator instructed an intentional archive with warnings. This phase did not re-run tests and does not claim a new test run.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. Both deltas were inspected before the copy:

- `specs/organization/spec.md` is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections.
- `specs/operating-mode/spec.md` contains only `ADDED Requirements`. It has no `MODIFIED`, `REMOVED`, or `RENAMED` sections.

`openspec/specs/organization/spec.md` and `openspec/specs/operating-mode/spec.md` did not exist. Each delta was copied unchanged. The copy creates the source of truth and deletes nothing from a prior main spec. The merge is not destructive. No extra confirmation was required.

This phase did not edit product source, did not commit, and did not edit another change.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-02-p0-03-organization/proposal.md` | n/a (openspec; Engram search returned no memory) |
| spec (organization) | `openspec/changes/archive/2026-11-02-p0-03-organization/specs/organization/spec.md` | n/a (openspec; Engram search returned no memory) |
| spec (operating-mode) | `openspec/changes/archive/2026-11-02-p0-03-organization/specs/operating-mode/spec.md` | n/a (openspec; Engram search returned no memory) |
| design | `openspec/changes/archive/2026-11-02-p0-03-organization/design.md` | n/a (openspec; Engram search returned no memory) |
| tasks | `openspec/changes/archive/2026-11-02-p0-03-organization/tasks.md` | n/a (openspec; Engram search returned no memory) |
| apply-progress | `openspec/changes/archive/2026-11-02-p0-03-organization/apply-progress.md` | n/a (openspec; not an Engram review receipt) |
| verify-report | `openspec/changes/archive/2026-11-02-p0-03-organization/verify-report.md` | File is the review receipt. Engram `#1117` is a summary only, not the receipt. |
| archive-report | `openspec/changes/archive/2026-11-02-p0-03-organization/archive-report.md` | 1162 (`obs-97d02cb462c2e009`) |

## Task Completion Gate

`tasks.md` has 18/18 implementation tasks checked (1.1–1.3, 2.1–2.4, 3.1–3.3, 4.1–4.4, 5.1–5.4). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. `apply-progress.md` records the same 18/18. The verify report records tasks total 18, complete 18, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks:

- The full pilot structure (6 sites, their NITs and warehouses) is loaded.
- Each site operates in cloud mode; when hybrid is activated, that structure reaches its node.
- A second invoicing taxpayer cannot be attached to a site implicitly.

This archive does not mark those proposal criteria done. The fixture criterion stays open: the loaded fixture uses sample NITs and has no warehouses.

## Spec Reconciliation

No sentence or scenario was rewritten. The orchestrator instructed a straight copy because neither main spec existed.

Both deltas were copied before the folder move.

| Domain | SHA-256 | Bytes |
|--------|---------|-------|
| organization | `A7EF3A715F8E57B111B859F8AE52E96E93BAD068BE1F4BB487B65FD1070D784B` | 3780 |
| operating-mode | `1EBB2839FD5D3E14818E9D3BF4BD4BACF2E030D72B51E3E92D3B42EB0A83FAD0` | 1467 |

The organization copy keeps seven requirements and fourteen scenarios:

- Company, Taxpayers and Brands
- Site Invoices Through Exactly One Taxpayer
- Inventory Locations
- Kitchen Stations and Cash Registers
- Structure Owned by the Cloud
- Tenant Isolation
- Structure Changes Recorded

The operating-mode copy keeps the delta heading `## ADDED Requirements` and two requirements with five scenarios:

- Site Mode in the Structure
- Structure Copy Reaches the Node

Deferred hybrid scenarios stay in the source of truth. This archive does not implement them, does not remove them, and does not add SQLite, sync, an outbox, a cursor, pairing, or admin-web. The node behavior recorded by verify remains: 403 `StructureEditRejected`, and nothing is stored.

Other domains were not touched.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| organization | Created | Full spec copied unchanged. 7 requirements, 14 scenarios. 0 delta add, 0 modify, 0 remove, 0 rename. 0 requirements deleted from a prior main spec. |
| operating-mode | Created | Delta copied unchanged. 2 added requirements, 5 scenarios. 0 modify, 0 remove, 0 rename. 0 requirements deleted from a prior main spec. |

Source of truth:

- `openspec/specs/organization/spec.md`
- `openspec/specs/operating-mode/spec.md`

## Recorded Verification (not re-run)

From `verify-report.md` only. Evidence is the dirty working tree above HEAD `208b30349b6c7b63f4db9898a2a84ba8e3b26df3` (`208b303`). Invoicing and monitoring edits in that tree were not reverted and are not this change.

- `pnpm exec vitest run --project platform organization` — exit 0. 3 files, 17 passed. The filename filter does not collect `update-structure.test.ts`.
- `pnpm exec vitest run --project api-cloud structure` — exit 0. 1 file, 7 passed.
- `pnpm exec vitest run --project local-node structure` — exit 0. 1 file, 1 passed. 403 `StructureEditRejected`; nothing stored.
- `pnpm exec vitest run --project platform contexts/platform/application/update-structure` — exit 0. 1 file, 5 passed.
- `pnpm exec tsc -b contexts/platform apps/api-cloud apps/local-node --pretty false` — exit 0.

Latest verify total: 30 passed, 0 failed, 0 skipped. 13/13 cloud scenarios compliant. 6/6 hybrid scenarios deferred. This archive did not run those commands again.

## Residual Warnings (not blocking)

Accepted by the orchestrator. This archive does not treat them as resolved and does not change product source:

1. Evidence includes the dirty working tree above HEAD `208b303` (invoicing and monitoring). Those edits were not reverted and are not this change. Organization-scoped commands in the recorded verify still exited 0. This archive is not a clean snapshot of that commit.
2. Design deviations recorded by verify: `addPoint`, `addInvoicingTaxpayer`, no `rehydrate`, `CHECK (id = tenant_id)`, and `postgresOrganizations` with no callers. HTTP tests inject the in-memory repository. The PGlite contract is the Postgres proof. None of these broke a passing cloud scenario.
3. The fixture still uses sample NITs (`SAMPLE-NIT-01` through `SAMPLE-NIT-06`, `label` `sample`) and has no warehouses. The proposal success criterion for the full pilot structure stays open. Design keeps sample NITs until the owner supplies real ones. Warehouses are optional in the spec.
4. The unfiltered RLS test covers `venues` only. The other structure tables use the same forced policy in SQL and were not selected without a `tenant_id` predicate in the recorded run. The named cross-tenant scenario is sites and passed.
5. Hybrid scenarios stay deferred under D-37: offline copy, reconnect, pairing snapshot, cursor delivery, other sites excluded, node copy, and mode change across sites. The node returns 403 `StructureEditRejected` and stores nothing. Do not add SQLite, sync, an outbox, a cursor, pairing, or admin-web in this archive.

## State

`state.yaml` in this archive has `status: archived` and `archive: done`. `verify` stays `done`, matching the PASS WITH WARNINGS receipt. The active folder `openspec/changes/p0-03-organization/` is removed by the move.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, zero CRITICAL, 13/13 cloud scenarios, six hybrid scenarios deferred), copied unchanged into the main specs, and archived with warnings. Active `openspec/changes/` no longer contains `p0-03-organization`.
