# Proposal: Reservation Payment Gateway

## Intent

Reservation charges are confirmed by a person checking the bank app (ADR-012, PRD-M9). That costs staff time and delays confirmation. ADR-012 leaves an online gateway with automatic confirmation as a future improvement (PRD-00 M9; TRD-M9 sec. 1 "Fase 5").

## Scope

### In Scope
- Online payment of reservation deposit or fee through a gateway, from the public booking link or a payment link sent by staff.
- Automatic confirmation on a signed, idempotent gateway notification; amount fixed by the reservation.
- Payment link expiry releasing the held slot.
- Refunds per the copied policy through the gateway when supported; manual transfer otherwise.
- Per-site choice: manual verification, gateway, or both.
- Gateway reconciliation report.

### Out of Scope
- Table QR gateway (ADR-016, → 1.13): not shared (TRD-M9 sec. 10).
- Notification of confirmation (→ 5.1).
- Card terminal payments at the venue (→ 5.2).

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `reservation-payments`: adds gateway charge, automatic confirmation, link expiry, gateway refunds and reconciliation.

## Approach

Add a `ReservationGateway` port and one provider adapter in `contexts/reservations/adapters` (chosen in an ADR-012 revision). The cloud owns the charge and confirmation (TRD-M9 sec. 3); confirmed reservations reach the node in `DayReservations`. The deposit is still applied at the cash register only once (`ApplyDeposit`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reservations/domain` | Modified | Gateway charge states, expiry |
| `contexts/reservations/application` | Modified | Start charge, confirm, refund, reconcile |
| `contexts/reservations/adapters/reservation-gateway` | New | Provider adapter + in-memory double |
| `shared/contracts` | Modified | Gateway notification and charge schemas |
| `apps/api-cloud` | Modified | Webhook route, expiry worker |
| `apps/customer-portal` | Modified | Pay step in public booking |
| `apps/local-node` | Modified | Receives confirmed reservations only |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gateway provider not chosen | High | Port + in-memory adapter; ADR-012 revision first |
| c4-m9 names `PasarelaPagos` (table QR port) for this; TRD-M2/TRD-M9 say reservations do not use it | Med | TRD wins: separate port |
| Payment arrives after link expiry | Med | Confirm if slot available; else refund automatically |
| Gateway commission vs deposit | Low | Commission recorded per charge |

## Rollback Plan

Switch sites to manual verification. Gateway-paid reservations already confirmed stay confirmed; pending gateway charges expire and release slots.

## Dependencies

- ADR-012 revision with provider; 3.7 manual charges; 3.8 public booking link.

## Success Criteria

- [ ] Reservations are confirmed without manual verification.
- [ ] A duplicated gateway notification confirms once.
- [ ] A forged notification confirms nothing.
- [ ] Integration operates in at least 1 site (PRD-00 sec. 11 phase 5).
