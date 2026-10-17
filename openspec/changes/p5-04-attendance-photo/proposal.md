# Proposal: Attendance Photo

## Intent

The personal PIN and on-premises presence reduce buddy punching, but a shared PIN still lets one worker clock in for another. PRD-00 sec. 13 risks and TRD-M8 sec. 10 defer "photo at clock event" to Phase 5.

## Scope

### In Scope
- Per-site setting: photo required at clock events (entry, exit, break start/end).
- Photo captured on the site device or the worker's phone inside the venue, attached to the clock event.
- Hybrid: photo stored on the node and uploaded later, with lower priority than DIAN documents.
- Review: administrator sees the photo beside each clock event and correction.
- Personal data handling (Ley 1581): notice, consent, retention, restricted access.

### Out of Scope
- Facial recognition or biometric matching: not planned.
- Payroll (PRD-00 out of scope).
- Changes to the clock-time rule: time stays the node's or server's (→ 1.9).

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `attendance`: adds required photo at clock events, offline photo storage and upload, review and retention.

## Approach

Extend `Mark` in `contexts/attendance/application`: when the site requires a photo, the clock event is accepted only with an image. The image goes through the file port (TRD-M8 sec. 1 currently "Foto: No está"): local disk on the node, object storage in the cloud. The clock event syncs as today; the image follows in a low-priority outbox lane.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/attendance/domain` | Modified | Photo-required rule |
| `contexts/attendance/application` | Modified | Mark with photo, review, retention purge |
| `contexts/attendance/adapters/sqlite`, `postgres` | Modified | Photo reference on clock events |
| `contexts/platform/adapters/files` | Modified | Node file store and cloud object store |
| `shared/sync` | Modified | Low-priority media lane |
| `apps/venue-app` | Modified | Camera capture at clock event |
| `apps/admin-web` | Modified | Photo review |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Camera denied or broken blocks the worker | Med | Supervisor-authorized clock event without photo, flagged |
| Node disk fills with photos | Med | Compression, size cap, purge after upload confirmation |
| Upload competes with invoices on a weak link | Med | Lowest outbox priority |
| Privacy complaints | Med | Notice and consent; retention period configurable |

## Rollback Plan

Turn the per-site "photo required" setting off; clock events work as in 1.9. Stored photos remain until their retention purge.

## Dependencies

- 1.9 attendance; 0.8 object storage port; legal review of consent text.

## Success Criteria

- [ ] Clock events at a site carry their photo.
- [ ] Without internet in hybrid mode, clock events with photo still work and the photo uploads later.
- [ ] Photos are visible only to authorized administrators of that site.
- [ ] Integration operates in at least 1 site (PRD-00 sec. 11 phase 5).
