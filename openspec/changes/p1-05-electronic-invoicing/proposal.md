# Proposal: Electronic Invoicing

## Intent

Every sale must have exactly one DIAN electronic sales invoice, issued through Factus, including when the internet drops mid-send (PRD-M3 HU-M3-01, HU-M3-03; TRD-00 sec. 8.1-8.4). No paper fallback and no aggregated invoices exist.

## Scope

### In Scope
- Factus adapter (OAuth2 per taxpayer, cloud only) behind an `InvoicingProvider` port.
- Final-consumer buyer, or ID card/NIT buyer with name and email autocompleted from DIAN at the cash register.
- Numbering range per site, or per cash register.
- Tip as a surcharge; payment methods mapped to DIAN codes.
- Deferred emission without internet (`pending_emission`), in sale order, under 80 requests/min per NIT.
- Uncertain-send verification by `reference_code` before any resend; rejection handling.
- Credit notes for voids or returns after emission.
- Document consumption counter per company, NIT and site, with yellow/red balance alerts; empty balance never blocks sales.

### Out of Scope
- Printing the invoice, receipt and their QR templates → 1.6.
- Customer data portal, masked autocomplete, re-invoicing → 1.8.
- Delivery address on final-consumer invoices → 3.1. Reservation deposits → 3.7.
- Document bundle pricing and recharge → 4.3. Support documents → 2.3.
- WhatsApp delivery of invoices → 5.1.

## Capabilities

### New Capabilities
- `e-invoicing`: sale document lifecycle, buyer, numbering, emission, deferred and uncertain handling, rejections, credit notes, consumption counter.

### Modified Capabilities
None

## Approach

Bounded context `invoicing` (TRD-M3). The operation owner (node in hybrid, cloud in cloud mode) creates `SaleDocument` with a UUIDv7 `reference_code` from the closed sale of 1.3 and taxes of 1.4. A cloud worker emits in sale order through a per-NIT rate limiter; results return as `EmissionResolved`. Documents sync with top priority. Factus credentials stay in the cloud secret manager.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/invoicing/{domain,application}` | New | Sale document, credit note, emission use cases |
| `contexts/invoicing/adapters/factus` | New | Anti-corruption layer for Factus |
| `contexts/invoicing/adapters/{postgres,sqlite}` | New | Documents, ranges, counters |
| `contexts/cash-register/application` | Modified | Request sale document on closure |
| `shared/sync`, `shared/contracts` | Modified | Top-priority document events |
| `apps/api-cloud` | Modified | Emission worker, limiter |
| `apps/local-node` | Modified | Local document creation |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate invoice after a cut | Med | Verify by `reference_code` before resend |
| Late invoicing without contingency | Med | 4G backup, automatic emission, aging alerts |
| Factus 429 at reconnection peak | Med | Shared per-NIT limiter; emission before queries |
| Accountant approval pending (TRD-00 8.4) | Med | Tracked; blocks production go-live only |

## Rollback Plan

Switch the provider to the simulated adapter: documents stay `pending_emission` and sales continue with receipts. Accepted documents are never deleted; corrections use credit notes.

## Dependencies

- 1.3 closed sales, 1.4 tax engine, 0.7 resilience, 0.8 secrets, Factus sandbox and production credentials, DIAN numbering ranges.

## Success Criteria

- [ ] Invoices accepted in sandbox and production, including an internet cut in the middle of a send without duplicate invoices.
- [ ] An empty document balance leaves invoices pending without blocking sales.
