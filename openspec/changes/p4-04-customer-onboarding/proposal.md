# Proposal: Customer Onboarding

## Intent

A new company must become ready to invoice by following only the guided setup, without engineering help (PRD-M7 HU-M7-01; TRD-00 sec. 8.4 NIT requirements; flujo m7 "Alta de una empresa").

## Scope

### In Scope
- Platform administrator creates company, taxpayers, sites, plan and first owner through the M0 organization entry port.
- Per-NIT Factus activation checklist: Chamber of Commerce (< 30 days), legal representative ID, RUT, DIAN numbering range, digital certificate; activation status.
- Readiness check per taxpayer: credentials authenticate and each site has a numbering range.
- Guided setup for the owner: brands, sites, kitchen stations, cash registers, warehouses, roles.
- Initial import of menu, ingredients and recipes; predefined tax profiles.
- Company document bag created at onboarding.

### Out of Scope
- Node installation and device registration — existing flows (→ 0.3, 0.4).
- Subscription charging (→ 4.3).
- Support panel (→ 4.5).
- First real non-pilot customer validation (→ 4.6).

## Capabilities

### New Capabilities
- `tenant-onboarding`: company creation, NIT activation checklist, guided setup, initial data import and predefined tax profiles.

### Modified Capabilities
None

## Approach

Cloud-only use cases in `contexts/saas/application` (`OnboardCompany`, `TrackTaxIdRequirements`, `ImportInitialCatalog`) that delegate to M0, M1 and M4 entry ports; M7 never writes their tables (TRD-M7 sec. 1). Import files go to object storage and are applied atomically per file. Factus readiness uses the invoicing entry port (token + `numbering-ranges`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/saas/domain` | Modified | `TaxIdRequirement`, onboarding progress |
| `contexts/saas/application` | Modified | Create company, track NIT, import |
| `contexts/platform/application/entry-port.ts` | Modified | Create organization and owner |
| `contexts/orders/application/entry-port.ts` | Modified | Bulk menu import |
| `contexts/inventory/application/entry-port.ts` | Modified | Bulk ingredient and recipe import |
| `contexts/invoicing/application/entry-port.ts` | Modified | Factus readiness check |
| `apps/api-cloud`, `apps/admin-web` | Modified | Backoffice and guided-setup screens (backoffice container open: PA-47) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Factus activation takes 1–3 business days | High | Site operates; e-invoices stay pending until NIT is ready |
| Bad import rows publish a partial menu | Med | All-or-nothing per file with row-level errors |
| Activation is a manual Factus process | Med | Checklist + automated readiness check, not an API activation |
| Flujo m7 says "support" creates companies; PRD-M7 says platform admin | Low | PRD wins: platform administrator |

## Rollback Plan

Onboarding is additive. A failed onboarding is reverted by deactivating the draft company through M0; imported files are deleted from object storage. No pilot tenant is touched.

## Dependencies

- 0.3, 1.1, 1.4, 1.5, 2.1 entry ports; 4.3 plans; Factus sandbox for readiness tests.

## Success Criteria

- [ ] A test company becomes ready to invoice by following only the guided setup.
- [ ] A NIT with a missing requirement is never marked ready.
- [ ] A file with one bad row publishes nothing.
- [ ] The platform administrator keeps no session inside the customer's operation.
