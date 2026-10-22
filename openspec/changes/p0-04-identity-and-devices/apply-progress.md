# Apply progress: p0-04-identity-and-devices

Work units 1 and 2. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

Delivery: feature-branch-chain. Unit 1 is PR 1, targeting tracker branch `p0-04-identity-and-devices`. Unit 2 is PR 2, targeting the unit 1 branch. Neither batch was committed. The branch was not switched. Phases 3–7 were not implemented.

## Completed tasks

- [x] 1.1 RED `contexts/platform/domain/identity.test.ts`
- [x] 1.2 GREEN `contexts/platform/domain/user.ts`, `device.ts`, `identity.ts`, `domain/index.ts`, and the skeleton allowlist
- [x] 2.1 RED `contexts/platform/application/operate-identity/operate-identity.test.ts`
- [x] 2.2 GREEN `operate-identity.ts`, identity ports, memory doubles, `entry-port.ts`, package imports, and the uncalled slow hasher
- [x] 2.3 RED `application/ports/identity-repository.contract.ts` and the memory contract test
- [x] 2.4 GREEN: the memory repository passes the contract and the skeleton allowlist includes the new files

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

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 domain | `pnpm vitest run --project platform contexts/platform/domain/identity.test.ts` exit 1. `FAIL contexts/platform/domain/identity.test.ts` — `Cannot find module '#domain/identity.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `user.ts`, `device.ts`, `identity.ts`, and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  11 passed (11)`. |
| 1.2 skeleton | `pnpm vitest run --project skeleton` exit 1. `Test Files  1 failed (1)`. `Tests  2 failed \| 6 passed (8)`. The declaration list was missing `domain/device.ts`, `domain/identity.ts`, and `domain/user.ts`. The domain export keys were missing the identity aggregate and its errors. | Same command after the allowlist update: exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |
| 2.1 → 2.2 operate identity | `pnpm vitest run --project platform contexts/platform/application/operate-identity/operate-identity.test.ts` exit 1. `FAIL contexts/platform/application/operate-identity/operate-identity.test.ts` — `Cannot find module '#adapters/memory/fast-identity-doubles.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, ports, memory doubles, entry port, and import map: exit 0. `Test Files  1 passed (1)`. `Tests  20 passed (20)`. |
| 2.3 → 2.4 identity repository | `pnpm vitest run --project platform contexts/platform/adapters/memory/in-memory-identity-repository.contract.test.ts` exit 1. `FAIL contexts/platform/adapters/memory/in-memory-identity-repository.contract.test.ts` — `Cannot find module '#adapters/memory/in-memory-identity-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `InMemoryIdentityRepository`: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |
| 2.4 skeleton | `pnpm vitest run --project skeleton` exit 1. `Test Files  1 failed (1)`. `Tests  1 failed \| 7 passed (8)`. The declaration list was missing the slow hasher, the fast doubles, the memory identity repository, `operate-identity.ts`, and the identity ports (`clock`, `identity-repository`, `identity-repository.contract`, `password-hasher`, `pin-hasher`, `second-factor`). | Same command after the allowlist update: exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |

## Deviations

The domain accepts hashes (`passwordHash`, `pinHash`, `factorHash`, `codeHash`) and does not generate or return a clear registration code. Hashing stays outside the aggregate, as the design keeps the domain pure. Showing the code once is left to operate-devices in phase 3, not to this identity use case. The issue result and the snapshot omit the hash. A code is accepted while `now` is below `issuedAt + 5 minutes` and rejected at that instant with `RegistrationCodeExpired`.

Five PIN failures lock the device. No lock duration was specified, so the lock stays until a later unit clears it. A correct PIN after the lock still throws `PinAttemptsLocked`. A correct PIN before the fifth failure resets the counter and replaces that device's session.

A fixed-station session uses `userId: ""` and the station display name. An administration session uses `deviceId: ""` and `venueId: ""`. Both still expose only `sessionId`, `userId`, `displayName`, `deviceId`, `venueId`, and `kind`.

`apps/venue-app` was added to the skeleton absent list. `apps/admin-web`, `shared/sync`, sqlite, cursor, outbox, and pairing were already absent and stay absent.

Unit 2 did not change the domain. Administration sign-in addresses `userId`; the aggregate has no email. `enrollSecondFactor` and `requireSecondFactor` both store a factor hash through `SecondFactor.enroll`. There is no separate "required before enrollment" flag. Once that hash is stored, `signInAdministration` calls `SecondFactor.verify` and the aggregate rejects a missing or wrong code.

Idle lock uses `Clock`. At `now >= lastActivity + idleLockMs`, `recordActivity` throws `SessionIdle` and does not save. The aggregate has no idle method, so the stored session remains until the next valid PIN replaces it. `siteOffline` blocks `startPinSession` and `recordActivity` only. Deactivation still saves while the site is offline.

A wrong PIN or a wrong second factor changes the aggregate, is saved, and then the error is rethrown. `Device` publishes `pinFailures` on its snapshot so attempts 1 through 4 are part of the event. A refusal that leaves the snapshot unchanged, including a PIN while the device is already locked, does not save.

`SlowSaltedHasher` lives in `adapters/crypto/slow-salted-hasher.ts` with `cost` unset. It has no hash method. Tests and application source do not import it.

## Remaining tasks

- [ ] 3.1–3.2 Device use case and signature verifier
- [ ] 4.1–4.3 Postgres RLS
- [ ] 5.1–5.2 Identity HTTP
- [ ] 6.1–6.2 Devices HTTP
- [ ] 7.1–7.5 Node 403 and the final skeleton absences

6/20 tasks complete. Ready for the next apply batch. Not ready for verify.

## Workload / PR boundary

- Mode: feature-branch-chain, work units 1 and 2 of 7
- Current work unit: Identity
- Boundary: `OperateIdentity`, its ports and fast memory doubles, the identity repository contract, the uncalled slow hasher, the entry-port export, the package import map, and the skeleton allowlist. No domain edit, no HTTP, no SQL, no `operate-devices`
- PR target: unit 2 targets the unit 1 branch, which targets tracker branch `p0-04-identity-and-devices`. Not committed, not pushed, no PR opened
- Estimated review budget impact: above 400 lines. The use-case test, the use case, and the repository contract are the bulk
