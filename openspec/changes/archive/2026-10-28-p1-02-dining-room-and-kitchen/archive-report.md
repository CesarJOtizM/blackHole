# Archive Report

**Change**: p1-02-dining-room-and-kitchen
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-10-28
**Archived to**: `openspec/changes/archive/2026-10-28-p1-02-dining-room-and-kitchen/`
**Verification verdict**: PASS WITH WARNINGS
**Engram**: not used. No observation IDs. Orchestrator forbade Engram for this archive.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/p1-02-dining-room-and-kitchen/proposal.md` | n/a (openspec) |
| spec (dining-room) | `openspec/changes/p1-02-dining-room-and-kitchen/specs/dining-room/spec.md` | n/a (openspec) |
| spec (kitchen) | `openspec/changes/p1-02-dining-room-and-kitchen/specs/kitchen/spec.md` | n/a (openspec) |
| design | `openspec/changes/p1-02-dining-room-and-kitchen/design.md` | n/a (openspec) |
| tasks | `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | n/a (openspec) |
| apply-progress | `openspec/changes/p1-02-dining-room-and-kitchen/apply-progress.md` | n/a (openspec) |
| verify-report | `openspec/changes/p1-02-dining-room-and-kitchen/verify-report.md` | n/a (openspec) |
| archive-report | `openspec/changes/p1-02-dining-room-and-kitchen/archive-report.md` | n/a (openspec) |

## Task Completion Gate

`tasks.md` has 47/47 implementation tasks checked (1.1–6.3). No `- [ ]` implementation task remains. Archive was allowed. The test suite was not run in this phase.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks. The p90 checkbox and the hybrid-cut checkbox stay open because those behaviors are deferred. See Residual Warnings.

## Spec Reconciliation (intentional-with-warnings)

The verify report required this reconciliation before the deltas became the main specs. Only the conflict scenarios below were edited. Passing scenarios were left unchanged, including First send stamped, Queue order, Line turns red, Station advances a line, Waiter notified, Printer offline, and Printer-only station.

Design sentences used, taken from `design.md`:

> `local-node` returns 403 `DiningRoomRejected` and stores nothing.

> Hybrid (D-37): node operation, SQLite, outbox, sync, node clock, and a cut.

Applied together as: local-node returns 403 DiningRoomRejected and stores nothing. Hybrid node operation, SQLite, outbox, sync, and a cut are deferred (D-37).

> p90 timing waits for a display. The hub must see the id on commit.

> no locked-phone notice (PA-30). The domain still emits the notice and the ticket text.

Applied for the locked-phone scenario as: No locked-phone notice (PA-30). The domain still emits the notice.

### Dining room — scenario "Stamped during a cut (hybrid)"

Requirement "Dine-in Time Capture" was left unchanged, including "Every table and line state change MUST store the operation owner's clock time (PRD-00 sec. 8.1)." Scenario "First send stamped" was left unchanged.

**Old scenario heading**: Stamped during a cut (hybrid)

**Old sentences**:

> GIVEN a hybrid site without internet
> WHEN lines change state
> THEN the node stamps them locally
> AND events reach the cloud in order after reconnection, without duplicates

**Design sentence used**: local-node returns 403 DiningRoomRejected and stores nothing. Hybrid node operation, SQLite, outbox, sync, and a cut are deferred (D-37).

**Replacement heading**: State change rejected on the local node

**Replacement**: a table or line state change posted on the local node returns 403 DiningRoomRejected and nothing is stored. The scenario does not claim a local stamp or a later sync.

### Dining room — requirement "Operation During an Internet Cut"

**Old requirement sentence**:

> In hybrid mode the dining room MUST keep working on the node. In cloud mode it SHALL be stopped and the app MUST say so.

**Old scenario** "Hybrid keeps serving":

> GIVEN a hybrid site loses internet
> WHEN a waiter opens a table and sends products
> THEN the node accepts them and the kitchen receives them

**Old scenario** "Cloud mode stopped":

> GIVEN a cloud-mode site loses internet
> WHEN a waiter tries to send an order
> THEN the app shows it is unavailable and no order is created

**Design sentence used**: local-node returns 403 DiningRoomRejected and stores nothing. Hybrid node operation, SQLite, outbox, sync, and a cut are deferred (D-37).

**Replacement**: the requirement now says the local node MUST reject every dining route, including orders-realtime, with 403 DiningRoomRejected and MUST store nothing, and that hybrid node operation, SQLite, outbox, sync, and a cut are deferred (D-37).

**Replacement scenarios**: "Dining routes rejected" and "Orders realtime rejected". Each returns 403 DiningRoomRejected and stores nothing. They do not claim the node keeps serving. They do not claim a client-unavailable screen.

### Kitchen — requirement "Delivery Latency" p90 MUST and scenario "Test service latency"

**Old MUST**:

> Inside the site, a sent product MUST appear at its station in under 2 seconds at p90, measured from send to display.

**Old scenario** "Test service latency":

> GIVEN a test service with normal peak traffic
> WHEN latency is measured for all sends
> THEN the p90 from send to station display is under 2 s

**Design sentence used**: p90 timing waits for a display. The hub must see the id on commit.

**Replacement MUST**: the hub MUST receive the send id on commit. A p90 display measurement MUST wait for a display.

**Replacement scenario**: when a product send commits, the hub has received the send id, and a p90 display measurement waits for a display. The scenario does not claim that a 2 second p90 was measured.

### Kitchen — scenario "Remote cloud link not involved (hybrid)"

**Old sentences**:

> GIVEN a hybrid site whose internet is slow or cut
> WHEN a waiter sends a product
> THEN delivery to the station does not wait for the cloud

**Design sentence used**: local-node returns 403 DiningRoomRejected and stores nothing. Hybrid node operation, SQLite, outbox, sync, and a cut are deferred (D-37).

**Replacement heading**: Send rejected on the local node

**Replacement**: a send posted on the local node returns 403 DiningRoomRejected and nothing is stored.

### Kitchen — scenario "Locked phone"

Requirement "Ready Notice" was left unchanged. Scenario "Waiter notified" was left unchanged.

**Old sentences**:

> GIVEN W's phone is locked
> WHEN a line becomes ready
> THEN the notice is delivered by the mechanism chosen in the 0.1 spike

**Design sentence used**: No locked-phone notice (PA-30). The domain still emits the notice.

**Replacement**: when the ready notice is published, the notice carries the table id, and a locked-phone delivery mechanism is outside this change (PA-30).

### Kitchen — requirement "Kitchen During an Internet Cut"

**Old requirement sentence**:

> In hybrid mode the station screens, printers and notices MUST keep working through the node. In cloud mode the kitchen SHALL be stopped.

**Old scenario** "Hybrid kitchen offline":

> GIVEN a hybrid site without internet
> WHEN a line is sent
> THEN the station receives it via the node and later events sync to the cloud

**Old scenario** "Cloud mode kitchen offline":

> GIVEN a cloud-mode site without internet
> WHEN the kitchen display is opened
> THEN it shows that the service is unavailable

**Design sentence used**: local-node returns 403 DiningRoomRejected and stores nothing. Hybrid node operation, SQLite, outbox, sync, and a cut are deferred (D-37).

**Replacement**: the requirement now says the local node MUST reject kitchen routes with 403 DiningRoomRejected and MUST store nothing, and that hybrid node operation, SQLite, outbox, sync, and a cut are deferred (D-37).

**Replacement scenarios**: "Kitchen routes rejected" and "Kitchen routes store nothing". Both state the same designed outcome: a kitchen route on the local node returns 403 DiningRoomRejected and nothing is stored. They do not claim station delivery through the node or a later sync. They do not claim a client-unavailable screen.

## Specs Synced

Neither main spec existed. Each change spec is a full spec (no ADDED, MODIFIED, REMOVED, or RENAMED sections). The reconciled files were copied. This merge adds requirements. It does not delete existing main-spec requirements. `openspec/config.yaml` `rules.archive` ("Warn before merging destructive deltas") does not apply as a destructive merge.

| Domain | Action | Details |
|--------|--------|---------|
| dining-room | Created | Full spec copied. 7 requirements. 0 modified, 0 removed, 0 renamed in a prior main spec. Before copy: scenario "Stamped during a cut (hybrid)" replaced; requirement "Operation During an Internet Cut" and both of its scenarios replaced. |
| kitchen | Created | Full spec copied. 7 requirements. 0 modified, 0 removed, 0 renamed in a prior main spec. Before copy: Delivery Latency p90 MUST and scenario "Test service latency" replaced; scenario "Remote cloud link not involved (hybrid)" replaced; scenario "Locked phone" replaced; requirement "Kitchen During an Internet Cut" and both of its scenarios replaced. |

Source of truth:

- `openspec/specs/dining-room/spec.md`
- `openspec/specs/kitchen/spec.md`

`openspec/specs/tax-engine/spec.md` and `openspec/changes/archive/2026-10-28-p1-04-tax-engine/` were not edited.

## Residual Warnings (not blocking)

These remain from the verify report. Their scenarios were not rewritten. This archive does not treat them as resolved:

- The empty check from open is not saved.
- A joined origin and a mixed course cannot be rebuilt.
- A held combo returns as a product.
- Station output and the red threshold stick to the first product.
- The deliver URL is not named in the design.
- `organization.structure` is yes for the owner only.
- SSE has no LISTEN.
- The printer-only ticket body is not on the SSE stream.
- `api-cloud` `tsc --noEmit` exited 1 on stale composite `dist`.
- Units 2, 8, 9, 13, 14, 15, 16, 18, 19, 20, 21, and 22 exceeded 400 lines without `size:exception`.
- The proposal's p90 and hybrid-cut checkboxes stay open because those behaviors are deferred.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, no CRITICAL), reconciled on the hybrid, latency, and locked-phone scenarios, synced, and archived. Active `openspec/changes/` no longer contains `p1-02-dining-room-and-kitchen`.
