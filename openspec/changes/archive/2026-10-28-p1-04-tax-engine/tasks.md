# Tasks: Tax Engine

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2600–3800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Units 1–11 in order |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Resolved 2026-10-28: same resolution as menu and attendance. Stacked PRs to master. One work unit per apply. PR 1 is tasks 1.1–1.3 only.

Cloud slice (D-37, D-08, D-09, D-29). RED then GREEN (ADR-017). `strict_tdd` false. Test titles: `given …, when …, then …`. Threat matrix N/A. Split a unit over 400 lines. Golden cases are unit tests of `calculateTaxes`. No Factus call (delivery 1.5).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Start: none. Finish: breakdown green. Verify: 10,800 → 10,000 + 800. | 1 | `pnpm vitest run --project invoicing domain/calculate-taxes` | N/A: pure domain | package, vitest, `decimal.js`, skeleton context |
| 2 | Start: breakdown. Finish: tip, bag, date, excluded. Verify: tip unchanged; bag 132. | 2 | `pnpm vitest run --project invoicing domain/calculate-taxes` | N/A: pure domain | those branches in `calculate-taxes.ts` |
| 3 | Start: line taxes. Finish: withholdings green. Verify: agent three amounts; consumer rejected. | 3 | `pnpm vitest run --project invoicing assess-withholdings` | N/A: pure domain | `assess-withholdings.ts` |
| 4 | Start: domain green. Finish: publish green. Verify: overlap unsaved; old rate kept. | 4 | `pnpm vitest run --project invoicing publish-tax-rule` | N/A: memory ports | `publish-tax-rule/` and its port |
| 5 | Start: rules save. Finish: adopt green. Verify: copy edit leaves the template. | 5 | `pnpm vitest run --project invoicing adopt-fiscal-template` | N/A: memory ports | `adopt-fiscal-template/` and its port |
| 6 | Start: ports exist. Finish: quote use case. Verify: `ruleId`, version, missing rule. | 6 | `pnpm vitest run --project invoicing application/calculate-taxes` | N/A: memory ports | that folder and `entry-port.ts` |
| 7 | Start: use cases. Finish: memory contract. Verify: hidden tenant; copy is not the template. | 7 | `pnpm vitest run --project invoicing adapters/memory` | N/A: memory ports | `adapters/memory` |
| 8 | Start: contract. Finish: PGlite green. Verify: forced RLS; hidden tenant. | 8 | `pnpm vitest run --project invoicing adapters/postgres` | N/A: PGlite, no live Postgres | `0009_tax.sql` and drizzle adapters |
| 9 | Start: store green. Finish: quote HTTP. Verify: 200, 403, 400, 409. | 9 | `pnpm vitest run --project platform permission-catalog` then `--project api-cloud tax-quote.controller` | N/A: `inject`, no `listen` | catalog row, quote controller, api-cloud wiring |
| 10 | Start: quote route. Finish: configure HTTP. Verify: 409 keeps the prior version. | 10 | `pnpm vitest run --project api-cloud tax-configuration.controller` | N/A: `inject`, no `listen` | configuration controller |
| 11 | Start: cloud routes. Finish: node 403. Verify: `TaxRejected`; nothing stored. | 11 | `pnpm vitest run --project local-node tax.controller` then `--project skeleton skeleton.test` | N/A: `inject`, no store | node controller and skeleton allow |

## Phase 1: Domain (units 1–3)

- [x] 1.1 Create `contexts/invoicing/package.json` (`@blackhole/invoicing`, export `./domain`, `#domain/*`), `tsconfig.json`, root `tsconfig.json` reference, vitest project `invoicing`, and catalog `decimal.js`. `tools/skeleton/skeleton.test.ts`: allow context `invoicing`.
- [x] 1.2 RED `domain/calculate-taxes.test.ts`: `G-INC-8` 10,800 → base 10,000 and INC 800 (`04`); `G-VAT-19` 11,900 → 10,000 and VAT 1,900 (`01`); `G-VAT-5` 10,500 → 10,000 and VAT 500; no rule throws `NoMatchingTaxRule`; gap past ±500 rejected; each line returns `ruleId` and `version`.
- [x] 1.3 GREEN `domain/calculate-taxes.ts`, `domain/index.ts`. Integer COP, `decimal.js` half-even. Base = price / (1 + sum of rates), two decimals. Prefix `tax_`. No Nest, SQL, Zod, or `node:crypto`.
- [x] 1.4 RED same test: `G-TIP` 1,000 leaves 10,000 and 800, and an excluded tip is untaxed; `G-BAG` 66 × 2 = 132 with no DIAN code; dine-in with no bags has none; delivery bags only when the venue flag is on; `G-DATE` March 31 is 5% and April 1 is 19%; non-VAT taxpayer excludes every product line (`G-EXCLUDED`). A mandatory delivery charge is taxable.
- [x] 1.5 GREEN the same function. Ignore `voluntaryTipCop`. Fixed bag line. Match regime, VAT, INC, franchise, classification, optional channel, and date. Channel `dine-in`, `take-out`, or `delivery`.
- [x] 1.6 RED `domain/assess-withholdings.test.ts`: a withholding agent returns income, VAT, and ICA, and invoice taxes stay unchanged; a final consumer is rejected. Municipality is not an ICA rate. Nothing is stored.
- [x] 1.7 GREEN `domain/assess-withholdings.ts`. No payment, shift, or cash register.

## Phase 2: Use cases (units 4–6)

- [x] 2.1 RED `application/publish-tax-rule/publish-tax-rule.test.ts`: an overlapping date on the same key is not saved; a new rate inserts a version and keeps the old one. Seed `independent-restaurant` (ordinary, INC, not franchise, 8%, `04`), `franchise` (VAT 19%, `01`), `simple-inc` (SIMPLE, INC 8%, `O-47`), VAT 5% (`01`), exempt (`01` at 0%), `is_excluded`, not taxed, ultra-processed (`35`, rate on the row), and a fixed bag. RUT `O-13`, `O-15`, `O-23`, `O-47`, `R-99-PN` stored only.
- [x] 2.2 GREEN `publish-tax-rule.ts`, `ports/tax-rule-repository.ts`. Add `#application/publish-tax-rule/*` and `#application/ports/*` before importing them.
- [x] 2.3 RED `application/adopt-fiscal-template/adopt-fiscal-template.test.ts`: adopting "SIMPLE regime, INC responsible" copies profile and rules onto that taxpayer; editing the copy leaves the template and other taxpayers. Profile: person type, regime `ordinary` or `simple`, VAT, INC, RUT, franchise, municipality per site. Do not change `Organization` or `taxProfileId`.
- [x] 2.4 GREEN `adopt-fiscal-template.ts`, `ports/fiscal-profile-repository.ts`. Add `#application/adopt-fiscal-template/*`.
- [x] 2.5 RED `application/calculate-taxes/calculate-taxes.test.ts`: profile, lines, date, channel, tip, and bags return `ruleId` and `version`; no rules throws `NoMatchingTaxRule`.
- [x] 2.6 GREEN `calculate-taxes.ts`, `entry-port.ts`. Load profile and dated rules through ports. Add `#application/calculate-taxes/*`. Callers import `@blackhole/invoicing/application/entry-port` only.

## Phase 3: Adapters (units 7–8)

- [x] 3.1 RED `ports/tax-rule-repository.contract.ts`, `ports/fiscal-profile-repository.contract.ts`, and `adapters/memory/*.contract.test.ts`: round-trip, hidden tenant, appended versions, copy is not the template row.
- [x] 3.2 GREEN the in-memory repositories. Add `#adapters/memory/*`.
- [x] 3.3 RED `adapters/postgres/*.contract.test.ts`: PGlite, `invoicing_app`, forced RLS, hidden tenant, round-trip. No Drizzle mock. `0009_tax.sql`. Leave `0001`–`0008`.
- [x] 3.4 GREEN `0009_tax.sql`, `schema.ts`, and the drizzle repositories. Add `#adapters/postgres/*`. Catalog `drizzle-orm` and `@electric-sql/pglite` on `@blackhole/invoicing`. Not a platform migration. No SQLite.

## Phase 4: Cloud HTTP (units 9–10)

- [x] 4.1 RED `contexts/platform/domain/permission-catalog.test.ts`: `tax.configure` is YES for owner and NO for every other matrix role.
- [x] 4.2 GREEN `permission-catalog.ts`: `TAX_CONFIGURE` is `tax.configure`.
- [x] 4.3 RED `apps/api-cloud/test/http/tax-quote.controller.test.ts`: `inject` and `x-session-id`; `POST /tenants/:tenantId/tax-quotes` is 200 for `G-INC-8`; 403 without `tax.configure` saves nothing; 400 on a bad body; 409 `{ error: "NoMatchingTaxRule" }`. No `listen`. No Factus call.
- [x] 4.4 GREEN the quote controller. Zod `safeParse` and `z.enum` channel in `apps/api-cloud`. Wire `application-module.ts`, `create-application.ts`, api-cloud `package.json`, and `tsconfig.json`. Entry-port only. No `shared/contracts`.
- [x] 4.5 RED `apps/api-cloud/test/http/tax-configuration.controller.test.ts`: publish 200 inserts a version; overlap 409 does not overwrite; adopt 200 copies; a copy edit leaves the template; 403 saves nothing.
- [x] 4.6 GREEN the configuration controller: `POST /tenants/:tenantId/tax-rules` and `POST /tenants/:tenantId/fiscal-profiles/adopt`. Same session and `tax.configure` gate. No Organization write.

## Phase 5: Node rejection (unit 11)

- [x] 5.1 RED `apps/local-node/test/http/tax.controller.test.ts`: quote, publish, and adopt return 403 `TaxRejected` and store nothing.
- [x] 5.2 GREEN `apps/local-node/src/http/tax.controller.ts` and `application-module.ts`. `POST tax-rules` = `tax.configure`. No repository and no SQLite.
- [x] 5.3 `tools/skeleton/skeleton.test.ts`: allow that controller.

## Out of scope

No SQLite, outbox, sync, Factus HTTP, credit notes, cash shifts, payments, dining checks, admin-web, or sale documents. No non-VAT bag line. No `not_taxed` versus `is_excluded` mapping. No menu fixture change.
