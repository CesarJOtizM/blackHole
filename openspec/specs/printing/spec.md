# Printing Specification

## Purpose

Thermal printing of every site document (TRD-00 sec. 7, TRD-M3 sec. 2, 5, 7). Shared capability `printing`; contexts submit print jobs and keep their rules.

## Requirements

### Requirement: Templates and Widths

The system MUST provide templates for kitchen ticket, pre-bill, invoice with QR and CUFE, offline sales receipt, cash close, transfer and tips settlement, each in 80 mm and 58 mm. The offline receipt MUST state that it is not an invoice and carry a lookup QR.

#### Scenario: Invoice on 58 mm
- GIVEN an accepted invoice and a 58 mm printer
- WHEN the invoice is printed
- THEN number, CUFE and a scannable QR are printed without truncation

#### Scenario: Offline receipt
- GIVEN a sale whose document is `pending_issuance`
- WHEN the cashier prints
- THEN the receipt reads "not an invoice" and carries a QR

### Requirement: Where Printing Runs

The browser MUST NOT send printer commands. In hybrid mode the node MUST print, also without internet. In cloud mode the bridge MUST print; if the bridge is off, jobs SHALL wait in the cloud and the screen MUST warn that nothing printed.

#### Scenario: Hybrid offline
- GIVEN a hybrid site without internet
- WHEN a pre-bill is requested
- THEN the node prints it

#### Scenario: Bridge off (cloud mode)
- GIVEN a cloud-mode site with its bridge off
- WHEN a cash close is printed
- THEN the job waits in the cloud and the screen warns it was not printed

### Requirement: Queue, Retries and Status

Every job MUST enter a queue and be retried on failure. Each printer MUST expose status, and each job MUST show printed or failed.

#### Scenario: Transient failure
- GIVEN a printer out of paper
- WHEN paper is restored within the retry window
- THEN the queued job prints once

#### Scenario: Retries exhausted
- GIVEN a printer offline beyond the retry window with no backup
- WHEN retries are exhausted
- THEN the job is marked failed and the requesting screen is alerted

### Requirement: Backup Printer

A network printer MAY have a backup. When the primary fails, the queue MUST send the job to the backup.

#### Scenario: Primary down
- GIVEN kitchen printer P with backup B
- WHEN P does not respond
- THEN the kitchen ticket prints on B

#### Scenario: Both down
- GIVEN P and B are offline
- WHEN a job arrives
- THEN the job is marked failed and the cash register is alerted

### Requirement: Audited Reprint

Any reprint MUST be audited with user, device, document and time. Reprinting an invoice or pre-bill MUST respect the user's cap from PRD-01 sec. 6.2.

#### Scenario: Reprint within cap
- GIVEN a cashier below her reprint cap
- WHEN she reprints an invoice
- THEN it prints and an audit event is recorded

#### Scenario: Over cap
- GIVEN a cashier at her reprint cap
- WHEN she reprints a pre-bill
- THEN the reprint does not print without authorization

### Requirement: Cash Drawer

The drawer command MUST only travel in a cash register job to the cash register printer. Every opening MUST be audited.

#### Scenario: Cash sale opens drawer
- GIVEN a cash payment at cash register C
- WHEN the receipt prints on C's printer
- THEN the drawer opens and the opening is audited with the sale

#### Scenario: Drawer on kitchen printer
- GIVEN a kitchen ticket job
- WHEN it is printed
- THEN no drawer command is sent
