# Dining Room Specification

## Purpose

Table side of service (PRD-M1 sec. 2-5, TRD-M1 sec. 2-4, 7). Bounded context: `orders`. The operation owner is the node in hybrid mode and the cloud API in cloud mode.

## Requirements

### Requirement: Table Map and States

Tables MUST be grouped by zone and be in exactly one state: free, occupied, bill requested or to clean. Opening SHALL move a free table to occupied with its diners. Marking a to-clean table ready SHALL make it free.

#### Scenario: Open a free table
- GIVEN table 5 in zone "Terrace" is free
- WHEN a waiter opens it for 4 diners
- THEN table 5 is occupied with an empty account

#### Scenario: Open an occupied table
- GIVEN table 5 is occupied
- WHEN another waiter tries to open it
- THEN the request is rejected and the existing account is kept

### Requirement: Order Taking

Waiters MUST add products with variants, modifiers and notes from a registered phone or fixed point, using the menu copy in force. The cash register MUST see the account in real time.

#### Scenario: Account visible to the cash register
- GIVEN table 5 is occupied
- WHEN the waiter sends 4 products
- THEN the cash register screen shows the updated account without refresh

#### Scenario: Product not orderable
- GIVEN "Breakfast" is outside its schedule
- WHEN the waiter adds it
- THEN the line is rejected with the reason

### Requirement: Courses and Resend

The waiter MAY send by course and hold later courses. Resending MUST route only that product again and MUST NOT charge it twice.

#### Scenario: Send starters first
- GIVEN an order with starters and mains
- WHEN the waiter sends course 1
- THEN only the starters reach the kitchen and mains stay held

#### Scenario: Resend one product
- GIVEN a sent soup whose ticket was lost
- WHEN the waiter resends it
- THEN only the soup is routed again and the account total is unchanged

### Requirement: Move, Join and Transfer

Moving, joining and transferring products MUST only happen while source and target are occupied or bill requested, keeping each line's origin.

#### Scenario: Join two tables
- GIVEN tables 5 and 6 are occupied
- WHEN the waiter joins 6 into 5
- THEN table 5 holds both accounts' lines with their origin

#### Scenario: Target not open
- GIVEN table 7 is to clean
- WHEN a waiter transfers a product to table 7
- THEN the request is rejected and nothing moves

### Requirement: Bill Request

Requesting the bill MUST move the table to bill requested and create a pre-bill print request. Sending another product SHALL return it to occupied.

#### Scenario: Request the bill
- GIVEN table 5 is occupied
- WHEN the waiter requests the bill
- THEN table 5 is bill requested and a pre-bill print job is created

#### Scenario: Keep ordering
- GIVEN table 5 is bill requested
- WHEN the waiter sends another product
- THEN table 5 returns to occupied

### Requirement: Dine-in Time Capture

Every table and line state change MUST store the operation owner's clock time (PRD-00 sec. 8.1).

#### Scenario: First send stamped
- GIVEN a table opened at 12:00:00 node time
- WHEN the first product is sent at 12:03:10
- THEN both times are stored and order-taking time is 190 s

#### Scenario: Stamped during a cut (hybrid)
- GIVEN a hybrid site without internet
- WHEN lines change state
- THEN the node stamps them locally
- AND events reach the cloud in order after reconnection, without duplicates

### Requirement: Operation During an Internet Cut

In hybrid mode the dining room MUST keep working on the node. In cloud mode it SHALL be stopped and the app MUST say so.

#### Scenario: Hybrid keeps serving
- GIVEN a hybrid site loses internet
- WHEN a waiter opens a table and sends products
- THEN the node accepts them and the kitchen receives them

#### Scenario: Cloud mode stopped
- GIVEN a cloud-mode site loses internet
- WHEN a waiter tries to send an order
- THEN the app shows it is unavailable and no order is created
