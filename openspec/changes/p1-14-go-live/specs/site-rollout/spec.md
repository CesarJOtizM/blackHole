# Site Rollout Specification

## Purpose

Verifiable readiness gates for taking a site to production and the run proving it operates only with the system (roadmap 1.14, TRD-00 10.1.2, 16.8). Each gate MUST leave evidence per site.

## Requirements

### Requirement: Technical Visit

A technical visit MUST record Wi-Fi coverage (dining room, kitchen, register, other floors), router model and client isolation, dedicated router decision, each printer's connection, and site mode. Installation MUST NOT start with an incomplete checklist.

#### Scenario: Complete visit
- GIVEN every checklist item recorded with evidence
- WHEN the visit is closed
- THEN installation is allowed

#### Scenario: Client isolation found
- GIVEN the staff network has client isolation active
- WHEN the visit records it
- THEN installation waits for a dedicated router or a network fix

### Requirement: Hardware Kit Verified

The kit MUST be installed and tested: thermal printers (80 or 58 mm) per station and register, drawer on the register printer, dedicated router if decided, 4G backup modem recommended. Hybrid sites MUST have a node with UPS; cloud sites with printers, a bridge.

#### Scenario: Unregistered phone test
- GIVEN the kit installed
- WHEN an unregistered phone on the site network tries to use the node or print
- THEN both attempts fail

#### Scenario: Drawer from non-register job
- GIVEN the kitchen printer
- WHEN a kitchen ticket prints
- THEN no drawer-open command is sent

### Requirement: Site Configuration Loaded

Before the rehearsal the site MUST have: menu with tax classification, tax profile, DIAN numbering range, users with roles and PINs, registered devices, stations and printers, tip rule, attendance settings and printed table QRs.

#### Scenario: Configuration check passes
- GIVEN all items loaded
- WHEN a test sale is invoiced in production
- THEN the DIAN accepts the document

#### Scenario: Missing numbering range
- GIVEN no DIAN range for the site
- WHEN readiness is checked
- THEN the rehearsal is blocked

### Requirement: Rehearsal With an Internet Cut

One full service MUST be rehearsed with the internet cut halfway. In hybrid mode, ordering, kitchen, register, printing and attendance MUST continue; on reconnection pending invoices MUST be issued and QR orders and payments from the cut MUST enter, without duplicates. In cloud mode the dining room stops and resumes, and QR orders and payments enter on reconnection.

#### Scenario: Hybrid rehearsal
- GIVEN a hybrid site mid-service
- WHEN internet is cut for 20 minutes and restored
- THEN no order is lost, invoices are issued once and QR orders and payments enter once

#### Scenario: Duplicate found
- GIVEN the rehearsal produces a duplicate invoice or order
- WHEN results are reviewed
- THEN go-live is blocked until fixed and rehearsed again

### Requirement: Staff Training

Every operating user MUST be trained for their role, with attendance recorded, covering clocking, outage behavior and sensitive actions.

#### Scenario: Trained roster
- GIVEN all active users trained
- WHEN readiness is checked
- THEN the training gate passes

#### Scenario: Untrained user
- GIVEN a new hire without training
- WHEN readiness is checked
- THEN the gate lists them as pending

### Requirement: Two-Week Validation Run

The site MUST operate 14 consecutive days only with the system. The run MUST show DIAN documents accepted with no rejection left unprocessed, at least one service with QR orders and QR payments, and staff clocking attendance every day. A day run partly outside the system MUST restart the count.

#### Scenario: Successful run
- GIVEN 14 consecutive logged days
- WHEN the run is reviewed
- THEN the exit criterion is met

#### Scenario: Fallback day
- GIVEN day 9 used the previous process for part of the service
- WHEN the day is logged
- THEN the count restarts at zero

### Requirement: Go/No-Go and Fallback

A go/no-go decision MUST be recorded before the run, with a fallback plan. Falling back MUST keep issued invoices valid. A hybrid site MUST NOT switch back to cloud mode with unsynced data unless explicitly accepted.

#### Scenario: Go decision
- GIVEN all gates passed
- WHEN the decision is recorded
- THEN the run starts

#### Scenario: Gate failed
- GIVEN the rehearsal gate failed
- WHEN go/no-go is held
- THEN the decision is no-go
