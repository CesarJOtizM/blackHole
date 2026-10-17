# Device Registry Specification

## Purpose

Define how site devices, including staff personal phones, become trusted, prove their identity on every request, stay on-premises and are revoked at once, assuming customers share the site Wi-Fi (TRD-00 10.1.1, 10.1.2).

## Requirements

### Requirement: Single-Use Registration Code

A site administrator MUST generate a single-use registration QR that expires within minutes. The node MUST show it in hybrid mode; the administration web MUST show it in cloud mode. Registration attempts MUST be rate limited.

#### Scenario: Register a phone
- GIVEN a valid registration QR
- WHEN a waiter scans it on-premises
- THEN the phone gets its own credential for that site and user

#### Scenario: Reused or expired code
- GIVEN a code already used or expired
- WHEN a phone scans it
- THEN registration is refused

### Requirement: Signed Requests

Each device MUST hold a non-exportable signing key and MUST sign every request. Hosts MUST reject unsigned requests, invalid signatures and signatures from revoked devices.

#### Scenario: Valid signature
- GIVEN a registered device
- WHEN it sends a signed request
- THEN the request is processed

#### Scenario: Copied session token
- GIVEN a session token copied to another phone without the key
- WHEN that phone sends a request
- THEN it is rejected

### Requirement: Unregistered Devices Get Nothing

The node MUST answer an unregistered device only with the registration screen, and only while a valid code exists. Unregistered devices MUST NOT trigger printing or the cash drawer. The node MUST expose only HTTPS and WebSocket on the local network.

#### Scenario: Customer phone on shared Wi-Fi
- GIVEN a customer phone on the site network
- WHEN it calls node endpoints or sends a print job
- THEN it receives no business data and nothing prints

#### Scenario: Port scan
- GIVEN a device on the site network
- WHEN it scans the node
- THEN only the HTTPS port answers

### Requirement: On-Premises Presence

Personal phones MUST operate only on-premises. In hybrid mode they MUST talk only to the node over the local network. In cloud mode the PWA MUST confirm it reaches the site bridge before operating. A cloud site with no local equipment MAY let a registered device with PIN operate from anywhere until revoked.

#### Scenario: Phone at home, hybrid site
- GIVEN a registered phone outside the site network
- WHEN it tries to take an order
- THEN it cannot reach the node and cannot operate

#### Scenario: Cloud site with bridge
- GIVEN a cloud site with a bridge and a phone that cannot reach it
- WHEN the phone tries to operate
- THEN operation is refused

### Requirement: No Business Data on Phones

Personal phones MUST store only the session and the device credential, never sales, reports or customer data.

#### Scenario: Storage inspection
- GIVEN a phone after a full shift
- WHEN its storage is inspected
- THEN only session and credential are present

#### Scenario: Storage wiped by the OS
- GIVEN the OS deletes the PWA storage
- WHEN the waiter reopens the app
- THEN no business data is lost and the phone registers again

### Requirement: Fixed Station Device

A device MAY be registered in fixed mode bound to one kitchen station; it MUST always open that station without a PIN to view it.

#### Scenario: Kitchen TV
- GIVEN a TV registered as the grill station
- WHEN it starts
- THEN it opens the grill queue without a PIN

#### Scenario: Other station
- GIVEN that fixed device
- WHEN it requests the bar queue
- THEN it is refused

### Requirement: Immediate Revocation

Revoking a device MUST stop it from operating in under 5 seconds. In hybrid mode the node MUST accept the revocation offline and upload it later.

#### Scenario: Revoke offline
- GIVEN a hybrid node without internet and a phone in use
- WHEN the administrator revokes it on the node
- THEN its next request fails within 5 seconds
- AND the revocation reaches the cloud on reconnect

#### Scenario: Revoked phone prints
- GIVEN a revoked phone
- WHEN it sends a print job
- THEN nothing prints
