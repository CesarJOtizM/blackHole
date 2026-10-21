# Apply progress: p0-03-organization

Work units 1, 2, and 3. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

Delivery: feature-branch-chain. Unit 1 stayed on `p0-03-organization-domain`. Unit 2 stays on `p0-03-organization-usecase`. Unit 3 stays on `p0-03-organization-postgres`. Not committed.

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

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm vitest run --project platform contexts/platform/domain/organization.test.ts` exit 1. `FAIL contexts/platform/domain/organization.test.ts` — `Cannot find module '#domain/organization.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `organization.ts` and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |
| 1.3 | Skeleton still expected only `venue-operation` domain keys and declarations. | `pnpm vitest run --project skeleton` exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| 2.1 → 2.2 | `pnpm vitest run --project platform contexts/platform/application/update-structure` exit 1. `FAIL contexts/platform/application/update-structure/update-structure.test.ts` — `Cannot find module '#adapters/memory/in-memory-organization-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, port, memory adapter, entry export, and import pattern: exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. |
| 2.3 → 2.4 | `pnpm vitest run --project platform contexts/platform/adapters/memory/in-memory-organization-repository.contract.test.ts` exit 1. `Cannot find module '#application/ports/organization-repository.contract.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the shared contract: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Skeleton before the declaration update: exit 1. `Tests  1 failed \| 6 passed (7)`. After the four new files were allowed: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| 3.1 → 3.2 | `pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` exit 1. `FAIL contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-organization-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `0002_organization.sql`, the organization tables in `schema.ts`, and `DrizzleOrganizationRepository`: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. The fourth test is `SELECT id FROM venues` as `organization_app` with `app.tenant_id` set and no `tenant_id` predicate. |
| 3.3 | The new repository class was not yet in the skeleton declaration list. | `pnpm vitest run --project skeleton` exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |

`pnpm exec biome check --write` on the five edited TypeScript and JSON files — exit 0. Checked 5 files. Fixed 5 files.

`pnpm exec tsc -b contexts/platform` — exit 0.

`pnpm architecture` — exit 0. `no dependency violations found (51 modules, 89 dependencies cruised)`. The TypeScript 7 transpiler warning is the existing cruiser notice.

`pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-venue-operation-repository.contract.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `0001_venue_operation.sql` and the venue tables were left in place.

## Deviations

`Organization.rehydrate` was not added. `load` rebuilds the aggregate with `registerCompany` and the existing mutators, so a loaded venue still rejects a second point. No domain test was added.

`organizations` has `CHECK (id = tenant_id)` so the company row cannot claim another tenant. Reads select without a `tenant_id` predicate and fail if more than one organization row is visible. Deletes still pass `tenant_id` so a missed role cannot remove another tenant. `0001` and `venue_operations` were not changed.

## Remaining tasks

- [ ] 4.1–4.4 Cloud HTTP and sample fixture
- [ ] 5.1–5.4 Node 403

## Workload / PR boundary

- Mode: feature-branch-chain, work unit 3 of 5
- Boundary: Postgres organization tables, forced RLS for `organization_app`, the Drizzle repository, its PGlite contract, the package export, and the skeleton line for that repository
- Estimated review budget impact: Postgres RLS slice. The SQL, schema, and repository together are the bulk of this PR; HTTP and local-node stay in later units
