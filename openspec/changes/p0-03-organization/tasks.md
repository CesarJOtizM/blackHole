# Tasks: Organization

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1800–2600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 1→5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

`it` titles: given/when/then. Leave `strict_tdd` and layer index files.

### Work units

| Unit | Goal | PR | `pnpm vitest run --project` | Runtime harness | Rollback boundary |
|------|------|----|-----------------------------|-----------------|-------------------|
| 1 | Domain | 1 | `platform contexts/platform/domain/organization.test.ts` | N/A: no I/O | `domain/organization.ts`, test, `domain/index.ts` |
| 2 | Use case, memory, contract | 2 | `platform contexts/platform/application/update-structure contexts/platform/adapters/memory` | N/A: no server | `update-structure/`, port, memory adapter |
| 3 | Postgres RLS | 3 | `platform contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` | N/A: PGlite, no listen | `0002_organization.sql`, `schema.ts`, Drizzle repo |
| 4 | Cloud fixture | 4 | `api-cloud src/update-structure.controller.test.ts` | inject `POST .../structure`; no listen | api-cloud structure files, `shared/contracts/update-structure.ts` |
| 5 | Node 403 | 5 | `local-node src/update-structure.controller.test.ts` | inject 403; no listen, no SQLite | node controller, module, `bootstrap.test.ts` |

## Phase 1: Domain

- [ ] 1.1 RED `contexts/platform/domain/organization.test.ts`: two NITs kept; `900123456` duplicate rejected; `openVenue` `cloud`, one point; second point, extra taxpayer, `assignStock` rejected; replace leaves one; stations, registers, warehouses kept.
- [ ] 1.2 GREEN `contexts/platform/domain/organization.ts`, `domain/index.ts`: `registerCompany`, `addTaxpayer`, `addBrand`, `openVenue` (point at `cloud`), `replaceInvoicingTaxpayer`, `addKitchenStation`, `addCashRegister`, `renameCashRegister`, `addSiteWarehouse`, `addGeneralWarehouse`. Unique NIT, `taxProfileId` only, prefix `organization_`. Keep `layer`.
- [ ] 1.3 `tools/skeleton/skeleton.test.ts`: allow `domain/organization.ts` and new domain keys.

## Phase 2: Use case

- [ ] 2.1 RED `contexts/platform/application/update-structure/update-structure.test.ts`: `renameCashRegister` emits `OrganizationChanged` (`actorId`, before, after); rejection skips `save` and emits nothing.
- [ ] 2.2 GREEN `update-structure.ts`, `application/ports/organization-repository.ts` (`load`, `save`), `adapters/memory/in-memory-organization-repository.ts`. Export `UpdateStructure` from `application/entry-port.ts`. Add `#application/update-structure/*` in `contexts/platform/package.json`.
- [ ] 2.3 RED `application/ports/organization-repository.contract.ts`, `adapters/memory/in-memory-organization-repository.contract.test.ts`: round-trip; tenant A hides B; one point.
- [ ] 2.4 GREEN: memory passes. Update skeleton. Folder `update-structure`.

## Phase 3: Postgres RLS

- [ ] 3.1 RED `contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts`: PGlite and `0002_organization.sql`. `organization_app` `SELECT` without `tenant_id` returns one tenant. No Drizzle mock.
- [ ] 3.2 GREEN `adapters/postgres/schema.ts`, `0002_organization.sql`, `drizzle-organization-repository.ts`. Forced RLS, unique `(company_id, nit)`, one `point`. Leave `venue_operations`. `save` sets `organization_app` and `app.tenant_id`, then stores the event.
- [ ] 3.3 Export from `contexts/platform/package.json`. Update skeleton.

## Phase 4: Cloud HTTP

- [ ] 4.1 RED `apps/api-cloud/src/update-structure.controller.test.ts`: inject `POST .../structure` → 200; bad body → 400; domain rejection → 409; neither writes. No `listen`.
- [ ] 4.2 GREEN `update-structure.controller.ts`, `create-application.ts`, `application-module.ts`, `shared/contracts/update-structure.ts`, `index.ts`. Zod; no platform import.
- [ ] 4.3 RED: six venues, `SAMPLE-NIT-01` through `SAMPLE-NIT-06`, `label` `sample`, mode `cloud`.
- [ ] 4.4 GREEN `apps/api-cloud/src/sample-pilot-structure.ts`, `postgres-organizations.ts`. Bind Postgres. Memory OK.

## Phase 5: Node 403

- [ ] 5.1 RED `apps/local-node/src/update-structure.controller.test.ts`: POST → 403 `StructureEditRejected`; nothing stored.
- [ ] 5.2 GREEN reject controller and `application-module.ts`. No repository. No SQLite.
- [ ] 5.3 `apps/local-node/src/bootstrap.test.ts`: drop `(empty tree)`. No `listen`, health, or dialect.
- [ ] 5.4 `tools/skeleton/skeleton.test.ts`: allow new files. Keep `shared/sync`, SQLite, cursor, outbox, pairing, `apps/admin-web` absent.
