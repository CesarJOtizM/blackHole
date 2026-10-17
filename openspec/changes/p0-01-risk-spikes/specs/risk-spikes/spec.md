# Risk Spikes Specification

## Purpose

Define what the Phase 0 decision report MUST establish before cloud printing relies on it (TRD-00 §7, D-37). The dedicated router and the 4G modem are already a recommendation the owner buys (D-36). Prototypes are disposable; the report is the deliverable.

Local HTTPS, locked-phone alerts without internet and SQLite peak load are deferred to the hybrid phase. They are not acceptance criteria of this change.

## Requirements

### Requirement: Decision Report

The report MUST record setup, evidence, decision and the consuming delivery for the printing spike. An inconclusive spike MUST be marked blocking.

#### Scenario: Printing spike concluded
- GIVEN the ESC/POS spike was executed
- WHEN the report is reviewed
- THEN it shows setup, evidence, decision and delivery 1.6 as consumer
- AND ADR-003 stays pending for the hybrid phase

#### Scenario: Inconclusive spike
- GIVEN the printing spike evidence supports no option
- WHEN the report is closed
- THEN the spike is marked blocking with an owner
- AND delivery 1.6 stays pending

### Requirement: ESC/POS Printing and Cash Drawer

The report MUST prove ESC/POS from the bridge profile to each pilot printer model, over network and USB, at 80 and 58 mm, including the drawer kick, and MUST record whether an unregistered device on shared Wi-Fi reaches the printer port.

#### Scenario: Print and open drawer
- GIVEN a pilot printer attached to the bridge
- WHEN a sample ticket and a drawer command are sent from the cloud job
- THEN the ticket prints legibly and the drawer opens

#### Scenario: Printer exposed to guests
- GIVEN a phone on the customer Wi-Fi
- WHEN it sends raw data to the printer port
- THEN the result and its mitigation are recorded against D-36

### Requirement: Recommended Router on the Visit

The report MUST record, for the visited site, whether the current router isolates printers. The dedicated router stays recommended and the owner buys it (D-36). The report does not price hardware the product sells.

#### Scenario: Current router isolates printers
- GIVEN the printing and network results
- WHEN the visit is recorded
- THEN it states whether that site can isolate printers on its current router

#### Scenario: Router cannot isolate printers
- GIVEN the site router has no isolation rules
- WHEN the visit is recorded
- THEN the report tells the owner to buy the dedicated router or use wired printers (D-36)

## Deferred to the hybrid phase (D-37)

Not acceptance criteria of this change. Kept here so the hybrid phase does not rediscover them.

### Local HTTPS for the Site PWA (PA-29, ADR-003)

Prove whether a real certificate for a per-site subdomain, issued by DNS-01 and resolved by local DNS, lets the PWA install and work against the node with internet cut, on Android Chrome and iPhone Safari (iOS 16.4+), including renewal on reconnect. If local DNS cannot be controlled or Safari rejects the setup, the report chooses the next option and lists the documents to update.

### Locked-phone alerts without internet (PA-30)

Prove how a waiter learns an item is ready while the phone is locked or the PWA is backgrounded, offline, on both platforms. If no mechanism wakes a locked iPhone, the report records the fallback.

### SQLite peak-hour load

Measure a node API on SQLite in WAL mode under the pilot peak profile while the outbox drains, against node API p95 < 200 ms and kitchen latency p90 < 2 s. If the target is missed, the report names the bottleneck.
