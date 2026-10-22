# Tasks: Identity and Devices

## Review Workload Forecast

2400–3400. 1→7. ask-on-risk.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

`it` titles: given/when/then. Leave `strict_tdd` and `layer`. D-37 cloud only. D-38 enroll once.

### Work units

PR 1 base = `p0-04-identity-and-devices`. Later PRs chain.

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain | PR 1 | `platform` |
| 2 | Identity | PR 2 | `platform` |
| 3 | Devices | PR 3 | `platform` |
| 4 | Postgres | PR 4 | PGlite |
| 5 | Identity HTTP | PR 5 | `api-cloud` |
| 6 | Devices HTTP | PR 6 | `api-cloud` |
| 7 | Node | PR 7 | `local-node` |

## Phase 1: Domain

- [x] 1.1 RED `contexts/platform/domain/identity.test.ts`: enrolled factor required; bad code, no session; `PinAttemptsLocked` at five; good PIN replaces session; hashed five-minute code; five-redeem lock; reuse refused; fixed station, no PIN; deactivate ends sessions; no secret snapshot.
- [x] 1.2 GREEN `domain/user.ts`, `device.ts`, `identity.ts`, `domain/index.ts`. Prefixes `user_`, `device_`, `session_`, `registration_`. Keys `sessionId`, `userId`, `displayName`, `deviceId`, `venueId`, `kind`. Keep `layer`. Update skeleton.

## Phase 2: Identity

- [x] 2.1 RED `application/operate-identity/operate-identity.test.ts`: `signInAdministration`, `enrollSecondFactor`, `requireSecondFactor`, `startPinSession`, `recordActivity`, `deactivateUser`. `siteOffline` and refusal skip `save`. Idle lock. Switch shows new name. Unregistered denied.
- [x] 2.2 GREEN `operate-identity.ts`, `application/ports/identity-repository.ts` (`load`, `save`), `password-hasher.ts`, `pin-hasher.ts`, `second-factor.ts`, `clock.ts`, memory doubles, `entry-port.ts`, `#application/operate-identity/*`, `#adapters/crypto/*`, uncalled `slow-salted-hasher.ts`.
- [x] 2.3 RED `application/ports/identity-repository.contract.ts`, memory contract: round-trip; tenant A hides B; no secrets.
- [x] 2.4 GREEN: memory passes. Update skeleton. No `use-case` folder.

## Phase 3: Devices

- [ ] 3.1 RED `application/operate-devices/operate-devices.test.ts`: `issueRegistrationCode`, `registerDevice`, `revokeDevice`, `openFixedStation`, `authorizeOperation`. Sign minus signature. Unsigned, bad, revoked, `siteOffline` do not save. One station. Other station refused. No queue.
- [ ] 3.2 GREEN `operate-devices.ts`, `application/ports/signature-verifier.ts`, fast verifier, `adapters/crypto/node-public-key-verifier.ts`, `#application/operate-devices/*`. Store `public_key`. Update skeleton.

## Phase 4: Postgres RLS

- [ ] 4.1 RED `adapters/postgres/drizzle-identity-repository.contract.test.ts`: PGlite, `0003_identity.sql`. `identity_app` SELECT without `tenant_id` returns one tenant. No mock. No secrets.
- [ ] 4.2 GREEN `schema.ts`, `0003_identity.sql`, `drizzle-identity-repository.ts`. `users`, `devices`, `registration_codes`, `sessions`, `identity_changes`. Forced RLS. `save` sets `identity_app` and `app.tenant_id`. Hash and `public_key` columns.
- [ ] 4.3 Export from `contexts/platform/package.json`. Update skeleton.

## Phase 5: Identity HTTP

- [ ] 5.1 RED `apps/api-cloud/src/operate-identity.controller.test.ts`: inject `POST /tenants/:tenantId/identity`, `x-session-id` → 200; 400 and 409 write nothing. Six keys only. No `listen`.
- [ ] 5.2 GREEN controller, `create-application.ts`, `application-module.ts`, `shared/contracts/identity.ts`, `index.ts`, `postgres-identity.ts`. Zod. Memory in tests.

## Phase 6: Devices HTTP

- [ ] 6.1 RED `apps/api-cloud/src/operate-devices.controller.test.ts`: inject `POST /tenants/:tenantId/devices` → 200; 400 and 409 write nothing. Unsigned and `siteOffline` do not save.
- [ ] 6.2 GREEN controller, `shared/contracts/devices.ts`, `index.ts`. Zod. No platform import.

## Phase 7: Node 403

- [ ] 7.1 RED `apps/local-node/src/operate-identity.controller.test.ts`: POST → 403 `IdentityCommandRejected`; nothing stored.
- [ ] 7.2 GREEN reject controller and `application-module.ts`. No repository. No SQLite.
- [ ] 7.3 RED `apps/local-node/src/operate-devices.controller.test.ts`: POST → 403 `DeviceCommandRejected`; nothing stored.
- [ ] 7.4 GREEN reject controller.
- [ ] 7.5 `tools/skeleton/skeleton.test.ts`: allow new files. `apps/venue-app` absent. Keep `shared/sync`, SQLite, cursor, outbox, pairing, `apps/admin-web` absent.
