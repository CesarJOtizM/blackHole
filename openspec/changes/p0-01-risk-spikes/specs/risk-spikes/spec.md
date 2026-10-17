# Risk Spikes Specification

## Purpose

Define what the Phase 0 decision report MUST establish before later deliveries rely on it (ADR-003, ADR-006, TRD-00 5.4, 7, 17). Prototypes are disposable; the report is the deliverable.

## Requirements

### Requirement: Decision Report

The report MUST record, per spike, setup, evidence, decision and consuming delivery; an inconclusive spike MUST be marked blocking.

#### Scenario: All spikes concluded
- GIVEN the five spikes were executed
- WHEN the report is reviewed
- THEN each spike shows setup, evidence, decision and consumer delivery
- AND ADR-003 and ADR-006 are marked decided

#### Scenario: Inconclusive spike
- GIVEN a spike whose evidence supports no option
- WHEN the report is closed
- THEN the spike is marked blocking with an owner
- AND its dependent deliveries stay pending

### Requirement: Local HTTPS for the Site PWA

The report MUST establish whether a real certificate for a per-site subdomain, issued by DNS-01 and resolved by local DNS, lets the PWA install and work against the node with internet cut, on Android Chrome and iPhone Safari (iOS 16.4+). It MUST prove renewal on reconnect and check router client isolation.

#### Scenario: Offline PWA on both platforms
- GIVEN a node with its site certificate and local DNS
- WHEN internet is cut and the PWA opens on Android and iPhone
- THEN both load over HTTPS without warnings and reach the node
- AND a near-expiry certificate renews on reconnect

#### Scenario: Option A fails
- GIVEN local DNS cannot be controlled or Safari rejects the setup
- WHEN the spike runs
- THEN the report chooses option B or C with rationale and lists documents to update

### Requirement: Locked-Phone Alerts Without Internet

The report MUST select and prove how a waiter learns an item is ready while the phone is locked or the PWA backgrounded, offline, on both platforms; otherwise it MUST state the fallback and residual risk.

#### Scenario: Locked phone alerted
- GIVEN a hybrid node offline and a locked waiter phone
- WHEN kitchen marks an item ready
- THEN the report records whether and how fast each platform alerts

#### Scenario: No offline mechanism
- GIVEN push depends on vendor services unreachable offline
- WHEN no mechanism wakes the locked iPhone
- THEN the report defines the fallback adopted by delivery 1.2

### Requirement: ESC/POS Printing and Cash Drawer

The report MUST prove ESC/POS from the node to each pilot printer model, over network and USB, at 80 and 58 mm, including the drawer kick, and MUST record whether an unregistered device on shared Wi-Fi reaches the printer port.

#### Scenario: Print and open drawer
- GIVEN a pilot printer attached to the node
- WHEN a sample ticket and a drawer command are sent
- THEN the ticket prints legibly and the drawer opens

#### Scenario: Printer exposed to guests
- GIVEN a phone on the customer Wi-Fi
- WHEN it sends raw data to the printer port
- THEN the result and its mitigation are recorded for ADR-006

### Requirement: Hardware Kit Decision

The report MUST decide node hardware, printers, UPS and whether the dedicated router is mandatory, recommended or optional, with reason and cost per item.

#### Scenario: Kit decided
- GIVEN the HTTPS, printing and network results
- WHEN ADR-006 is written
- THEN each kit item has a reason and a cost estimate

#### Scenario: Router cannot isolate printers
- GIVEN the site router has no isolation rules
- WHEN the kit is decided for that site
- THEN a dedicated router or wired printers become mandatory

### Requirement: SQLite Peak-Hour Load

The report MUST measure a node API on SQLite in WAL mode under the pilot peak profile while the outbox drains, against node API p95 < 200 ms and kitchen latency p90 < 2 s.

#### Scenario: Within targets
- GIVEN the peak profile on reference hardware
- WHEN the load test runs with the outbox draining
- THEN p95 and p90 are recorded and meet the targets

#### Scenario: Targets missed
- GIVEN p95 exceeds 200 ms
- WHEN the result is recorded
- THEN the report names the bottleneck and the change required before 0.2 closes
