## Verification Report

**Change**: p1-04-tax-engine
**Version**: N/A (roadmap delivery 1.4)
**Mode**: Standard

Strict TDD is inactive. `strict-tdd-verify.md` was not loaded. Evidence is from this run on 2026-10-28. Specs were compared first, design second, and task completion third. Implementation files were not edited. The orders context, the dining-room change, and the orders Vitest project were not read or executed. This report replaces the previous FAIL report. The change was not archived and `tasks.md` was not marked.

The previous failure was the invoicing `tsc` project (23 diagnostics) plus an UNTESTED reading of the offline scenario. This run treats a passing `tsc` as evidence those diagnostics are gone. Offline calculation was intentionally not added. The accepted design rejects a node-side calculator, so that spec/design conflict is a WARNING, not a missing-implementation CRITICAL.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 26 |
| Tasks complete | 26 |
| Tasks incomplete | 0 |

Tasks 1.1 through 5.3 are checked in `tasks.md`. No unchecked implementation task remains. `state.yaml` still says `apply: partial` and `verify: pending`; this phase did not update it.

### Build & Tests Execution

**Build**: ✅ Passed

```text
pnpm exec tsc -p contexts/invoicing --noEmit --pretty false
exit 0
No diagnostics printed.
```

`contexts/invoicing/domain/calculate-taxes.ts` imports `{ Decimal }` from `decimal.js`. `money` and `pesos` still call `Decimal.ROUND_HALF_EVEN`. Numeric behavior was not changed. `contexts/invoicing/tsconfig.json` sets `"types": ["node"]` and pins `typeRoots` to `../../node_modules/.pnpm/@types+node@24.19.2/node_modules/@types`. That pin is what lets this project typecheck without a package dependency on `@types/node` and without a lockfile edit.

**Tests**: ✅ 493 passed / ❌ 0 failed / ⚠️ 0 skipped

```text
pnpm vitest run --project invoicing
exit 0 — Test Files 9 passed (9) — Tests 65 passed (65)

pnpm vitest run --project platform permission-catalog
exit 0 — Test Files 1 passed (1) — Tests 409 passed (409)

pnpm vitest run --project api-cloud tax-quote.controller tax-configuration.controller
exit 0 — Test Files 2 passed (2) — Tests 9 passed (9)

pnpm vitest run --project local-node tax.controller
exit 0 — Test Files 1 passed (1) — Tests 1 passed (1)

pnpm vitest run --project skeleton skeleton.test
exit 0 — Test Files 1 passed (1) — Tests 9 passed (9)
```

The orders project was not run. Full-workspace `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm architecture` were not run.

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available

No coverage provider is installed. The threshold in `openspec/config.yaml` is 0.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Taxpayer Fiscal Profile | INC-responsible restaurant | `contexts/invoicing/domain/calculate-taxes.test.ts` > given two rules for one classification, when the profile matches regime, VAT responsibility, INC responsibility, and franchise, then that rule is applied | ✅ COMPLIANT |
| Taxpayer Fiscal Profile | Not VAT responsible | `contexts/invoicing/domain/calculate-taxes.test.ts` > given a taxpayer who is not responsible for VAT, when product lines are calculated, then every product line is excluded | ✅ COMPLIANT |
| Dated Tax Rules | Rate change by date | `contexts/invoicing/domain/calculate-taxes.test.ts` > given a 5% rule until March 31 and a 19% rule from April 1, when the same classification is sold on both dates, then March 31 uses 5% and April 1 uses 19% | ✅ COMPLIANT |
| Dated Tax Rules | No rule found | `contexts/invoicing/domain/calculate-taxes.test.ts` > given no rule matches the line, when the line is calculated, then NoMatchingTaxRule is thrown | ✅ COMPLIANT |
| Price-Included Breakdown and Rounding | VAT 19 % breakdown | `contexts/invoicing/domain/calculate-taxes.test.ts` > given a VAT 19% rule, when a line priced 11900 is calculated, then the base is 10000 and VAT is 1900 with code 01 | ✅ COMPLIANT |
| Price-Included Breakdown and Rounding | Gap beyond rounding limit | `contexts/invoicing/domain/calculate-taxes.test.ts` > given a computed total of 10800, when the paid amount differs by more than 500 either way, then the totals are rejected | ✅ COMPLIANT |
| Tip Outside the Base | Tip added | `contexts/invoicing/domain/calculate-taxes.test.ts` > given an INC 8% line priced 10800, when a voluntary tip of 1000 is added, then the base stays 10000 and INC stays 800 | ✅ COMPLIANT |
| Tip Outside the Base | Tip on an excluded sale | `contexts/invoicing/domain/calculate-taxes.test.ts` > given an excluded sale, when a voluntary tip of 1000 is added, then no tax is computed on the tip | ✅ COMPLIANT |
| Plastic Bag as Item Line | Take-out with bags | `contexts/invoicing/domain/calculate-taxes.test.ts` > given a bag value of 66, when a take-out sale has 2 bags, then one bag line of 132 is produced with no DIAN code | ✅ COMPLIANT |
| Plastic Bag as Item Line | No bags used | `contexts/invoicing/domain/calculate-taxes.test.ts` > given a dine-in sale with no bags, when an unscoped rule and a take-out rule both exist, then the unscoped rule applies and no bag line is produced | ✅ COMPLIANT |
| Corporate Withholdings on Payment | Corporate customer pays | `contexts/invoicing/domain/assess-withholdings.test.ts` > given a withholding agent with recorded withholdings, when they are assessed, then income, VAT, and ICA are returned, invoice taxes stay unchanged, and nothing is stored | ⚠️ PARTIAL |
| Corporate Withholdings on Payment | Final consumer | `contexts/invoicing/domain/assess-withholdings.test.ts` > given a final consumer, when withholdings are assessed, then the assessment is rejected | ✅ COMPLIANT |
| Predefined Profiles | Adopt a template | `contexts/invoicing/application/adopt-fiscal-template/adopt-fiscal-template.test.ts` > given template "SIMPLE regime, INC responsible", when a taxpayer adopts it, then the profile and rules are copied onto that taxpayer | ✅ COMPLIANT |
| Predefined Profiles | Customized copy | `contexts/invoicing/application/adopt-fiscal-template/adopt-fiscal-template.test.ts` > given two taxpayers adopted that template, when one copy is edited, then the template and the other taxpayer stay unchanged | ✅ COMPLIANT |
| Traceability and Offline Parity | Offline computation | `apps/local-node/test/http/tax.controller.test.ts` > given a tax quote, publish, and adopt, when they are posted on the node, then each is rejected and nothing is stored | ⚠️ SPEC/DESIGN CONFLICT |
| Traceability and Offline Parity | Accountant case table | `contexts/invoicing/domain/calculate-taxes.test.ts` > G-INC-8, G-VAT-19, G-VAT-5, G-TIP, G-BAG, G-DATE, and G-EXCLUDED | ⚠️ PARTIAL |

**Compliance summary**: 13/16 scenarios compliant. Two are partial. One is a spec/design conflict, not an untested implementation gap.

The HTTP adopt test also passed for the adopt and customized-copy scenarios. Its edit step calls `saveAdopted` on the in-memory repository after two HTTP adopts. That passing test supports the customized-copy row; it does not add an HTTP edit route.

The spec still says: "A hybrid node MUST compute offline with its rule copy." The offline scenario expects a sale on a hybrid node with rules version 7 to equal the cloud result for version 7, with lines recording version 7. The design decision relied on is: "Postgres, memory, PGlite. `local-node` returns 403 and stores nothing" (D-37, cloud-only MVP). The technical approach also says "Cloud only (D-37)". The design text does not require offline computation. The passing local-node test proves 403 `{ error: "TaxRejected" }` for quote, publish, and adopt, and an empty `ApplicationModule` provider and import list. No node-side calculator is required.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Taxpayer fiscal profile | ✅ Implemented | Ordinary INC-responsible profile selects INC 8% (`04`). A non-VAT profile excludes every product line and returns base equal to the menu price. |
| Dated rules and explicit miss | ✅ Implemented | Inclusive dates select 5% on March 31 and 19% on April 1. No match throws `NoMatchingTaxRule`. A gap past ±500 throws `CashRoundingRejected`. |
| Price-included breakdown, tip, and bags | ✅ Implemented | 11,900 → base 10,000 and VAT 1,900. A 1,000 tip leaves the INC line at 10,000 + 800. Take-out with 2 bags emits one 132 line and a null DIAN code. Dine-in with no bags emits none. Half-even rounding remains in `calculateTaxes`. |
| Withholdings | ⚠️ Partial | Income, VAT, and ICA are returned and invoice taxes stay unchanged. A final consumer throws `WithholdingRejected`. Municipality is not applied as an ICA rate. Nothing is stored on a payment. |
| Predefined profiles | ✅ Implemented | Adopting "SIMPLE regime, INC responsible" copies the profile and rules. Editing one copy leaves the template and the other taxpayer unchanged. |
| Traceability | ⚠️ Partial | Cloud quote lines return `ruleId` and `version` (catalog version 7 in the application test). No sale row is persisted. The node returns 403 and stores nothing, which matches the design and contradicts the spec's offline sentence. |
| Accountant and Factus equality | ⚠️ Partial | The golden breakdowns passed. No test compares them with the Factus sandbox. Quote and configuration tests assert Factus `issue` stays at 0. |
| Cloud HTTP | ✅ Implemented | `POST /tax-quotes` returns 200 for G-INC-8, 403 `TaxConfigureDenied` without `tax.configure`, 400 on a bad body, and 409 `NoMatchingTaxRule`. Publish overlap returns 409 and keeps the prior version. Adopt returns 200. `tax.configure` is YES only for owner in the permission matrix. |
| Node rejection | ✅ Implemented | Quote, publish, and adopt return 403 `{ error: "TaxRejected" }`. `ApplicationModule` providers and imports stay empty. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| `calculateTaxes` on the invoicing entry port; no cash, sale, or Factus call | ✅ Yes | Callers use `@blackhole/invoicing/application/entry-port`. The quote test asserts that export is the same class. Factus issue count stays 0. |
| A new rate is a new version; overlap is rejected | ✅ Yes | Application and HTTP tests keep the old rate and return 409 `OverlappingTaxRule` on an overlapping key. |
| Postgres, memory, and PGlite; `local-node` returns 403 and stores nothing | ✅ Yes | Invoicing includes memory and PGlite contract tests. The node test proves 403 and an empty module. Relied-on sentence: "Postgres, memory, PGlite. `local-node` returns 403 and stores nothing". This follows the design and contradicts the spec's offline scenario. |
| `assessWithholdings` returns amounts and stores nothing | ✅ Yes | Matches the design because the payment aggregate is absent. It does not satisfy the spec clause that withholdings are stored with the payment. |
| Adopt copies rows onto that taxpayer | ⚠️ Partial | The copy is stored and isolated. `CalculateTaxes` then calls `TaxRuleRepository.list(tenantId)` and does not pass `adopted.rules` into the domain. The application test keeps a copy at version 1 with VAT 19% and asserts catalog version 7, INC 8%. An edited copy does not change the quote. |
| Match keys, half-even rounding, tip ignored, bag flag, channels | ✅ Yes | Domain tests cover profile keys, inclusive dates, channel specificity, the delivery-bag flag, and a taxable mandatory delivery charge. The source uses a named `Decimal` import and `Decimal.ROUND_HALF_EVEN`. `tsc` accepts that file. |
| Missing rules throw `NoMatchingTaxRule` | ⚠️ Partial | A stored profile and an empty catalog throw it, and that test passed. A missing adopted profile throws the same error before the domain runs. Unit 6 has no dedicated missing-profile case. The HTTP 409 test uses `openCloud(false)`, which inserts neither a profile nor a rule, so it hits the missing-profile branch while its title says no rule matches. |
| Forced RLS and hidden tenant | ✅ Yes | `tax_rules` and `adopted_fiscal_profiles` use `tenant_id = current_setting('app.tenant_id')`. `fiscal_templates` has no `tenant_id`. RLS is still enabled and forced, with policy `template_catalog` `USING (true)` `WITH CHECK (true)`. That shared catalog matches predefined templates any taxpayer may adopt. It is not a tenant-isolation defect. |
| Zod boundary and `tax.configure` for owner only | ✅ Yes | Channel, regime, and marker use `z.enum` in the cloud controllers. The permission-catalog test passed inside the 409-test run. |
| No HTTP edit of an adopted copy | ✅ Yes | Configuration routes are `POST /tax-rules` and `POST /fiscal-profiles/adopt` only. The passing HTTP isolation test edits through `saveAdopted`. The spec scenario does not require an edit route. |
| `FiscalTemplateNotFound` maps to 409 | ⚠️ Partial | The controller throws `ConflictException({ error: "FiscalTemplateNotFound" })`. No test in this run calls a missing template name. |
| Node `routePermissions` maps only `POST tax-rules` | ✅ Yes | The passing node test expects exactly `{ "POST tax-rules": "tax.configure" }`. Quote and adopt are omitted from the map and still return 403 `TaxRejected` without a store. That is the task's observable contract, not a product failure. |
| Orders, cash, Factus, `shared/contracts`, and SQLite stay out | ✅ Yes | Not part of the invoicing or tax HTTP surface inspected here. |

### Issues Found

**CRITICAL**:

- None.

**WARNING**:

- Spec/design conflict on "Offline computation". The spec says a hybrid node MUST compute offline with its rule copy and that the version-7 result equals the cloud result. The design sentence relied on is: "Postgres, memory, PGlite. `local-node` returns 403 and stores nothing". The design does not require offline computation. The passing local-node test proves 403 `TaxRejected` and an empty module. This is not a missing node-side calculator.
- `contexts/invoicing/tsconfig.json` pins `typeRoots` to `../../node_modules/.pnpm/@types+node@24.19.2/node_modules/@types`. The package does not declare `@types/node`, and the lockfile was not changed. A catalog move of `@types/node` breaks this path. Passing `tsc` shows the previous diagnostics are gone; it does not make the pin durable.
- "Corporate customer pays" is PARTIAL. The passing assessment returns the three amounts and leaves invoice taxes unchanged. The spec says those withholdings are stored with the payment. Design says nothing is stored, because the payment aggregate is out of this change.
- "Accountant case table" is PARTIAL. The golden breakdowns passed. The Factus sandbox comparison did not run. Design leaves that equality to delivery 1.5, and the proposal success checkbox is still open.
- The quote use case reads the tenant catalog, not the rules copied onto the adopted profile. Isolation of the copy passed. A later quote does not use the edited copy. That does not fail the written "Customized copy" scenario, and it does leave adoption without effect on the calculated tax.
- A missing profile throws `NoMatchingTaxRule`, and unit 6 has no dedicated scenario for that guard. The HTTP 409 case reaches it only because the seed omits both the profile and the rules.
- `FiscalTemplateNotFound` returns 409, and unit 10 did not exercise it. There is no spec scenario for a missing template.
- There is no HTTP route to edit an adopted copy. The configuration test adopts over HTTP and then calls `saveAdopted`. The isolation assertion passed.
- Process, not a product failure: work units 8 (~864 lines), 9 (~470), and 10 (~716) exceeded the 400-line review budget. `size:exception` was not granted and those units were not split. Figures are the ones recorded in `apply-progress.md`; this phase did not recompute a repository diff. Apply progress also records unit 7 at about 645 lines under the same condition. Unit 11 is recorded at 88 lines.
- `local-node` `routePermissions` maps only `POST tax-rules` to `tax.configure`. Quote and adopt still return 403 `TaxRejected` and store nothing. The passing test locks that map. Not a product failure.

**SUGGESTION**:

- The two proposal success checkboxes are still open. The dated-rate checkbox is covered by the passing publish tests. The accountant-table and Factus checkbox waits for delivery 1.5.
- A dedicated application test for a missing profile, and an HTTP test for `FiscalTemplateNotFound`, would separate those guards from the no-rule and overlap paths.
- Reconcile the spec sentence "A hybrid node MUST compute offline with its rule copy" with D-37 before archive merges that delta into the main spec.

### Verdict

PASS WITH WARNINGS

13/16 spec scenarios are compliant, every assigned test command passed (493 tests, exit 0), and `tsc -p contexts/invoicing` exited 0. No CRITICAL remains. The offline scenario is a spec/design conflict, and the recorded product and process deviations stay warnings.
