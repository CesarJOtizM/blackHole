## Verification Report

**Change**: p0-03-organization
**Version**: N/A
**Mode**: Standard

Strict TDD is inactive (`strict_tdd: false`). This is a cloud-slice re-judgment under D-37. The previous report failed because six hybrid scenarios were marked CRITICAL. Design section "Deferred to the hybrid phase" keeps those out of this delivery: no SQLite, no sync, no outbox, no cursor, no pairing, no admin-web. They are DEFERRED here, not apply work and not archive blockers.

Tasks were confirmed complete (18/18 checked) before the suite ran. Specs were compared first, design second, task completion third.

### Evidence scope

HEAD is `208b30349b6c7b63f4db9898a2a84ba8e3b26df3` (`208b303`, merge of pull request #60). Every command ran in `C:\Users\csar-\Proyectos\blackHole` against the dirty working tree above that commit. The tree includes uncommitted invoicing and monitoring edits. Those edits were not reverted. No command ran in another worktree. `pnpm test` and the invoicing project were not run.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 18 |
| Tasks complete | 18 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: ✅ Passed (`pnpm exec tsc -b contexts/platform apps/api-cloud apps/local-node --pretty false`, exit 0)
```text
pnpm exec tsc -b contexts/platform apps/api-cloud apps/local-node --pretty false
exit 0
```

**Tests**: ✅ 30 passed / ❌ 0 failed / ⚠️ 0 skipped

| Command | Exit | Result |
|---------|------|--------|
| `pnpm exec vitest run --project platform organization` | 0 | 3 files, 17 passed. Domain, memory contract, and PGlite contract. The filename filter does not collect `update-structure.test.ts`. |
| `pnpm exec vitest run --project api-cloud structure` | 0 | 1 file, 7 passed (`apps/api-cloud/test/http/update-structure.controller.test.ts`). |
| `pnpm exec vitest run --project local-node structure` | 0 | 1 file, 1 passed (`apps/local-node/test/http/update-structure.controller.test.ts`). |
| `pnpm exec vitest run --project platform contexts/platform/application/update-structure` | 0 | 1 file, 5 passed. Narrowest organization path for the use-case file the `organization` filter missed. Not an invoicing run. |

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available

No coverage package is installed. `openspec/config.yaml` sets `coverage_threshold: 0`. Lint and architecture were not part of this re-judge command set and were not re-run.

### Spec Compliance Matrix

`DEFERRED` means the design records the scenario as hybrid-phase work. It is not a cloud-slice failure and does not block archive. A cloud scenario is compliant only when a covering test passed in this run.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Company, Taxpayers and Brands | Two taxpayers | `contexts/platform/domain/organization.test.ts` > given a company, when two taxpayers with different NITs are added, then both exist with their tax profiles | ✅ COMPLIANT |
| Company, Taxpayers and Brands | Duplicate NIT | `contexts/platform/domain/organization.test.ts` > given a taxpayer with NIT 900123456, when another taxpayer with the same NIT is added, then it is rejected and the first taxpayer stays | ✅ COMPLIANT |
| Site Invoices Through Exactly One Taxpayer | Site created | `contexts/platform/domain/organization.test.ts` > given a brand and a taxpayer of the same company, when a venue is opened with both, then it invoices through that taxpayer in cloud mode with one point | ✅ COMPLIANT |
| Site Invoices Through Exactly One Taxpayer | Implicit second taxpayer | `contexts/platform/domain/organization.test.ts` > given a venue with a taxpayer, when another taxpayer is attached without the replace command, then it is rejected and the venue keeps that taxpayer. Same outcome in the use-case file and in the api-cloud 409 `addInvoicingTaxpayer` case. | ✅ COMPLIANT |
| Inventory Locations | Point created with site | The open-venue domain test asserts exactly one `point`. `organization-repository.contract.ts` > given a venue with its point, when the organization is saved and loaded, then the venue keeps one point (memory and PGlite, inside the platform `organization` run). | ✅ COMPLIANT |
| Inventory Locations | Second point | `contexts/platform/domain/organization.test.ts` > given a venue with its point, when another point is added, then it is rejected and the venue keeps one point. Also the api-cloud 409 `PointAlreadyOpen` case. | ✅ COMPLIANT |
| Kitchen Stations and Cash Registers | Stations and registers | `contexts/platform/domain/organization.test.ts` > given a venue, when stations, registers, and warehouses are added, then they stay on that venue and the company | ✅ COMPLIANT |
| Kitchen Stations and Cash Registers | Stock on a station | `contexts/platform/domain/organization.test.ts` > given a kitchen station, when stock is assigned to it, then it is rejected and the station stays unchanged. Also the use-case and api-cloud 409 `StockNotHeld` cases. | ✅ COMPLIANT |
| Structure Owned by the Cloud | Edit on the node | `apps/local-node/test/http/update-structure.controller.test.ts` > given a structure command, when it is posted to the node, then the edit is rejected and nothing is stored (403 `StructureEditRejected`; module providers and imports stay empty). Cloud-mode rejection from D-37. The test does not activate hybrid mode. | ✅ COMPLIANT |
| Structure Owned by the Cloud | Change during a cut | Design: offline copy and reconnect delivery are hybrid. | ⏸ DEFERRED |
| Structure Owned by the Cloud | Cloud cut prevents editing (requirement clause) | Same local-node test: in cloud mode the node returns 403 `StructureEditRejected` and stores nothing. | ✅ COMPLIANT |
| Tenant Isolation | Cross-tenant read | `contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` > given companies A and B, when organization_app selects venues without a tenant filter, then only the current tenant returns. The shared contract also passed on memory and PGlite for `load`. | ✅ COMPLIANT |
| Tenant Isolation | Node copy | Design: SQLite site copy is hybrid. | ⏸ DEFERRED |
| Structure Changes Recorded | Register renamed | `contexts/platform/application/update-structure/update-structure.test.ts` > given a register, when an administrator renames it, then an OrganizationChanged event records the actor and the names before and after | ✅ COMPLIANT |
| Structure Changes Recorded | Rejected change | `contexts/platform/application/update-structure/update-structure.test.ts` > given a venue with a taxpayer, when another taxpayer is attached without replace, then save is not called and nothing is emitted. Duplicate NIT and `assignStock` cases in the same file also passed. | ✅ COMPLIANT |
| Site Mode in the Structure | New site mode | `apps/api-cloud/test/http/update-structure.controller.test.ts` > given the sample pilot fixture, when it is posted, then six cloud venues are read back (`SAMPLE-NIT-01`–`06`, `label` `sample`, every venue `cloud`) | ✅ COMPLIANT |
| Site Mode in the Structure | Mode change out of scope | Design: hybrid mode and admin scope (another site's administrator) are hybrid / 0.5. | ⏸ DEFERRED |
| Structure Copy Reaches the Node | Activation snapshot | Design: pairing snapshot is hybrid. | ⏸ DEFERRED |
| Structure Copy Reaches the Node | Later change while offline | Design: cursor delivery and reconnect are hybrid. | ⏸ DEFERRED |
| Structure Copy Reaches the Node | Other sites excluded | Design: the other-sites node copy is hybrid. | ⏸ DEFERRED |

**Compliance summary**: 13/13 cloud scenarios compliant on this run. 6/6 hybrid scenarios deferred. 0 failing. 0 untested cloud scenarios. The cloud-mode cut clause is compliant via the node 403 test.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Company, Taxpayers and Brands | ✅ Implemented | `Organization.addTaxpayer` keeps distinct NITs and `taxProfileId`. Duplicate NIT throws `DuplicateNit`. SQL has `UNIQUE (company_id, nit)`. |
| Site Invoices Through Exactly One Taxpayer | ✅ Implemented | `openVenue` stores one `invoicingTaxpayerId`. `addInvoicingTaxpayer` throws `InvoicingTaxpayerAlreadyAssigned`. `replaceInvoicingTaxpayer` leaves the new taxpayer. HTTP maps that rejection to 409. |
| Inventory Locations | ✅ Implemented | `openVenue` creates one `point`. `addPoint` throws `PointAlreadyOpen`. SQL unique index `inventory_locations_one_point_per_venue`. Site and general warehouses exist on the domain. The sample fixture does not post warehouses. |
| Kitchen Stations and Cash Registers | ✅ Implemented | Stations and registers belong to the venue. `assignStock` throws `StockNotHeld` before save. |
| Structure Owned by the Cloud | ✅ Implemented for the cloud slice | Cloud `POST /tenants/:tenantId/structure` accepts a valid command. `local-node` returns 403 `StructureEditRejected` and has no organization repository. Offline copy and reconnect stay deferred. |
| Tenant Isolation | ✅ Implemented for PostgreSQL | Forced RLS on the organization tables for `organization_app`. `DrizzleOrganizationRepository` runs `SET LOCAL ROLE organization_app` and `set_config('app.tenant_id', ...)` before save and load. The omitted-filter runtime test selects `venues` only. The SQLite site copy stays deferred. |
| Structure Changes Recorded | ✅ Implemented | A successful `execute` builds `OrganizationChanged` (`actorId`, before, after) and then `save`. A thrown domain error never reaches `save`. |
| Site Mode in the Structure | ✅ Implemented for new sites | `openVenue` sets `mode: "cloud"`. The sample HTTP test reads back six cloud venues. A mode change that needs another site's administrator stays deferred. |
| Structure Copy Reaches the Node | ⏸ Deferred | Pairing snapshot, configuration cursor, and per-site store are in the design deferral list. `tools/skeleton/skeleton.test.ts` still expects `shared/sync`, `apps/admin-web`, SQLite, cursor, outbox, and pairing to be absent. That skeleton project was not executed in this run. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D-37 cloud structure only | ✅ Yes | One `UpdateStructure` flow in api-cloud. Node rejects the same POST. |
| One aggregate; domain owns the invariants | ✅ Yes | `Organization` enforces NIT, taxpayer, point, and stock rules. |
| Glossary `Venue` for the spec's site | ✅ Yes | Code uses venue. Specs still say site. |
| RLS as `organization_app`, forced, not a `WHERE`-only filter | ✅ Yes | `0002_organization.sql` plus `SET LOCAL ROLE` inside the transaction. The PGlite test selects `venues` with no `tenant_id` predicate. |
| Event in the same `save`; rejection does not save | ✅ Yes | `execute` saves only after the command is applied. Rejection tests spy on `save`. |
| HTTP 400 Zod, 409 domain | ✅ Yes | Invalid body is 400 and stores nothing. Domain errors return `{ error: <name> }` with 409. |
| Node 403 `StructureEditRejected`; no repository and no SQLite | ✅ Yes | Injected POST passed. Module providers and imports stay empty. |
| Sample NITs only; real NITs stay out of git | ✅ Yes | Fixture is `SAMPLE-NIT-01`–`06`, `label: "sample"`. Open question remains open. |
| `addPoint` and `addInvoicingTaxpayer` | ⚠️ Deviation | Design command list did not name them. They exist so HTTP can reach `PointAlreadyOpen` and `InvoicingTaxpayerAlreadyAssigned`. They support the spec. |
| `Organization.rehydrate` | ⚠️ Deviation | Not present. `load` rebuilds through `registerCompany` and the mutators. The contract test still rejects a second point after load. |
| `CHECK (id = tenant_id)` on organizations | ⚠️ Deviation | Not in the design decision table. It stops a company row from claiming another tenant. |
| `postgresOrganizations` binds Postgres | ⚠️ Deviation | The factory exists and has no callers. HTTP tests inject `InMemoryOrganizationRepository`. Task 4.4 said "Memory OK". Postgres behavior is the PGlite contract. |
| Deferred hybrid phase | ✅ Yes | Offline copy, reconnect, pairing snapshot, cursor delivery, other sites excluded, node copy, and a mode change that needs another site's administrator stay out of this slice. |
| No production data; `0002_organization.sql` is additive | ✅ Yes | Migration creates the role, tables, and forced RLS. `venue_operations` is untouched. |
| `strict_tdd` stays false | ✅ Yes | Not loaded for this verify. |

### Issues Found
**CRITICAL**: None

**WARNING**:
- Runtime evidence is the dirty working tree above HEAD `208b303`, including uncommitted invoicing and monitoring edits. Organization-scoped commands still exited 0. This run is not a clean snapshot of that commit.
- Design deviations: `addPoint`, `addInvoicingTaxpayer`, no `rehydrate`, and `CHECK (id = tenant_id)`. None break a passing cloud scenario.
- `postgresOrganizations` is never called. Cloud HTTP composition uses the in-memory repository. The PGlite contract is the Postgres proof.
- Proposal success criteria stay open. The loaded fixture is six sample-NIT cloud venues and no warehouses. Design keeps sample NITs until the owner supplies real ones, and warehouses are optional. Hybrid delivery of that structure is deferred. The named "New site mode" scenario passed on the sample.
- The omitted-filter RLS test covers `venues` only. The other structure tables use the same forced policy in SQL and were not selected without a `tenant_id` predicate in this run. The named cross-tenant scenario is sites and passed.

**SUGGESTION**: None.

### Verdict
PASS WITH WARNINGS
13/13 cloud scenarios passed in this run. Six hybrid scenarios are deferred by the design and are not cloud-slice failures. Warnings do not block archive. No product code was changed.
