# Design: Cloud venue operation

Delivery 0.2 is the cloud MVP only (D-37, TRD-00 §19.2). Inside-out ([ADR-017](../../../docs/adr/ADR-017-tdd-sobre-hexagonal.md)): domain, use case with memory, one port contract, PostgreSQL, thin HTTP. `contexts/platform` holds the rule; `apps/api-cloud` is the composition root ([ADR-018](../../../docs/adr/ADR-018-screaming-y-bounded-context.md)). `apps/local-node` stays an empty Nest host.

`VenueOperation` is the operation record, not the 0.3 `Venue`. `openCloud(venueId)` sets mode `cloud`, operationOwner `cloud`, generation `1`. `acceptWrite(generation)` throws `StaleGeneration` otherwise. `AcceptCloudWrite` loads or opens, checks, then persists. A stale write is not stored. The same `writeId` is not inserted twice. Generation does not increase here.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| PGlite: `new PGlite()`, `drizzle({ client })` from `drizzle-orm/pglite` | WASM cold start; real Postgres; no daemon | **Chosen.** Not a mock (TRD-00 §16.3). Suite stays seconds (§16.8) |
| Docker or Testcontainers | Needs a daemon | Rejected |
| Mock Drizzle, or pg-mem | Not the cloud SQL | Rejected |
| SQLite for this port | Second dialect now | Rejected (D-37). No shared schema |
| Controller in `apps/api-cloud` | `adapters/http` waits for a second host | **Chosen.** One route, no SQL |
| Idempotency key `writeId` | Caller supplies it; no `IdGenerator` yet | **Chosen** |
| HTTP 409 `{ "error": "StaleGeneration" }` | 400 collides with Zod | **Chosen.** Accept and replay return 200 |
| `createApplication(venueOperations)` | No database on boot | **Chosen.** `postgresVenueOperations(db)` binds Drizzle. HTTP tests pass memory |
| `application/**/*.test.ts` may import `adapters/memory` | A wide exception hides layer breaks | **Chosen.** Production application still cannot |
| Leave `strict_tdd` false | Tests become collected | **Chosen.** Vitest project `platform` only |

## Data Flow

```
POST /venues/:venueId/writes { writeId, generation }
        │  Zod (shared/contracts): invalid → 400, repository unchanged
        ▼
AcceptCloudWriteController          apps/api-cloud
        │  StaleGeneration → 409, repository unchanged
        ▼
AcceptCloudWrite                   application/entry-port.ts
        │  findByVenueId; if missing, openCloud (unsaved)
        │  acceptWrite; on throw, persist nothing
        ▼
VenueOperationRepository           abstract class, Nest token
        ├─ InMemoryVenueOperationRepository     use-case and HTTP tests
        └─ DrizzleVenueOperationRepository      cloud binding; contract on PGlite
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `contexts/platform/domain/venue-operation.ts`, `venue-operation.test.ts` | Create | Aggregate and `StaleGeneration`. No Nest, Drizzle, Zod |
| `contexts/platform/domain/index.ts` | Modify | Keep `layer`. Export both |
| `contexts/platform/application/ports/venue-operation-repository.ts`, `venue-operation-repository.contract.ts` | Create | `save`, `findByVenueId`, `saveWrite`. Insert, read, idempotency, empty |
| `contexts/platform/application/accept-cloud-write/accept-cloud-write.ts`, `accept-cloud-write.test.ts` | Create | Load-or-open, check, persist. Memory only |
| `contexts/platform/application/entry-port.ts` | Create | Exports `AcceptCloudWrite` and `StaleGeneration` |
| `contexts/platform/adapters/memory/in-memory-venue-operation-repository.ts`, `.contract.test.ts` | Create | In-memory maps. Imports the suite |
| `contexts/platform/adapters/postgres/schema.ts`, `0001_venue_operation.sql`, `drizzle-venue-operation-repository.ts`, `.contract.test.ts` | Create | Postgres schema only. PGlite runs the suite. Same `write_id` is a no-op |
| `shared/contracts/accept-cloud-write.ts`, `index.ts`, `package.json`, `tsconfig.json` | Create / Modify | Zod command and result. Catalog `zod` 4.6.7 |
| `vitest.config.ts` | Modify | Project `platform`: `contexts/platform/**/*.test.ts` |
| `.dependency-cruiser.cjs` | Modify | Test-only import exception |
| `pnpm-workspace.yaml`, `contexts/platform/package.json` | Modify | Catalog `drizzle-orm` and `@electric-sql/pglite` |
| `apps/api-cloud/src/accept-cloud-write.controller.ts`, `.controller.test.ts`, `postgres-venue-operations.ts` | Create | Route and Drizzle binding. HTTP test uses memory |
| `apps/api-cloud/src/application-module.ts`, `create-application.ts`, `bootstrap.test.ts` | Modify | `register(venueOperations)`. Keep no listen. Drop empty-route asserts |
| `apps/api-cloud/package.json`, `tsconfig.json` | Modify | Workspace deps plus `zod`. Project references |
| `tools/skeleton/skeleton.test.ts` | Modify | Allow this use case, Zod, and Drizzle. Keep `shared/sync` absent; domain imports neither Nest nor Drizzle |

No deletions. Do not edit `apps/local-node`, `application/index.ts`, or `adapters/index.ts`. Do not set `strict_tdd`.

## Interfaces / Contracts

`VenueOperationRepository` is an abstract class: `save(operation)`, `findByVenueId(venueId) → VenueOperation | null`, `saveWrite({ writeId, venueId, generation })`. `POST /venues/:venueId/writes` body `{ writeId: uuid, generation: positive int }`. Result `{ venueId, writeId, mode: "cloud", operationOwner: "cloud", generation }`. Tables: `venue_operations` (`venue_id` pk, `mode`, `operation_owner`, `generation`), `operational_writes` (`write_id` pk, `venue_id`, `generation`).

## Testing Strategy

One failing test, then the minimum code (ADR-017). Given / When / Then. AAA blocks separated by a blank line.

| Layer | What to test | Approach |
|-------|----------------|----------|
| Domain | `openCloud`; current generation; `StaleGeneration` | Pure. No Nest, no database |
| Use case | Open and accept; stale stores nothing; repeat | Memory adapter. No Nest |
| Contract | Insert, read, one row per `writeId`, empty | Suite once. Memory and PGlite each import it |
| HTTP | 200; 400 and 409 leave memory empty; repeat | Nest+Fastify, memory, no listen, no PGlite |

## Migration / Rollout

No production data. `0001_venue_operation.sql` only creates those two tables. The Postgres contract runs it on a fresh in-memory PGlite. No `ALTER`.

## Deferred to the hybrid phase

No files, tasks, or schema: `shared/sync`, outbox, inbox, cursors, batches, priority, node clock; SQLite and `local-node` as operation owner; `ActivateHybrid`, `PairNode`, `ReturnToCloud`, `FailOverToCloud`, bridge, pairing codes; organization tree (0.3); RLS, Better Auth, audit hash chain.

## Open Questions

None. D-37 stands.
