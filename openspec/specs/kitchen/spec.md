# Kitchen Specification

## Purpose

Deliver each sent product to its kitchen station and track it until delivered (PRD-M1 HU-M1-03, TRD-M1 sec. 2-4, TRD-00 sec. 6). Bounded context: `orders`, with ticket output through `shared/printing`.

## Requirements

### Requirement: Station Routing

Each product MUST belong to exactly one kitchen station. Each station SHALL output to a screen, a kitchen-ticket printer, or both. The cash register MUST always receive the account, regardless of station.

#### Scenario: Product reaches its station
- GIVEN "Steak" belongs to station "Grill" with output "both"
- WHEN a waiter sends "Steak"
- THEN the Grill screen shows it, the Grill printer prints a kitchen ticket
- AND the cash register account includes it

#### Scenario: Product without station
- GIVEN a product with no station configured
- WHEN a waiter sends it
- THEN the send is rejected with the reason and nothing reaches any station

### Requirement: Delivery Latency

The hub MUST receive the send id on commit. A p90 display measurement MUST wait for a display.

#### Scenario: Test service latency
- GIVEN a product send commits
- WHEN the hub is observed
- THEN the hub has received the send id
- AND a p90 display measurement waits for a display

#### Scenario: Send rejected on the local node
- GIVEN the local node
- WHEN a waiter sends a product
- THEN the response is 403 DiningRoomRejected and nothing is stored

### Requirement: Kitchen Display Queue

The kitchen display MUST show a queue per station ordered by send time, with a traffic-light indicator from elapsed time against thresholds configured per station.

#### Scenario: Queue order
- GIVEN two lines sent at 12:00 and 12:02 to "Grill"
- WHEN the Grill display renders
- THEN the 12:00 line is first

#### Scenario: Line turns red
- GIVEN a red threshold of 15 minutes for "Grill"
- WHEN a line has waited 16 minutes without being ready
- THEN the line is shown red

### Requirement: Forward-Only Line Lifecycle

A line SHALL move sent → in preparation → ready → delivered and MUST NOT move backward. Each transition MUST store the operation owner's timestamp.

#### Scenario: Station advances a line
- GIVEN a sent line at station "Cold"
- WHEN the station marks it in preparation and then ready
- THEN both transitions are stored with node timestamps

#### Scenario: Backward move rejected
- GIVEN a ready line
- WHEN anyone tries to set it back to sent
- THEN the change is rejected and the state stays ready

### Requirement: Ready Notice

When a line becomes ready, the waiter of that table MUST receive a notice. The waiter SHALL mark the line delivered.

#### Scenario: Waiter notified
- GIVEN a line of table 5 served by waiter W
- WHEN the station marks it ready
- THEN W's device shows a ready notice for table 5

#### Scenario: Locked phone
- GIVEN a line of table 5 becomes ready
- WHEN the ready notice is published
- THEN the notice carries the table id
- AND a locked-phone delivery mechanism is outside this change (PA-30)

### Requirement: Kitchen Ticket Printer Failure

If a station printer fails, the line MUST stay on the station screen when one exists, and the cash register MUST be alerted.

#### Scenario: Printer offline
- GIVEN station "Bar" with output "both" and its printer offline
- WHEN a drink is sent
- THEN the drink appears on the Bar screen
- AND the cash register receives a printer-failure alert

#### Scenario: Printer-only station
- GIVEN station "Bar" with output "printer" and its printer offline
- WHEN a drink is sent
- THEN the cash register is alerted with the unprinted ticket

### Requirement: Kitchen During an Internet Cut

The local node MUST reject kitchen routes with 403 DiningRoomRejected and MUST store nothing. Hybrid node operation, SQLite, outbox, sync, and a cut are deferred (D-37).

#### Scenario: Kitchen routes rejected
- GIVEN the local node
- WHEN a kitchen route is called
- THEN the response is 403 DiningRoomRejected and nothing is stored

#### Scenario: Kitchen routes store nothing
- GIVEN the local node
- WHEN a kitchen route is called
- THEN the response is 403 DiningRoomRejected and nothing is stored
