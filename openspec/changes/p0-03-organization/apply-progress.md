# Apply progress: p0-03-organization

Work units 1 and 2. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

Delivery: feature-branch-chain. Unit 1 stayed on `p0-03-organization-domain`. Unit 2 stays on `p0-03-organization-usecase`. Not committed.

## Completed tasks

- [x] 1.1 RED `contexts/platform/domain/organization.test.ts`
- [x] 1.2 GREEN `contexts/platform/domain/organization.ts`, `domain/index.ts`
- [x] 1.3 `tools/skeleton/skeleton.test.ts` allows `domain/organization.ts` and the new domain keys
- [x] 2.1 RED `contexts/platform/application/update-structure/update-structure.test.ts`
- [x] 2.2 GREEN `update-structure.ts`, `organization-repository.ts`, `in-memory-organization-repository.ts`, entry port, package import
- [x] 2.3 RED `organization-repository.contract.ts` and the memory contract test
- [x] 2.4 GREEN: memory passes the contract. Skeleton allows the new files

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

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm vitest run --project platform contexts/platform/domain/organization.test.ts` exit 1. `FAIL contexts/platform/domain/organization.test.ts` — `Cannot find module '#domain/organization.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `organization.ts` and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |
| 1.3 | Skeleton still expected only `venue-operation` domain keys and declarations. | `pnpm vitest run --project skeleton` exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| 2.1 → 2.2 | `pnpm vitest run --project platform contexts/platform/application/update-structure` exit 1. `FAIL contexts/platform/application/update-structure/update-structure.test.ts` — `Cannot find module '#adapters/memory/in-memory-organization-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, port, memory adapter, entry export, and import pattern: exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. |
| 2.3 → 2.4 | `pnpm vitest run --project platform contexts/platform/adapters/memory/in-memory-organization-repository.contract.test.ts` exit 1. `Cannot find module '#application/ports/organization-repository.contract.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the shared contract: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Skeleton before the declaration update: exit 1. `Tests  1 failed \| 6 passed (7)`. After the four new files were allowed: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |

`pnpm exec biome check --write` on the nine edited files — exit 0. Checked 9 files. Fixed 9 files.

`pnpm exec tsc -b contexts/platform` — exit 0.

`pnpm architecture` — exit 0. `no dependency violations found (49 modules, 77 dependencies cruised)`. The TypeScript 7 transpiler warning is the existing cruiser notice.

## Deviations

None — implementation matches design. `OrganizationChanged.before` and `OrganizationChanged.after` are snapshots of the organization, so a renamed register keeps the old name in `before` and the new name in `after`. `save` runs only after the command is accepted. `addInvoicingTaxpayer`, `assignStock`, and a duplicate NIT throw and do not save. Memory keeps one map of organizations and one map of events, both keyed by `organization.id`, because `save(organization, event)` has no separate tenant argument. `load(tenantId)` uses that same key. `registerCompany` rejects a command id that differs from `tenantId` and does not save. `eventsFor` is an inspection method on the memory adapter and the contract subject, the same role as `countByWriteId`. `VenueOperation` was not changed.

## Remaining tasks

- [ ] 3.1–3.3 Postgres RLS
- [ ] 4.1–4.4 Cloud HTTP and sample fixture
- [ ] 5.1–5.4 Node 403

## Workload / PR boundary

- Mode: feature-branch-chain, work unit 2 of 5
- Boundary: `UpdateStructure`, the organization repository port and contract, the in-memory adapter, the entry-port export, the package import and exports this unit needs, and the skeleton lines for the files this unit adds
- Estimated review budget impact: use-case and memory slice, under the 400-line budget for this PR
