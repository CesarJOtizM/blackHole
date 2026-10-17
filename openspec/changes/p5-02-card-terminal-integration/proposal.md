# Proposal: Card Terminal Integration

## Intent

Today cashiers type the amount into the card terminal and copy the approval back (PRD-M2 rule 8). That invites typos and amount mismatches. ADR-007 (TRD-00 sec. 6.3, sec. 18) evaluates direct integration with the pilot's terminals — Credibanco, Bold and Redeban — so the amount travels to the terminal and the approval returns automatically.

## Scope

### In Scope
- ADR-007 decision per provider: which integration each offers (local LAN/USB, cloud API, none).
- One `CardTerminal` adapter per provider that supports it; manual adapter kept.
- Amount sent from the bill balance; approval, franchise and last 4 digits returned and recorded.
- Timeout/uncertain handling without double charge; cancellation.
- Manual fallback with reason; cash count per terminal using integrated records.

### Out of Scope
- Storing full card data (PCI DSS stays out of scope, TRD-00 sec. 6.3).
- Table QR payments (→ 1.13) and reservation gateway (→ 5.3).
- Providers that offer no integration: remain manual.

## Capabilities

### New Capabilities
- `card-terminal-integration`: per-provider terminal integration, amount push, approval return, uncertain-state recovery.

### Modified Capabilities
- `cash-register`: payment origin (integrated or manual), manual-entry reason on integrated terminals, cash count by terminal from integrated approvals.

## Approach

Implement adapters of the existing `CardTerminal` port in `contexts/cash-register/adapters` (TRD-M2 sec. 1). The payment is created where the cash register runs: node in hybrid, api-cloud in cloud mode. A terminal request carries a unique reference so status can be queried before any retry.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/cash-register/domain` | Modified | Terminal payment states, origin |
| `contexts/cash-register/application` | Modified | Charge via terminal, recover uncertain |
| `contexts/cash-register/adapters/credibanco`, `bold`, `redeban` | New | Provider adapters (as ADR-007 allows) |
| `shared/contracts` | Modified | Terminal payment schemas |
| `apps/local-node`, `apps/api-cloud` | Modified | Wire adapters per site terminal |
| `apps/venue-app` | Modified | Cash register terminal flow |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A provider exposes no usable integration | High | Manual adapter stays; criterion applies per integrated provider |
| Cloud-API terminal during hybrid outage | Med | Falls back to manual entry with reason |
| Double charge after timeout | Med | Status query by reference before retry |
| Hardware certification time | Med | Start ADR-007 talks early |

## Rollback Plan

Switch the site's terminal configuration back to the manual adapter. Payments already recorded keep their data; cash count logic accepts both origins.

## Dependencies

- PA-43 (ADR-007) decision; provider SDK/API access and test terminals at the pilot site.

## Success Criteria

- [ ] Card payments without typing the amount or the approval.
- [ ] A timeout never produces two charges for one payment.
- [ ] Integration operates in at least 1 site (PRD-00 sec. 11 phase 5).
