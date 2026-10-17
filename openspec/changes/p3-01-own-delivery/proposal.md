# Proposal: Own Delivery

## Intent

Sites take delivery orders by phone, WhatsApp and counter outside the system, so they cannot measure them like a table. This change lets staff create an own-delivery order with customer and address, send it to the kitchen, dispatch it with an own courier, confirm delivery and cash on delivery (COD), and reconcile the courier (PRD-M5 HU-M5-01, PRD-00 sec. 6.2, TRD-M5).

## Scope

### In Scope
- Delivery order with customer, phone, address and notes; channels phone, WhatsApp (staff-entered) and counter
- Courier PWA: assigned orders, delivery and COD confirmation
- Dispatch, delivery, stage timestamps (created, ready, dispatched, delivered)
- COD into the shift and end-of-shift courier reconciliation
- Delivery address on the invoice; plastic bag tax line when the site has it enabled and the order leaves the site (D-29)
- Cancellation (stock return or waste) and audit

### Out of Scope
- Platform orders, hub and manual capture → 3.2
- Delivery time reports → 3.9
- WhatsApp notifications to the customer → 5.1
- Route optimization (not in PRD-00)

## Capabilities

### New Capabilities
- `delivery`: own-delivery lifecycle, courier app, COD reconciliation, delivery invoicing rules

### Modified Capabilities
None

## Approach

New `delivery` bounded context with a `Delivery` aggregate (mandatory address, ordered stages). Creation calls the `orders` entry port to create an internal order; COD calls the `cash-register` entry port. In hybrid mode the node owns site-created deliveries and syncs them to the cloud for the courier; in cloud mode `api-cloud` owns everything. Courier app talks to the cloud over mobile data.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/delivery/{domain,application,adapters}` | New | Aggregate, use cases, SQLite/PostgreSQL repositories |
| `contexts/orders`, `contexts/cash-register` | Modified | Delivery channel, COD and courier reconciliation |
| `contexts/invoicing` | Modified | Delivery address on document |
| `shared/contracts` | Modified | Delivery schemas and events |
| `apps/api-cloud`, `apps/local-node` | Modified | Composition, HTTP + WebSocket for courier |
| `apps/delivery-app`, `apps/venue-app` | New / Modified | Courier PWA; delivery screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Courier outside site Wi-Fi during internet cut | High | Confirmation waits for connectivity; reconciliation tolerates late sync |
| COD cash lost between courier and drawer | Med | Per-courier reconciliation with audited differences |
| Bag tax rule for delivery unclear with accountant | Med | Each site turns the bag tax line on or off (D-29); when on, reuse the tax engine line |

## Rollback Plan

Feature flag per site disables the delivery channel; open deliveries are closed manually as regular orders. Tables are additive; no data from other contexts is migrated.

## Dependencies

- Dining room and kitchen (1.2), cash register (1.3), tax engine (1.4), electronic invoicing (1.5), sale consumption (2.2)
- Device registry for courier phones (0.4)
- Own delivery uses the same sales invoice (D-07), with the delivery address on the document.

## Success Criteria

- [ ] One week of own deliveries of a site, with times per stage
- [ ] A delivery created during an internet cut on a hybrid site completes and syncs without duplicates
- [ ] Courier COD reconciles against the shift
