# Accounting Exports Specification

## Purpose

Give the accountant read-only, taxpayer-scoped fiscal information to close each month. Computed only in the cloud (api-cloud, PostgreSQL) from synced invoicing events; local-node does not serve it.

## Requirements

### Requirement: Monthly Invoice Summary

The system MUST produce, per taxpayer, site and calendar month, the count and value of accepted invoices, separating final-consumer invoices from identified-customer invoices, with their taxes, credit notes and re-invoicings. The month MUST be determined by the validation date; the sale date SHALL be shown alongside.

#### Scenario: Summary for a month

- GIVEN taxpayer A with accepted invoices in two sites in March
- WHEN the accountant requests the March summary
- THEN count, value and taxes are shown per site
- AND final consumer and identified customers are separated

#### Scenario: Re-invoicing counted

- GIVEN a final-consumer invoice annulled by a credit note and re-issued to a customer
- WHEN the summary is computed
- THEN the credit note and the new invoice both appear
- AND the re-invoicing count increases by one

#### Scenario: Offline sale validated next month

- GIVEN a hybrid-site sale on March 31 validated by Factus on April 1
- WHEN the March and April summaries are produced
- THEN the invoice appears in April
- AND its March sale date is visible

### Requirement: Summary Is Not a Fiscal Document

The summary MUST be labelled as a report and the system MUST NOT offer any action to group sales into a DIAN document.

#### Scenario: No grouping action

- GIVEN a monthly summary on screen
- WHEN the accountant reviews available actions
- THEN only view and export are offered

#### Scenario: Grouping request rejected

- GIVEN a client calling the API to issue a document from a monthly summary
- WHEN the request is received
- THEN it is rejected
- AND no document is sent to Factus

### Requirement: Pending Documents at Cut-off

The summary MUST list documents still `pending_issuance` or `uncertain` at the moment of the report, separately from accepted totals.

#### Scenario: Pending excluded from totals

- GIVEN 3 sales of March still pending issuance
- WHEN the March summary is requested
- THEN accepted totals exclude them
- AND they appear in a pending section with their age

#### Scenario: Pending later accepted

- GIVEN a pending March sale that Factus validates in April
- WHEN the March summary is requested again
- THEN it no longer appears as pending in March
- AND it is counted in April

### Requirement: Tax Reports by Taxpayer

The system MUST report taxable base and tax per taxpayer, period and tax type (IVA by rate, INC, ultra-processed, plastic bags, excluded, exempt), matching what was sent to Factus. Tips MUST be excluded from the base.

#### Scenario: INC and IVA taxpayers

- GIVEN taxpayer A responsible for INC and taxpayer B responsible for IVA
- WHEN the tax report for the month is generated per taxpayer
- THEN each taxpayer shows only its own tax types

#### Scenario: Tips excluded

- GIVEN invoices with tips charged as surcharge
- WHEN the tax report is generated
- THEN tips do not increase the taxable base

### Requirement: Accounting Export Files

The system MUST export the summary and tax reports as spreadsheet files per taxpayer and period, stored in object storage with an expiry. Exports containing customer personal data MUST require authorization and be audited.

#### Scenario: Export ready

- GIVEN a completed month for taxpayer A
- WHEN the accountant requests the export
- THEN a downloadable file is produced
- AND the link stops working after its expiry

#### Scenario: Personal data export

- GIVEN an export including identified customers' names
- WHEN a user without the personal-data authorization requests it
- THEN the export is rejected
- AND the attempt is audited

### Requirement: Accountant Scope

Accountant access MUST be read-only and limited to the taxpayers in the accountant's scope (PRD-01).

#### Scenario: Own taxpayer allowed

- GIVEN an accountant scoped to taxpayer A
- WHEN they request taxpayer A's tax report
- THEN the report is returned with no edit actions

#### Scenario: Other taxpayer blocked

- GIVEN an accountant scoped to taxpayer A
- WHEN they request taxpayer B's summary
- THEN the request is rejected
