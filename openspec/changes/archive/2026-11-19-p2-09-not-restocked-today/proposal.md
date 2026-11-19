# Proposal: Not Restocked Today (Roadmap 2.9)

## Intent

A table can wait for a dish that will never come out. The system proposes, and a person confirms, that a dish will not be restocked this service: it leaves the menu, unstarted lines leave the queue, affected waiters are notified at once and confirm the customer was told (PRD-00 M4 and rule 1, PRD-M4 HU-M4-05 and rule 8, PRD-M1 rule 5, TRD-M4 sec. 4 and 7).

## Scope

### In Scope
- System proposal when the point, the supplying warehouses and in-transit transfers cannot cover one more portion.
- Confirmation by kitchen chief or site administrator; removal of the mark.
- Dish blocked for sending (waiter and QR table orders) until end of service or removal.
- Withdrawal of sent-but-unstarted lines, not charged, with inventory returned.
- Kitchen marking a started line it cannot finish, recorded as waste.
- Instant waiter notice through the "order ready" channel; "customer notified" confirmation; audit.

### Out of Scope
- Marking the dish sold out on delivery platforms and notifying the platform → 3.2 / 3.3 / 3.4.
- Reporting of withdrawals in control reports → 2.10 / 4.1.

## Capabilities

### New Capabilities
- `dish-withdrawal`: proposal, confirmation, menu block, queue withdrawal, waiter notice, customer-notified confirmation.

### Modified Capabilities
None

## Approach

`contexts/inventory` owns the mark and emits `AvailabilityChanged` with the not-restocked flag (`shared/contracts`). `contexts/orders` reacts in-process: rejects new lines, withdraws unstarted ones and notifies each table's waiter over the "order ready" WebSocket channel. Hybrid sites run it on `apps/local-node` (SQLite), offline included; on reconnection the event stops the cloud from offering the dish. Cloud-mode sites run it on `apps/api-cloud` (PostgreSQL).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | New | Not-restocked mark, proposal rule |
| `contexts/inventory/application` | New | Propose, confirm, remove |
| `contexts/orders/application` | Modified | Block sending, withdraw lines, notice, customer notified |
| `shared/contracts` | Modified | Not-restocked flag on `AvailabilityChanged` |
| `apps/local-node`, `apps/api-cloud` | Modified | Wiring, waiter WebSocket notice |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A bad count cancels orders | Medium | Nothing is withdrawn without human confirmation |
| Waiter misses the notice | Medium | Sound and screen; pending "customer notified" stays visible |
| QR order queued in cloud during outage | Medium | Applied on reconnection and rejected for the marked dish |

## Rollback Plan

Disable proposals and confirmation per site by configuration; existing marks expire at end of service. Withdrawn lines remain recorded as not charged with their inventory return, so no data reversal is needed.

## Dependencies

- p2-07 (availability event), p2-05 (in-transit transfers), p2-02 (return and waste), p1-02 (kitchen queue, waiter notices), p1-12 (QR orders).

## Success Criteria

- [ ] A marked dish leaves the menu and the affected waiters receive the notice instantly.
- [ ] Without a human confirmation no line is withdrawn.
- [ ] A hybrid site applies the mark and notices during an outage.
