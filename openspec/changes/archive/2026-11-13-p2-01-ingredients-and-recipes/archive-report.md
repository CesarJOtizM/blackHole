# Archive Report

**Change**: p2-01-ingredients-and-recipes
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-13
**Archived to**: `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None (the earlier lint heading is resolved by the Orchestrator follow-up)
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `master` `c0aa1b70179db73c8995896ee9bc2a4ab341c62a`

## Gate

Persistence is openspec. Engram was not searched and was not written. The orchestrator forbade Engram for this phase. Filesystem artifacts were read from `openspec/changes/p2-01-ingredients-and-recipes/`: `proposal.md`, `specs/recipes/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`.

`verify-report.md` ends with an Orchestrator follow-up. That follow-up is the operative archive gate. The change files lint clean: `pnpm exec biome check` on the 59 TypeScript files in this change exited 0 (`Checked 59 files in 54ms. No fixes applied.`). The repo-wide `pnpm lint` failure (651 Biome errors, 1 warning) is CRLF formatter noise from `core.autocrlf=true` on paths outside this change. Those files were not reformatted. The follow-up resolves the earlier CRITICAL lint heading in the same file. No other CRITICAL remains. Archive gate: PASS WITH WARNINGS.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The recipes artifact is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/recipes/spec.md` did not exist. The merge creates that spec and deletes nothing. No extra confirmation was required. Proposal capabilities list `recipes` as new and modified capabilities as none.

This phase did not commit, did not push, and did not edit `contexts/`, `apps/`, `docs/roadmap.md`, `docs/design/*.pen`, `.agents/`, `skills-lock.json`, `openspec/changes/p2-02-sale-consumption`, or `openspec/changes/p2-03-purchasing`.

`state.yaml` was left as the pre-archive snapshot (`status: verified`, `verify: pass-with-warnings`, `archive: pending`). This phase did not rewrite it.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/proposal.md` | none (openspec filesystem; Engram not used) |
| spec | `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/specs/recipes/spec.md` | none (openspec filesystem; Engram not used) |
| design | `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/design.md` | none (openspec filesystem; Engram not used) |
| tasks | `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/tasks.md` | none (openspec filesystem; Engram not used) |
| apply-progress | `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/apply-progress.md` | none (openspec filesystem; Engram not used) |
| verify-report | `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/verify-report.md` | none (openspec filesystem; Engram not used) |
| archive-report | `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/archive-report.md` | none (openspec filesystem; Engram not used) |

The verify report records its own workspace as `c:\Users\csar-\Proyectos\blackHole-phase-2`, branch `p2-01/admin` at `914dd67e702541ac331762997d7fedbda6134f38`. This archive ran in `C:\Users\csar-\Proyectos\blackHole` on `master` at `c0aa1b70179db73c8995896ee9bc2a4ab341c62a`. The completion gate used the change files in this checkout.

## Task Completion Gate

`tasks.md` has 18/18 implementation tasks checked (1.1–1.3, 2.1–2.4, 3.1, 4.1–4.3, 5.1–5.6, 6.1). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. `apply-progress.md` lists the same 18 tasks complete. The verify report records tasks total 18, complete 18, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked. Those are pilot outcomes, not implementation tasks:

- The pilot site's recipes are loaded, with their theoretical cost and margin per dish.
- "Extra cheese" adds and "no onion" subtracts in the exploded quantities.
- A hybrid node keeps its copied version during an outage; a new version arrives on reconnect.

This archive does not mark those proposal criteria done.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| recipes | Created | Full spec copied. 8 requirements, 16 scenarios. 0 modified, 0 removed, 0 renamed. |

`openspec/specs/recipes/spec.md` was copied from the change spec before the folder move. SHA-256 of both copies at sync time: `019A4515D24830226433C9569D521A45B2492D2BB398DBF231BDE0BA01B41FC4`. No sentence was rewritten.

Copied requirements:

- Ingredient Units: Purchase unit converts; Zero factor rejected
- Recipe per Product and Variant: Variant overrides product; Yield applied
- Sub-recipes Without Cycles: Sub-recipe expands; Cycle rejected
- Modifier Adjustments: Extra and without; Floor at zero
- Immutable Versions: Edit creates version; Unauthorized edit
- Distribution by Operating Mode: Version reaches node; Outage keeps copy
- Excel Import: Valid import; Invalid row
- Theoretical Cost and Margin: Cost and margin; Waiter sees no costs

The verify report marks all 16 scenarios compliant. This archive copies the spec text as written. It does not rewrite scenario wording to match milli-unit assertions.

## Warnings Preserved

These verify warnings were not fixed:

- Quantities are milli-units (`QUANTITY_SCALE = 1000`). The purchase-conversion scenario's passing assertion is `100_000 * QUANTITY_SCALE`, not the literal integer 100000. The design line "2 × 50 kg = 100000 g" describes the base-unit meaning.
- Cloud Nest bootstrap uses `InMemoryRecipeCatalogRepository` unless the caller passes `recipeCatalogs`. `postgresRecipeCatalogs` exists. HTTP tests use the memory adapter. Startup stays dialect-free. No spec scenario breaks.
- Node copy persistence is a `node:sqlite` `DatabaseSync` session plus `0001_recipe_copy.sql` and copy tables (`recipe_copies` and children), not the eight cloud tables. `better-sqlite3` was not added. The node prints `ExperimentalWarning` for SQLite; the suites still exited 0.
- Excel import on the wire is strict JSON `{ contents: base64 }`. Sheets are `ingredients` and `recipes`. The design left the workbook shape unnamed. Columns are recorded in `apply-progress.md`.
- Admin cost rendering requires both `costCop` and `marginPercent` as own finite numbers. Task 6.1 has no runtime test. Admin-web has no vitest project. Typecheck and the production build cover the screens.
- An equal recipe-copy version is ignored as a replay. The spec requires an older version to be ignored.
- `ingredients`, `unit_conversions`, and `modifier_deltas` store `version` so a frozen version can be replayed. The design named those tables without that column.
- The in-memory catalog keeps one live aggregate. A domain error after a later upsert could dirty that draft. The row-17 rejection is tested before any upsert. Postgres reloads from stored versions.
- Apply slices are above the 400-line review budget. `size:exception` was not granted (`apply-progress.md`). This does not fail a spec scenario.
- `pnpm architecture` exited 0 with no dependency violations and printed `missing-typescript-transpiler` for TypeScript 7. That warning is already in `openspec/config.yaml`.
- Repo-wide `pnpm lint` still fails on CRLF outside this change. The 59 change TypeScript files lint clean. This archive did not reformat the checkout.

## Archive Contents

- proposal.md
- specs/recipes/spec.md
- design.md
- tasks.md (18/18 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml
- archive-report.md

## Source of Truth Updated

- `openspec/specs/recipes/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/archive-report.md`, `openspec/specs/recipes/spec.md`
**Learned**: OpenSpec only. No Engram observation IDs. PASS WITH WARNINGS did not block archive. The CRLF lint failure stays outside this change. Milli-unit storage, the in-memory cloud default, the node copy schema, base64 import, and the untested admin cost gate stay open.
