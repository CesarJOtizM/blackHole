# Apply progress: p0-05-roles-and-permissions

Phases 1 through 4. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: `size:exception`. The workload forecast asked for a decision and recommended `feature-branch-chain` (400-line budget: high). The parent assigned every unchecked task in phases 1 through 4 and forbade commits, pushes, and branch switches. This apply is one uncommitted batch on tracker branch `p0-05-roles-and-permissions` (base `origin/master` `7815c10`). No pull request was opened. A later split can still follow `feature-branch-chain`. `p0-04-identity-and-devices` is merged, so the tasks that waited on that merge proceeded.

## Completed tasks

- [x] 1.1 RED permission catalog tests
- [x] 1.2 GREEN catalog and domain index
- [x] 1.3 RED authorization aggregate tests
- [x] 1.4 GREEN authorization aggregate
- [x] 1.5 RED evaluate tests
- [x] 1.6 GREEN pure evaluate
- [x] 2.1 RED operate-authorization tests
- [x] 2.2 GREEN use case, ports, and memory doubles
- [x] 2.3 RED evaluate-permission tests
- [x] 2.4 GREEN evaluate-permission
- [x] 2.5 RED authorization repository contract and memory contract test
- [x] 2.6 GREEN in-memory authorization repository
- [x] 2.7 Package import map for the two use-case folders
- [x] 3.1 RED Drizzle authorization contract
- [x] 3.2 GREEN schema, `0004_authorization.sql`, Drizzle repository
- [x] 3.3 Package export for the Drizzle repository
- [x] 4.1 RED cloud authorization HTTP tests
- [x] 4.2 GREEN cloud controller, module, contract, entry port
- [x] 4.3 RED sales charge HTTP cases
- [x] 4.4 GREEN charge evaluation stores nothing
- [x] 4.5 RED route permission declaration test
- [x] 4.6 GREEN structure and writes declarations
- [x] 4.7 RED node authorization rejection test
- [x] 4.8 GREEN node controller, no repository
- [x] 4.9 Skeleton allowlist

## Work Unit Evidence

### Unit 1 — domain

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED: `pnpm vitest run --project platform` failed to load `#domain/permission-catalog.js`, `#domain/authorization.js`, and `#domain/evaluate.js` (3 failed suites, 0 tests). GREEN after the catalog, aggregate, evaluate, and domain index: domain tests passed (415 in that run). Final full project: `pnpm vitest run --project platform` exit 0. `Test Files  21 passed (21)`. `Tests  522 passed (522)`. |
| Runtime harness command/scenario and exact result | N/A: the catalog, aggregate, and `evaluate` have no I/O. They do not open files, sockets, or a database. |
| Rollback boundary | `contexts/platform/domain/permission-catalog.ts`, `permission-catalog.test.ts`, `authorization.ts`, `authorization.test.ts`, `evaluate.ts`, `evaluate.test.ts`, and the authorization exports in `contexts/platform/domain/index.ts` (`layer` stays). |

### Unit 2 — use case and memory

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Use case and memory contract passed together (18 tests, 3 files) after implementation. A separate RED command was not captured for this unit. Final full project: `pnpm vitest run --project platform` exit 0. `Test Files  21 passed (21)`. `Tests  522 passed (522)`. `pnpm architecture` exit 0. `no dependency violations found (144 modules, 353 dependencies cruised)`. |
| Runtime harness command/scenario and exact result | The use cases and the memory repository run in-process. `PinVerifier.confirm` is the memory double. Five failures lock and the session stays. There is no socket and no database. |
| Rollback boundary | `contexts/platform/application/operate-authorization/`, `contexts/platform/application/evaluate-permission/`, `contexts/platform/application/ports/{authorization-repository,authorization-repository.contract,authorization-clock,session-reader,identity-reader,pin-verifier}.ts`, `contexts/platform/adapters/memory/{authorization-doubles,in-memory-authorization-repository,in-memory-authorization-repository.contract.test}.ts`, and the `#application/operate-authorization/*` and `#application/evaluate-permission/*` import map entries. |

### Unit 3 — Postgres

| Evidence | Required value |
|---|---|
| Focused test command and exact result | First PGlite run failed on `authorization_notices_pkey` because `notice_1` collided across tenants. After tenant-prefixed notice ids, the Drizzle contract, operate-authorization, and authorization domain tests passed (23). Final full project: `pnpm vitest run --project platform` exit 0. `Test Files  21 passed (21)`. `Tests  522 passed (522)`. |
| Runtime harness command/scenario and exact result | PGlite executes `0004_authorization.sql`. `authorization_app` with `app.tenant_id` set to tenant A selects assignments with no tenant predicate and returns only tenant A. The SQL has no PIN column. Drizzle is not mocked. |
| Rollback boundary | `contexts/platform/adapters/postgres/0004_authorization.sql`, the authorization tables in `schema.ts`, `drizzle-authorization-repository.ts` and its contract test, and the package export `./adapters/postgres/drizzle-authorization-repository`. |

### Unit 4 — HTTP

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project api-cloud` exit 0. `Test Files  6 passed (6)`. `Tests  29 passed (29)`. `pnpm vitest run --project local-node` exit 0. `Test Files  5 passed (5)`. `Tests  7 passed (7)`. `pnpm vitest run --project skeleton` exit 0. `Test Files  2 passed (2)`. `Tests  9 passed (9)`. `pnpm architecture` exit 0. `no dependency violations found (144 modules, 353 dependencies cruised)`. |
| Runtime harness command/scenario and exact result | Nest Fastify `inject`. No `listen`. Cloud `POST /tenants/:tenantId/authorization`: owner copy 200 and stored; predefined revise 409 `PredefinedRoleRevision` and events unchanged; waiter copy 403 `PermissionDenied` and events unchanged; cashier discount request 200 `requires_authorization` with `discountPercent` cap 5. `POST /tenants/:tenantId/sales/charges`: waiter 403 and events unchanged; cashier 10% 200 `requires_authorization` and events unchanged. Node `POST /authorization` returns 403 `{ error: "PermissionCommandRejected" }`. Node `ApplicationModule` providers and imports stay empty. |
| Rollback boundary | `apps/api-cloud/src/authorization.controller.ts`, `authorization.controller.test.ts`, `authorization-access.ts`, the authorization providers in `application-module.ts`, the `authorizationDependencies` spreads in the cloud test helpers, `apps/local-node/src/authorization.controller.ts` and its test, the node controller registration, `shared/contracts/authorization.ts`, the entry-port authorization exports, `routePermissions` on structure, writes, identity, and devices, `tools/skeleton/route-permission-declaration.test.ts`, and the skeleton allowlist lines. |

## Deviations

Notice ids are `${tenantId}:notice_${n}`. The table primary key is a global `id`, the same shape as organization events. A per-aggregate `notice_1` collided when two tenants were saved in one PGlite database.

`canManage` looks at every assignment whose `.authorize` grant is `yes` or `with_limit`. A site administrator can copy a subset role. Company scope is not required.

`RequestExpired` throws without flipping the request to `expired`. A refusal that does not change state is not saved. The in-memory repository keeps the same object, so a mutation before the throw would leak into a later load.

The Zod command uses `z.string()` for permission. `shared/contracts` does not import `@blackhole/platform`. The cloud controller casts the parsed command to `AuthorizationCommand`.

`create-application.ts` already accepts `CloudApplicationDependencies`. The new ports were added on that type in `application-module.ts`. Tests build them with `authorizationDependencies`. The factory body did not need a new branch.

Identity and devices routes declare `identity.session` and `device.register` because those routes exist after the p0-04 merge. `structure` still uses `x-actor-id`. `writes` still has no actor header. Declarations are not enforced at runtime.

`Identity.load` stays behind `RepositorySessionReader` and `RepositoryIdentityReader` in api-cloud. The use case sees only `SessionReader` and `IdentityReader`. An administration session with `venueId: ""` is mapped to `null`. That venue is not a grant. `PinVerifier.confirm` is a memory double. No method was added to the identity aggregate.

The charge path evaluates `sale.charge` and then `sale.discount` when `discountPercent` is present. A denial or `requires_authorization` on that path does not save. A support grant that flips to expired does save, because that is a state change. An already expired grant does not save.

Phase 1 followed RED then GREEN. Phases 2 and 3 were implemented in the same uncommitted batch; the separate RED commands for those units were not kept. Phase 4 tests were added after the controllers already existed in that batch, then the four projects and `pnpm architecture` passed.

## Status

25/25 tasks complete. Ready for verify. Verify and archive stay pending. The work is uncommitted on `p0-05-roles-and-permissions`.
