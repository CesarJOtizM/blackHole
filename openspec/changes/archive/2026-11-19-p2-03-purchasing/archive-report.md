# Archive Report

**Change**: p2-03-purchasing
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-p2-03-purchasing/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `p2-11/rollout-status` `750d0f365f7f2ed36d6eaa57d40ab3fed54bab20`

## Gate

Persistence is openspec. Filesystem artifacts were read from `openspec/changes/p2-03-purchasing/`: `proposal.md`, `specs/purchasing/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`. No Engram review receipt exists in this change folder. The orchestrator authorized archive when tasks are complete and the verify report has zero CRITICAL.

`verify-report.md` front matter is `verdict: pass_with_warnings`, `critical_findings: 0`, `archive_allowed: false`. The body says **CRITICAL**: None and **Verdict**: PASS WITH WARNINGS. `archive_allowed: false` is only the dependency note that `p2-02-sale-consumption` was still active with `verify: fail`. That row is stale. `p2-02-sale-consumption` is now `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/`. The other dependencies are also archived: `2026-11-13-p2-01-ingredients-and-recipes`, `2026-10-30-p1-05-electronic-invoicing`, `2026-11-02-p0-05-roles-and-permissions`, `2026-10-28-p0-06-audit`.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The purchasing artifact is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/purchasing/spec.md` did not exist. The merge creates that spec and deletes nothing. No extra confirmation was required. Proposal capabilities list `purchasing` as new and modified capabilities as none.

This phase did not commit, did not re-verify, did not edit product code, and did not update `docs/roadmap.md`.

`state.yaml` `artifacts.archive` was set to `done` before the folder move. `status` stays `applied`. `verify` stays `pass` as written in that file, even though the verify report verdict is pass with warnings.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-19-p2-03-purchasing/proposal.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-03-purchasing/specs/purchasing/spec.md` | none (openspec filesystem) |
| design | `openspec/changes/archive/2026-11-19-p2-03-purchasing/design.md` | none (openspec filesystem) |
| tasks | `openspec/changes/archive/2026-11-19-p2-03-purchasing/tasks.md` | none (openspec filesystem) |
| apply-progress | `openspec/changes/archive/2026-11-19-p2-03-purchasing/apply-progress.md` | none (openspec filesystem) |
| verify-report | `openspec/changes/archive/2026-11-19-p2-03-purchasing/verify-report.md` | none (openspec filesystem) |
| archive-report | `openspec/changes/archive/2026-11-19-p2-03-purchasing/archive-report.md` | Engram `1391` (`obs-96fbd24be67bb92f`), topic `sdd/p2-03-purchasing/archive-report` |

## Task Completion Gate

`tasks.md` has 22/22 implementation tasks checked (1.1–1.4, 2.1–2.8, 3.1–3.5, 4.1–4.3, 5.1–5.2). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was performed. The verify report records tasks total 22, complete 22, incomplete 0.

Proposal success criteria stay unchecked. They describe a week of real purchases and are not implementation tasks.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| purchasing | Created | Full spec copied. 7 requirements, 17 scenarios. 0 modified, 0 removed, 0 renamed. |

SHA-256 at sync time, main spec equals the change spec: `639BEB15A2613765BB201DFC23483E5D90D8A5E932C12A197F26B65E1F921052`.

Copied requirements: Suppliers, Purchase Orders, Receipt at Real Cost, Weighted Average Cost, Support Document, Supplier E-invoice Intake, Cost Visibility.

The verify report marks 10/17 scenarios compliant. Seven fiscal scenarios (support document, supplier XML, hybrid offline receipt) are deferred by proposal and design. The copied spec keeps those requirement texts. This archive does not rewrite them.

## Warnings Preserved

- `PurchaseView` still contains WhatsApp, invoice price, and invoice photo copy. Live routes render `PurchaseScreen` and `ReceiveScreen`.
- Venue receipt parsing is local because `venue-app` does not depend on `@blackhole/contracts`.
- Postgres writes `locationId` into `stock_movements.venue_id` because that column is NOT NULL.
- This verify run did not re-execute the memory or PGlite purchasing contracts, the stock-ledger domain file, typecheck, lint, or architecture.
- The spec still contains Support Document, Supplier E-invoice Intake, and the non-invoicing support-document outcome. Proposal and design leave them out. They are not implemented.

## Archive Contents

- proposal.md
- specs/purchasing/spec.md
- design.md
- tasks.md (22/22 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml (`archive: done`)
- archive-report.md

Active `openspec/changes/p2-03-purchasing/` is gone.

## Source of Truth Updated

- `openspec/specs/purchasing/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-19-p2-03-purchasing/archive-report.md`, `openspec/specs/purchasing/spec.md`
**Learned**: `archive_allowed: false` was a stale p2-02 dependency. Zero CRITICAL and complete tasks allowed archive as intentional-with-warnings. Deferred fiscal requirements remain in the main spec text.
