```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:4872e68e67f850c1b365fa3333ba3acfcd2f9bcac09c7041ded23f74d86d1f72
verdict: partial
blockers: 0
critical_findings: 0
requirements: 9/12
scenarios: 15/25
test_command: pnpm exec vitest run --project platform --project api-cloud --project local-node --project skeleton
test_exit_code: 0
test_output_hash: sha256:78dd3a2e7512c520d502b6372837884f7f4fe63149152e51521601a64f292640
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:fe6d5c722085097098478e6b87e60b5cec8444e0566b2694f3e0f2fe2d419961
```

## Verification Report

**Change**: p0-04-identity-and-devices
**Version**: delivery 0.4
**Mode**: Standard (`strict_tdd: false`)

Checkout: branch `p0-05-roles-and-permissions` at `b92bb8c`. Merge `7815c10` (PR #13) is an ancestor. Identity sources used for the matrix match that merge except `shared/contracts/index.ts` and `shared/contracts/authorization.ts`, which belong to the roles change. `design.md` in this folder was left untouched. Engram was unreachable (connection timeout); persistence for this phase is `openspec`.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 20 |
| Tasks complete | 20 |
| Tasks incomplete | 0 |

Tasks 1.1 through 7.5 are checked. Full verification ran.

### Build & Tests Execution

**Build**: Passed after the type fix (`pnpm typecheck`, exit 0). The first run exited 2. `expectSession` now takes `Session`, `shared/contracts/tsconfig.json` includes `identity.ts`, `devices.ts`, and `authorization.ts`, and the authorization repository narrows stored codes with `find` before returning them.

```text
contexts/platform/application/operate-identity/operate-identity.test.ts(179,258,428,487,516,591): TS2345
  Session is not assignable to Record<string, string> (missing string index signature).
shared/contracts/devices.ts(3,33) and shared/contracts/index.ts: TS6307
  identity.ts and devices.ts are imported and are not in shared/contracts/tsconfig.json include.
shared/contracts/index.ts: TS6307 authorization.ts (p0-05 file, same command).
contexts/platform/adapters/postgres/drizzle-authorization-repository.ts(505-549): TS2322 x6 (p0-05 file, same command).
```

The `Session` errors and the missing `identity.ts` / `devices.ts` include are already true at `7815c10`. `shared/contracts/tsconfig.json` include is `index.ts`, `accept-cloud-write.ts`, `update-structure.ts`. Removing the p0-05 files would still leave `pnpm typecheck` red.

**Tests**: 567 passed, 0 failed, 0 skipped (34 files, exit 0)

| Project | Files | Tests | Result |
|---------|-------|-------|--------|
| platform | 21 | 522 | passed |
| api-cloud | 6 | 29 | passed |
| local-node | 5 | 7 | passed |
| skeleton | 2 | 9 | passed |
| Total | 34 | 567 | passed |

The project split is from a second run of the same command with `--reporter=json` (exit 0, same 567/567). These totals include p0-05 tests on this branch. Vitest does not typecheck, so the green suite does not clear the `tsc` errors above.

**Lint** (recorded, not a failure of this change): `pnpm lint` exit 1. 112 errors, 3 warnings. Output hash `sha256:8dd19edd92a708496d3636042c295d8687a972caf049438db639b2a581961d19`. Diagnostics are Biome `format` against CRLF (521 CR markers in the log) plus `lint/style/useImportType` in `apps/api-cloud/src/authorization-access.ts` (p0-05). Biome was not run with `--write`.

**Coverage**: Not available (no coverage provider; threshold 0).

### Spec Compliance Matrix

Hybrid sync, shared Wi-Fi, local HTTPS, port scan, offline upload, and the phone app are deferred by D-37 and `design.md` ("Deferred to the hybrid phase"). Those rows are not failures of this change. A row is COMPLIANT only when a covering test passed in the run above.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Administration Session | Sign-in with second factor | `operate-identity.test.ts` > given an owner, when an administrator requires a second factor, then sign-in with that code starts a session | COMPLIANT |
| Administration Session | Wrong second factor | `operate-identity.test.ts` > given a required second factor, when the code is wrong, then no session starts and the failed attempt is saved | COMPLIANT |
| Personal PIN Session | Valid PIN on the node offline | Node identity POST returns 403 `IdentityCommandRejected` and stores nothing. Offline PIN success is deferred (D-37). | DEFERRED |
| Personal PIN Session | Cloud site during a cut | `operate-identity.test.ts` > given a cloud site without internet, when a waiter enters a valid PIN, then no session starts and save is not called | COMPLIANT |
| Personal PIN Session | Unregistered device | `operate-identity.test.ts` > given an unregistered device, when a valid PIN is entered, then the session is denied and save is not called | COMPLIANT |
| Quick Switch and Inactivity Lock | Quick switch | `operate-identity.test.ts` > given a cashier session, when a supervisor enters a valid PIN, then the session shows the supervisor name | COMPLIANT |
| Quick Switch and Inactivity Lock | Inactivity | `operate-identity.test.ts` > given a waiter phone with a 5-minute lock, when 5 minutes pass without activity, then the PIN is required again and save is not called | COMPLIANT |
| PIN Attempt Limit | Lock after failures | `operate-identity.test.ts` > given five wrong PINs, when the fifth is entered, then PinAttemptsLocked is raised and a later PIN is still refused | PARTIAL |
| PIN Attempt Limit | Success resets | `operate-identity.test.ts` > given three failed PIN attempts, when a valid PIN is entered, then the counter resets and the session starts | COMPLIANT |
| User Deactivation | Deactivate on offline node | `operate-identity.test.ts` > given an open session while the site is offline, when the user is deactivated, then the session ends and the change is saved | PARTIAL |
| User Deactivation | Deactivated user signs in | `operate-identity.test.ts` > given a deactivated user, when they enter a PIN, then the session is denied and save is not called | COMPLIANT |
| Single-Use Registration Code | Register a phone | `operate-devices.test.ts` > given a registration code, when it is issued and the phone signs its registration, then the code is shown once and the public key is stored | COMPLIANT |
| Single-Use Registration Code | Reused or expired code | `identity.test.ts` > given a registration code already redeemed…; same file expires at `issuedAt + 5 minutes` with `RegistrationCodeExpired`; `operate-devices.controller.test.ts` reused code returns 409 and saves nothing | COMPLIANT |
| Signed Requests | Valid signature | `node-public-key-verifier.test.ts` > given an ed25519 key, when the payload is signed, then the node verifier accepts that payload and rejects another | COMPLIANT |
| Signed Requests | Copied session token | `operate-devices.test.ts` > given an unsigned registration… and given a bad signature… then nothing is saved | COMPLIANT |
| Unregistered Devices Get Nothing | Customer phone on shared Wi-Fi | Deferred with shared Wi-Fi and print (D-37). Node device POST returns 403 and stores nothing. | DEFERRED |
| Unregistered Devices Get Nothing | Port scan | Deferred with local HTTPS and port scan (D-37). | DEFERRED |
| On-Premises Presence | Phone at home, hybrid site | Deferred with hybrid reachability (D-37). | DEFERRED |
| On-Premises Presence | Cloud site with bridge | `operate-devices.test.ts` > given a cloud site without internet, when a device command arrives, then nothing is saved | COMPLIANT |
| No Business Data on Phones | Storage inspection | No phone app (`apps/venue-app` absent by design). Session public keys are covered by the six-key HTTP test. | DEFERRED |
| No Business Data on Phones | Storage wiped by the OS | No PWA storage. Re-registration exists on the aggregate; the wipe story is deferred with `apps/venue-app`. | DEFERRED |
| Fixed Station Device | Kitchen TV | `identity.test.ts` > given a TV registered as the grill station, when it opens, then the grill session starts without a PIN and the bar station is refused | COMPLIANT |
| Fixed Station Device | Other station | `operate-devices.test.ts` > given a grill station, when it opens and then asks for the bar, then only the grill session starts and nothing is queued | COMPLIANT |
| Immediate Revocation | Revoke offline | Domain revoke ends the session and a later authorization is refused. Upload on reconnect is deferred (D-37). | DEFERRED |
| Immediate Revocation | Revoked phone prints | `operate-devices.test.ts` > given a revoked phone, when it authorizes with a valid signature, then nothing is saved. Print is out of scope (proposal 1.6; design: no queue). | PARTIAL |

**Compliance summary**: 15/25 scenarios compliant. 7 deferred by D-37 or the design hybrid/phone deferral (not failures). 3 partial (warnings below).

Requirements 9/12 have no partial scenario. Incomplete requirements: PIN Attempt Limit, User Deactivation, Immediate Revocation.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| One tenant aggregate | Implemented | `Identity` holds users, devices, codes, and sessions. `load(tenantId)` / `save`. |
| Session public keys | Implemented | `sessionId`, `userId`, `displayName`, `deviceId`, `venueId`, `kind` only. HTTP test asserts those six keys. |
| Secrets stay out of events | Implemented | Snapshot omits PIN, password, hashes, and private keys. Registration code is hashed, returned once, and absent from the stored event (`operate-devices.controller.test.ts`). |
| Refusal vs recorded attempt | Implemented | `execute` snapshots before `apply`. Unchanged snapshot does not save. Bad PIN, bad second factor, and bad redeem save, then rethrow. |
| Idle lock | Implemented | `OperateIdentity` clock map. `recordActivity` throws `SessionIdle`, does not save, and does not delete the stored session. |
| Node rejection | Implemented | Identity 403 `IdentityCommandRejected`. Devices 403 `DeviceCommandRejected`. Module providers and imports stay empty. |
| `x-session-id` | Implemented | Required for identity HTTP. Not passed into the aggregate. `registerFixedStation` is a domain method, not a devices HTTP command (`openFixedStation` is). |
| Postgres RLS | Implemented | `drizzle-identity-repository.contract.test.ts`: `identity_app` without a tenant predicate returns one tenant. Failed PIN reloads. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cloud MVP, node returns 403 | Yes | No SQLite identity store. Hybrid upload is absent on purpose. |
| One aggregate, two POSTs, 400/409 | Yes | `POST /tenants/:tenantId/identity` and `.../devices`. |
| Fast doubles; `SlowSaltedHasher` unused | Yes | Hasher file has no hash method and tests do not construct it. |
| `identity_app` forced RLS, `0003_identity.sql` | Yes | Contract test uses PGlite. |
| Enroll once, then factor required (D-38) | Yes | Missing code after enroll does not save. Wrong code saves the attempt. |
| A refusal does not save | Partial | The sentence is broader than the code. Recorded attempts save. Unchanged refusals do not. The code matches the spec and the required invariant. |
| `siteOffline` blocks PIN and authorize | Partial | Identity blocks `startPinSession` and `recordActivity` only. Deactivate still saves. Every device command is blocked. |
| Station binding, no queue | Yes | Other station throws `StationRefused` and does not save. |
| Admin `x-session-id`; six session keys | Yes | Positive HTTP test passed. Missing-header 400 is implemented and not separately tested. |
| Deferred hybrid phase | Yes | Offline PIN, offline upload, shared Wi-Fi, port scan, SQLite, Playwright, `apps/admin-web`, `apps/venue-app` stay absent. |

### Issues Found

**CRITICAL**:

None. The two type errors below were fixed after the first run, and `pnpm typecheck` now exits 0.

- `expectSession` now accepts `Session` instead of `Record<string, string>`.
- `shared/contracts/tsconfig.json` includes `identity.ts`, `devices.ts`, and `authorization.ts`. Stored authorization codes are narrowed with `find` before they are returned.

**WARNING**:

- Lock after failures is partial. Five failures set `pinAttemptsLocked`, save, and keep refusing PINs, including a later valid PIN. There is no expiry and no separate administrator alert. The public snapshot is the only admin-visible signal. `apps/admin-web` is deferred.
- Deactivate-on-offline-node is partial only for "reaches the cloud on reconnect". The session ends in the same save while `siteOffline` is true. That upload is hybrid sync and is not a failure (D-37).
- Revoked-phone-prints is partial only for the print job. Revoked authorize saves nothing. Print queue and templates are out of scope (proposal → 1.6).
- Design line "A refusal does not save" does not mention save-then-rethrow for a changed snapshot.
- Cloud bridge refusal is the `siteOffline` flag, not a PWA reachability probe.
- Phone storage scenarios have no runtime phone inspection. The six-key session and secret-free events are what this slice tests.
- Identity HTTP tests always send `x-session-id`. The empty-header 400 path is untested.
- `pnpm lint` exit 1 is the known Biome CRLF noise, plus two p0-05 import-type diagnostics. Not a failure of this change.

**SUGGESTION**:

- Type `expectSession` with `Session`.
- Add `identity.ts` and `devices.ts` to the contracts project include. `authorization.ts` belongs to p0-05.

### Verdict

PARTIAL

Tests passed (567/567). The typecheck blockers are fixed and `pnpm typecheck` now exits 0. The change stays partial because the lock-after-failures scenario still has no temporary expiry and no administrator alert. Deferred hybrid sync is not the reason.
