# Notifications Specification

## Purpose

Deliver staff alerts and customer messages through WhatsApp, email and SMS (D-03), in addition to in-app and Web Push, according to each site's configuration. External channels go through the `Messaging` port; in-app and Web Push stay on `Notifier`. External channels are sent only from the cloud (api-cloud); in hybrid mode the node keeps in-app alerts working without internet; in cloud mode a site outage stops both in-app and external alerts until the link returns.

## Requirements

### Requirement: Channel Configuration per Site

Each site MUST configure, per notification type (shortage alert, bag balance alert, reservation confirmation, reservation reminder, invoice delivery), the channels (in-app, push, WhatsApp, email, SMS) and recipient roles. In-app MUST remain enabled for staff alerts.

#### Scenario: WhatsApp for red shortage alerts

- GIVEN site 1 configured to send red shortage alerts by WhatsApp to the kitchen chief
- WHEN a red shortage alert opens
- THEN the kitchen chief receives a WhatsApp message
- AND the alert also appears in-app

#### Scenario: Channel not configured

- GIVEN site 2 with email disabled for shortage alerts
- WHEN a shortage alert opens there
- THEN no email is sent

#### Scenario: SMS for critical bag balance

- GIVEN a site configured to send critical bag balance alerts by SMS to the company administrator
- WHEN the bag balance reaches critical
- THEN the administrator receives an SMS
- AND the alert also appears in-app

### Requirement: Staff Alerts

Shortage alerts (including escalation) and bag balance alerts (yellow, red, critical) MUST be sent through the configured external channels. Bag alerts MUST reach the company administrator and blackHole support.

#### Scenario: Escalated alert

- GIVEN an unattended red alert escalated to the administrator
- WHEN escalation fires
- THEN the administrator receives it on their configured channel

#### Scenario: Hybrid outage

- GIVEN a hybrid node without internet that opens a shortage alert
- WHEN the alert is raised
- THEN it shows on the site's screens immediately
- AND the external message is sent after the event reaches the cloud, if the alert is still open

### Requirement: Reservation Messages

The system MUST send a confirmation when a reservation becomes confirmed and a reminder at the site's configured lead time. A reminder whose send time has already passed the reservation time MUST NOT be sent.

#### Scenario: Confirmation sent

- GIVEN a customer with WhatsApp consent
- WHEN their reservation is confirmed
- THEN they receive date, time, party size and the site's policy

#### Scenario: Reminder by SMS

- GIVEN a customer with SMS consent and no WhatsApp consent
- WHEN the reminder time of their reservation arrives
- THEN they receive the reminder by SMS only

#### Scenario: Cancelled before reminder

- GIVEN a reservation cancelled before its reminder time
- WHEN the reminder time arrives
- THEN no reminder is sent

### Requirement: Invoice Delivery by WhatsApp or SMS

When the customer provided a mobile number and consent, the system MUST send the invoice link by WhatsApp or SMS, as the site configures, only after Factus validated it. Email delivery by Factus SHALL remain the default for customers with email.

#### Scenario: Validated invoice

- GIVEN a sale with the customer's mobile number
- WHEN Factus validates the invoice
- THEN the customer receives a WhatsApp message with the invoice link

#### Scenario: Deferred issuance

- GIVEN a sale made during an outage with the invoice pending
- WHEN the invoice is still pending
- THEN no invoice message is sent
- AND it is sent once the invoice is validated

### Requirement: Consent and Opt-Out

Customer messages MUST require recorded consent per channel and MUST stop immediately after opt-out. Staff contact data MUST be used only for operational alerts.

#### Scenario: Opted-out customer

- GIVEN a customer who opted out of WhatsApp
- WHEN their reservation is confirmed
- THEN no WhatsApp message is sent

#### Scenario: No consent recorded

- GIVEN a phone number captured without consent
- WHEN an invoice is validated
- THEN no WhatsApp message is sent

### Requirement: Idempotent Delivery and Retries

Each event MUST produce at most one message per recipient and channel. Failed deliveries MUST be retried with backoff and, after the retry limit, marked failed and visible to the site administrator.

#### Scenario: Duplicate event

- GIVEN a shortage event delivered twice to the cloud
- WHEN messages are dispatched
- THEN each recipient receives one message

#### Scenario: Provider down

- GIVEN the WhatsApp provider failing
- WHEN retries are exhausted
- THEN the message is marked failed
- AND the in-app alert remains available
