# Proposal: QR Table Ordering

## Intent

Customers should order from their own phone by scanning a fixed table QR, without installing anything, and the dish must reach the right kitchen station as fast as a waiter's order. Orders sent during an outage must enter the kitchen on reconnection exactly once (PRD-00 6.1.2, PRD-M1 HU-M1-02, TRD-00 6.4).

## Scope

### In Scope
- Fixed per-table QR identifying site and table, rotated only on reprint.
- Site menu on the customer's phone: prices, modifiers, sold-out items.
- Idempotent order intent stored in the cloud.
- Applying the intent: open the table or add to the open account, channel `qr_table`, kitchen routing.
- Optional cash-register acceptance per site (default direct).
- Cloud queue during an outage, applied on reconnection with current availability.
- Customer cannot void, discount or change prices.
- Pending-intent alert and QR channel visibility in the dining room.

### Out of Scope
- Paying from the QR → 1.13.
- Automatic sold-out from inventory → 2.7; "not restocked today" → 2.9 (the intent already respects whatever availability exists).
- Channel sales reports → 1.11 covers waiter vs QR table.

## Capabilities

### New Capabilities
- `qr-table-ordering`: table QR, customer menu, order intent, application, optional acceptance, outage queue.

### Modified Capabilities
- `dining-room` (delta): QR channel visibility on tables, accounts and kitchen tickets; pending-intent alert.

## Approach

The portal (`apps/customer-portal`, from 1.8) runs in api-cloud and never talks to the node (TRD-00 10.1.2). Intents are registered in the cloud and applied by the operation owner (local-node via sync in hybrid, api-cloud in cloud mode), keyed by UUID (TRD-M1 sec. 6), with availability evaluated at apply time.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/orders/domain`, `contexts/orders/application` | Modified | QR order intent, apply use case, table token |
| `contexts/orders/adapters` (postgres, sqlite) | Modified | Intent store with unique key |
| `apps/customer-portal` | Modified | Menu and cart under table token |
| `apps/api-cloud`, `apps/local-node` | Modified | Intent endpoints; apply on owner |
| `apps/site-app` | Modified | Acceptance queue, QR badge |
| `shared/contracts`, `shared/sync` | Modified | Intent schema, high-priority downstream event |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Photo of the QR used from outside | Med | Order stays on that table, staff see it, acceptance mode available (PRD-00 sec. 13) |
| Duplicate application after reconnection | Med | Unique intent key, contract tests on both dialects |
| Cloud-mode outage semantics: TRD-M1 says intents wait, yet the cloud owns the operation | Low | Spec holds routing until site devices reconnect; design confirms |

## Rollback Plan

A per-site flag disables the table token; the portal shows "ask your waiter". Pending intents are rejected with a customer-visible message. Waiter ordering is unaffected.

## Dependencies

- p1-01, p1-02, p1-08, p0-02, p0-07.
- Pilot decision on cash acceptance (PRD-M1 Q2).

## Success Criteria

- [ ] In a test service, a customer orders from their phone and the dish reaches the correct station. An order sent during an outage enters the kitchen on reconnection, without duplicates.
- [ ] The customer portal offers no void, discount or price change.
