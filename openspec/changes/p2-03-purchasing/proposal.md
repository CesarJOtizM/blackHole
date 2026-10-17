# Proposal: Purchasing

## Intent

Stock and cost are only real when purchases enter at what was actually paid (PRD-M4 rule 5, PRD-00 sec. 6.6). Many suppliers (e.g. the market square) do not invoice, so the taxpayer needs a DIAN support document through Factus; invoicing suppliers should not be typed twice.

## Scope

### In Scope
- Suppliers, purchase orders, receiving against an order or direct, at a warehouse or the point-of-sale location.
- Receipt at real cost with purchase-to-base unit conversion; weighted average cost per location.
- Support document through Factus for non-invoicing suppliers (TRD-00 sec. 8.2), deferred while offline.
- Upload of supplier e-invoice XML through Factus, mapped to ingredients, confirmed by the location owner.

### Out of Scope
- Purchase order from a shortage alert with one tap → 2.8. Suggested levels from supplier lead time → 2.8.
- Purchase exports for the accountant → 4.2. Accounting itself (PRD-00 out of scope).

## Capabilities

### New Capabilities
- `purchasing`: suppliers, purchase orders, receiving at real cost, average cost, support document, supplier e-invoice intake.

### Modified Capabilities
None

## Approach

Orders and receipts run on the location owner (TRD-M4 sec. 4): `local-node` for hybrid sites, `api-cloud` for cloud-mode sites and warehouses without a node. Support documents and XML uploads call the `invoicing` entry port in the cloud only, because Factus credentials never reach the node (TRD-00 sec. 8.2, TRD-M3 sec. 4); the resulting stock is written by the owner.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | Modified | Supplier, purchase order, average cost rule |
| `contexts/inventory/application` | Modified | Create order, receive, load supplier invoice |
| `contexts/invoicing/application` | Modified | Issue support document, upload reception |
| `contexts/invoicing/adapters/factus` | Modified | `support-documents/validate`, `receptions/upload` |
| `shared/contracts` | Modified | Receipt and support document events |
| `apps/web-admin`, site PWA | New | Purchasing and receiving screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Supplier e-invoice intake is "to be evaluated" in PRD-00/PRD-M4 but in roadmap scope | Med | Roadmap wins; accountant validates early |
| Whether VAT is part of cost is undefined | High | Open question to accountant before apply |
| Support document numbering range missing | Med | Block issuance with alert; stock still received |
| Each support document consumes a bundle document | Low | Counted in the bundle counter (p1-05) |

## Rollback Plan

Disable purchasing endpoints by flag. Receipts already recorded stay as ledger movements; corrections are compensating movements. Support documents already accepted by DIAN cannot be reverted and stay recorded.

## Dependencies

- p2-02 ledger, p1-05 Factus adapter and bundle counter, a DIAN support-document numbering range per taxpayer, p0-05 permissions.

## Success Criteria

- [ ] One week of real purchases is recorded, including those from suppliers that do not invoice.
- [ ] Each non-invoicing purchase has an accepted support document.
- [ ] Average cost changes only with real-cost entries.
