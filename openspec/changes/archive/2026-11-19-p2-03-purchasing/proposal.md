# Proposal: Purchasing

## Intent

Stock and cost are only real when purchases enter at the amount recorded on receipt (D-15, PRD-M4). Factus is for sales. Supplier e-invoices and DIAN support documents stay outside this system (D-14).

## Scope

### In Scope
- Suppliers, purchase orders, receiving against an order or direct, at a warehouse or the point-of-sale location.
- Receipt at the recorded cost with purchase-to-base unit conversion; weighted average cost per location. Purchase VAT is not split out.

### Out of Scope
- Supplier e-invoice intake and DIAN support documents (D-14).
- Purchase order from a shortage alert with one tap → 2.8. Suggested levels from supplier lead time → 2.8.
- Purchase exports for the accountant → 4.2. Accounting itself (PRD-00 out of scope).

## Capabilities

### New Capabilities
- `purchasing`: suppliers, purchase orders, receiving at recorded cost, average cost.

### Modified Capabilities
None

## Approach

Orders and receipts run on the location owner (TRD-M4 sec. 4): `local-node` for hybrid sites, `api-cloud` for cloud-mode sites and warehouses without a node. Receipt does not call Factus.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | Modified | Supplier, purchase order, average cost rule |
| `contexts/inventory/application` | Modified | Create order, receive |
| `shared/contracts` | Modified | Receipt events |
| `apps/admin-web`, site PWA | New | Purchasing and receiving screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Recorded cost includes non-creditable VAT (D-15) | Med | Store the amount entered; do not split purchase VAT |

## Rollback Plan

Disable purchasing endpoints by flag. Receipts already recorded stay as ledger movements; corrections are compensating movements.

## Dependencies

- p2-02 ledger, p0-05 permissions.

## Success Criteria

- [ ] One week of real purchases is recorded at the entered cost.
- [ ] Average cost changes only with those receipts. Purchase VAT is not split out.
