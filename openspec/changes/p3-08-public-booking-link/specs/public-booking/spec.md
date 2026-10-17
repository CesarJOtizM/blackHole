# Public Booking Specification

## Purpose

Let customers create reservations from a public link per site, seeing the policy before confirming (PRD-M9 HU-M9-04, TRD-M9 sec. 5, 7 and 8).

## Requirements

### Requirement: Public Site Link

Each site MAY enable one public booking link. It MUST work without a customer account and MUST show only that site's slots.

#### Scenario: Link enabled
- GIVEN a site with the link enabled
- WHEN a customer opens it on a phone
- THEN they see that site's available slots

#### Scenario: Link disabled
- GIVEN a site with the link disabled
- WHEN the link is opened
- THEN no booking can be made and a contact message is shown

### Requirement: Policy Visible Before Confirmation

Before confirming, the customer MUST see charge type, amount, collection accounts and refund tiers. The policy shown MUST be the one copied into the reservation.

#### Scenario: Charged slot
- GIVEN a slot with a 50,000 deposit
- WHEN the customer selects it
- THEN amount and tiers appear before the confirm action

#### Scenario: Policy changed while viewing
- GIVEN the site changes the policy after the customer loaded it
- WHEN the customer confirms
- THEN they are shown the new policy and must confirm again

### Requirement: Availability Enforcement

The link MUST use the same cloud capacity rule as staff. Without capacity the reservation MUST NOT be created.

#### Scenario: Capacity taken meanwhile
- GIVEN the last table booked by staff a moment earlier
- WHEN the customer confirms
- THEN no reservation is created and other slots are suggested

#### Scenario: Party too large
- GIVEN a party larger than any slot capacity
- WHEN requested
- THEN the customer is told to contact the site

### Requirement: Channel and Payment

A link reservation MUST carry channel "public link". If the slot charges, it MUST start pending payment, show the transfer data and reference, and MUST only be confirmed by staff verification. A free slot MUST be confirmed immediately.

#### Scenario: Free slot
- GIVEN a free slot
- WHEN the customer confirms
- THEN the reservation is confirmed with channel "public link"

#### Scenario: Customer cannot self-confirm
- GIVEN a charged reservation from the link
- WHEN the customer states they already transferred
- THEN the reservation stays pending payment until staff verify

### Requirement: Privacy

The link MUST NOT list other people's reservations or expose bank data beyond what the site published. It MUST show a personal data processing notice (Ley 1581) and record consent.

#### Scenario: Probing reservations
- GIVEN a customer who knows another phone number
- WHEN they query the link with it
- THEN no reservation data is returned

#### Scenario: Consent missing
- GIVEN the customer did not accept the notice
- WHEN they confirm
- THEN the reservation is not created

### Requirement: Cloud-Only Availability

The link MUST run only in the cloud. A site internet cut MUST NOT stop it; the reservation MUST reach the node on reconnect. During a cloud outage the link MUST be unavailable.

#### Scenario: Site offline
- GIVEN a hybrid site without internet
- WHEN a customer books for tonight
- THEN the reservation is created in the cloud and appears on the node after reconnect

#### Scenario: Provisional collision
- GIVEN the node created a provisional for the same table offline
- WHEN it syncs
- THEN the provisional goes into conflict, not the link reservation

### Requirement: Abuse Protection

The link SHOULD limit repeated submissions per device and phone.

#### Scenario: Burst blocked
- GIVEN many submissions from one device in a minute
- WHEN another arrives
- THEN it is rejected temporarily

#### Scenario: Normal use
- GIVEN a single submission
- WHEN it arrives
- THEN it is processed
