# Proposal: Dining Room and Kitchen

## Intent

Waiters take orders on their phone and each product reaches its station without passing through the cash register (PRD-M1 HU-M1-01, HU-M1-03). Time events captured from day one feed PRD-00 sec. 8.1.

## Scope

### In Scope
- Table map by zone and table states.
- Order taking on phone or fixed point; courses; resend.
- Routing to station screen, kitchen-ticket printer or both; cash register always sees the account.
- Kitchen display with traffic light; in preparation, ready, delivered; ready notice.
- Printer failure: ticket stays on screen, cash register alerted.
- Move table, join tables, transfer products.
- Bill request (state and pre-bill request).
- Node-clock timestamps for all dine-in metrics of PRD-00 sec. 8.1.

### Out of Scope
- Voids, discounts, courtesies, price change, transfer to another waiter, edits after the pre-bill → 1.7.
- Payment, account split, table "to clean" on payment → 1.3.
- Pre-bill template, print queue and backup printer → 1.6; pre-bill invoicing QR → 1.8.
- Table QR orders → 1.12. Time reports → 1.11.
- Stock consumption on send → 2.2; "not restocked today" and "cannot be delivered" → 2.9.
- Delivery and platform times → 3.1, 3.2.

## Capabilities

### New Capabilities
- `dining-room`: table map and states, order taking, courses, resend, move/join/transfer, bill request, time capture.
- `kitchen`: station routing, kitchen display, ticket printer output and fallback, line lifecycle, ready notice, latency.

### Modified Capabilities
None

## Approach

Bounded context `orders`: `Table`, `Order`, `OrderLine`, pure `Router` (TRD-M1 sec. 2). Runs on local-node in hybrid, api-cloud in cloud mode (TRD-00 sec. 6). WebSocket real time; `LISTEN/NOTIFY` across cloud instances. Sends and state changes hit the outbox in the same transaction.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/orders/domain`, `contexts/orders/application` | New | Table, order, line, router, use cases |
| `contexts/orders/adapters/{postgres,sqlite,http,websocket}` | New | Persistence, HTTP and real time |
| `shared/printing` | New | Minimal kitchen-ticket output through `Printer` port |
| `shared/contracts`, `shared/sync` | Modified | Line-state events, outbox |
| `apps/local-node`, `apps/api-cloud`, `apps/venue-app` | Modified/New | Hosts and PWA screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Notice with locked phone | High | Solution from 0.1 spike before build |
| p90 over 2 s under peak load | Med | Load test on node with SQLite peak data from 0.1 |
| Clock skew between devices | Med | Only node (or cloud) clock stamps states |

## Rollback Plan

Feature flag per site disables the dining-room screens; the site keeps its previous process. Revert additive migrations of `dining_tables`, `checks`, `orders`, `order_lines`. No sales exist yet, so no fiscal data is affected.

## Dependencies

- 1.1 catalog; 0.3 stations; 0.4 devices; 0.5 permissions; 0.6 audit; 0.1 notification spike (PA-30).

## Success Criteria

- [ ] In a test service, orders reach the kitchen in under 2 s (p90) and a 4-product order is taken in under 30 s.
- [ ] In hybrid mode, sending and kitchen keep working during an internet cut.
- [ ] Every line state change carries a node timestamp.
