# Apply progress: p1-04-tax-engine

Work unit 1. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is PR 1 and stops at tasks 1.1–1.3. Not committed. `size:exception` was not granted.

## Completed tasks

- [x] 1.1 Create `contexts/invoicing` (`@blackhole/invoicing`, export `./domain`, `#domain/*`), root tsconfig reference, vitest project `invoicing`, catalog `decimal.js` 10.6.0, and allow context `invoicing` in the skeleton test.
- [x] 1.2 RED `domain/calculate-taxes.test.ts` for G-INC-8, G-VAT-19, G-VAT-5, `NoMatchingTaxRule`, a gap past ±500, and `ruleId` plus `version` on each line.
- [x] 1.3 GREEN `domain/calculate-taxes.ts` and `domain/index.ts`. Integer COP in, `decimal.js` half-even, base = price / (1 + sum of rates) at two decimals, identifiers use the `tax_` prefix.
- [x] 1.4 RED `domain/calculate-taxes.test.ts` for G-TIP, an untaxed excluded tip, G-BAG, dine-in with no bags, delivery bags gated by the venue flag, G-DATE, G-EXCLUDED, and a taxable mandatory delivery charge.
- [x] 1.5 GREEN `domain/calculate-taxes.ts`. `voluntaryTipCop` is left out of the tax and the cash-rounding gap. A fixed bag line has no DIAN code. Rules match regime, VAT, INC, franchise, classification, optional channel, and inclusive dates. Channels are `dine-in`, `take-out`, and `delivery`.

## Work Unit Evidence

### Unit 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing domain/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. Repeated after `pnpm biome check --write` on the touched files: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `calculateTaxes` does not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing`, the `invoicing` project in `vitest.config.ts`, the `contexts/invoicing` reference in `tsconfig.json`, `decimal.js` in `pnpm-workspace.yaml` and `pnpm-lock.yaml`, and `invoicing` in `allowedContexts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.2 → 1.3 | `pnpm vitest run --project invoicing domain/calculate-taxes` exit 1. `FAIL contexts/invoicing/domain/calculate-taxes.test.ts` — `Cannot find module '#domain/calculate-taxes.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The package and vitest project already existed. | Same command after `domain/calculate-taxes.ts` and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. Repeated after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| 1.4 → 1.5 | Same command, exit 1. `Test Files  1 failed (1)`. `Tests  10 failed | 7 passed (17)`. The seven unit 1 cases stayed green. The ten new cases failed: tip and delivery charge threw `CashRoundingRejected`; bags, dates, exclusion, channel, and profile match returned the wrong breakdown. | Same command after the matcher, tip, bag, and exclusion behavior: exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. Repeated after `pnpm biome check --write` on the touched domain files: exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. |

## Work unit 2

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 2 slice and stops at tasks 1.4–1.5. Not committed. `size:exception` was not granted.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing domain/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. Repeated after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `calculateTaxes` does not open files, sockets, or a database. |
| Rollback boundary | The tip, bag, date, exclusion, and profile/channel match branches in `contexts/invoicing/domain/calculate-taxes.ts`, the new cases in `calculate-taxes.test.ts`, and the `BagLine`, `FiscalProfile`, `TaxChannel`, and `TaxRegime` exports in `domain/index.ts`. |

## Deviations from Design

Unit 1 matches a rule by `taxClassification` only. Regime, VAT, INC, franchise, channel, and date stay for task 1.5. `paidCop` is the amount the customer pays; `cashRoundingAmount` is `paidCop` minus the peso-rounded total. A gap of exactly 500 is kept. A gap of 501 either way throws `CashRoundingRejected`. `bagLine` is `null` and `excluded` is `false`. Tip, bags, dates, and non-VAT exclusion stay for tasks 1.4–1.5. `InvalidTaxId` requires the `tax_` prefix and `InvalidTaxAmount` requires integer COP. The RED file does not dedicate a case to those two rejections. The golden prices divide evenly, so they do not distinguish half-even from half-up. The code passes `Decimal.ROUND_HALF_EVEN`.

Unit 2 keeps that formula. `paidCop` still includes what the customer pays, and `voluntaryTipCop` is subtracted before the cash-rounding gap, so a 1,000 tip on the 10,800 INC sale stays at base 10,000 and INC 800 with a gap of 0. The tip is not a line. A mandatory delivery charge is an ordinary product line; its classification is taxed and the tip is not. A missing match key on a rule is a wildcard, so the unit 1 rules still match by classification alone. `validFrom` and `validTo` are inclusive `YYYY-MM-DD` strings. A channel-specific rule beats an unscoped rule; other ties keep input order. The bag line is `{ quantity, unitCop, amount, code: null, ruleId, version }` with `amount = fixedCop × bagCount` in `decimal.js` half-even pesos. Take-out adds it when `bagCount > 0`. Delivery adds it only when `deliveryBagsEnabled` is true. Dine-in does not. A non-VAT profile still matches a rule for `ruleId` and `version`, then sets `excluded: true`, an empty tax list, and base equal to the menu price. No matching rule still throws `NoMatchingTaxRule`. A non-VAT profile does not emit a bag line.

## Issues Found

Unit 1: none.

Unit 2: a taxpayer with `vatResponsible: false` excludes every product line, including one that would otherwise be INC. The bag line for that taxpayer is suppressed and has no dedicated test; the design left that case unconfirmed.

## Work unit 3

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 3 slice and stops at tasks 1.6–1.7. Phase 2 is not started. Not committed. `size:exception` was not granted. Unit 2 already exceeded the 400-line budget. This unit does not rewrite or shrink unit 2.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing assess-withholdings` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Repeated after `pnpm biome check --write` on the touched files: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `pnpm vitest run --project invoicing domain/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `assessWithholdings` does not open files, sockets, or a database. |
| Rollback boundary | `contexts/invoicing/domain/assess-withholdings.ts`, `contexts/invoicing/domain/assess-withholdings.test.ts`, and the `assessWithholdings` exports added to `domain/index.ts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.6 → 1.7 | `pnpm vitest run --project invoicing assess-withholdings` exit 1. `FAIL contexts/invoicing/domain/assess-withholdings.test.ts` — `Cannot find module '#domain/assess-withholdings.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/assess-withholdings.ts` and the `domain/index.ts` export: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Repeated after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `domain/calculate-taxes` stayed at 17 passed. |

### Deviations

Unit 3 keeps the unit 1 and unit 2 `calculateTaxes` behavior. `assessWithholdings` does not compute a withholding rate. The spec and design publish no income, VAT, or ICA percentages, and they say withholdings are not computed on the sale. The test records integer COP `1_250`, `90`, and `37`. Those amounts are not derived from the invoice. Invoice taxes use the spec INC line, code `04`, rate `0.08`, amount `800`, and come back unchanged. The string `0.00966` is only a municipality value that must not be applied; it is not a seeded ICA rate.

The design signature `assessWithholdings({ income, vat, ica })` is extended with `customer`, `municipality`, and `invoiceTaxes`. The scenarios need a withholding agent versus a final consumer, unchanged invoice taxes, and proof that municipality is not an ICA rate. A final consumer throws `WithholdingRejected`. The result is `{ income, vat, ica, invoiceTaxes }` only. Municipality is accepted and not copied onto the result. A second call does not change the first result. There is no payment, shift, or cash register.

Integer COP reuses `InvalidTaxAmount` from `calculate-taxes.ts`. `calculateTaxes` is unchanged. The RED file does not dedicate a case to a non-integer amount.

### Issues

Unit 3: none.

## Work unit 4

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 4 slice and stops at tasks 2.1–2.2. Phase 2 tasks 2.3 and later are not started. Not committed. `size:exception` was not granted. Units 1–3 already exceeded the 400-line budget. This unit does not rewrite or shrink them.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing publish-tax-rule` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Repeated after `pnpm biome check --write` on the touched files: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `pnpm vitest run --project invoicing domain/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. `pnpm vitest run --project invoicing assess-withholdings` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `PublishTaxRule` does not open files, sockets, Postgres, or Factus. |
| Rollback boundary | `contexts/invoicing/application/publish-tax-rule/`, `contexts/invoicing/application/ports/tax-rule-repository.ts`, the `#application/publish-tax-rule/*` and `#application/ports/*` import patterns, and the `application` include in `contexts/invoicing/tsconfig.json`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.1 → 2.2 | `pnpm vitest run --project invoicing publish-tax-rule` exit 1. `FAIL contexts/invoicing/application/publish-tax-rule/publish-tax-rule.test.ts` — `Cannot find module '#application/ports/tax-rule-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The import patterns were already in `package.json`. | Same command after `publish-tax-rule.ts` and `ports/tax-rule-repository.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Repeated after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `domain/calculate-taxes` stayed at 17 passed. `assess-withholdings` stayed at 3 passed. |

### Deviations

Unit 4 does not change `calculateTaxes` or `assessWithholdings`. The catalog is test data published through the use case. The use case does not hardcode the nine rules.

`independent-restaurant` stores regime `ordinary`, `incResponsible: true`, `franchise: false`, code `04`, rate `0.08`, classification `restaurant service`. VAT responsibility is omitted. `franchise` stores `franchise: true`, `vatResponsible: true`, code `01`, rate `0.19`, classification `restaurant service`. Regime and INC are omitted. `simple-inc` stores regime `simple`, `incResponsible: true`, code `O-47`, rate `0.08`, classification `restaurant service`. Franchise and VAT are omitted. VAT 5% uses classification `packaged drink`, code `01`, rate `0.05`. Exempt stores code `01` at rate `0`. `is_excluded` and `not_taxed` are distinct markers with empty taxes. They are not mapped to each other. Ultra-processed stores code `35` and the row rate `0.15`. The legal rate stays an open question. The plastic bag stores `fixedCop: 66`, empty taxes, and classification `plastic bag`.

RUT codes `O-13`, `O-15`, `O-23`, `O-47`, and `R-99-PN` are stored on the published rule as `rutResponsibilities`. They are not tax components and they are not part of the overlap key. A second publish that changes only those codes still overlaps. The fiscal profile remains task 2.3.

The overlap key is equality of regime, VAT responsibility, INC responsibility, franchise, classification, and channel. An omitted field is not a wildcard. Dates are inclusive. A missing `validTo` runs through `9999-12-31`. The same id with a later, non-overlapping rate becomes the next version. The previous row is not updated. A different id on the same key is still rejected when the dates overlap. `OverlappingTaxRule` is thrown before `insert`. The repository port has `list` and `insert` only.

`contexts/invoicing/tsconfig.json` now includes `application` so the use case belongs to the package project. There is no channel-only test in this unit. Channel is still part of the key.

### Issues

Unit 4: none.

## Work unit 5

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 5 slice and stops at tasks 2.3–2.4. Phase 2 task 2.5 and later are not started. Not committed. `size:exception` was not granted. Units 1–4 already exceeded the 400-line budget. This unit does not rewrite or shrink them.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing adopt-fiscal-template` — exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. Repeated after `pnpm biome check --write` on the touched files: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `pnpm vitest run --project invoicing publish-tax-rule` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `pnpm vitest run --project invoicing domain/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. `pnpm vitest run --project invoicing assess-withholdings` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `AdoptFiscalTemplate` does not open files, sockets, Postgres, or Factus. |
| Rollback boundary | `contexts/invoicing/application/adopt-fiscal-template/`, `contexts/invoicing/application/ports/fiscal-profile-repository.ts`, and the `#application/adopt-fiscal-template/*` import pattern. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.3 → 2.4 | `pnpm vitest run --project invoicing adopt-fiscal-template` exit 1. `FAIL contexts/invoicing/application/adopt-fiscal-template/adopt-fiscal-template.test.ts` — `Cannot find module '#application/adopt-fiscal-template/adopt-fiscal-template.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The `#application/adopt-fiscal-template/*` pattern was already in `package.json`. Repeated after the second scenario snapshotted the other taxpayer from the stored copy: same exit 1, same missing module, `Tests  no tests`. | Same command after `adopt-fiscal-template.ts` and `ports/fiscal-profile-repository.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. Repeated after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `publish-tax-rule` stayed at 3 passed. `domain/calculate-taxes` stayed at 17 passed. `assess-withholdings` stayed at 3 passed. |

### Deviations

Unit 5 does not change `calculateTaxes`, `assessWithholdings`, `PublishTaxRule`, `Organization`, or `taxProfileId`. The adopted object has no `taxProfileId`.

Copied rules are stored on the adopted fiscal profile. They are not inserted into `TaxRuleRepository`, so publish overlap and the unit 4 catalog stay unchanged. A copy has to be per taxpayer: one shared tenant rule row would change every taxpayer.

The template is found by name. The use case does not hardcode "SIMPLE regime, INC responsible". The test seeds that template: person type `juridical`, regime `simple`, VAT false, INC true, RUT `O-47`, franchise false, and municipalities Medellin (`venue_north`) and Bogota (`venue_south`). Its rules are `simple-inc` (`O-47` at `0.08`, restaurant service) and the plastic bag at 66. The profile type also allows person type `natural` and regime `ordinary`.

The copy id is `tax_profile_${taxpayerId}`. Each copied rule keeps the template rule id and version, sets `templateRowId` to the template `rowId`, and gets a new `rowId` of `tax_copy_${taxpayerId}_${templateRowId}`. Nested taxes, RUT codes, and municipalities are new arrays. `saveAdopted` replaces that taxpayer's copy. It does not write the template row. This unit does not add an edit use case and does not publish a new rule version. The edit in the test changes the copy to person type `natural`, regime `ordinary`, VAT true, INC false, franchise true, RUT `O-13`, municipality Envigado, and rate `0.19`. The template and `taxpayer_b` stay as adopted.

`FiscalTemplateNotFound` is thrown when the name is missing. No scenario covers that guard.

### Issues

Unit 5: none.

## Work unit 6

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 6 slice and stops at tasks 2.5–2.6. Phase 3 is not started. Not committed. `size:exception` was not granted. Units 1–5 already exceeded the 400-line budget. This unit does not rewrite or shrink them.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing application/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. Repeated after `pnpm biome check --write` on the touched files, including the entry-port identity assertion: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `pnpm vitest run --project invoicing adopt-fiscal-template` — exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `pnpm vitest run --project invoicing publish-tax-rule` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `pnpm vitest run --project invoicing domain/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. `pnpm vitest run --project invoicing assess-withholdings` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `CalculateTaxes` does not open files, sockets, Postgres, or Factus. |
| Rollback boundary | `contexts/invoicing/application/calculate-taxes/`, `contexts/invoicing/application/entry-port.ts`, `findAdopted` on `ports/fiscal-profile-repository.ts`, the adopt test double's `findAdopted`, the `#application/calculate-taxes/*` import, and the `./application/entry-port` package export. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.5 → 2.6 | `pnpm vitest run --project invoicing application/calculate-taxes` exit 1. `FAIL contexts/invoicing/application/calculate-taxes/calculate-taxes.test.ts` — `Cannot find module '#application/calculate-taxes/calculate-taxes.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The `#application/calculate-taxes/*` pattern was already in `package.json`. | Same command after `calculate-taxes.ts` and `entry-port.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. Repeated after Biome and the entry-port identity assertion: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `adopt-fiscal-template` stayed at 2 passed. `publish-tax-rule` stayed at 3 passed. `domain/calculate-taxes` stayed at 17 passed. `assess-withholdings` stayed at 3 passed. |

### Deviations

Unit 6 does not change `calculateTaxes`, `assessWithholdings`, `PublishTaxRule`, or `AdoptFiscalTemplate`.

The quote loads the adopted profile with `FiscalProfileRepository.findAdopted(tenantId, profileId)` and the tenant catalog with `TaxRuleRepository.list(tenantId)`. It keeps rules whose `validFrom` and `validTo` cover `soldOn`. A missing `validTo` stays open-ended. Those rows and the profile match keys go to the domain. The domain still applies channel specificity, profile keys, and the date. Copied rules stored on the adopted profile are not quoted. The test keeps a copy at version 1 with the same match keys; the result is catalog version 7. A row from another tenant is not listed.

`paidCop` is on the command. The sequence diagram does not name it. The domain rejects a cash gap past ±500, so the caller sends what the customer pays, including the tip and the bags. For the INC line, a 1,000 tip and two bags, that amount is 11,932 and the gap is 0.

A missing adopted profile throws `NoMatchingTaxRule` before the domain runs. No scenario covers that guard.

`entry-port.ts` exports `CalculateTaxes`, `CalculateTaxesCommand`, and `NoMatchingTaxRule`. It does not export `PublishTaxRule` or `AdoptFiscalTemplate`. Callers outside the package import `@blackhole/invoicing/application/entry-port`. The quote test asserts that export is the same class.

`findAdopted` is a new port method. `AdoptFiscalTemplate` does not call it. The adopt test double implements it and those tests stay green.

### Issues

Unit 6: a taxpayer's edited copy is not the quote source. The tenant catalog is. Phase 4 must not assume an adopted copy changes the quote until a later unit reads those rows.

## Work unit 7

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 7 slice and stops at tasks 3.1–3.2. Task 3.3 is not started. Not committed. `size:exception` was not granted. Units 1–6 already exceeded the 400-line budget. This unit does not rewrite or shrink them.

This unit is about 645 changed lines: 632 lines in the new contract and memory files, plus `insertTemplate` on the fiscal profile port, the two test-double methods, the `#adapters/memory/*` import, and the invoicing `tsconfig.json` include. That is over the 400-line budget. The overrun is recorded here. Tasks 3.1 and 3.2 were not split.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project invoicing adapters/memory` — exit 0. `Test Files  2 passed (2)`. `Tests  16 passed (16)`. Repeated after `pnpm biome check --write` on the touched files: exit 0. `Test Files  2 passed (2)`. `Tests  16 passed (16)`. `pnpm vitest run --project invoicing publish-tax-rule` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. `pnpm vitest run --project invoicing adopt-fiscal-template` — exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `pnpm vitest run --project invoicing application/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `pnpm vitest run --project invoicing domain/calculate-taxes` — exit 0. `Test Files  1 passed (1)`. `Tests  17 passed (17)`. `pnpm vitest run --project invoicing assess-withholdings` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |
| Runtime harness command/scenario and exact result | N/A, memory ports. The repositories do not open files, sockets, Postgres, or Factus. |
| Rollback boundary | `contexts/invoicing/adapters/memory/`, `application/ports/tax-rule-repository.contract.ts`, `application/ports/fiscal-profile-repository.contract.ts`, `insertTemplate` on `fiscal-profile-repository.ts`, the `insertTemplate` methods on the adopt and quote test doubles, `#adapters/memory/*`, and `adapters` in `contexts/invoicing/tsconfig.json` `include`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.1 → 3.2 | `pnpm vitest run --project invoicing adapters/memory` exit 1. `FAIL contexts/invoicing/adapters/memory/in-memory-fiscal-profile-repository.contract.test.ts` — `Cannot find module '#adapters/memory/in-memory-fiscal-profile-repository.js'`. `FAIL contexts/invoicing/adapters/memory/in-memory-tax-rule-repository.contract.test.ts` — `Cannot find module '#adapters/memory/in-memory-tax-rule-repository.js'`. `Test Files  2 failed (2)`. `Tests  no tests`. The `#adapters/memory/*` pattern was already in `package.json`. The repository files did not exist. | Same command after the in-memory repositories: exit 0. `Test Files  2 passed (2)`. `Tests  16 passed (16)`. Repeated after Biome: exit 0. `Test Files  2 passed (2)`. `Tests  16 passed (16)`. `publish-tax-rule` stayed at 3 passed. `adopt-fiscal-template` stayed at 2 passed. `application/calculate-taxes` stayed at 2 passed. `domain/calculate-taxes` stayed at 17 passed. `assess-withholdings` stayed at 3 passed. |

### Deviations

Unit 7 does not change `calculateTaxes`, `assessWithholdings`, `PublishTaxRule`, `AdoptFiscalTemplate`, or `CalculateTaxes`. An edited adopted copy still does not change the quote. The tenant catalog remains the quote source. That unit 6 deviation stays out of this unit.

`FiscalProfileRepository.insertTemplate` is new. The shared contract stores a template through the port, then stores a copy, then edits the copy. The adopt test double throws "A fiscal template is already seeded." The quote test double throws "A quote cannot store a fiscal profile." Those tests do not call `insertTemplate`. Their scenarios are unchanged.

`InMemoryTaxRuleRepository.insert` appends. A second insert with the same tenant, id, and version throws "A tax rule version already exists." and leaves the stored version. Version 2 of the same id is kept beside version 1. `list` returns only that tenant, in insertion order, as cloned rows. The repository has no update method and no delete method.

`InMemoryFiscalProfileRepository` keeps templates and adopted profiles in separate lists. `insertAdopted` throws "A copy cannot replace the template row." when the profile id equals a template id, and stores nothing. `saveAdopted` replaces the row for the same tenant and taxpayer. It does not write the template row. `findAdopted` filters by tenant and profile id, so the same profile id in another tenant stays hidden. Returned templates, profiles, rules, taxes, municipalities, and RUT lists are copies.

`contexts/invoicing/tsconfig.json` now includes `adapters`, matching the attendance package, so the memory adapter belongs to the invoicing project. The memory repositories are not package `exports`. This unit imports them through `#adapters/memory/*`.

### Issues

Unit 7: about 645 changed lines, over the 400-line budget. Recorded. Not split. `size:exception` was not granted.

`pnpm exec tsc -b contexts/invoicing` still reports existing `Decimal` namespace errors in `domain/calculate-taxes.ts`. This unit did not edit that file. `domain/calculate-taxes` stayed at 17 passed.

## Work unit 8

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 8 slice and stops at tasks 3.3–3.4. Phase 4 HTTP is not started. Not committed. `size:exception` was not granted. Units 1–7 already exceeded the 400-line budget. This unit does not rewrite or shrink them.

This unit is about 864 changed lines: 841 lines in the new Postgres adapter files, the `#adapters/postgres/*` import plus catalog `drizzle-orm` and `@electric-sql/pglite` on `@blackhole/invoicing`, and 20 lines in `pnpm-lock.yaml`. The lockfile also records catalogued `decimal.js` 10.6.0 for the invoicing importer. No catalog version changed. That is over the 400-line budget. The overrun is recorded here. Tasks 3.3 and 3.4 were not split.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED: `pnpm vitest run --project invoicing adapters/postgres` — exit 1. `FAIL contexts/invoicing/adapters/postgres/drizzle-fiscal-profile-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-fiscal-profile-repository.js'`. `FAIL contexts/invoicing/adapters/postgres/drizzle-tax-rule-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-tax-rule-repository.js'`. `Test Files  2 failed (2)`. `Tests  no tests`. The `#adapters/postgres/*` pattern and the catalog dependencies were already declared so PGlite could load. `0009_tax.sql` and the Drizzle repositories did not exist. GREEN before Biome: same command exit 0. `Test Files  2 passed (2)`. `Tests  22 passed (22)`. After `pnpm biome check --write` on the touched files: `pnpm vitest run --project invoicing adapters/postgres adapters/memory publish-tax-rule adopt-fiscal-template application/calculate-taxes domain/calculate-taxes assess-withholdings` — exit 0. `Test Files  9 passed (9)`. `Tests  65 passed (65)`. That is 22 Postgres, 16 memory, 3 publish, 2 adopt, 2 application calculate-taxes, 17 domain calculate-taxes, and 3 assess-withholdings. |
| Runtime harness command/scenario and exact result | N/A, PGlite, no live Postgres. Each contract test opens a fresh PGlite and applies `contexts/invoicing/adapters/postgres/0009_tax.sql`. |
| Rollback boundary | `contexts/invoicing/adapters/postgres/`, `#adapters/postgres/*`, catalog `drizzle-orm` and `@electric-sql/pglite` on `@blackhole/invoicing`, and the invoicing importer rows in `pnpm-lock.yaml`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.3 → 3.4 | `pnpm vitest run --project invoicing adapters/postgres` exit 1. Both contract files failed to load: `Cannot find module '#adapters/postgres/drizzle-fiscal-profile-repository.js'` and `Cannot find module '#adapters/postgres/drizzle-tax-rule-repository.js'`. `Test Files  2 failed (2)`. `Tests  no tests`. | Same command after `0009_tax.sql`, `schema.ts`, and the Drizzle repositories: exit 0. `Test Files  2 passed (2)`. `Tests  22 passed (22)`. Repeated after Biome inside the combined invoicing run: exit 0. `Test Files  9 passed (9)`. `Tests  65 passed (65)`. Memory stayed at 16 passed. `publish-tax-rule` stayed at 3 passed. `adopt-fiscal-template` stayed at 2 passed. `application/calculate-taxes` stayed at 2 passed. `domain/calculate-taxes` stayed at 17 passed. `assess-withholdings` stayed at 3 passed. |

### Deviations

Unit 8 does not change `calculateTaxes`, `assessWithholdings`, `PublishTaxRule`, `AdoptFiscalTemplate`, or `CalculateTaxes`. An edited adopted copy still does not change the quote. `domain/calculate-taxes.ts` was not edited.

Fiscal templates have no tenant. `0009_tax.sql` still forces row level security on `fiscal_templates`, with policy `template_catalog` for `invoicing_app` using `USING (true)` and `WITH CHECK (true)`, so the shared catalog stays visible while a missing policy would hide every row. `tax_rules` and `adopted_fiscal_profiles` use `tenant_id = current_setting('app.tenant_id')`. The repositories set `SET LOCAL ROLE invoicing_app` and do not add `tenant_id` to the list or find filters, matching the attendance shape.

Tax rules and fiscal templates reject update, delete, and truncate. Adopted profiles allow `UPDATE` because `saveAdopted` replaces the copy for the same tenant and taxpayer. Delete and truncate on adopted profiles are still rejected. Grants are `SELECT, INSERT` on rules and templates, and `SELECT, INSERT, UPDATE` on adopted profiles. There is no `DELETE` grant.

Taxes, RUT codes, template profiles, template rules, and copied rules are `jsonb`. Scalar tax-rule columns keep regime, channel, and marker checks. Versions append by `position`. A repeated tenant, id, and version throws "A tax rule version already exists." A copy whose id equals a template id throws "A copy cannot replace the template row." and stores nothing.

Migrations `0001` through `0008` were not edited. This file is `contexts/invoicing/adapters/postgres/0009_tax.sql`. It is not a platform migration. No SQLite, HTTP, Factus, or Zod boundary was added.

### Issues

Unit 8: about 864 changed lines, over the 400-line budget. Recorded. Not split. `size:exception` was not granted.

`domain/calculate-taxes.ts` still has the prior `Decimal` namespace errors. This unit did not edit that file and did not treat that failure as its bug. `domain/calculate-taxes` stayed at 17 passed.

## Work unit 9

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 9 slice and stops at tasks 4.1–4.4. Task 4.5 and phase 5 are not started. Not committed. `size:exception` was not granted. Units 1–8 already exceeded the 400-line budget. This unit does not rewrite or shrink them.

This unit is about 470 changed lines: 144 in `tax-quote.controller.ts`, 277 in `tax-quote.controller.test.ts`, 27 in `application-module.ts`, 11 in the permission test, 2 in the catalog, 4 package exports, and the api-cloud dependency, tsconfig reference, and lockfile importer. That is over the 400-line budget. The overrun is recorded here. Tasks 4.1–4.4 were not split.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED permission: `pnpm vitest run --project platform permission-catalog` — exit 1. `Tests  1 failed \| 399 passed (400)`. `expected undefined to be 'tax.configure'`. GREEN before the HTTP work: same command exit 0. `Test Files  1 passed (1)`. `Tests  409 passed (409)`. RED HTTP: `pnpm vitest run --project api-cloud tax-quote.controller` — exit 1. `Cannot find module '#src/http/tax-quote.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. GREEN before Biome: same command exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. After `pnpm biome check --write` and the company-scoped cashier: same command exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. Repeated with the catalog: `pnpm vitest run --project platform permission-catalog` — exit 0. `Tests  409 passed (409)`. `pnpm vitest run --project invoicing` — exit 0. `Test Files  9 passed (9)`. `Tests  65 passed (65)`. That is 22 Postgres, 16 memory, 3 publish, 2 adopt, 2 application calculate-taxes, 17 domain calculate-taxes, and 3 assess-withholdings. |
| Runtime harness command/scenario and exact result | N/A: `inject` and `x-session-id`. `createApplication` calls `init`. No `listen`. The quote test counts Factus `issue` calls and they stay at 0. No live Postgres. |
| Rollback boundary | `TAX_CONFIGURE` in `permission-catalog.ts`, the quote controller, the invoicing providers in `application-module.ts`, `@blackhole/invoicing` on api-cloud, the invoicing tsconfig reference, the api-cloud importer in `pnpm-lock.yaml`, and the invoicing package exports for the two ports and the two memory repositories. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.1 → 4.2 | `pnpm vitest run --project platform permission-catalog` exit 1. `given tax.configure, when every matrix role is read, then only the owner is yes` — `expected undefined to be 'tax.configure'`. `Tests  1 failed \| 399 passed (400)`. | Same command after `TAX_CONFIGURE` and the owner-only matrix row: exit 0. `Tests  409 passed (409)`. |
| 4.3 → 4.4 | `pnpm vitest run --project api-cloud tax-quote.controller` exit 1. `Cannot find module '#src/http/tax-quote.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The package exports, api-cloud dependency, and lockfile importer already existed so the failure was the missing controller. | Same command after the controller and `ApplicationModule.register`: exit 0. `Tests  4 passed (4)`. Repeated after Biome and the company-scoped cashier: exit 0. `Tests  4 passed (4)`. Permission catalog stayed at 409 passed. Invoicing stayed at 65 passed. |

### Deviations

Unit 9 does not change `calculateTaxes`, `assessWithholdings`, `PublishTaxRule`, `AdoptFiscalTemplate`, or `CalculateTaxes`. `domain/calculate-taxes.ts` was not edited. An edited adopted copy still does not change the quote. The tenant catalog remains the quote source.

`tax.configure` is YES for owner and NO for general manager, site administrator, shift supervisor, cashier, waiter, kitchen chief, and warehouse keeper. The HTTP gate evaluates that permission on a company target. The cashier in the 403 case is assigned at company scope, so the denial is the NO cell, and the stored rule and adopted profile stay unchanged. The 403 body is `{ error: "TaxConfigureDenied" }`. The task named only the 409 body.

`POST /tenants/:tenantId/tax-quotes` parses the body with `safeParse`. Channel is `z.enum(["dine-in", "take-out", "delivery"])`. Zod stays in the controller. The G-INC-8 seed is an adopted profile plus catalog rule `tax_rule_inc_8` version 7, code `04`, rate `0.08`, classification `restaurant service`, with no regime, VAT, INC, franchise, or channel key, so the domain wildcard matches. `10_800` returns base `10_000`, INC `800`, and code `04`. A missing profile returns 409 `{ error: "NoMatchingTaxRule" }`.

`create-application.ts` was not edited. It already forwards `CloudApplicationDependencies` into `ApplicationModule.register`. The new optional `taxRules` and `fiscalProfiles` are on that type, and the test passes the in-memory repositories there. When they are omitted, the module builds empty in-memory repositories. No live Postgres. The controller imports `@blackhole/invoicing/application/entry-port` only. The module constructs `CalculateTaxes` from the port tokens. No `shared/contracts`, Factus call, configuration controller, Organization write, SQLite, or `listen()`.

### Issues

Unit 9: about 470 changed lines, over the 400-line budget. Recorded. Not split. `size:exception` was not granted.

`domain/calculate-taxes.ts` still has the prior `Decimal` namespace errors. This unit did not edit that file. `domain/calculate-taxes` stayed at 17 passed.

## Work unit 10

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 10 slice and stops at tasks 4.5–4.6. Phase 5 is not started. Not committed. `size:exception` was not granted. Units 1–9 already exceeded the 400-line budget. This unit does not rewrite or shrink them.

This unit is about 716 changed lines: 201 in `tax-configuration.controller.ts`, 488 in `tax-configuration.controller.test.ts`, 10 new entry-port exports, and 17 lines in `application-module.ts` (the configuration controller, `PublishTaxRule`, and `AdoptFiscalTemplate`). That is over the 400-line budget. The overrun is recorded here. Tasks 4.5 and 4.6 were not split.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED: `pnpm vitest run --project api-cloud tax-configuration.controller` — exit 1. `Cannot find module '#src/http/tax-configuration.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. GREEN before Biome: same command exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. After `pnpm biome check --write` on the four touched files: same command exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. `pnpm vitest run --project api-cloud tax-quote.controller` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. `pnpm vitest run --project invoicing` — exit 0. `Test Files  9 passed (9)`. `Tests  65 passed (65)`. `pnpm vitest run --project platform permission-catalog` — exit 0. `Test Files  1 passed (1)`. `Tests  409 passed (409)`. |
| Runtime harness command/scenario and exact result | N/A: `inject` and `x-session-id`. `createApplication` calls `init`. No `listen`. The configuration test counts Factus `issue` calls and they stay at 0. No live Postgres. Memory repositories enter through `taxRules` and `fiscalProfiles`. |
| Rollback boundary | `TaxConfigurationController`, its HTTP test, the `PublishTaxRule` and `AdoptFiscalTemplate` exports on `entry-port.ts`, and the configuration providers plus controller registration in `application-module.ts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.5 → 4.6 | `pnpm vitest run --project api-cloud tax-configuration.controller` exit 1, before the controller existed. `Cannot find module '#src/http/tax-configuration.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the controller, entry-port exports, and `ApplicationModule.register`: exit 0. `Tests  5 passed (5)`. Repeated after Biome: exit 0. `Tests  5 passed (5)`. Quote stayed at 4 passed. Invoicing stayed at 65 passed. Permission catalog stayed at 409 passed. |

### Deviations

Unit 10 does not change `CalculateTaxes`, `calculateTaxes`, the quote controller scenarios, `permission-catalog.ts`, or `Organization`. `create-application.ts` was not edited. A missing fiscal template is mapped to 409 `{ error: "FiscalTemplateNotFound" }`, the same conflict shape as `OverlappingTaxRule` and the quote route's `NoMatchingTaxRule`. No scenario in tasks 4.5–4.6 calls that missing-template path.

There is no HTTP route for editing an adopted copy. After two `POST /fiscal-profiles/adopt` responses return 200, the test edits the stored copy with `saveAdopted` on the same in-memory repository. The template and the other taxpayer stay unchanged. The 403 body is `{ error: "TaxConfigureDenied" }`. Organization events stay empty.

`POST /tenants/:tenantId/tax-rules` and `POST /tenants/:tenantId/fiscal-profiles/adopt` parse the body with `safeParse`. Regime, channel, and marker use `z.enum`. Zod stays in the controller. The controller imports `@blackhole/invoicing/application/entry-port` only. The module constructs `PublishTaxRule` and `AdoptFiscalTemplate` from the existing port tokens. No `shared/contracts`, Factus call, SQLite, or `listen()`.

### Issues

Unit 10: about 716 changed lines, over the 400-line budget. Recorded. Not split. `size:exception` was not granted.

`domain/calculate-taxes.ts` still has the prior `Decimal` namespace errors. This unit did not edit that file. The invoicing suite stayed at 65 passed, including 17 domain calculate-taxes tests.

## Work unit 11

Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. This batch is the unit 11 slice and stops at tasks 5.1–5.3. Not committed. `size:exception` was not granted. Units 1–10 already exceeded the 400-line budget. This unit does not rewrite or shrink them.

This unit is 88 changed lines: 34 in `tax.controller.ts`, 51 in `tax.controller.test.ts`, 2 in `application-module.ts`, and 1 allow-list path in `skeleton.test.ts`. That is under the 400-line budget. No overrun. Tasks 5.1–5.3 were not split.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED: `pnpm vitest run --project local-node tax.controller` — exit 1. `Cannot find module '#src/http/tax.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. GREEN before Biome: same command exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. `pnpm vitest run --project skeleton skeleton.test` — exit 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`. `pnpm vitest run --project api-cloud tax-quote.controller tax-configuration.controller` — exit 0. `Test Files  2 passed (2)`. `Tests  9 passed (9)`. `pnpm vitest run --project invoicing` — exit 0. `Test Files  9 passed (9)`. `Tests  65 passed (65)`. After `pnpm biome check --write` on the four touched files: local-node exit 0. `Tests  1 passed (1)`. Skeleton exit 0. `Tests  9 passed (9)`. |
| Runtime harness command/scenario and exact result | N/A: `inject`. `createApplication` calls `init`. No `listen`. No repository and no SQLite. `ApplicationModule` providers and imports stay empty. |
| Rollback boundary | `TaxController`, its HTTP test, the controller registration in `apps/local-node/src/composition/application-module.ts`, and `path.join("http", "tax.controller.ts")` in the local-node source allow-list. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 5.1 → 5.2 → 5.3 | `pnpm vitest run --project local-node tax.controller` exit 1, before the controller existed. `Cannot find module '#src/http/tax.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `TaxController` and its registration on `ApplicationModule`: exit 0. `Tests  1 passed (1)`. Skeleton after the allow-list path: exit 0. `Tests  9 passed (9)`. Repeated after Biome: local-node `Tests  1 passed (1)`; skeleton `Tests  9 passed (9)`. Cloud tax HTTP stayed at 9 passed. Invoicing stayed at 65 passed. |

### Deviations

The node returns `{ error: "TaxRejected" }` with HTTP 403 for `POST /tenants/:tenantId/tax-quotes`, `POST /tenants/:tenantId/tax-rules`, and `POST /tenants/:tenantId/fiscal-profiles/adopt`. `routePermissions` maps only `"POST tax-rules"` to `tax.configure`. The handlers do not read a body, a session, or a store. `local-node` does not import `@blackhole/invoicing`. Cloud quote and configuration controllers, `permission-catalog.ts`, and domain tax math were not edited.

`pnpm biome check --write` formatted the touched files. The local-node source list gained only `http/tax.controller.ts`. Every path that was already listed stayed. No dining controller was added. `allowedContexts` remains attendance, invoicing, orders, and platform.

### Issues

Unit 11 stays under the 400-line budget at 88 changed lines. No overrun. Not split. `size:exception` was not granted.

`domain/calculate-taxes.ts` still has the prior `Decimal` namespace errors. This unit did not edit that file. The invoicing suite stayed at 65 passed.

Every tax task, 1.1 through 5.3, is checked. The change is not archived.

## Correction after verify FAIL

Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. Tasks 1.1–5.3 stay checked. This note does not archive the change and does not edit the verify report. No product behavior was added.

`pnpm exec tsc -p contexts/invoicing --noEmit --pretty false` had exited 1 with 23 diagnostics.

`decimal.js` 10.6.0 ships `decimal.d.ts` with `export default Decimal`, `export namespace Decimal`, and `export declare class Decimal`. The file's own example uses `import { Decimal } from "decimal.js"`. `decimal.mjs` exports that constructor as `export var Decimal` and `export default Decimal`. Under NodeNext, `verbatimModuleSyntax`, and `esModuleInterop`, the default import bound the namespace: TS2709 on the `Decimal` annotations, TS2339 for `ROUND_HALF_EVEN`, and TS2351 for `new Decimal`. `contexts/invoicing/domain/calculate-taxes.ts` now uses the named import. Rounding remains `Decimal.ROUND_HALF_EVEN`. Numeric results, match keys, and error types are unchanged.

`contexts/invoicing/tsconfig.json` sets `"types": ["node"]`, the same option as attendance and platform. That option alone is TS2688: `@blackhole/invoicing` does not depend on `@types/node`, and pnpm does not link another context's copy. No dependency was added and `pnpm-lock.yaml` was not edited. `typeRoots` points at the catalog copy already installed for the other contexts: `node_modules/.pnpm/@types+node@24.19.2/node_modules/@types` (catalog `@types/node` 24.19.2). The Postgres contract tests then typecheck `node:fs`, `node:url`, `URL`, and `import.meta.url`.

| Evidence | Required value |
|---|---|
| Typecheck | `pnpm exec tsc -p contexts/invoicing --noEmit --pretty false` — exit 0. |
| Invoicing tests | `pnpm vitest run --project invoicing` — exit 0. `Test Files  9 passed (9)`. `Tests  65 passed (65)`. That includes `domain/calculate-taxes` (17) and the Postgres contracts. Repeated after `typeRoots`: exit 0. `Test Files  9 passed (9)`. `Tests  65 passed (65)`. |

### Unresolved

Spec scenario "Offline computation" says a hybrid node MUST compute offline with its rule copy and match the cloud result for version 7. Design D-37 says the local node stores nothing and returns 403 `TaxRejected`. Those two statements contradict. No offline tax calculation was added. No test pretends the node calculates. Left unresolved.
