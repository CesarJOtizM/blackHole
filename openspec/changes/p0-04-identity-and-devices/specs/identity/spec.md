# Identity Specification

## Purpose

Define who is operating: administration users in the cloud, and site staff with a personal PIN on registered devices, validated by the node in hybrid mode and by the cloud in cloud mode (TRD-00 10.1, PRD-01 10, TRD-M0 4).

## Requirements

### Requirement: Administration Session

Administration users MUST sign in to api-cloud with email and password. The system MUST support enrolling a second factor and, once enrolled, MUST require it at every sign-in. The node MUST NOT accept administration sign-in.

#### Scenario: Sign-in with second factor
- GIVEN an owner with a second factor enrolled
- WHEN they enter valid credentials and a valid code
- THEN an administration session starts

#### Scenario: Wrong second factor
- GIVEN an owner with a second factor enrolled
- WHEN the code is wrong
- THEN no session starts and the attempt is recorded

### Requirement: Personal PIN Session

Staff MUST start a short session with a personal PIN on a registered device of their site. The screen MUST always show who is operating. PINs MUST be stored only as a slow salted hash and MUST NOT appear in clear in events or logs. In hybrid mode the node MUST validate the PIN offline using its copy; in cloud mode the cloud validates it and no session is possible during a cut.

#### Scenario: Valid PIN on the node offline
- GIVEN a hybrid node without internet and a registered device
- WHEN a waiter enters a valid PIN
- THEN a session starts and shows the waiter's name

#### Scenario: Cloud site during a cut
- GIVEN a cloud-mode site without internet
- WHEN a waiter enters a PIN
- THEN no session starts

#### Scenario: Unregistered device
- GIVEN a device that is not registered
- WHEN a valid PIN is entered
- THEN the session is denied

### Requirement: Quick Switch and Inactivity Lock

A shared device MUST allow switching user with another PIN without closing the app, and MUST lock after an inactivity time configurable per device.

#### Scenario: Quick switch
- GIVEN a cashier signed in
- WHEN a supervisor enters their PIN to switch
- THEN the session belongs to the supervisor and the screen shows their name

#### Scenario: Inactivity
- GIVEN a waiter phone with a 5-minute lock
- WHEN 5 minutes pass without activity
- THEN the PIN is required again

### Requirement: PIN Attempt Limit

Repeated failed PIN attempts on a device MUST trigger a temporary lock and an alert to the site administrator, and MUST be recorded.

#### Scenario: Lock after failures
- GIVEN the attempt limit is 5
- WHEN 5 wrong PINs are entered on one device
- THEN that device rejects PINs temporarily and the administrator is alerted

#### Scenario: Success resets
- GIVEN 3 failed attempts
- WHEN a valid PIN is entered
- THEN the counter resets

### Requirement: User Deactivation

Deactivating a user MUST end their sessions on every device of the site in under 5 seconds. In hybrid mode the node MUST accept the deactivation offline, apply it at once and upload it later.

#### Scenario: Deactivate on offline node
- GIVEN a hybrid node without internet and a waiter with an open session
- WHEN the administrator deactivates the waiter on the node
- THEN the session stops working within 5 seconds
- AND the change reaches the cloud on reconnect

#### Scenario: Deactivated user signs in
- GIVEN a deactivated user
- WHEN they enter their PIN
- THEN the session is denied
