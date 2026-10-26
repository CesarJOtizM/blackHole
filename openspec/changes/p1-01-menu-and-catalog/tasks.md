# Tasks: Menu and Catalog

## Review Workload Forecast

Estimated changed lines: 2200–3400. Delivery strategy: ask-on-risk.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Resolved 2026-10-23: stacked PRs to master. Implement one work unit per apply. PR 1 is tasks 1.1–1.2 only.

Cloud slice (D-37). RED/GREEN. `strict_tdd` false. Threat matrix N/A.

1. Publish rules, empty → green. PR 1. Test: `pnpm vitest run --project orders menu.test`. Harness: N/A, pure domain. Rollback: `contexts/orders`, vitest, root reference, skeleton.
2. Quote and `VenuePrice` → green. PR 2. Test: `pnpm vitest run --project orders menu.test`. Harness: N/A, pure domain. Rollback: `quote` and `VenuePrice` in `menu.ts`.
3. Save path → memory contract. PR 3. Test: `pnpm vitest run --project orders update-menu in-memory-menu`. Harness: N/A, memory ports. Rollback: `update-menu` and memory repository.
4. Venue read → green. PR 4. Test: `pnpm vitest run --project orders view-venue-menu`. Harness: N/A, memory Clock. Rollback: `view-venue-menu` and `entry-port`.
5. Postgres → PGlite green. PR 5. Test: `pnpm vitest run --project orders drizzle-menu-repository`. Harness: N/A, PGlite, no listen. Rollback: `0001_menu.sql` and drizzle adapter.
6. Cloud POST and GET → green. PR 6. Test: `pnpm vitest run --project api-cloud update-menu.controller view-venue-menu.controller`. Harness: N/A, inject, no listen. Rollback: controllers, contract, api-cloud wiring.
7. Node 403, nothing stored. PR 7. Test: `pnpm vitest run --project local-node update-menu.controller`. Harness: N/A, inject, no store. Rollback: node controller and skeleton allow.

## 1. Domain publish

- [x] 1.1 RED `contexts/orders/domain/menu.test.ts`: variants, `MissingTaxClassification`, `ForeignModifier`, combo. Add package, vitest `orders`, root reference, skeleton allow.
- [x] 1.2 GREEN `domain/menu.ts`, `domain/index.ts`. Integer COP. Prefix `menu_`. No Nest, SQL, Zod, `node:crypto`.

## 2. Quote and site price

- [x] 2.1 RED same test: quote 23,000; site price leaves brand; unavailable combo; closed window stays listed, `orderable: false`.
- [x] 2.2 GREEN `VenuePrice` and `Menu.quote`. Domain receives the minute. No tax math.

## 3. UpdateMenu and memory

- [x] 3.1 RED `application/update-menu/update-menu.test.ts`: `publishProduct`, `publishCombo`, `setVenuePrice`; rejection does not save; other-brand venue rejected.
- [x] 3.2 GREEN `update-menu.ts`, `ports/menu-repository.ts` (`load`, `save`), `ports/venue-directory.ts`.
- [x] 3.3 RED `menu-repository.contract.ts` and `in-memory-menu-repository.contract.test.ts`: round-trip; hidden tenant.
- [x] 3.4 GREEN `in-memory-menu-repository.ts`. `#application/update-menu/*`, `#application/ports/*`.

## 4. ViewVenueMenu

- [ ] 4.1 RED `view-venue-menu.test.ts`: other brand hidden; 12:00 not orderable. Bogota minute via `Intl`.
- [ ] 4.2 GREEN `view-venue-menu.ts`, `in-memory-venue-directory.ts`, `entry-port.ts`. Callers use `entry-port.ts` only.

## 5. Postgres

- [ ] 5.1 RED `drizzle-menu-repository.contract.test.ts`: PGlite, `orders_app`, forced RLS, hidden tenant, round-trip. No mock.
- [ ] 5.2 GREEN `0001_menu.sql`, `schema.ts`, `drizzle-menu-repository.ts`. Not a platform migration.

## 6. Cloud HTTP

- [ ] 6.1 RED `apps/api-cloud/test/http/update-menu.controller.test.ts`: inject POST, `x-session-id`. 200; 403 with no save; 400; 409. `menu.edit`. No `listen`.
- [ ] 6.2 GREEN `shared/contracts/menu.ts`, `index.ts`, update controller, `organization-venue-directory.ts`, `postgres-menus.ts`, module, `create-application.ts`, `package.json`, `tsconfig.json`. Audit before/after. Entry-port only.
- [ ] 6.3 RED `view-venue-menu.controller.test.ts`: `GET /tenants/:tenantId/venues/:venueId/menu` 200 with price and `orderable`; pin session only its venue.
- [ ] 6.4 GREEN view controller. Session required. Read skips `menu.edit`.

## 7. Node rejection

- [ ] 7.1 RED `apps/local-node/test/http/update-menu.controller.test.ts`: POST and GET 403 `MenuRejected`; nothing stored.
- [ ] 7.2 GREEN `src/http/update-menu.controller.ts`, `application-module.ts`. `POST menu` = `menu.edit`. No SQLite.
- [ ] 7.3 `tools/skeleton/skeleton.test.ts`: allow that controller.

## Out of scope

No hybrid copy, SQLite, node clock, admin-web, or venue-app.
