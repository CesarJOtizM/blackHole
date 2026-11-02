# Proposal: Roles and Permissions

## Intent

Anti-theft control depends on deciding who can do what, where and up to how much, with another person authorizing sensitive actions (PRD-01 entirely; TRD-00 10.2; TRD-M0 2, 4). The decision must be taken by the server, identically on the node offline and in the cloud.

## Scope

### In Scope
- Permission catalog defined in code, each sensitive permission paired with its `.authorize` permission.
- Predefined roles (PRD-01 4) and the default matrix (PRD-01 6); custom roles copied from them.
- Scoped assignments (company, brand, site, warehouse, taxpayer) with validity windows.
- Limits (PRD-01 7) and site adjustments that only lower them.
- Pure evaluation: allowed, requires authorization, denied; routes declare their permission.
- Supervisor authorization by PIN on the same device or remotely, reason, expiry, per-shift self-authorization.
- No privilege escalation; at least one active owner; owner notified of role and limit changes.
- Support access granted by the owner with expiry.

### Out of Scope
- Wiring each module's sensitive action and control reports/unusual-behavior alerts → 1.7.
- "No clock-in, no operation" (M8) → 1.9.
- Support panel and M7 token issuance UI → 4.5.
- Tamper-evident storage of these events → 0.6.

## Capabilities

### New Capabilities
- `authorization`: catalog, roles, scopes, limits, evaluation, supervisor authorization, support access.

### Modified Capabilities
None

## Approach

Evaluation as a pure domain function in `contexts/platform/domain`, exposed through `application/entry-port.ts` (`EvaluatePermission`) for M1, M2, M4, M5 and M9. Role management use cases run only in api-cloud; the node evaluates with its site copy. One generated test per matrix cell drives the exit criterion. Remote requests travel over the node WebSocket locally and Web Push from the cloud.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/domain` | Modified | Permission catalog, roles, evaluation |
| `contexts/platform/application` | Modified | Role management, authorization requests, entry port |
| `contexts/platform/adapters/{http,ws,postgres,sqlite}` | Modified | Routes with declared permission, authorization gateway, stores |
| `shared/contracts` | Modified | Permission codes, authorization request schemas |
| `apps/api-cloud`, `apps/local-node` | Modified | Bind evaluation, route-permission check |
| `apps/venue-app`, `apps/admin-web` (planned) | New | Supervisor prompt, roles screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Default limits | Low | Adopted as the initial values; the site administrator authorizes (D-30) |
| Single-person shift | Low | Self-authorization, flagged and alerted, when that person is the only authorizer (D-30) |
| Bartender charging at the bar | Low | Permission exists and starts off in the pilot (D-22) |
| Matrix grows faster than tests | Med | Test generated from the catalog; build fails if a cell lacks one |

## Rollback Plan

Catalog and roles are additive data. Revert commits; existing predefined roles remain. A wrong default is fixed by a forward migration.

## Dependencies

- p0-04 users, PIN sessions and devices.

## Success Criteria

- [ ] Every permission in the matrix is proven by an automated case, and nobody can grant themselves more privileges than they hold.
- [ ] A supervisor cannot authorize their own void.
- [ ] A site-1 administrator cannot assign roles in site 2.
- [ ] A limit change reaches the owner as a notice.
