# Apply progress: p0-04-identity-and-devices

Work units 1 through 7. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

Delivery: feature-branch-chain. Units 1 and 2 were already on tracker branch `p0-04-identity-and-devices` and were not committed. Units 3 through 7 were implemented on that same branch. The branch was not switched. Nothing was committed or pushed.

## Completed tasks

- [x] 1.1 RED `contexts/platform/domain/identity.test.ts`
- [x] 1.2 GREEN `contexts/platform/domain/user.ts`, `device.ts`, `identity.ts`, `domain/index.ts`, and the skeleton allowlist
- [x] 2.1 RED `contexts/platform/application/operate-identity/operate-identity.test.ts`
- [x] 2.2 GREEN `operate-identity.ts`, identity ports, memory doubles, `entry-port.ts`, package imports, and the uncalled slow hasher
- [x] 2.3 RED `application/ports/identity-repository.contract.ts` and the memory contract test
- [x] 2.4 GREEN: the memory repository passes the contract and the skeleton allowlist includes the new files
- [x] 3.1 RED `application/operate-devices/operate-devices.test.ts`
- [x] 3.2 GREEN `operate-devices.ts`, signature port, fast verifier, `node-public-key-verifier.ts`, and the skeleton allowlist
- [x] 4.1 RED `adapters/postgres/drizzle-identity-repository.contract.test.ts`
- [x] 4.2 GREEN schema, `0003_identity.sql`, and `drizzle-identity-repository.ts`
- [x] 4.3 Package export and skeleton allowlist
- [x] 5.1 RED `apps/api-cloud/src/operate-identity.controller.test.ts`
- [x] 5.2 GREEN identity controller, module wiring, Zod contract, and `postgres-identity.ts`
- [x] 6.1 RED `apps/api-cloud/src/operate-devices.controller.test.ts`
- [x] 6.2 GREEN devices controller and Zod contract
- [x] 7.1 RED `apps/local-node/src/operate-identity.controller.test.ts`
- [x] 7.2 GREEN node identity rejection. No repository
- [x] 7.3 RED `apps/local-node/src/operate-devices.controller.test.ts`
- [x] 7.4 GREEN node device rejection
- [x] 7.5 Skeleton allowlist. `apps/venue-app`, `apps/admin-web`, `shared/sync`, sqlite, cursor, outbox, and pairing stay absent

## Work Unit Evidence

### Unit 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/domain/identity.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  11 passed (11)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |
| Runtime harness command/scenario and exact result | N/A: this unit has no I/O. The aggregate does not open files, sockets, or a database. |
| Rollback boundary | `contexts/platform/domain/identity.test.ts`, `contexts/platform/domain/user.ts`, `contexts/platform/domain/device.ts`, `contexts/platform/domain/identity.ts`, the identity re-exports in `contexts/platform/domain/index.ts` (`layer` stays), and the skeleton declaration lines, domain export keys, and `apps/venue-app` absence. |

### Unit 2

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/application/operate-identity/operate-identity.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  20 passed (20)`. `pnpm vitest run --project platform contexts/platform/adapters/memory/in-memory-identity-repository.contract.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `pnpm vitest run --project platform contexts/platform/domain/identity.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  11 passed (11)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. `pnpm architecture` — exit 0. `no dependency violations found (77 modules, 138 dependencies cruised)`. |
| Runtime harness command/scenario and exact result | The use case and the memory repository run in-process. There is no socket, HTTP listener, or database. `SlowSaltedHasher` is not constructed and not called. |
| Rollback boundary | `contexts/platform/application/operate-identity/`, `contexts/platform/application/ports/{clock,password-hasher,pin-hasher,second-factor,identity-repository,identity-repository.contract}.ts`, `contexts/platform/adapters/memory/{fast-identity-doubles,in-memory-identity-repository,in-memory-identity-repository.contract.test}.ts`, `contexts/platform/adapters/crypto/slow-salted-hasher.ts`, the `OperateIdentity` export in `contexts/platform/application/entry-port.ts`, the `#application/operate-identity/*` and `#adapters/crypto/*` import map entries, and the skeleton declaration lines for those files. |

### Unit 3

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/application/operate-devices/operate-devices.test.ts contexts/platform/adapters/crypto/node-public-key-verifier.test.ts contexts/platform/domain/identity.test.ts contexts/platform/application/operate-identity/operate-identity.test.ts` — exit 0. `Test Files  4 passed (4)`. `Tests  41 passed (41)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. `pnpm architecture` — exit 0. `no dependency violations found (84 modules, 157 dependencies cruised)`. |
| Runtime harness command/scenario and exact result | The device use case and the fast verifier run in-process. The node verifier test signs one Ed25519 payload with `node:crypto` and checks accept and reject. No socket and no database. `SlowSaltedHasher` stays uncalled. |
| Rollback boundary | `contexts/platform/application/operate-devices/`, `contexts/platform/application/ports/signature-verifier.ts`, `contexts/platform/adapters/memory/fast-signature-verifier.ts`, `contexts/platform/adapters/crypto/node-public-key-verifier.ts` and its test, the `signFast` export, `revokeDevice` / `authorizeOperation` / `DeviceRevoked` / `revoked` / `failedRedeems`, the `#application/operate-devices/*` import, the entry-port device exports, and the skeleton declaration and domain export lines. |

### Unit 4

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-identity-repository.contract.test.ts contexts/platform/domain/identity.test.ts contexts/platform/application/operate-identity/operate-identity.test.ts` — exit 0. `Test Files  3 passed (3)`. `Tests  38 passed (38)`. `pnpm vitest run --project skeleton` — exit 0. `Tests  8 passed (8)`. `pnpm architecture` — exit 0. `no dependency violations found (86 modules, 169 dependencies cruised)`. |
| Runtime harness command/scenario and exact result | PGlite executes `0003_identity.sql`. `identity_app` selects `devices` with no tenant predicate and returns only tenant A. A failed PIN is saved and reloaded with `pinFailures` 1, then the real PIN still matches. Drizzle is not mocked. |
| Rollback boundary | `contexts/platform/adapters/postgres/0003_identity.sql`, the identity tables in `schema.ts`, `drizzle-identity-repository.ts` and its contract test, `Identity.toRecord` / `Identity.restore`, `UserRecord` / `DeviceRecord`, the package export `./adapters/postgres/drizzle-identity-repository`, and the skeleton declaration line. |

### Unit 5

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project api-cloud` — exit 0. `Test Files  4 passed (4)`. `Tests  18 passed (18)` immediately after the identity controller. The later full run, after devices wiring, stayed green: `Test Files  5 passed (5)`. `Tests  23 passed (23)`. |
| Runtime harness command/scenario and exact result | Nest Fastify `inject` posts `POST /tenants/:tenantId/identity` with `x-session-id`. No `listen`. Memory repository. 200 returns a session with the six keys. 400 and 409 leave the stored events unchanged. |
| Rollback boundary | `apps/api-cloud/src/operate-identity.controller.ts` and its test, `postgres-identity.ts`, `shared/contracts/identity.ts`, the identity providers in `application-module.ts`, and the memory identity exports used by the cloud tests. |

### Unit 6

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project api-cloud apps/api-cloud/src/operate-devices.controller.test.ts apps/api-cloud/src/operate-identity.controller.test.ts apps/api-cloud/src/bootstrap.test.ts` — exit 0. `Test Files  3 passed (3)`. `Tests  11 passed (11)`. Full `pnpm vitest run --project api-cloud` — exit 0. `Test Files  5 passed (5)`. `Tests  23 passed (23)`. |
| Runtime harness command/scenario and exact result | `inject` posts `POST /tenants/:tenantId/devices`. No `listen`. 200 shows the registration code once and the stored event omits it. 400, 409, an unsigned redeem, and `siteOffline` add no event. |
| Rollback boundary | `apps/api-cloud/src/operate-devices.controller.ts` and its test, `shared/contracts/devices.ts`, the devices controller and `SignatureVerifier` provider, and the fast signature verifier package export. |

### Unit 7

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project local-node` — exit 0. `Test Files  4 passed (4)`. `Tests  6 passed (6)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. `pnpm vitest run --project platform` — exit 0. `Test Files  14 passed (14)`. `Tests  84 passed (84)`. `pnpm architecture` — exit 0. `no dependency violations found (108 modules, 235 dependencies cruised)`. |
| Runtime harness command/scenario and exact result | Node `inject` posts identity and devices. Both return 403. `ApplicationModule` providers and imports stay empty. No repository and no SQLite. |
| Rollback boundary | `apps/local-node/src/operate-identity.controller.ts`, `operate-devices.controller.ts`, their tests, the controller list in `apps/local-node/src/application-module.ts`, and the local-node names in `tools/skeleton/skeleton.test.ts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 domain | `pnpm vitest run --project platform contexts/platform/domain/identity.test.ts` exit 1. `FAIL contexts/platform/domain/identity.test.ts` — `Cannot find module '#domain/identity.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `user.ts`, `device.ts`, `identity.ts`, and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  11 passed (11)`. |
| 1.2 skeleton | `pnpm vitest run --project skeleton` exit 1. `Test Files  1 failed (1)`. `Tests  2 failed \| 6 passed (8)`. The declaration list was missing `domain/device.ts`, `domain/identity.ts`, and `domain/user.ts`. The domain export keys were missing the identity aggregate and its errors. | Same command after the allowlist update: exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |
| 2.1 → 2.2 operate identity | `pnpm vitest run --project platform contexts/platform/application/operate-identity/operate-identity.test.ts` exit 1. `FAIL contexts/platform/application/operate-identity/operate-identity.test.ts` — `Cannot find module '#adapters/memory/fast-identity-doubles.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, ports, memory doubles, entry port, and import map: exit 0. `Test Files  1 passed (1)`. `Tests  20 passed (20)`. |
| 2.3 → 2.4 identity repository | `pnpm vitest run --project platform contexts/platform/adapters/memory/in-memory-identity-repository.contract.test.ts` exit 1. `FAIL contexts/platform/adapters/memory/in-memory-identity-repository.contract.test.ts` — `Cannot find module '#adapters/memory/in-memory-identity-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `InMemoryIdentityRepository`: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |
| 2.4 skeleton | `pnpm vitest run --project skeleton` exit 1. `Test Files  1 failed (1)`. `Tests  1 failed \| 7 passed (8)`. The declaration list was missing the slow hasher, the fast doubles, the memory identity repository, `operate-identity.ts`, and the identity ports (`clock`, `identity-repository`, `identity-repository.contract`, `password-hasher`, `pin-hasher`, `second-factor`). | Same command after the allowlist update: exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |
| 3.1 domain revoke and authorize, then devices | Domain: `pnpm vitest run --project platform contexts/platform/domain/identity.test.ts` exit 1. `Tests  2 failed \| 11 passed (13)`. `identity.revokeDevice is not a function`. `identity.authorizeOperation is not a function`. Devices: `pnpm vitest run --project platform contexts/platform/application/operate-devices/operate-devices.test.ts` exit 1. `Cannot find module '#adapters/memory/fast-signature-verifier.js'`. `Tests  no tests`. Node verifier: `pnpm vitest run --project platform contexts/platform/adapters/crypto/node-public-key-verifier.test.ts` exit 1. `Cannot find module '#adapters/crypto/node-public-key-verifier.js'`. `Tests  no tests`. | Domain plus the original 20 use-case tests: exit 0. `Test Files  2 passed (2)`. `Tests  33 passed (33)`. Devices, node verifier, domain, and operate-identity together: exit 0. `Test Files  4 passed (4)`. `Tests  41 passed (41)`. |
| 4.1 → 4.2 Postgres | `pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-identity-repository.contract.test.ts` exit 1. `Cannot find module '#adapters/postgres/drizzle-identity-repository.js'`. `Tests  no tests`. | Same command plus domain and operate-identity: exit 0. `Test Files  3 passed (3)`. `Tests  38 passed (38)`. |
| 5.1 → 5.2 identity HTTP | `pnpm vitest run --project api-cloud apps/api-cloud/src/operate-identity.controller.test.ts` exit 1. `"./adapters/memory/fast-identity-doubles" is not exported`. `Tests  no tests`. | `pnpm vitest run --project api-cloud` exit 0. `Test Files  4 passed (4)`. `Tests  18 passed (18)`. |
| 6.1 → 6.2 devices HTTP | `pnpm vitest run --project api-cloud apps/api-cloud/src/operate-devices.controller.test.ts` exit 1. `"./adapters/memory/fast-signature-verifier" is not exported`. `Tests  no tests`. | Devices, identity, and bootstrap: exit 0. `Test Files  3 passed (3)`. `Tests  11 passed (11)`. |
| 7.1 and 7.3 → 7.4 node | `pnpm vitest run --project local-node apps/local-node/src/operate-identity.controller.test.ts apps/local-node/src/operate-devices.controller.test.ts` exit 1. `Tests  2 failed (2)`. Both responses were 404. | `pnpm vitest run --project local-node` exit 0. `Test Files  4 passed (4)`. `Tests  6 passed (6)`. |
| 7.5 skeleton | The new local-node files were absent from the source list until this task. | `pnpm vitest run --project skeleton` exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. `pnpm architecture` exit 0. `no dependency violations found (108 modules, 235 dependencies cruised)`. `pnpm vitest run --project platform` exit 0. `Test Files  14 passed (14)`. `Tests  84 passed (84)`. |

## Deviations

The domain accepts hashes (`passwordHash`, `pinHash`, `factorHash`, `codeHash`) and does not generate or return a clear registration code. Hashing stays outside the aggregate, as the design keeps the domain pure. Showing the code once is left to operate-devices in phase 3, not to this identity use case. The issue result and the snapshot omit the hash. A code is accepted while `now` is below `issuedAt + 5 minutes` and rejected at that instant with `RegistrationCodeExpired`.

Five PIN failures lock the device. No lock duration was specified, so the lock stays until a later unit clears it. A correct PIN after the lock still throws `PinAttemptsLocked`. A correct PIN before the fifth failure resets the counter and replaces that device's session.

A fixed-station session uses `userId: ""` and the station display name. An administration session uses `deviceId: ""` and `venueId: ""`. Both still expose only `sessionId`, `userId`, `displayName`, `deviceId`, `venueId`, and `kind`.

`apps/venue-app` was added to the skeleton absent list. `apps/admin-web`, `shared/sync`, sqlite, cursor, outbox, and pairing were already absent and stay absent.

Unit 2 did not change the domain. Administration sign-in addresses `userId`; the aggregate has no email. `enrollSecondFactor` and `requireSecondFactor` both store a factor hash through `SecondFactor.enroll`. There is no separate "required before enrollment" flag. Once that hash is stored, `signInAdministration` calls `SecondFactor.verify` and the aggregate rejects a missing or wrong code.

Idle lock uses `Clock`. At `now >= lastActivity + idleLockMs`, `recordActivity` throws `SessionIdle` and does not save. The aggregate has no idle method, so the stored session remains until the next valid PIN replaces it. `siteOffline` blocks `startPinSession` and `recordActivity` only. Deactivation still saves while the site is offline.

A wrong PIN or a wrong second factor changes the aggregate, is saved, and then the error is rethrown. `Device` publishes `pinFailures` on its snapshot so attempts 1 through 4 are part of the event. A refusal that leaves the snapshot unchanged, including a PIN while the device is already locked, does not save.

`SlowSaltedHasher` lives in `adapters/crypto/slow-salted-hasher.ts` with `cost` unset. It has no hash method. Tests and application source do not import it.

Unit 3 added `revokeDevice`, `authorizeOperation`, and `DeviceRevoked` because the aggregate did not have them. The public device now includes `revoked`. The public registration code now includes `failedRedeems`, so a bad redeem changes the snapshot and is saved, then rethrown, the same way a bad PIN is saved. The original 11 domain tests and 20 identity use-case tests stayed green; the domain file now has 13 tests.

`OperateDevices` hashes the shown-once registration code with `PasswordHasher`. There is no separate code hasher in the task list. The clear code is returned by the use case and is absent from the saved event. `siteOffline` blocks every device command, including issuing a code, and does not save. Unsigned, bad, and revoked requests do not save. A bad redeem does save. A fixed station opens without a PIN. Asking for the other station throws `StationRefused` and does not save. The snapshot has no queue.

`NodePublicKeyVerifier` verifies Ed25519 SPKI keys. The HTTP and use-case tests use `FastSignatureVerifier`. One adapter test calls the node verifier. `SlowSaltedHasher` stays uncalled.

Postgres reloads hashes, `public_key`, and `pin_failures` through `Identity.toRecord` and `Identity.restore`. Events remain the public snapshot. `identity_app` with forced RLS returns one tenant when `app.tenant_id` is set and the SELECT has no tenant predicate.

Identity HTTP requires `x-session-id` and does not store that header. The response session has the six keys. Devices HTTP returns the registration code only on the response, not in the stored event. Zod contracts live in `shared/contracts` and do not import platform.

The node returns 403 `IdentityCommandRejected` or `DeviceCommandRejected`. Its module has no providers and no repository.

The workload forecast asked for chained PRs. This batch implemented units 3 through 7 on the existing branch because the assignment was those tasks and commits and branch switches were forbidden.

## Remaining tasks

None in this change. 20/20 tasks complete. Ready for verify. Not archived.

## Workload / PR boundary

- Mode: feature-branch-chain, work units 1 through 7 on tracker branch `p0-04-identity-and-devices`
- Current work unit: Node 403, completing the change
- Boundary: units 3–7 add device commands, PGlite RLS, cloud HTTP, and node 403. No p0-05 or p0-08 code
- PR target: not committed, not pushed, no PR opened
- Estimated review budget impact: above 400 lines across units 3–7. The change is ready to commit when a commit is requested
