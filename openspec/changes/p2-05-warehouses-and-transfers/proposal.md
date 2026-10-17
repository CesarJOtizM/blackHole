# Proposal: Warehouses and Transfers

## Intent

Sites are replenished from their own warehouse and from a general warehouse that serves several sites. Differences between what was dispatched and received get lost today, and the receiving site may be offline (PRD-M4 HU-M4-03, TRD-00 sec. 5.1 and 5.5, ADR-010 proposed in TRD-00 sec. 18).

## Scope

### In Scope
- Site warehouses (owned by the site) and company general warehouses, plus which warehouses supply each site.
- General warehouse on a node in warehouse profile (inventory, receiving, dispatch, voucher printing; no dining room or cash), or web-only without a node.
- Transfers: requested, dispatched, in transit, received, received with differences; same-node and two-owner (general→site, site→site).
- Two halves sharing one transfer ID; dispatch voucher with QR to receive offline.
- Replenishment request from the point of sale and suggestion by minimum stock.

### Out of Scope
- Full levels (reorder point), coverage alerts, one-tap replenishment from an alert → 2.8.
- Producible quantity with replenishment → 2.7.
- Transfer and difference reports → 2.10.

## Capabilities

### New Capabilities
- `warehouses-and-transfers`: warehouse locations and supply relations, warehouse node profile, transfer lifecycle, QR voucher reception, cross-owner reconciliation, replenishment suggestion.

### Modified Capabilities
None

## Approach

Each owner records only its half (TRD-M4 sec. 3, 7): origin writes transfer-out, destination writes transfer-in, reconciled by transfer ID through the cloud. `local-node` gains a warehouse profile that loads only inventory and printing. The voucher is printed via `shared/printing` with a QR holding the transfer detail; a registered device scanning it records the destination half before sync arrives.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | Modified | Transfer aggregate, replenishment suggestion |
| `contexts/inventory/application` | Modified | Request, dispatch, receive, receive with differences |
| `contexts/platform/domain` | Modified | Warehouse supply relation, warehouse node pairing |
| `shared/printing` | Modified | Transfer voucher with QR |
| `shared/sync` | Modified | Cross-node transfer half routing |
| `apps/local-node` | Modified | Warehouse profile |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Forged or reused QR | Med | Registered device only; unmatched receipts flagged at reconciliation |
| Transfer cost not specified in docs | Med | Origin average cost at dispatch; confirm with PO |
| Minimum/maximum overlap with 2.8 levels | Med | 2.5 defines min/max only; 2.8 extends |
| ADR-010 still "proposed" | Med | Accept ADR before apply |

## Rollback Plan

Disable transfer endpoints and the warehouse profile by flag; general warehouse falls back to web-only. Recorded halves stay in the ledger; open transfers are closed by compensating movements.

## Dependencies

- p2-02 ledger, p2-03 average cost, p0-04 devices, p0-07 node operation, p1-06 printing; ADR-010 accepted.

## Success Criteria

- [ ] One full replenishment cycle from the general warehouse completes, with a site offline at the moment of receiving.
- [ ] Every difference requires permission and stays visible.
