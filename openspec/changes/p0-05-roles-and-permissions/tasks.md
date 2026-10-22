# Tasks: Roles and Permissions

## Review Workload Forecast

Estimated changed lines: 2400–3800. Delivery: ask-on-risk.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

RED then GREEN (ADR-017). `it`: given/when/then. Leave `strict_tdd` and `layer`. Do not edit p0-03, p0-04, or p0-08.

### Work units

PR 1 base = tracker branch `p0-05-roles-and-permissions`. PR 2 base = PR 1 branch. PR 3 base = PR 2 branch. PR 4 base = PR 3 branch.

| Unit | Goal | PR | Verify |
|------|------|----|--------|
| 1 | Domain | 1 | `platform` domain tests |
| 2 | Use case, memory | 2 | `platform` use case and memory contract |
| 3 | PGlite | 3 | Drizzle contract. Waits on `0003_identity.sql`. Do not start apply. |
| 4 | HTTP | 4 | cloud, node, skeleton. Waits on composition files. Do not start apply. |

Units 1 and 2 may be written now. Tasks that edit `contexts/platform/package.json`, `application/entry-port.ts`, api-cloud `create-application.ts` or `application-module.ts`, local-node `application-module.ts`, `tools/skeleton/skeleton.test.ts`, or add `0004_authorization.sql` wait until `p0-04-identity-and-devices` is merged. Do not start apply from those tasks.

## Phase 1: Domain

- [ ] 1.1 RED `contexts/platform/domain/permission-catalog.test.ts`: one case per §6 cell; `.authorize` pairs; bartender `sale.charge` off (D-22); §7 percent, COP, counts (D-30); other §4 roles prose-only; missing cell fails typecheck.
- [ ] 1.2 GREEN `domain/permission-catalog.ts`, `domain/index.ts`. Codes `<context>.<action>`. Eight columns. Keep `layer`.
- [ ] 1.3 RED `domain/authorization.test.ts`: predefined edit rejected; copy may change; site 15→20 rejected; lower allowed; last owner stays; subset escalation rejected; site-1 admin cannot assign site 2; bartender flag default off.
- [ ] 1.4 GREEN `domain/authorization.ts`. `load`/`save` like Organization. Predefined roles in code.
- [ ] 1.5 RED `domain/evaluate.test.ts`: two sites, two roles; Saturday assignment denied Sunday; 10% over 5% returns `requires_authorization` and the exceeded limit; most permissive wins; company covers below; brand covers its sites; self-auth needs the shift flag and a sole active authorizer assignment, not attendance; shift totals are inputs.
- [ ] 1.6 GREEN `domain/evaluate.ts`: `allowed`, `requires_authorization`, or `denied`. No I/O.

## Phase 2: Use case and memory

Keys: `sessionId`, `userId`, `displayName`, `deviceId`, `venueId`, `kind` (`administration` or `pin`). Administration may omit `venueId`. No `Identity.load`. No new 0.4 method.

- [ ] 2.1 RED `application/operate-authorization/operate-authorization.test.ts`: unknown session, refusal, and foreign `pin` skip save; administration is not a venue grant; save before/after; owner notice on role or limit change; resolve stores requester, authorizer, action, value, reason, device, time; own PIN denied without the flag; sole authorizer sets `selfAuthorized` and a notice; five failed `confirm` calls lock and keep the session.
- [ ] 2.2 GREEN `operate-authorization.ts`, `authorization-repository.ts` (`load`, `save`), `session-reader.ts`, `identity-reader.ts` (`{ userId, active }`), `pin-verifier.ts` (`confirm`). Memory doubles. Do not edit `entry-port.ts`.
- [ ] 2.3 RED `application/evaluate-permission/evaluate-permission.test.ts`: waiter `sale.charge` denied; over-limit stores nothing; `x-support-grant-id` allowed at 1h of 4h and recorded; expired grant denied; lazy expiry; inactive user denied.
- [ ] 2.4 GREEN `evaluate-permission.ts`. 0.5 clock. Do not import the 0.4 `Clock`.
- [ ] 2.5 RED `application/ports/authorization-repository.contract.ts` and `adapters/memory/in-memory-authorization-repository.contract.test.ts`: round-trip; hidden tenant; no PINs.
- [ ] 2.6 GREEN `adapters/memory/in-memory-authorization-repository.ts`.
- [ ] 2.7 Add `#application/operate-authorization/*` and `#application/evaluate-permission/*` to `contexts/platform/package.json`. Apply waits until `p0-04-identity-and-devices` is merged. Do not start apply from this task.

## Phase 3: Postgres

Do not start apply until `p0-04-identity-and-devices` is merged.

- [ ] 3.1 RED `adapters/postgres/drizzle-authorization-repository.contract.test.ts`: PGlite and `0004_authorization.sql`; `authorization_app` without `tenant_id` sees one tenant; round-trip; no PINs; no mock.
- [ ] 3.2 GREEN `schema.ts`, `0004_authorization.sql`, `drizzle-authorization-repository.ts`. Roles, permissions, assignments, venue limits, flags, requests, grants, shift flags, notices, changes. Forced RLS. `save` sets `authorization_app` and `app.tenant_id`.
- [ ] 3.3 Export from `contexts/platform/package.json`. Do not start apply from this task.

## Phase 4: HTTP

Do not start apply until `p0-04-identity-and-devices` is merged (`entry-port.ts`, both modules, `create-application.ts`, `skeleton.test.ts`). `Identity.load` only then, behind `IdentityReader`.

- [ ] 4.1 RED `apps/api-cloud/src/authorization.controller.test.ts`: inject `POST /authorization` → 200; 409 and 403 save nothing; `requires_authorization` → 200. No `listen`.
- [ ] 4.2 GREEN controller, `create-application.ts`, `application-module.ts`, `shared/contracts/authorization.ts`, `entry-port.ts` (`OperateAuthorization`, `EvaluatePermission`). Zod. `x-session-id`. `x-support-grant-id`, not a session kind.
- [ ] 4.3 RED same file: waiter `POST .../sales/charges` → 403; over-limit → 200; nothing stored.
- [ ] 4.4 GREEN evaluates `sale.charge` and stores nothing.
- [ ] 4.5 RED `tools/skeleton/route-permission-declaration.test.ts`: mutating route without `permission` fails. Routes that exist today only.
- [ ] 4.6 GREEN `structure` declares `organization.structure`; `writes` declares `operation.accept-cloud-write`. Keep behavior and `x-actor-id`. Do not enforce. Absent 0.4 identity routes must not fail; they join after that merge.
- [ ] 4.7 RED `apps/local-node/src/authorization.controller.test.ts`: POST → 403 `PermissionCommandRejected`; nothing stored.
- [ ] 4.8 GREEN node controller and `application-module.ts`. No repository. No SQLite.
- [ ] 4.9 `tools/skeleton/skeleton.test.ts`: allow new files. Keep admin-web, venue-app, `shared/sync`, and SQLite absent. Do not start apply from this task.

## Unplaced

Remote approval offline (hybrid node, on-site phone, no internet): no socket, Web Push, or offline evaluate.
