# Proposal: Tax Engine

## Intent

The same dish must be taxed according to the taxpayer, the product classification and the date, without a code change when the law changes (PRD-M3 HU-M3-05; PRD-00 sec. 7.1). Menu prices include taxes; the engine breaks them down exactly as Factus does so the printed total matches the validated one (TRD-00 sec. 8.6).

## Scope

### In Scope
- Fiscal profile per taxpayer: person type, regime (ordinary or SIMPLE), VAT and INC responsibility, RUT responsibilities, franchise, municipality per site.
- Tax catalog: INC 8 %, VAT 19 % and 5 %, exempt, excluded, not taxed, plastic bag fixed value, ultra-processed tax, new taxes as records.
- Tax rules with validity dates combining profile, classification and context (channel, date, bag).
- Price-included breakdown: base, sequential taxes with banker's rounding, cash rounding up to ±500.
- Bag as an item line; tip outside the base; non-VAT-responsible means excluded.
- Corporate customer withholdings recorded on payment.
- Predefined profiles validated by the accountant.
- Each sale line keeps the rule and version applied.

### Out of Scope
- Sending documents to Factus → 1.5.
- Tax reports per taxpayer, period and type, and accountant export → 1.11 and 4.2.
- Deposit deduction on invoices → 3.7.

## Capabilities

### New Capabilities
- `tax-engine`: fiscal profiles, tax catalog, dated rules, price-included breakdown, rounding, bags, withholdings, predefined profiles, rule traceability.

### Modified Capabilities
None

## Approach

Pure function in `contexts/invoicing/domain` (TRD-M3 sec. 1-2): profile + classification + context → line taxes, using decimal arithmetic. Same code on the node offline and in the cloud. Rules and profiles are cloud-owned configuration copied to nodes through sync. The accountant-validated case table per regime becomes automated domain tests, compared against the Factus sandbox. Fiscal profile data extends the taxpayer from 0.3 (`platform`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/invoicing/domain` | New | Tax engine, profile, rule, catalog |
| `contexts/invoicing/application` | New | Rule management, profile templates |
| `contexts/invoicing/adapters/{postgres,sqlite,http}` | New | Rule storage and node copy |
| `contexts/cash-register/domain` | Modified | Withholdings on corporate payment |
| `shared/contracts` | Modified | Rule copy schema, line tax result |
| `apps/api-cloud`, `apps/local-node`, `apps/admin-web` | Modified | Hosts and admin screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rounding diverges from Factus | High | Replicate banker's rounding; sandbox comparison per case |
| Accountant answers are in D-07, D-08 and D-09 | Med | The exit criterion is the sandbox case table |
| Rule copy outdated on node | Med | Lines store rule version; audit reveals drift |

## Rollback Plan

The engine is additive and not yet used for emission. Revert to the previous rule version by publishing a record that ends the faulty rule's validity; code rollback removes the module without touching sales.

## Dependencies

- 0.3 taxpayers and sites; 1.1 tax classification; 1.3 payments; Factus sandbox credentials already held outside the repo (D-20). Tax profile selection is D-09.

## Success Criteria

- [ ] The case table per regime, validated by the accountant, passes as automated tests and matches Factus in the sandbox.
- [ ] A new tax rate goes live as a dated record, without deployment.
