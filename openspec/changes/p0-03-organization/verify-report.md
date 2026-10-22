## Verification Report

**Change**: p0-03-organization
**Version**: N/A
**Mode**: Standard

Strict TDD is inactive (`strict_tdd: false`). Tasks were confirmed complete (18/18 checked) before the suite ran. Specs were compared first, design second, task completion third.

HEAD is `941298f` on `p0-04-identity-and-devices` (same commit as merged `p0-03-organization`). This report does not use or modify `openspec/changes/p0-04-identity-and-devices/`.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 18 |
| Tasks complete | 18 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: ✅ Passed (`pnpm typecheck`, exit 0)
```text
pnpm typecheck
$ tsc -b
exit 0
```

**Tests**: ✅ 91 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
pnpm test
$ vitest run
Test Files  18 passed (18)
     Tests  91 passed (91)
Duration  6.38s
exit 0
```

The default Vitest config includes projects `api-cloud`, `local-node`, `platform`, `spikes`, and `skeleton`. The organization domain, use-case, memory contract, PGlite contract, cloud HTTP, node HTTP, and skeleton tests are in those projects and ran in this command.

**Lint**: ❌ Failed (exit 1). Format only.
```text
pnpm lint
$ biome check .
Checked 72 files in 125ms. No fixes applied.
Found 65 errors.
Diagnostics not shown: 45.
Shown diagnostics are Biome format findings (CRLF).
exit 1
```

`pnpm exec biome lint .` (rules only, not the gate command) exited 0: `Checked 72 files in 49ms. No fixes applied.` The gate failure is line endings, including organization files (`apps/api-cloud/src/update-structure.controller.ts`, `sample-pilot-structure.ts`, `postgres-organizations.ts`, both `application-module.ts` files) and older files (`.dependency-cruiser.cjs`, `biome.json`, root `package.json`, `tools/spikes/escpos/package.json`). The repo was not reformatted.

**Architecture**: ✅ Passed (exit 0), with the known TypeScript 7 transpiler warning.
```text
pnpm architecture
no dependency violations found (61 modules, 110 dependencies cruised)
missing-typescript-transpiler: dependency-cruiser wants typescript >=2 <7; TypeScript 7 sources may be skipped.
exit 0
```

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available

No coverage package is installed. `openspec/config.yaml` sets `coverage_threshold: 0`.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Company, Taxpayers and Brands | Two taxpayers | `contexts/platform/domain/organization.test.ts` > given a company, when two taxpayers with different NITs are added, then both exist with their tax profiles | ✅ COMPLIANT |
| Company, Taxpayers and Brands | Duplicate NIT | `contexts/platform/domain/organization.test.ts` > given a taxpayer with NIT 900123456, when another taxpayer with the same NIT is added, then it is rejected and the first taxpayer stays | ✅ COMPLIANT |
| Site Invoices Through Exactly One Taxpayer | Site created | `contexts/platform/domain/organization.test.ts` > given a brand and a taxpayer of the same company, when a venue is opened with both, then it invoices through that taxpayer in cloud mode with one point | ✅ COMPLIANT |
| Site Invoices Through Exactly One Taxpayer | Implicit second taxpayer | `contexts/platform/domain/organization.test.ts` > given a venue with a taxpayer, when another taxpayer is attached without the replace command, then it is rejected and the venue keeps that taxpayer. Also the use-case and `api-cloud` 409 cases for `addInvoicingTaxpayer`. | ✅ COMPLIANT |
| Inventory Locations | Point created with site | Same open-venue test asserts exactly one `point` location. `organization-repository.contract.ts` > given a venue with its point, when the organization is saved and loaded, then the venue keeps one point (memory and PGlite). | ✅ COMPLIANT |
| Inventory Locations | Second point | `contexts/platform/domain/organization.test.ts` > given a venue with its point, when another point is added, then it is rejected and the venue keeps one point. Also the `api-cloud` 409 `PointAlreadyOpen` case. | ✅ COMPLIANT |
| Kitchen Stations and Cash Registers | Stations and registers | `contexts/platform/domain/organization.test.ts` > given a venue, when stations, registers, and warehouses are added, then they stay on that venue and the company (grill, bar, two registers, one site warehouse, one general warehouse) | ✅ COMPLIANT |
| Kitchen Stations and Cash Registers | Stock on a station | `contexts/platform/domain/organization.test.ts` > given a kitchen station, when stock is assigned to it, then it is rejected and the station stays unchanged. Also the use-case and `api-cloud` 409 `StockNotHeld` cases. | ✅ COMPLIANT |
| Structure Owned by the Cloud | Edit on the node | `apps/local-node/src/update-structure.controller.test.ts` > given a structure command, when it is posted to the node, then the edit is rejected and nothing is stored (403 `StructureEditRejected`). The test does not activate hybrid mode. | ✅ COMPLIANT |
| Structure Owned by the Cloud | Change during a cut | (none found) | ❌ UNTESTED |
| Structure Owned by the Cloud | Cloud cut prevents editing (requirement clause, no named scenario) | (none found) | ❌ UNTESTED |
| Tenant Isolation | Cross-tenant read | `contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` > given companies A and B, when organization_app selects venues without a tenant filter, then only the current tenant returns. The shared contract also passed on memory and PGlite for `load`. | ✅ COMPLIANT |
| Tenant Isolation | Node copy | (none found) | ❌ UNTESTED |
| Structure Changes Recorded | Register renamed | `contexts/platform/application/update-structure/update-structure.test.ts` > given a register, when an administrator renames it, then an OrganizationChanged event records the actor and the names before and after | ✅ COMPLIANT |
| Structure Changes Recorded | Rejected change | `contexts/platform/application/update-structure/update-structure.test.ts` > given a venue with a taxpayer, when another taxpayer is attached without replace, then save is not called and nothing is emitted. Duplicate NIT and `assignStock` cases in the same file also passed. | ✅ COMPLIANT |
| Site Mode in the Structure | New site mode | `apps/api-cloud/src/update-structure.controller.test.ts` > given the sample pilot fixture, when it is posted, then six cloud venues are read back | ✅ COMPLIANT |
| Site Mode in the Structure | Mode change out of scope | (none found) | ❌ UNTESTED |
| Structure Copy Reaches the Node | Activation snapshot | (none found) | ❌ UNTESTED |
| Structure Copy Reaches the Node | Later change while offline | (none found) | ❌ UNTESTED |
| Structure Copy Reaches the Node | Other sites excluded | (none found) | ❌ UNTESTED |

**Compliance summary**: 13/19 named scenarios compliant. 6 named scenarios untested. 1 additional requirement clause untested (cloud-mode cut prevents editing).

Passing runtime evidence is `pnpm test` exit 0 (91/91). A scenario is compliant only where the cited test is in that run and asserts the scenario outcome.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Company, Taxpayers and Brands | ✅ Implemented | `Organization.addTaxpayer` keeps distinct NITs and `taxProfileId`. Duplicate NIT throws `DuplicateNit` and leaves the tree unchanged. SQL adds `UNIQUE (company_id, nit)`. |
| Site Invoices Through Exactly One Taxpayer | ✅ Implemented | `openVenue` stores one `invoicingTaxpayerId`. `addInvoicingTaxpayer` throws `InvoicingTaxpayerAlreadyAssigned`. `replaceInvoicingTaxpayer` leaves exactly the new taxpayer. HTTP maps that rejection to 409 and does not append an event. |
| Inventory Locations | ✅ Implemented | `openVenue` creates one `point`. `addPoint` throws `PointAlreadyOpen`. SQL unique index `inventory_locations_one_point_per_venue`. Site and general warehouses exist on the domain. The sample fixture does not post warehouses. |
| Kitchen Stations and Cash Registers | ✅ Implemented | Stations and registers belong to the venue. `assignStock` throws `StockNotHeld` before save. |
| Structure Owned by the Cloud | ⚠️ Partial | Cloud `POST /tenants/:tenantId/structure` accepts a valid command. `local-node` returns 403 `StructureEditRejected` and has no organization repository. No cut, offline copy, or reconnect delivery exists. `UpdateStructure.execute` does not consult connectivity. |
| Tenant Isolation | ⚠️ Partial | PostgreSQL enables and forces RLS on organizations, taxpayers, brands, venues, inventory locations, kitchen stations, cash registers, and organization changes for `organization_app`. `DrizzleOrganizationRepository` runs `SET LOCAL ROLE organization_app` and `set_config('app.tenant_id', ...)` before save and load. The omitted-filter runtime test selects `venues` only. SQLite site copy is absent. |
| Structure Changes Recorded | ✅ Implemented | A successful `execute` builds `OrganizationChanged` (`actorId`, before, after) and then `save`. A thrown domain error never reaches `save`. Runtime proof is the rename and the rejection cases. |
| Site Mode in the Structure | ⚠️ Partial | `openVenue` sets `mode: "cloud"`. The sample HTTP test reads back six venues, all `cloud`, with `SAMPLE-NIT-01` through `SAMPLE-NIT-06` and `label: "sample"`. There is no mode-change command and no administrator scope check. |
| Structure Copy Reaches the Node | ❌ Not implemented | No pairing snapshot, configuration cursor, reconnect delivery, or per-site store. `tools/skeleton/skeleton.test.ts` passed and still expects `shared/sync`, `apps/admin-web`, SQLite, cursor, outbox, and pairing to be absent. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| One `UpdateStructure` command union, not `CreateOrganization` | ✅ Yes | Single use case and one `POST /tenants/:tenantId/structure`. |
| One aggregate; domain owns the invariants | ✅ Yes | `Organization` enforces NIT, taxpayer, point, and stock rules. |
| Glossary `Venue` for the spec's site | ✅ Yes | Code uses venue. Specs still say site. |
| RLS as `organization_app`, forced, not a `WHERE`-only filter | ✅ Yes | `0002_organization.sql` plus `SET LOCAL ROLE` inside the transaction. The PGlite test selects `venues` with no `tenant_id` predicate. |
| Event in the same `save`; rejection does not save | ✅ Yes | `execute` saves only after `applyCommand` returns. Rejection tests spy on `save`. |
| HTTP 400 Zod, 409 domain | ✅ Yes | Invalid body is 400 and stores nothing. Domain errors return `{ error: <name> }` with 409. |
| Node 403 `StructureEditRejected`; no repository and no SQLite | ✅ Yes | Injected POST. Module providers and imports stay empty. No `listen()`. |
| Sample NITs only; real NITs stay out of git | ✅ Yes | Fixture is `SAMPLE-NIT-01`–`06`, `label: "sample"`. Open question remains open. |
| `addPoint` and `addInvoicingTaxpayer` | ⚠️ Deviation | Design command list did not name them. Apply added both so HTTP can reach `PointAlreadyOpen` and `InvoicingTaxpayerAlreadyAssigned`. They support the spec. |
| `Organization.rehydrate` | ⚠️ Deviation | Not added. `load` rebuilds through `registerCompany` and the mutators. The contract test still rejects a second point after load. |
| `CHECK (id = tenant_id)` on organizations | ⚠️ Deviation | Not in the design decision table. It stops a company row from claiming another tenant. |
| `postgresOrganizations` binds Postgres | ⚠️ Deviation | The factory exists and is not imported by `createApplication` or any test. HTTP tests inject `InMemoryOrganizationRepository`. Tasks said "Memory OK". `postgresVenueOperations` has the same uncalled shape. |
| Deferred hybrid phase (sync, cursor, outbox, SQLite, pairing, reconnect, hybrid mode, admin scope, `apps/admin-web`) | ✅ Yes, against the design | Those files stay absent, and the skeleton test passed. That deferral leaves six spec scenarios untested. |
| No production data; `0002_organization.sql` is additive | ✅ Yes | Migration creates the role, tables, and forced RLS. `venue_operations` is untouched. |
| `strict_tdd` stays false | ✅ Yes | Not loaded for this verify. |

### Issues Found
**CRITICAL**:
- Change during a cut is untested and unimplemented. The spec requires a hybrid site to keep its copy while offline and to receive a register added on the web once on reconnect. There is no cursor, outbox, or reconnect test.
- Node copy is untested and unimplemented. The spec requires a node of site 1 to hold no other site's data. The node has no store. The 403 test only proves a rejected POST does not register a repository.
- Mode change out of scope is untested and unimplemented. The spec requires an administrator of site 1 to be refused when requesting hybrid for site 2. There is no actor scope and no mode-change command. Users and roles are deferred, and this scenario was not removed from the spec.
- Activation snapshot is untested and unimplemented. The spec requires pairing to deliver one site's company, taxpayer, brand, stations, registers, and inventory locations. Pairing does not exist. The sample fixture also posts no stations, registers, or warehouses.
- Later change while offline is untested and unimplemented. The spec requires one cursor-ordered delivery of a station added in the cloud while the hybrid site is offline.
- Other sites excluded is untested and unimplemented. The spec requires the node of site 3, in a six-site company, to hold none of the other five sites.
- Cloud-mode cut prevents editing is an untested requirement clause. "In cloud mode, a cut MUST prevent editing" has no scenario, no connectivity check, and no test. The design deferral list does not name this clause.

**WARNING**:
- `pnpm lint` exited 1 with 65 Biome format diagnostics (45 not shown). `biome lint` exited 0. The failure is CRLF, including this change's files and older files. The tree was not reformatted.
- `pnpm architecture` exited 0 and printed `missing-typescript-transpiler` for TypeScript 7.
- Design deviations: `addPoint`, `addInvoicingTaxpayer`, no `rehydrate`, and `CHECK (id = tenant_id)`. None of these break a passing scenario.
- `postgresOrganizations` is never called. Postgres behavior is proven by the PGlite repository contract, not by the cloud HTTP composition.
- Proposal success criterion "the full pilot structure (6 sites, their NITs and warehouses) is loaded" is not met. The loaded fixture is six sample-NIT cloud venues and no warehouses. The design open question still says real NITs are unknown. The named "New site mode" scenario passed on that sample.
- The omitted-filter RLS test covers `venues` only. The other structure tables use the same policy in SQL and were not selected without a `tenant_id` predicate at runtime.

**SUGGESTION**: None.

### Verdict
FAIL
13/19 named scenarios compliant. Domain, use-case, RLS, cloud HTTP, and node 403 tests passed (91/91), and typecheck and architecture exited 0. Six spec scenarios for hybrid copy, reconnect, and administrator scope have no passing test, and the cloud-mode cut clause is also untested. Archive is blocked.

### Orchestrator reading

D-37 keeps the hybrid copy out of this delivery. The six untested scenarios (offline copy, pairing snapshot, cursor delivery, other sites excluded, node copy, mode change out of scope) stay in the spec for the hybrid phase. They are not apply work on the cloud slice. In cloud mode a cut already prevents editing: the only writer is `api-cloud`, and `local-node` returns 403 `StructureEditRejected` without a store. `verify` stays `partial`. Do not archive, and do not start a hybrid apply from this report.
