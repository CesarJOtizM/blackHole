# Proposal: Skeleton and Synchronization

## Intent

Every module needs one API that runs in the cloud by default and, when a site activates hybrid mode, on a site node that keeps working offline and syncs later without duplicates (PRD-00 9.1, TRD-00 5.0–5.5, TRD-M0 3). The monorepo skeleton exists; operating mode and sync do not.

### Status

The skeleton part of 0.2 is done: `contexts/platform` (layer markers), `shared/contracts`, `apps/api-cloud`, `apps/local-node` (empty Nest hosts with bootstrap tests), `tools/cruiser`, `tools/skeleton` and the architecture rules (`pnpm architecture`). Still pending in 0.2: the first use case, the port contract suite and the memory, PostgreSQL and SQLite adapters, plus operating mode and sync. The change stays open until the whole delivery meets its exit criterion.

## Scope

### In Scope
- Operating mode per site: cloud default, hybrid activation by pairing, return to cloud, single owner with generation.
- Same use cases hosted by `api-cloud` (PostgreSQL) and `local-node` (SQLite); `bridge` runtime profile with no operation data.
- Transactional outbox, idempotent inbox, per-site config cursor, compressed resumable batches, send priority, node clock as reference.
- Contract suite per port run on memory, SQLite and PostgreSQL adapters.

### Out of Scope
- Organization data and its copy to the node → 0.3.
- Device credentials and PIN → 0.4.
- Node failover (ADR-004), retries/backoff, 4G, staged updates → 0.7.
- Bridge print jobs → 1.6.
- Telemetry payloads → 0.9.

## Capabilities

### New Capabilities
- `operating-mode`: cloud/hybrid mode per site, ownership and generation, activation and return.
- `sync`: outbox, inbox, cursors, batches, ordering and priority.

### Modified Capabilities
None

## Approach

Inside-out TDD (ADR-017): generation and ownership in `contexts/platform/domain`; activation, return and batch application as use cases with in-memory adapters; the outbox/inbox mechanism in `shared/sync` behind ports; one Drizzle schema per dialect. Apps stay composition roots (ADR-018).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/{domain,application,adapters}` | Modified | Today layer markers only; gains mode, generation, use cases, `application/entry-port.ts` |
| `contexts/platform/adapters/{memory,sqlite,postgres,http}` | New | Port adapters and contract suites |
| `shared/sync` | New | Outbox, inbox, cursor, batch codec |
| `shared/contracts` | Modified | Today empty; gains event envelope and batch schemas |
| `apps/api-cloud`, `apps/local-node` | Modified | Today empty Nest modules; bind adapters per dialect |
| `vitest.config.ts` | Modified | Add projects for `contexts/*` and `shared/*` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Contract drift between SQLite and PostgreSQL | Med | Same contract suite on both dialects |
| Ownership change mid-batch | Med | Generation check on every write; test from TRD-00 16.9 |
## Rollback Plan

No site uses hybrid mode yet. Revert the change commits; sites stay in cloud mode. Migrations are additive and corrected forward.

## Dependencies

- p0-01 SQLite load result confirms the node dialect.

## Success Criteria

- [ ] A site in cloud mode operates without a node.
- [ ] With hybrid activated, an event created without internet reaches the cloud after 2 h disconnected, not duplicated and in order.
- [ ] Every port has one contract suite (`<port>.contract.ts`, run by `<adapter>.contract.test.ts`) passing on memory, SQLite and PostgreSQL.
- [ ] With internet, sync delay stays at p95 < 1 min (TRD-00 15).
- [x] Skeleton: workspace, `contexts/platform`, `shared/contracts`, both hosts, `tools/cruiser`, `tools/skeleton` and architecture rules.
