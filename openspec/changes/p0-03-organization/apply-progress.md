# Apply progress: p0-03-organization

Work units 1, 2, 3, and 4. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

Delivery: feature-branch-chain. Unit 1 stayed on `p0-03-organization-domain`. Unit 2 stays on `p0-03-organization-usecase`. Unit 3 stays on `p0-03-organization-postgres`. Unit 4 stays on `p0-03-organization-http`. Not committed.

## Completed tasks

- [x] 1.1 RED `contexts/platform/domain/organization.test.ts`
- [x] 1.2 GREEN `contexts/platform/domain/organization.ts`, `domain/index.ts`
- [x] 1.3 `tools/skeleton/skeleton.test.ts` allows `domain/organization.ts` and the new domain keys
- [x] 2.1 RED `contexts/platform/application/update-structure/update-structure.test.ts`
- [x] 2.2 GREEN `update-structure.ts`, `organization-repository.ts`, `in-memory-organization-repository.ts`, entry port, package import
- [x] 2.3 RED `organization-repository.contract.ts` and the memory contract test
- [x] 2.4 GREEN: memory passes the contract. Skeleton allows the new files
- [x] 3.1 RED `contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts`
- [x] 3.2 GREEN `schema.ts`, `0002_organization.sql`, `drizzle-organization-repository.ts`
- [x] 3.3 Export from `contexts/platform/package.json`. Skeleton allows the Drizzle organization repository
- [x] 4.1 RED `apps/api-cloud/src/update-structure.controller.test.ts`: inject `POST /tenants/:tenantId/structure` → 200; bad body → 400; domain rejection → 409; neither writes. No `listen`
- [x] 4.2 GREEN `update-structure.controller.ts`, `create-application.ts`, `application-module.ts`, `shared/contracts/update-structure.ts`, `index.ts`. Zod; the contract does not import platform
- [x] 4.3 RED: six venues, `SAMPLE-NIT-01` through `SAMPLE-NIT-06`, label `sample`, mode `cloud`
- [x] 4.4 GREEN `apps/api-cloud/src/sample-pilot-structure.ts`, `postgres-organizations.ts`. Postgres binding is typed. HTTP tests keep the in-memory repository

## Work Unit Evidence

### Unit 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/domain/organization.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| Runtime harness command/scenario and exact result | N/A: this unit has no I/O. The aggregate does not open files, sockets, or a database. |
| Rollback boundary | `contexts/platform/domain/organization.ts`, `contexts/platform/domain/organization.test.ts`, `contexts/platform/domain/index.ts`, and the skeleton expectations for `domain/organization.ts` plus the new domain export keys. |

### Unit 2

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/application/update-structure contexts/platform/adapters/memory` — exit 0. `Test Files  3 passed (3)`. `Tests  11 passed (11)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| Runtime harness command/scenario and exact result | N/A: no server. This unit does not listen, open HTTP, or touch Postgres. |
| Rollback boundary | `contexts/platform/application/update-structure/`, `application/ports/organization-repository.ts`, `application/ports/organization-repository.contract.ts`, `adapters/memory/in-memory-organization-repository.ts`, `adapters/memory/in-memory-organization-repository.contract.test.ts`, the `UpdateStructure` export in `application/entry-port.ts`, the `#application/update-structure/*` import plus the organization port and memory exports in `contexts/platform/package.json`, and the skeleton declaration lines for those four new files. |

### Unit 3

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| Runtime harness command/scenario and exact result | N/A: PGlite, no listen. The contract and the `organization_app` select run inside PGlite. Nothing calls `listen`. |
| Rollback boundary | `contexts/platform/adapters/postgres/0002_organization.sql`, the organization tables added to `adapters/postgres/schema.ts` (leave `venue_operations` and `operational_writes`), `adapters/postgres/drizzle-organization-repository.ts`, `adapters/postgres/drizzle-organization-repository.contract.test.ts`, the `./adapters/postgres/drizzle-organization-repository` export in `contexts/platform/package.json`, and the skeleton declaration line for `drizzle-organization-repository.ts`. |

### Unit 4

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project api-cloud src/update-structure.controller.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| Runtime harness command/scenario and exact result | Nest `inject` of `POST /tenants/:tenantId/structure`. No `listen()`. 200 stores `registerCompany`. 400 on a Zod rejection stores nothing. 409 for `DuplicateNit`, `InvoicingTaxpayerAlreadyAssigned`, `StockNotHeld`, and `PointAlreadyOpen` leaves the previous events unchanged. The sample fixture posts six venues and the last response plus `load` read back six `cloud` venues with `SAMPLE-NIT-01` through `SAMPLE-NIT-06`. The in-memory repository is the one injected. `pnpm vitest run --project api-cloud` — exit 0. `Test Files  3 passed (3)`. `Tests  15 passed (15)`, including the existing case that the server is not listening. |
| Rollback boundary | `apps/api-cloud/src/update-structure.controller.ts`, `apps/api-cloud/src/update-structure.controller.test.ts`, `apps/api-cloud/src/sample-pilot-structure.ts`, `apps/api-cloud/src/postgres-organizations.ts`, the organization provider in `apps/api-cloud/src/application-module.ts` and `apps/api-cloud/src/create-application.ts`, the call-site updates in `accept-cloud-write.controller.test.ts` and `bootstrap.test.ts`, `shared/contracts/update-structure.ts`, its export in `shared/contracts/index.ts`, the `update-structure.ts` include in `shared/contracts/tsconfig.json`, the domain-error re-exports in `contexts/platform/application/entry-port.ts`, and the `addPoint` command added to `contexts/platform/application/update-structure/update-structure.ts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm vitest run --project platform contexts/platform/domain/organization.test.ts` exit 1. `FAIL contexts/platform/domain/organization.test.ts` — `Cannot find module '#domain/organization.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `organization.ts` and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |
| 1.3 | Skeleton still expected only `venue-operation` domain keys and declarations. | `pnpm vitest run --project skeleton` exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| 2.1 → 2.2 | `pnpm vitest run --project platform contexts/platform/application/update-structure` exit 1. `FAIL contexts/platform/application/update-structure/update-structure.test.ts` — `Cannot find module '#adapters/memory/in-memory-organization-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, port, memory adapter, entry export, and import pattern: exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. |
| 2.3 → 2.4 | `pnpm vitest run --project platform contexts/platform/adapters/memory/in-memory-organization-repository.contract.test.ts` exit 1. `Cannot find module '#application/ports/organization-repository.contract.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the shared contract: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Skeleton before the declaration update: exit 1. `Tests  1 failed \| 6 passed (7)`. After the four new files were allowed: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| 3.1 → 3.2 | `pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` exit 1. `FAIL contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-organization-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `0002_organization.sql`, the organization tables in `schema.ts`, and `DrizzleOrganizationRepository`: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The fourth test is `SELECT id FROM venues` as `organization_app` with `app.tenant_id` set and no `tenant_id` predicate. |
| 3.3 | The new repository class was not yet in the skeleton declaration list. | `pnpm vitest run --project skeleton` exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| 4.1 → 4.2 | `pnpm vitest run --project api-cloud src/update-structure.controller.test.ts` exit 1. Six tests failed with 404. The accepted command expected 200 and the invalid body expected 400. `Test Files  1 failed (1)`. `Tests  6 failed (6)`. | Same command after the controller, Zod contract, module, and `createApplication` binding: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |
| 4.3 → 4.4 | Same command exit 1. `Cannot find module '#src/sample-pilot-structure.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `sample-pilot-structure.ts` and `postgres-organizations.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |

`pnpm exec tsc -b apps/api-cloud contexts/platform shared/contracts` — exit 0.

`pnpm architecture` — exit 0. `no dependency violations found (59 modules, 106 dependencies cruised)`. The TypeScript 7 transpiler warning is the existing cruiser notice.

`pnpm vitest run --project platform contexts/platform/application/update-structure` — exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. The `addPoint` case did not change the existing use-case results.

## Deviations

`Organization.rehydrate` was not added. `load` rebuilds the aggregate with `registerCompany` and the existing mutators, so a loaded venue still rejects a second point. No domain test was added.

`organizations` has `CHECK (id = tenant_id)` so the company row cannot claim another tenant. Reads select without a `tenant_id` predicate and fail if more than one organization row is visible. Deletes still pass `tenant_id` so a missed role cannot remove another tenant. `0001` and `venue_operations` were not changed.

`addPoint` was added to `UpdateStructure` and to the Zod command. The design command list did not name it. A second point is otherwise unreachable from HTTP, and the assigned 409 case needs `PointAlreadyOpen`. `addInvoicingTaxpayer` was already on the use case and is the command for a second taxpayer without replace.

`actorId` is the `x-actor-id` header. The body is one structure command. Users are out of scope, so there is no session. A missing or empty actor is 400 and nothing is saved.

Domain rejection classes are re-exported from `application/entry-port.ts`, the same path the venue write uses for `StaleGeneration`. The controller does not import `contexts/platform/domain`. The contract file does not import platform.

`postgresOrganizations` binds `DrizzleOrganizationRepository` the same way `postgresVenueOperations` binds the venue repository. HTTP tests inject the in-memory repository. The factory is not called, so no database and no port are opened.

Skeleton assertions already allow Zod under `shared/contracts` and check the contracts index with `toContain`. No skeleton edit was required. `apps/admin-web`, `adapters/sqlite`, and `shared/sync` were not added.

## Remaining tasks

- [ ] 5.1–5.4 Node 403

## Workload / PR boundary

- Mode: feature-branch-chain, work unit 4 of 5
- Boundary: cloud `POST /tenants/:tenantId/structure`, the Zod command and `OrganizationChanged` event, the sample pilot fixture, and the typed Postgres organization binding. local-node stays in unit 5
- Estimated review budget impact: HTTP slice. The contract and controller are the bulk of this PR; the sample fixture and the Postgres factory are small. The use-case `addPoint` arm is the only platform behavior added here
