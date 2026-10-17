# Proposal: Reservations

## Intent

Sites keep reservations in notebooks or chats, with no capacity check and no link to the floor plan. This change lets staff register reservations against slot availability, shows them on the floor plan, tracks arrival and no-show, and keeps working offline with provisional reservations (PRD-M9 HU-M9-01/02, PRD-00 sec. 6.3 and M9, TRD-00 sec. 6.2, TRD-M9).

## Scope

### In Scope
- Staff registration (phone, WhatsApp, in person): customer, phone, date, time, party size, zone or table, occasion, notes
- Availability by slot: capacity, estimated duration, reservable tables
- Day reservations on the floor plan; table blocked a configurable time before
- States: confirmed, customer arrived, no-show, cancelled, provisional, in conflict (pending payment reserved for 3.7)
- Arrival opens table and check in `orders`
- Provisional reservations without internet; conflict resolution by admin

### Out of Scope
- Charges, deposits, fees, refunds, payment expiry → 3.7
- Public booking link → 3.8
- Reservation reports → 3.9
- Confirmation and reminder messages → 5.1

## Capabilities

### New Capabilities
- `reservations`: registration, availability, lifecycle, floor-plan blocking, arrival, provisional and conflicts

### Modified Capabilities
None

## Approach

New `reservations` bounded context. The cloud owns `Reservation` and validates capacity. The node owns `ReservationSeating` (block, arrival, no-show) in hybrid mode; in cloud mode `api-cloud` owns both. Day reservations sync down to the node; attendance and provisional reservations sync up through the outbox.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reservations/{domain,application,adapters}` | New | Aggregates, use cases, PostgreSQL/SQLite repositories |
| `contexts/orders` | Modified | Blocked tables, open table from reservation |
| `shared/contracts`, `shared/sync` | Modified | Reservation events, day download |
| `apps/api-cloud`, `apps/local-node` | Modified | Composition and HTTP |
| `apps/venue-app`, `apps/admin-web` | Modified | Agenda, floor plan, settings |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Two provisional reservations for one slot | Med | Explicit conflict, human resolution |
| Day copy on node stale after cloud edits | Med | Push day changes over the site channel |
| Capacity model too simple for zones | Low | Reservable tables per zone |

## Rollback Plan

Hide reservations per site via flag; blocked tables are released. Tables are additive and do not affect orders history.

## Dependencies

- Organization (0.3), sync (0.2), dining room floor plan (1.2), permissions (0.5)
- Each venue chooses $0, a deposit applied to the bill with a retention percentage on cancel, or a non-refundable fee. Collection accounts are venue data (D-34).

## Success Criteria

- [ ] One week of reservations of a site managed in the system
- [ ] A reservation created during an internet cut becomes provisional and is confirmed or flagged in conflict on reconnect
- [ ] Arrival opens the table and check exactly once
