# Proposal: Accountant Information

## Intent

The pilot's accountant must close a month in their accounting software using only system exports: monthly invoice summary, tax reports per taxpayer and accounting exports (PRD-M6 HU-M6-04; PRD-00 sec. 7.1 rule 6 and sec. 8.2).

## Scope

### In Scope
- Monthly invoice summary per taxpayer and site: count and value, final consumer vs identified customers, taxes, credit notes and re-invoicings. A report, never a fiscal document.
- Tax reports per taxpayer, period and tax type (IVA, INC, ultra-processed, plastic bags).
- Accounting exports (spreadsheet) per taxpayer and period, stored in object storage with expiry.
- Accountant role scoped to taxpayer, read-only.

### Out of Scope
- Payroll hours export — already in attendance (→ 1.9).
- Full accounting or payroll (PRD-00, out of scope).
- Consolidated operational reports (→ 4.1).
- Emailing the export to the accountant (→ 5.1 if needed).

## Capabilities

### New Capabilities
- `accounting-exports`: monthly invoice summary, tax reports by taxpayer and accounting export files.

### Modified Capabilities
None

## Approach

Cloud-only projections in `contexts/reporting` fed by M3 document events (accepted, credit note, pending). The fiscal month is the validation date reported by Factus; documents still pending at cut-off are listed apart (TRD-00 sec. 8.3). Export runs as a cloud worker (TRD-M6 `Export`), writes to the file port, and audits exports with personal data.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reporting/domain` | Modified | Fiscal summary and tax aggregation rules |
| `contexts/reporting/application` | Modified | Summary, tax report and export use cases |
| `contexts/reporting/adapters/postgres` | Modified | Fiscal fact tables |
| `contexts/invoicing/application/entry-port.ts` | Modified | Read model of documents per taxpayer |
| `shared/contracts` | Modified | Export request and file schemas |
| `apps/api-cloud` | Modified | Admin routes, export worker |
| `apps/admin-web` | Modified | Accountant screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Accountant's software export format open: PA-10 | High | Factus lists bills and credit notes and downloads XML and PDF. It does not publish an import file. Column mapping stays configuration until the pilot accountant names the format |
| Late-validated offline invoices land in the next month | Med | Month by validation date; sale date shown; pending list at cut-off |
| Summary mistaken for a global invoice | Low | Labelled "not a fiscal document"; no DIAN grouping action exists |

## Rollback Plan

Disable accountant routes and the export worker per tenant. Projections are read-only derivatives; dropping them affects no invoice or tax data.

## Dependencies

- 1.4 tax engine, 1.5 e-invoicing and 1.8 re-invoicing events; pilot accountant's availability for validation.

## Success Criteria

- [ ] The pilot's accountant closes a month with the system's exports.
- [ ] Summary totals match the accepted Factus documents of that taxpayer and month.
- [ ] An accountant scoped to taxpayer A cannot read taxpayer B.
- [ ] No action exists to turn the summary into a DIAN document.
