# Archive Report

**Change**: p1-04-tax-engine
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-10-28
**Archived to**: `openspec/changes/archive/2026-10-28-p1-04-tax-engine/`
**Verification verdict**: PASS WITH WARNINGS
**Engram**: not used. No observation IDs. Orchestrator forbade Engram for this archive.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/p1-04-tax-engine/proposal.md` | n/a (openspec) |
| spec | `openspec/changes/p1-04-tax-engine/specs/tax-engine/spec.md` | n/a (openspec) |
| design | `openspec/changes/p1-04-tax-engine/design.md` | n/a (openspec) |
| tasks | `openspec/changes/p1-04-tax-engine/tasks.md` | n/a (openspec) |
| apply-progress | `openspec/changes/p1-04-tax-engine/apply-progress.md` | n/a (openspec) |
| verify-report | `openspec/changes/p1-04-tax-engine/verify-report.md` | n/a (openspec) |
| archive-report | `openspec/changes/p1-04-tax-engine/archive-report.md` | n/a (openspec) |

## Task Completion Gate

`tasks.md` has 26/26 implementation tasks checked (1.1–5.3). No `- [ ]` implementation task remains. Archive was allowed. The test suite and the orders project were not run in this phase.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks. The verify report already records them as a suggestion: the dated-rate criterion is covered by passing publish tests; the accountant-table and Factus criterion waits for delivery 1.5.

## Spec Reconciliation (intentional-with-warnings)

The verify report required this reconciliation before the delta became the main spec. No offline tax calculation was added.

**Old sentence** (requirement "Traceability and Offline Parity"):

> Each sale line MUST store the rule and version applied. A hybrid node MUST compute offline with its rule copy.

**Replaced scenario** ("Offline computation"): a hybrid node offline with rules version 7, when a sale is computed, equals the cloud result for version 7 and lines record version 7.

**Design sentence** (D-37, architecture decision):

> Postgres, memory, PGlite. `local-node` returns 403 and stores nothing

**Kept**: "Each sale line MUST store the rule and version applied."

**Replacement for the hybrid-node MUST**:

> The local node MUST reject quote, publish, and adopt with 403 TaxRejected and MUST store nothing. It does not compute taxes.

**Replacement scenario** ("Node rejection"), aligned with `apps/local-node/test/http/tax.controller.test.ts` (`given a tax quote, publish, and adopt, when they are posted on the node, then each is rejected and nothing is stored`):

- GIVEN a tax quote, a rule publish, and a fiscal-profile adopt
- WHEN they are posted on the local node
- THEN each response is 403 TaxRejected and nothing is stored

The accountant case table scenario was left unchanged. The requirement heading was left unchanged. The main spec did not exist, so the reconciled full spec was copied. This merge adds requirements; it does not delete existing main-spec requirements. `openspec/config.yaml` `rules.archive` ("Warn before merging destructive deltas") does not apply as a destructive merge.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| tax-engine | Created | Full spec copied. 8 requirements. 0 modified, 0 removed, 0 renamed in a prior main spec. Requirement "Traceability and Offline Parity" reconciled before copy: 1 sentence replaced, 1 scenario replaced. |

Source of truth: `openspec/specs/tax-engine/spec.md`.

## Residual Warnings (not blocking)

These remain from the verify report. This archive does not treat them as resolved:

- Purpose still says results MUST match on node (SQLite copy) and cloud (PostgreSQL). That sentence was outside the instructed reconciliation. The requirement body now matches D-37.
- "Corporate customer pays" is partial: amounts are returned and invoice taxes stay unchanged; withholdings are not stored on a payment because the payment aggregate is out of scope.
- "Accountant case table" is partial: golden breakdowns passed; Factus sandbox comparison did not run (delivery 1.5).
- Quote reads the tenant catalog, not the rules copied onto the adopted profile.
- A missing profile throws `NoMatchingTaxRule`. `FiscalTemplateNotFound` is mapped to 409 and was not exercised by unit 10.
- Work units 7–10 exceeded the 400-line review budget without `size:exception`.
- `contexts/invoicing/tsconfig.json` pins `typeRoots` to a pnpm path for `@types/node`.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, no CRITICAL), reconciled on the offline sentence, synced, and archived. Active `openspec/changes/` no longer contains `p1-04-tax-engine`.
