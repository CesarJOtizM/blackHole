# QR Table Ordering Specification

## Purpose

Let a customer order from a fixed table QR into the same account, stations and register as a waiter's order, with channel "QR table". The phone talks only to the cloud portal, never the node (PRD-00 6.1.2, TRD-00 6.4).

## Requirements

### Requirement: Fixed Table QR

Each table SHALL have a fixed QR that identifies only site and table and carries no account data. It MUST NOT expire; reprinting it MUST rotate the token and invalidate the previous one.

#### Scenario: Scan
- GIVEN a printed table QR
- WHEN a customer scans it
- THEN the portal opens for that site and table without install or sign-up

#### Scenario: Rotated QR
- GIVEN an administrator reprinted the QR of table 5
- WHEN someone scans the old QR
- THEN the portal refuses to take orders

### Requirement: Customer Menu

The portal SHALL show the site's current menu with prices, variants, modifiers and sold-out items; sold-out items MUST NOT be orderable.

#### Scenario: Sold-out item
- GIVEN a dish marked sold out at the site
- WHEN the customer browses the menu
- THEN the dish is shown as unavailable and cannot be added

#### Scenario: Site price
- GIVEN a site price different from the brand price
- WHEN the customer views the dish
- THEN the site price is shown

### Requirement: Idempotent Order Intent

Each submission MUST be stored in the cloud as one order intent with a unique identifier. Resubmitting the same intent MUST NOT create another.

#### Scenario: Double tap
- GIVEN a customer taps "send" twice
- WHEN both requests arrive
- THEN one intent exists

#### Scenario: Empty cart
- GIVEN a cart with no items
- WHEN the customer submits
- THEN no intent is created

### Requirement: Intent Application

The operation owner SHALL apply each intent once: open the table if free or add to its open account, mark lines "QR table", route each to its station and show the account at the register, as fast as a waiter's order.

#### Scenario: Free table
- GIVEN table 3 is free and the site is online
- WHEN a QR order with a grill dish arrives
- THEN the table opens and the dish reaches the grill station marked "QR table"

#### Scenario: Occupied table
- GIVEN table 3 has an open account
- WHEN a QR order arrives
- THEN its lines join that account

### Requirement: Optional Register Acceptance

Each site SHALL use direct mode (default) or register acceptance, where the kitchen MUST NOT see lines until a cashier accepts and rejections MUST be shown to the customer.

#### Scenario: Acceptance required
- GIVEN a site in acceptance mode
- WHEN a QR order arrives
- THEN it waits at the register and reaches the kitchen only after acceptance

#### Scenario: Cashier rejects
- GIVEN a pending QR order
- WHEN the cashier rejects it
- THEN no line is created and the portal shows it was not accepted

### Requirement: Customer Restrictions

The portal MUST NOT offer voids, discounts, courtesies or price changes. Those remain staff actions with their permissions.

#### Scenario: Editing the unsent cart
- GIVEN a customer with items not yet sent
- WHEN they remove an item from the cart
- THEN the cart updates and nothing reaches the account

#### Scenario: Forged void request
- GIVEN a crafted void request from the portal
- WHEN it arrives
- THEN it is rejected

### Requirement: Outage Queue

During a hybrid outage, intents MUST wait in the cloud and apply once on reconnection, in arrival order, with availability at apply time; unavailable dishes MUST NOT reach the kitchen and the portal MUST say so. In cloud mode, intents MUST wait the same way while site devices are disconnected. Waiters keep ordering on the node.

#### Scenario: Order during outage
- GIVEN a hybrid site without internet
- WHEN a customer sends a QR order
- THEN it reaches the kitchen after reconnection, once

#### Scenario: Dish unavailable on reconnection
- GIVEN a queued intent for a dish sold out since
- WHEN the node applies it
- THEN that line is rejected and shown on the portal, without duplicates on retry
