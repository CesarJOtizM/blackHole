# Proposal: Organization

## Intent

Sales, invoicing and inventory need the customer structure first: company, taxpayers with tax profile, brands, sites, kitchen stations, cash registers, warehouses and each site's mode (PRD-00 5, PRD-M0 HU-M0-01, TRD-00 4, TRD-M0 2). The pilot (6 sites, their NITs and warehouses) must be loadable and reach each hybrid node.

## Scope

### In Scope
- Company, taxpayers (NIT unique within a company, tax profile reference), brands, sites, kitchen stations, cash registers.
- Inventory locations: exactly one point per site, optional site warehouses, optional general warehouse.
- Site mode shown and managed as part of the structure.
- Structure owned by the cloud; per-site copy pushed to the node through the config cursor.
- Organization-changed events with actor and before/after.
- Pilot structure loaded.

### Out of Scope
- Users, roles and the last-owner rule → 0.4 / 0.5.
- Tamper-evident audit chain → 0.6.
- Tax rules behind the profile → 1.4.
- DIAN numbering ranges → 1.5.
- Menus per brand → 1.1.
- Guided onboarding (M7 `CreateOrganization`) → 4.4.
- General warehouse node (ADR-010, D-04) → 2.5.

## Capabilities

### New Capabilities
- `organization`: customer structure and its invariants.

### Modified Capabilities
- `operating-mode`: site mode as structure attribute; structure copy reaches the node on activation.

## Approach

Thin domain in `contexts/platform/domain` (one taxpayer per site, one point per site, stations without stock), a `Structure` use case in the cloud only, repositories per dialect, and config-stream publication reusing `shared/sync`. Admin screens in `apps/admin-web`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/domain` | Modified | Organization entities and invariants |
| `contexts/platform/application` | Modified | `Structure` use case, repository ports |
| `contexts/platform/adapters/{postgres,sqlite,memory,http}` | Modified | Tables with `tenant_id` and RLS in PostgreSQL; site-only copy in SQLite |
| `shared/contracts` | Modified | Organization schemas and `OrganizationChanged` event |
| `apps/api-cloud`, `apps/local-node` | Modified | Bind repositories; node is read-only for structure |
| `apps/admin-web` (planned) | New | Structure screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tax profile is selected per taxpayer (D-09, ADR-009) | Med | Store a profile reference; engine in 1.4 |
| Pilot data incomplete (NITs, warehouses) | Med | Load script validated with owner |
| Node gets other sites' data | Low | Per-site stream; contract test |

## Rollback Plan

Structure tables are additive. Revert commits and drop new tables in staging; production has no customer data before the pilot load.

## Dependencies

- p0-02 operating mode and config cursor.

## Success Criteria

- [ ] The full pilot structure (6 sites, their NITs and warehouses) is loaded.
- [ ] Each site operates in cloud mode; when hybrid is activated, that structure reaches its node.
- [ ] A second invoicing taxpayer cannot be attached to a site implicitly.
