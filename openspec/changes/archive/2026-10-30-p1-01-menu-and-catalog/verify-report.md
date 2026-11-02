## Verification Report

**Change**: p1-01-menu-and-catalog
**Version**: N/A
**Mode**: Standard
**Evidence**: commit `208b303` on branch `verify/p1-01-menu`
**Workspace**: `C:\Users\csar-\Proyectos\blackHole-verify-menu`

`strict_tdd` is false. The strict-TDD module was not loaded. `state.yaml` said `apply: pending`. That field was stale: `tasks.md` has every implementation task checked, and the menu code is on this commit. Apply was not started.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 19 |
| Tasks complete | 19 |
| Tasks incomplete | 0 |

Tasks 1.1–7.3 are checked. Hybrid copy, SQLite, the node clock, `admin-web`, and `venue-app` stay out of the task list.

### Build & Tests Execution

**Install**: ✅ Passed

```text
pnpm install --frozen-lockfile
exit 0
```

**Build**: ✅ Passed

```text
pnpm exec tsc -b contexts/orders apps/api-cloud apps/local-node --pretty false
exit 0
```

No diagnostics were printed.

**Tests**: ✅ 35 passed / 0 failed / 0 skipped

```text
pnpm exec vitest run --project orders --project api-cloud --project local-node menu
exit 0
Test Files  8 passed (8)
Tests       35 passed (35)
Duration    6.17s
```

The `menu` filter selected the menu tests. The 8 files and 35 tests match this set:

| File | Tests |
|------|-------|
| `contexts/orders/domain/menu.test.ts` | 10 |
| `contexts/orders/application/update-menu/update-menu.test.ts` | 5 |
| `contexts/orders/application/view-venue-menu/view-venue-menu.test.ts` | 4 |
| `contexts/orders/adapters/memory/in-memory-menu-repository.contract.test.ts` | 2 |
| `contexts/orders/adapters/postgres/drizzle-menu-repository.contract.test.ts` | 3 |
| `apps/api-cloud/test/http/update-menu.controller.test.ts` | 6 |
| `apps/api-cloud/test/http/view-venue-menu.controller.test.ts` | 4 |
| `apps/local-node/test/http/update-menu.controller.test.ts` | 1 |

Task 7.3 lives in the skeleton project, which that filter does not include. A supplementary command was run:

```text
pnpm exec vitest run --project skeleton skeleton.test.ts --reporter=verbose
exit 0
Test Files  1 passed (1)
Tests       9 passed (9)
```

The passing local-node allow-list case includes `http/update-menu.controller.ts`.

**Coverage**: Not available / threshold: 0% → ➖ Not available

No coverage package is configured. `pnpm architecture` was not re-run. The prescribed commands were install, the scoped Vitest filter, and the scoped `tsc -b`.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Brand-Owned Products and Variants | Product with variants | `contexts/orders/domain/menu.test.ts` > given brand B with product Burger and variants single and double, when an admin of brand B publishes the product, then the menu lists Burger with both variants | ✅ COMPLIANT |
| Brand-Owned Products and Variants | Other brand isolated | `contexts/orders/application/view-venue-menu/view-venue-menu.test.ts` > given site S belongs to brand A, when site S requests its menu, then no product of brand B is returned | ✅ COMPLIANT |
| Modifiers With and Without Cost | Paid modifier | `contexts/orders/domain/menu.test.ts` > given Burger priced 20000 with modifier extra cheese at 3000, when a waiter selects the modifier, then the line price is 23000 | ✅ COMPLIANT |
| Modifiers With and Without Cost | Foreign modifier rejected | `contexts/orders/domain/menu.test.ts` > given modifier no ice belongs only to drinks, when it is attached to Burger in an order line, then the line is rejected and the menu stays unchanged | ✅ COMPLIANT |
| Combos | Combo sold as a unit | `contexts/orders/domain/menu.test.ts` > given combo Lunch with a burger and a soda at 28000, when the combo is shown in the menu, then it appears as one item priced 28000 with its components listed | ✅ COMPLIANT |
| Combos | Unavailable component | `contexts/orders/domain/menu.test.ts` > given the soda of combo Lunch is unavailable at site S, when site S shows its menu, then Lunch stays listed and is not orderable | ✅ COMPLIANT |
| Mandatory Tax Classification | Classified product published | `contexts/orders/application/ports/menu-repository.contract.ts` > given a menu with a product, a combo and a site price, when it is saved, then the same copy can be read back | ✅ COMPLIANT |
| Mandatory Tax Classification | Missing classification | `contexts/orders/application/update-menu/update-menu.test.ts` > given a product without tax classification, when an admin publishes it, then publication is rejected and nothing is saved | ✅ COMPLIANT |
| Site Price, Availability and Schedule | Site price override | `contexts/orders/domain/menu.test.ts` > given brand price 20000 for Burger, when site S sets 22000, then site S sells at 22000 and the brand product stays 20000 | ✅ COMPLIANT |
| Site Price, Availability and Schedule | Outside schedule | `contexts/orders/application/view-venue-menu/view-venue-menu.test.ts` > given Breakfast is sold at site S from 07:00 to 11:00, when a waiter browses the menu at 12:00 in Bogota, then Breakfast stays listed with orderable false | ✅ COMPLIANT |
| Menu Edit Permission | Admin edits own site | `apps/api-cloud/test/http/update-menu.controller.test.ts` > given a site administrator, when she sets her own site price, then the response is 200 and the audit records the old and new price | ✅ COMPLIANT |
| Menu Edit Permission | Outside scope | `apps/api-cloud/test/http/update-menu.controller.test.ts` > given a site administrator, when she sets the price of another site, then the response is 403 and the price stays unchanged | ✅ COMPLIANT |
| Menu Copy to the Operating Site | Waiter phone shows menu | `apps/api-cloud/test/http/view-venue-menu.controller.test.ts` > given a pin session at noon in Bogota, when GET /menu is injected for its venue, then the response is 200 with the site price and orderable flag | ⚠️ PARTIAL |
| Menu Copy to the Operating Site | Change during an internet cut (hybrid) | `apps/local-node/test/http/update-menu.controller.test.ts` > given menu commands, when they are posted or read on the node, then both are rejected and nothing is stored | ⚠️ SPEC/DESIGN CONFLICT |

**Compliance summary**: 12/14 scenarios compliant. One is partial. One is a spec/design conflict, not an untested implementation gap.

The same passing runs also cover the stored variants (`update-menu.test.ts`), the other-site brand price of 20,000, the domain `viewAt` window, the cloud POST 200/403/400/409 cases, the cashier read without `menu.edit`, the pin session denied on another venue, and the PGlite round-trip plus forced RLS (`drizzle-menu-repository.contract.test.ts`, 3 tests). The repository contract ran twice, in memory and in PGlite. The classified-product row uses that round-trip because `products` equality keeps `taxClassification: "restaurant service"` on the copy that is read back. The domain publish test also keeps the classification on the product.

Partial row:

- **Waiter phone shows menu.** The passing pin-session GET returns 200 with Breakfast at 15,000 `orderable: false`, the site burger at 22,000 `orderable: true`, and `combos: []`. The fixture publishes neither variants, nor modifiers, nor a combo, so the response assertion does not show those three. `Menu.viewAt` and `venueMenu` do carry variants, modifiers, combos, the price in force, and `orderable`. `apps/venue-app` and `apps/admin-web` are deferred.

Spec/design conflict:

- **Change during an internet cut (hybrid).** The spec says the hybrid node keeps selling on its current copy and applies the new version once after reconnection. Design D-37 rejects the node copy: both routes return 403 `{ error: "MenuRejected" }` and store nothing. Tasks 7.1–7.2 and the deferred section say the same. The passing node test proves that designed rejection. It does not prove a versioned copy or exactly-once delivery. This is not missing apply work on the cloud slice.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Brand products and variants | ✅ Implemented | One `Menu` per brand. `publishProduct` stores optional variants. A site read loads only `VenueDirectory.brandOf`. An unknown venue returns null and does not load. |
| Modifiers | ✅ Implemented | `quote` adds each modifier price to the site price, or the brand price. A modifier id that is not on the product throws `ForeignModifier`. A price of 0 can be published. |
| Combos | ✅ Implemented | One combo price and component ids. `viewAt` lists the combo and sets `orderable: false` when a component is not orderable. |
| Tax classification | ✅ Implemented | An empty classification throws `MissingTaxClassification` and does not save. The classification is stored and returned by `viewAt`. There is no tax arithmetic. |
| Site price, availability, schedule | ✅ Implemented | `setVenuePrice` does not write the brand product. Another site keeps the brand price. Outside `07:00`–`11:00`, the item stays listed with `orderable: false`. |
| Menu edit permission and audit | ✅ Implemented | `POST /tenants/:tenantId/menu` evaluates `menu.edit` before save. A denial returns 403 `MenuEditDenied` and does not save. A site admin of her own venue gets 200. Audit `menu.edit` records `{ price }` before and after. `siteId` is the venue, or the brand id on a brand edit. Zod failure is 400. A domain rejection is 409. |
| Cloud venue read | ✅ Implemented | `GET /tenants/:tenantId/venues/:venueId/menu` requires a session and does not require `menu.edit`. A pin session for another venue is 403 `MenuReadDenied`. A missing session is 400. |
| Hybrid copy | ⚠️ Conflict | Not implemented, by design. The node has no repository and no SQLite. |
| Postgres copy | ✅ Implemented | `0001_menu.sql` creates `orders_app`, the menu tables, and forced RLS on `tenant_id`. It is not a platform migration. The PGlite test selects `menus` as `orders_app` without a tenant predicate and sees only tenant A. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cloud slice inside `contexts/orders`. Domain has no Nest, SQL, Zod, or `node:crypto` | ✅ Yes | `menu.ts` has no such imports. Prices are integer COP. Ids use the `menu_` prefix. Both rules have passing tests. |
| One `Menu` per brand. `VenuePrice` is the override only | ✅ Yes | A site price does not change `products`. Quote uses the site price, else the brand price. |
| `UpdateMenu` command union: `publishProduct`, `publishCombo`, `setVenuePrice` | ✅ Yes | One `POST /tenants/:tenantId/menu`. |
| `ViewVenueMenu` on the cloud. Bogota minute via `Intl` | ✅ Yes | `view-venue-menu.ts` formats `Clock.now()` as `America/Bogota` `HH:mm` and passes that minute to `viewAt`. The noon case uses `2026-10-26T17:00:00.000Z`. |
| `EvaluatePermission` (`menu.edit`) in the controller. `orders` stays off platform interiors | ✅ Yes | The use case comes from `@blackhole/orders/application/entry-port`. Nest port tokens are package exports, the same shape platform already uses. |
| A peso cap on `menu.edit` | ✅ Yes, rejected | The design rejects a peso cap and treats the cap as scope. The passing tests cover an in-scope site admin and a 403 for the other site. `value` sent to `EvaluatePermission` is null. |
| `RecordAuditEvent` after save. Action `menu.edit`, before and after | ✅ Yes | The controller loads the previous price, calls `execute`, then records the audit. A 403 or 409 leaves the audit list empty in the passing tests. |
| `VenueDirectory` in api-cloud over the organization repository | ✅ Yes | `organization-venue-directory.ts` is the adapter. The use case checks the brand before `setVenuePrice`. |
| `0001_menu.sql`, `orders_app`, forced RLS, PGlite | ✅ Yes | The contract test applies that SQL in-process and closes the client. No Drizzle mock and no listen. |
| Node copy rejected. 403 `{ error: "MenuRejected" }`, no store | ✅ Yes | POST and GET both return that body. `routePermissions["POST menu"]` is `menu.edit`. GET is absent from the map. `ApplicationModule` providers and imports stay empty. |
| Public surface `application/entry-port.ts` | ✅ Yes | `UpdateMenu`, `ViewVenueMenu`, `ForeignVenue`, and the menu domain errors are re-exported. |
| `postgresMenus` bound at cloud startup | ⚠️ Partial | `postgresMenus` exists and is not called. `ApplicationModule` uses `dependencies.menus ?? new InMemoryMenuRepository()`. `create-application.ts` is unchanged. HTTP tests inject the memory repository. Persistence is proven by the PGlite contract, not by the cloud process composition. |
| Deferred hybrid phase (D-37) | ✅ Yes, against the design | No versioned copy, outbox, sync cursor, SQLite, or node clock. This follows the design and contradicts the hybrid spec scenario. |
| Deferred UI | ✅ Yes | `apps/admin-web` and `apps/venue-app` are absent from this slice. |

### Issues Found

**CRITICAL**:

- None.

**WARNING**:

- The hybrid cut scenario remains in `specs/catalog/spec.md` and is not implemented. The passing node test proves 403 `MenuRejected` and an empty module. That matches design D-37 and tasks 7.1–7.2. It contradicts the spec sentence that the node keeps its copy and applies the new version once after reconnection. Do not start a hybrid apply from this report.
- The waiter-phone scenario is PARTIAL. The passing pin GET proves products, the site price, and `orderable` for a registered device. It does not publish variants, modifiers, or a combo. The phone and the admin UI stay deferred.
- `postgresMenus` is never called. A cloud process that does not pass `menus` stores the catalog in memory. The PGlite repository contract passed.
- The three proposal success checkboxes are still open. The site-price checkbox is covered by the passing quote tests. The waiter-phone checkbox and the hybrid-reconnect checkbox wait on the deferred UI and on D-37.
- Process, not a product failure: `apply-progress.md` records work units over the 400-line budget and `size:exception` was not granted. This phase did not recompute the diff.

**SUGGESTION**:

- Before archive merges the catalog delta, move the hybrid cut scenario out of this change's delivered behavior so the main spec does not record a versioned node copy that this slice does not have.
- A published modifier with price 0 is allowed. `quote` adds `modifier.price`. No test asserts that a free modifier leaves the line at the product price.

### Verdict

PASS WITH WARNINGS

12/14 scenarios are compliant, one is partial, and the hybrid cut scenario is a spec/design conflict. Tasks 1.1–7.3 are complete. The scoped menu tests passed (35/35, exit 0), the skeleton allow-list passed (9/9, exit 0), and `tsc -b contexts/orders apps/api-cloud apps/local-node` exited 0. No CRITICAL remains. Archive can proceed only if it does not treat the deferred hybrid copy as delivered behavior.
