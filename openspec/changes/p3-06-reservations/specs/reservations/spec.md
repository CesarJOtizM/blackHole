# Reservations Specification

## Purpose

Register table reservations against slot capacity, show them on the floor plan and track attendance, also during internet cuts (PRD-M9, TRD-00 sec. 6.2, TRD-M9).

## Requirements

### Requirement: Staff Registration

Staff with reservation permission MUST register a reservation with customer name, phone, date, time, party size and channel (phone, WhatsApp, in person). Zone or table, occasion and notes MAY be added.

#### Scenario: Registered
- GIVEN a host and free capacity on Friday 20:00
- WHEN they register 4 people by phone
- THEN the reservation exists with channel "phone"

#### Scenario: Missing phone
- GIVEN a reservation without phone
- WHEN submitted
- THEN it is rejected

### Requirement: Slot Availability

The cloud MUST validate capacity per slot using slot capacity, estimated duration and reservable tables. Without capacity a reservation MUST NOT be confirmed.

#### Scenario: Capacity available
- GIVEN 20 seats free in the slot
- WHEN 6 people are requested
- THEN the reservation is accepted

#### Scenario: Overlap by duration
- GIVEN the only reservable table is booked 19:00 with 2 h duration
- WHEN a 20:00 reservation requests that table
- THEN it is rejected

### Requirement: Lifecycle

States MUST be pending payment, confirmed, customer arrived, no-show, cancelled, provisional and in conflict. A zero-value reservation MUST go straight to confirmed. Arrived, no-show and cancelled MUST be final.

#### Scenario: Cancel confirmed
- GIVEN a confirmed reservation
- WHEN staff cancel it
- THEN it is cancelled and its capacity is released

#### Scenario: Invalid transition
- GIVEN a reservation marked no-show
- WHEN someone marks arrival
- THEN it is rejected

### Requirement: Floor Plan Blocking

Day reservations MUST reach the operation owner, and the assigned table MUST appear blocked a site-configurable time before the reservation.

#### Scenario: Blocked before time
- GIVEN a 20:00 reservation and a 30-minute block
- WHEN it is 19:30
- THEN the table shows as reserved on the floor plan

#### Scenario: Seating a walk-in on a blocked table
- GIVEN a blocked table
- WHEN a waiter tries to open it for walk-ins
- THEN the system warns that it is reserved

### Requirement: Arrival and No-Show

Marking arrival MUST open or associate the table and check exactly once. Staff MUST be able to mark no-show. Both MUST be recorded on the node in hybrid mode and synced later.

#### Scenario: Arrival
- GIVEN a confirmed reservation
- WHEN the host marks arrival
- THEN a table and check open, linked to the reservation

#### Scenario: Repeated arrival
- GIVEN arrival already recorded
- WHEN it is recorded again after a retry
- THEN no second check is opened

### Requirement: Provisional Reservations Offline

A hybrid node without internet MUST create provisional reservations. On reconnect the cloud MUST confirm them if capacity exists, or mark them in conflict for an admin. Conflicts MUST NOT resolve automatically.

#### Scenario: Confirmed on reconnect
- GIVEN a provisional reservation created offline
- WHEN the node reconnects and capacity exists
- THEN it becomes confirmed

#### Scenario: Conflict
- GIVEN the slot filled in the cloud during the cut
- WHEN the provisional arrives
- THEN it is in conflict until an admin resolves it

### Requirement: Ownership by Mode

The cloud MUST own reservations. In hybrid mode the node MUST own blocking, arrival and no-show; in cloud mode `api-cloud` MUST own them, and during an outage the site MUST NOT register attendance until the link returns.

#### Scenario: Hybrid offline arrival
- GIVEN a hybrid site without internet
- WHEN arrival is marked
- THEN it is stored on the node and synced once on reconnect

#### Scenario: Cloud-mode outage
- GIVEN a cloud-mode site without internet
- WHEN staff try to mark arrival
- THEN it is unavailable, as for the dining room
