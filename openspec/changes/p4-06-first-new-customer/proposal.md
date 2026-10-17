# Proposal: First New Customer

## Intent

Prove blackHole is a product, not a pilot project: a restaurant outside the pilot is configured and operating without custom development (PRD-00 sec. 11 phase 4 exit; PRD-M7 sec. 2 "No incluye"; PRD-00 pilot risk).

## Scope

### In Scope
- Onboard one non-pilot restaurant using only the guided setup (4.4) and an active subscription (4.3).
- Verifiable no-custom-development rule: no tenant-specific code, branch or build.
- Gap register: any need that is not configuration is logged as product backlog, not built for this customer.
- Tenant isolation verified between the new customer and the pilot.
- Go-live in the customer's chosen mode (cloud by default; hybrid only if requested), with first invoice accepted and support panel visibility.

### Out of Scope
- Building any feature requested only by this customer (→ re-planned roadmap entry, if accepted for all).
- Phase 5 integrations: notifications, card terminals, reservation gateway, attendance photo (→ 5.1–5.4).
- Pilot six-site rollout (→ 2.11).

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `site-rollout`: adds the non-pilot customer rollout criteria — configuration-only setup, gap register, isolation and go-live checks.

## Approach

Run the onboarding checklist end to end with the customer's real data. The release pipeline (0.8) is the only code path: the deployed artifact is the same for every tenant. Isolation is verified with Row Level Security tests against the pilot tenant. The go-live checklist reuses 1.14 and adds subscription, NIT readiness and support-panel checks.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/saas` | Modified | Gap register and rollout checklist |
| `contexts/platform/adapters/postgres` | Modified | Isolation verification tests |
| `apps/api-cloud` | Modified | Rollout status in backoffice |
| `apps/local-node` | Modified | Only if the customer enables hybrid |
| `infra` | Modified | No tenant-specific resources allowed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Customer needs a pilot-specific behavior | High | Gap register; configuration or decline, never custom code |
| Tax regime not covered by predefined profiles | Med | Custom profile via configuration (4.4) |
| Factus activation delays go-live | Med | Start NIT checklist first; site may operate with pending invoices |
| Data leakage between tenants | Low | RLS isolation test is a go-live gate |

## Rollback Plan

The new tenant is additive. If go-live fails, suspend the subscription and deactivate the company through M0; issued documents are retained. Pilot tenants are unaffected because no shared code or configuration changes.

## Dependencies

- 4.1–4.5 complete; a signed non-pilot restaurant with NIT documents.

## Success Criteria

- [ ] The new customer is configured without custom development.
- [ ] The deployed artifact and commit are identical to the pilot's.
- [ ] Neither tenant can read the other's data.
- [ ] The first invoice of the new customer is accepted by Factus.
