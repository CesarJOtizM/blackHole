# Delta for Attendance

## ADDED Requirements

### Requirement: Photo Required at Clock Events

A site MAY require a photo at every clock event. When required, a clock event MUST be recorded only with a photo captured at that moment on a device inside the venue. The clock event time MUST remain the node's time (hybrid) or the server's time (cloud mode), not the photo's metadata.

#### Scenario: Clock-in with photo

- GIVEN a site requiring photos
- WHEN a worker enters their PIN and a photo is captured
- THEN the clock event is recorded with the photo attached
- AND its time is the node's time

#### Scenario: No photo provided

- GIVEN a site requiring photos
- WHEN a clock event is submitted without a photo
- THEN it is rejected and no clock event is recorded

#### Scenario: Photo not required

- GIVEN a site with the setting off
- WHEN a worker clocks in
- THEN the clock event is recorded without photo as before

### Requirement: Camera Unavailable Fallback

If the device camera is unavailable, a supervisor MUST be able to authorize the clock event without photo; it MUST be flagged for review and audited.

#### Scenario: Supervisor authorizes

- GIVEN a broken camera at the site device
- WHEN a supervisor authorizes with their PIN
- THEN the clock event is recorded flagged "no photo"
- AND the authorization is audited

#### Scenario: Self-authorization blocked

- GIVEN the worker is also a supervisor
- WHEN they try to authorize their own clock event without photo
- THEN the authorization is rejected

### Requirement: Photo Storage per Mode

In hybrid mode, the node MUST store the photo locally and accept the clock event without internet; the photo MUST upload later with lower priority than DIAN documents, QR payments and clock events. In cloud mode, the photo MUST be stored in cloud object storage with the event, and during an outage no clock event is taken.

#### Scenario: Hybrid outage

- GIVEN a hybrid node without internet
- WHEN a worker clocks in with photo
- THEN the clock event is recorded on the node
- AND the photo uploads after reconnection, after pending invoices

#### Scenario: Duplicate upload

- GIVEN a photo batch delivered twice
- WHEN the cloud receives it
- THEN the clock event has one photo

### Requirement: Photo Review

Site administrators MUST see the photo beside each clock event and correction in their site's attendance review. Corrections MUST NOT replace or delete the original photo.

#### Scenario: Review a clock event

- GIVEN a clock event with photo
- WHEN the site administrator opens attendance review
- THEN the photo appears with time and worker

#### Scenario: Other site's admin

- GIVEN an administrator of site 2
- WHEN they request site 1 photos
- THEN the request is rejected

### Requirement: Personal Data and Retention

Workers MUST be informed and consent recorded before photos are required. Photos MUST be retained for the site's configured period and then purged; they MUST NOT be used for biometric matching or included in hours exports. Purge on the node MUST happen only after the cloud confirms receipt.

#### Scenario: Retention purge

- GIVEN a retention of 90 days
- WHEN a photo becomes 91 days old
- THEN it is purged and the clock event remains

#### Scenario: Unsynced photo not purged

- GIVEN a node photo not yet confirmed by the cloud
- WHEN local cleanup runs
- THEN the photo is kept

#### Scenario: Export excludes photos

- GIVEN an hours export for payroll
- WHEN it is generated
- THEN no photo is included
