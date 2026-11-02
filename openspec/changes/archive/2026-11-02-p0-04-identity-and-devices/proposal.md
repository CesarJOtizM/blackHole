# Proposal: Identity and Devices

## Intent

Staff use shared devices and their own phones on a Wi-Fi network that customers may share (TRD-00 10.1–10.1.2). The system must know who operates, on which registered device, and cut access instantly when someone leaves (PRD-M0 HU-M0-02, HU-M0-03; PRD-01 8.5, 10).

## Scope

### In Scope
- Administration session in the cloud: email, password and second factor.
- Personal PIN session on registered devices, quick user switch, inactivity lock, PIN attempt limits.
- Device registration with a single-use QR, per-device non-exportable signing key, fixed kitchen-station devices.
- Personal phones: on-premises presence check, no business data stored.
- Immediate revocation of a device or user, on the node even offline.
- Node protection on shared Wi-Fi: unregistered devices get only the registration screen and cannot print.

### Out of Scope
- Role matrix, scopes, limits and supervisor PIN authorization → 0.5.
- Tamper-evident chain for these events → 0.6.
- "No clock-in, no operation" rule (M8) → 1.9.
- Print queue and templates → 1.6.
- Support access token issued by M7 → 0.5 (grant) / 4.5 (panel).

## Capabilities

### New Capabilities
- `identity`: administration and PIN sessions, user deactivation.
- `device-registry`: registration, signing credential, presence, revocation, node protection.

### Modified Capabilities
None

## Approach

Domain entities `User` and `Device` in `contexts/platform/domain`; session and device use cases with in-memory adapters first; signature verification and PIN hashing behind ports (`SignatureVerifier`, `PinHasher`). Cloud-only admin auth adapter in `api-cloud`. Node copy of users, PIN hashes and devices of its site; deactivation and revocation are the only node-owned exceptions (TRD-00 10.2).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/domain` | Modified | `User`, `Device`, session rules |
| `contexts/platform/application` | Modified | PIN session, registration, revocation use cases |
| `contexts/platform/adapters/{crypto,http,sqlite,postgres}` | New/Modified | Signature, hashing, controllers, stores |
| `shared/contracts` | Modified | Session, registration and revocation schemas |
| `apps/api-cloud` | Modified | Admin auth adapter, device endpoints for cloud mode |
| `apps/local-node` | Modified | PIN and device endpoints; reject unsigned traffic |
| `apps/venue-app`, `apps/admin-web` (planned) | New | PIN, QR scan, revoke screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Local HTTPS outcome changes the device channel: PA-29 (ADR-003) | Med | Depends on p0-01 decision |
| Who must use a second factor | Low | The administrator requires it for everyone or for the people they mark. Anyone else may turn it on (D-38) |
| TRD-00 allows off-premises use when a cloud site has no local equipment; PRD-M0 rule 7 forbids it | Med | Master wins; exception specified and flagged |
| iOS evicts PWA storage | High | Phone stores only session and credential |

## Rollback Plan

Feature-flag enforcement per site during validation; revert commits otherwise. Revoked credentials stay revoked; no data on phones to clean.

## Dependencies

- p0-01 (ADR-003, ADR-006); p0-03 sites.

## Success Criteria

- [ ] A phone not registered on the site network cannot use the node or print; a revoked one stops operating instantly.
- [ ] Revoking a user on an offline node ends their sessions in under 5 seconds.
- [ ] Playwright journey: register a phone, sign in with PIN, revoke it.
