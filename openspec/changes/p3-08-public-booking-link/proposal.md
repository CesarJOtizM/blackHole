# Proposal: Public Booking Link

## Intent

Customers can only reserve by calling or writing, which depends on staff being free. This change publishes one booking link per site where customers pick slot and party size, see the policy and amount, and create the reservation themselves (PRD-M9 HU-M9-04, PRD-00 M9, TRD-00 sec. 6.2, TRD-M9 sec. 5 and 8).

## Scope

### In Scope
- Public link per site, mobile first, without customer account
- Availability by slot from the same cloud capacity rule
- Policy, amount and refund tiers visible before confirming; the shown policy is the one copied
- Reservation created with channel "public link"; payment remains staff-verified transfer
- Privacy: no listing of other reservations; Ley 1581 notice for personal data
- Abuse protection on submissions

### Out of Scope
- Online payment with automatic confirmation → 5.3
- Automatic confirmation and reminders to the customer → 5.1
- Booking link reports by channel → 3.9

## Capabilities

### New Capabilities
- `public-booking`: public per-site booking with visible policy

### Modified Capabilities
None

## Approach

A public HTTP entry in `api-cloud`, served by `apps/customer-portal`, calls the existing `CreateReservation` use case in `contexts/reservations` with channel "public link". It lives only in the cloud; the site receives the reservation in its day copy.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reservations/application` | Modified | Public channel, policy preview |
| `contexts/reservations/adapters/http` | New | Public endpoints without session |
| `shared/contracts` | Modified | Public availability and booking schemas |
| `apps/api-cloud` | Modified | Public routes, rate limiting |
| `apps/customer-portal` | Modified | Booking screens |
| `apps/web-admin` | Modified | Enable link, publish collection data |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Spam or fake bookings fill capacity | Med | Rate limits; unpaid charged bookings expire (3.7) |
| Personal data exposure | Low | No listing; only data the site published |
| Policy shown differs from copied | Low | Same policy version id in preview and creation |

## Rollback Plan

Disable the link per site; existing reservations remain and are handled by staff. No schema removal needed.

## Dependencies

- Reservations (3.6) and reservation payments (3.7)

## Success Criteria

- [ ] Real reservations created by customers from the link
- [ ] With no capacity, no reservation is created
- [ ] The policy shown is the one stored in the reservation
