# Tasks: Cloud venue operation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1400 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

17 new + 14 modified. `pnpm test` green per phase.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain, use case, memory, contract, Vitest `platform`, skeleton | PR 1 | base `main`; `pnpm test` green |
| 2 | PGlite adapter, Drizzle schema, migration, catalog | PR 2 | base = PR 1 branch after it merges, or stacked on PR 1 until then |
| 3 | Route, composition root, Zod, api-cloud wiring | PR 3 | base = PR 2 branch after it merges |

No sync, SQLite, `shared/sync`, local-node, pairing, organization, RLS, Better Auth, audit, `strict_tdd`, `application/index.ts`, `adapters/index.ts`. `nestjs-zod` stays forbidden.

## Phase 1: Domain, use case, memory

- [x] 1.1 `vitest.config.ts`: project `platform`, include `contexts/platform/**/*.test.ts`.
- [x] 1.2 RED `contexts/platform/domain/venue-operation.test.ts`: `openCloud` → cloud/cloud/generation `1`.
- [x] 1.3 GREEN `contexts/platform/domain/venue-operation.ts` and `domain/index.ts` (`layer` stays). Relax skeleton `expect(domainSource).toBe('export const layer = "domain" as const;\n')`, `expect(keys).toEqual(["layer"])`, `expect(declarations).toEqual([])`.
- [x] 1.4 RED: `acceptWrite` accepts current generation.
- [x] 1.5 GREEN: match succeeds; generation unchanged.
- [x] 1.6 RED: other generation throws `StaleGeneration`.
- [x] 1.7 GREEN: throw and export `StaleGeneration` from `domain/index.ts`.
- [x] 1.8 RED `contexts/platform/application/accept-cloud-write/accept-cloud-write.test.ts`: memory stores the write.
- [x] 1.9 GREEN `accept-cloud-write.ts`, `application/ports/venue-operation-repository.ts` (`save`, `findByVenueId`, `saveWrite`), `adapters/memory/in-memory-venue-operation-repository.ts`. Cruiser: `application/**/*.test.ts` → `adapters/memory`.
- [x] 1.10 RED: stale write leaves memory unchanged.
- [x] 1.11 GREEN: `StaleGeneration` persists nothing.
- [x] 1.12 RED: same `writeId` inserts once.
- [x] 1.13 GREEN: second `saveWrite` is a no-op.
- [x] 1.14 RED `application/ports/venue-operation-repository.contract.ts` + memory `.contract.test.ts`: insert, read, one `writeId`, empty find.
- [x] 1.15 GREEN: memory passes. Export `AcceptCloudWrite` and `StaleGeneration` from `application/entry-port.ts`.

## Phase 2: PostgreSQL

- [x] 2.1 Catalog `drizzle-orm` and `@electric-sql/pglite` in `pnpm-workspace.yaml` and `contexts/platform/package.json`. Relax skeleton `expect(dependencies).toEqual([])` for `drizzle-orm` only.
- [x] 2.2 RED `contexts/platform/adapters/postgres/drizzle-venue-operation-repository.contract.test.ts`: contract on PGlite + `0001_venue_operation.sql`. Test omits `drizzle-orm`.
- [x] 2.3 GREEN `schema.ts`, `0001_venue_operation.sql` (`venue_operations`, `operational_writes`), `drizzle-venue-operation-repository.ts` via `drizzle({ client })` from `drizzle-orm/pglite`. Same `write_id` no-op. Relax `expect(imports).toEqual([])` for `drizzle-orm`.

## Phase 3: HTTP

- [ ] 3.1 RED `apps/api-cloud/src/accept-cloud-write.controller.test.ts`: POST 200 `{venueId,writeId,mode:cloud,operationOwner:cloud,generation}` on memory; no listen/PGlite.
- [ ] 3.2 GREEN controller, `createApplication(venueOperations)`, `ApplicationModule.register(venueOperations)`. Drop `expect(routes.trim()).toBe("(empty tree)")`. Keep no-listen, no SQL.
- [ ] 3.3 RED: invalid body → 400; memory empty.
- [ ] 3.4 GREEN `shared/contracts/accept-cloud-write.ts` (Zod 4.6.7) via `index.ts`. 400 does not save. Add `zod`; api-cloud tsconfig refs; contracts `include`. Relax `expect(contents).toBe("export {};")`, `expect(importsZod).toBe(false)`, Zod import/dependency expects.
- [ ] 3.5 RED: stale → 409 `{ "error": "StaleGeneration" }`; memory empty.
- [ ] 3.6 GREEN: map `StaleGeneration` to 409; no persist.
- [ ] 3.7 RED: repeat `writeId` → 200.
- [ ] 3.8 GREEN: replay 200; no second insert.
- [ ] 3.9 `apps/api-cloud/src/postgres-venue-operations.ts`: `postgresVenueOperations(db)` binds Drizzle. HTTP keeps memory.
