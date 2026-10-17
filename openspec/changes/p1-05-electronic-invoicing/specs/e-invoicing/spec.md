# E-Invoicing Specification

## Purpose

DIAN electronic sales invoices through Factus (TRD-00 sec. 8.1-8.3, TRD-M3). Bounded context: `invoicing`. Factus is called only from the cloud; nodes MUST NOT hold its credentials.

## Requirements

### Requirement: One Sale, One Document

Each closed sale MUST have exactly one electronic sales invoice with a unique `reference_code`, plus any credit notes. Aggregating sales MUST NOT be possible.

#### Scenario: Sale closed online
- GIVEN a closed sale and a working cloud link
- WHEN the document is emitted
- THEN the site receives number, CUFE and QR data

#### Scenario: Second document refused
- GIVEN a sale with a document
- WHEN another is requested
- THEN the existing one is returned

### Requirement: Buyer

Without customer data the buyer MUST be the final consumer (`13`, `222222222222`, "Consumidor final", `R-99-PN`, taxpayer internal email) for any amount. For an ID card or NIT entered at the cash register, the system SHALL autocomplete only name and email from DIAN and MUST validate the NIT check digit.

#### Scenario: Autocomplete
- GIVEN a cashier enters a valid NIT
- WHEN the lookup returns
- THEN name and email are filled for the invoice

#### Scenario: Invalid check digit
- GIVEN a NIT with a wrong check digit
- WHEN submitted
- THEN the buyer is rejected before emission

### Requirement: Numbering and Content

Documents MUST use the site range, or the cash register range when configured, with site establishment data. The tip MUST be a surcharge; payment methods map to DIAN codes.

#### Scenario: Register-level range
- GIVEN cash register C has its own range
- WHEN C closes a sale
- THEN the invoice uses C's range

#### Scenario: Tip as surcharge
- GIVEN a 100,000 sale with a 10,000 tip
- WHEN the document is built
- THEN the tip is a surcharge and taxes match the 100,000 sale

### Requirement: Deferred Emission

Without a cloud link the document MUST be `pending_emission` and the sale MUST complete. On reconnection pending documents MUST be emitted in sale order, before other data, within 80 requests per minute per NIT. Hybrid: the node holds them; cloud mode: they wait until the site link returns.

#### Scenario: Hybrid cut
- GIVEN a hybrid site offline
- WHEN three sales close
- THEN three documents are pending and later emitted in sale order

#### Scenario: Rate limit
- GIVEN 120 pending documents of one NIT
- WHEN emission resumes
- THEN at most 80 requests per minute are sent for that NIT

### Requirement: Uncertain Send Verification

A send without response MUST make the document `uncertain` and be verified by `reference_code` before resending: validated → take it; pending → delete that attempt and resend; not found → resend with the same reference. Failed verification keeps it `uncertain` with backoff.

#### Scenario: Already validated
- GIVEN an uncertain document Factus validated
- WHEN verification runs
- THEN its number and CUFE are taken and nothing is resent

#### Scenario: Verification fails
- GIVEN an uncertain document and no internet
- WHEN verification is attempted
- THEN it stays uncertain and is not resent

### Requirement: Rejections and Credit Notes

A rejection MUST raise an alert; the corrected document SHALL be resent with a new reference. A void or return after acceptance MUST be a credit note referencing the unchanged original, requiring the PRD-01 sec. 6.2 permission.

#### Scenario: Rejected then resent
- GIVEN Factus rejects a document and buyer data is fixed
- WHEN it is resent
- THEN an alert was raised and it uses a new reference

#### Scenario: Credit note without permission
- GIVEN a cashier without permission
- WHEN she requests a credit note
- THEN nothing is sent

### Requirement: Document Consumption Counter

Each validated invoice or credit note MUST count one document per company, NIT and site. Alerts fire yellow under 15 days of balance, red under 5. Without balance, documents SHALL stay pending "no balance" and sales continue.

#### Scenario: Yellow alert
- GIVEN the balance covers 12 days
- WHEN a document is counted
- THEN a yellow alert reaches the company admin and support

#### Scenario: Balance exhausted
- GIVEN zero document balance
- WHEN a sale closes
- THEN the sale completes; the document is pending "no balance"
