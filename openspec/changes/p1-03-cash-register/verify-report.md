```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:58c240b48376bade415eb98baee3c20c983ddd5efac297ed2fdde3281bfb591c
verdict: fail
blockers: 1
critical_findings: 1
requirements: 7/8
scenarios: 15/16
test_command: pnpm test
test_exit_code: 1
test_output_hash: sha256:58c240b48376bade415eb98baee3c20c983ddd5efac297ed2fdde3281bfb591c
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:1f345e6ac1f9e6ae7c4e70d1f0c8c9f8b8f80218269a1b4473f9ac63a9d4a253
archive_allowed: false
```

## Verification Report

**Change**: p1-03-cash-register
**Version**: N/A
**Mode**: Standard
**Persistence**: openspec
**Workspace**: working tree at `c:\Users\csar-\Proyectos\blackHole`
**Judged from**: this run (the previous `verify-report.md` was not reused)

`evidence_revision` and `test_output_hash` are the SHA-256 of the captured `pnpm test` stdout/stderr. `build_output_hash` is the SHA-256 of the captured `pnpm typecheck` stdout/stderr (`$ tsc -b` plus CRLF, 10 bytes).

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 35 |
| Tasks complete | 35 |
| Tasks incomplete | 0 |

Tasks 1.1–6.2 are all checked. Apply units 1–17 are recorded done. Full verification was allowed to run.

### Build & Tests Execution

**Build**: Passed

```text
pnpm typecheck
exit 0
output: $ tsc -b
sha256:1f345e6ac1f9e6ae7c4e70d1f0c8c9f8b8f80218269a1b4473f9ac63a9d4a253

pnpm exec tsc -b contexts/cash-register contexts/orders apps/api-cloud apps/local-node --pretty false
exit 0
output: empty
sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

**Tests**: Failed at the suite gate. Scoped cash-register coverage passed.

```text
pnpm test
exit 1
Test Files  1 failed | 160 passed (161)
Tests       1 failed | 1217 passed (1218)
Duration    52.38s
sha256:58c240b48376bade415eb98baee3c20c983ddd5efac297ed2fdde3281bfb591c

Failed test:
contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts
  > given an organization and its change, when they are saved, then both can be read back
Error: Test timed out in 5000ms.
  at organizationRepositoryContract
     contexts/platform/application/ports/organization-repository.contract.ts:92

Isolated retry (not one of the two named exemptions):
pnpm vitest run --project platform contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts
exit 0
Test Files  1 passed (1)
Tests       4 passed (4)
Duration    4.37s
```

The two platform files named in the verify brief did not fail in this full suite:

- `contexts/platform/adapters/postgres/drizzle-pending-issuance.contract.test.ts`
- `contexts/platform/adapters/postgres/drizzle-provider-rate-gate.contract.test.ts`

Scoped runs, all exit 0:

| Command | Result |
|---------|--------|
| `pnpm vitest run --project cash-register` | 16 files, 110 passed |
| `pnpm vitest run --project orders mark-account-paid dining-table release-table` | 3 files, 13 passed |
| `pnpm vitest run --project api-cloud cash-shift.controller charge-check.controller cash-count.controller bootstrap.test.ts` | 4 files, 17 passed |
| `pnpm vitest run --project local-node cash-register.controller tax.controller` | 2 files, 2 passed |
| `pnpm vitest run --project skeleton skeleton.test.ts route-permission-declaration.test.ts` | 2 files, 10 passed |

**Architecture**: Passed (`pnpm architecture`, exit 0). dependency-cruiser reported no violations (532 modules, 1693 dependencies) and printed `missing-typescript-transpiler` for TypeScript >= 7. That notice did not change the exit code.

**Lint**: `pnpm lint` exit 1. Biome reported 398 errors and 1 warning; 379 diagnostics were hidden by the diagnostic cap. The diagnostics that were printed are formatter CRLF (`␍`) diffs, including files outside cash-register. A separate in-scope check is recorded under Issues. Coverage: not available (threshold 0).

### Spec Compliance Matrix

Covering tests below passed in the scoped runs and were not among the full-suite failures. A scenario is compliant only when that covering test passed in this run.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Shift Opening | Open a shift | `contexts/cash-register/domain/cash-shift.test.ts` > given cash register C has no open shift, when cashier K declares a 200000 float, then a shift opens for K on C | ✅ COMPLIANT |
| Shift Opening | Second shift rejected | `contexts/cash-register/domain/cash-shift.test.ts` > given C has an open shift, when another cashier opens a shift on C, then ShiftAlreadyOpen and the shift stays | ✅ COMPLIANT |
| Payments and Mixed Payments | Mixed payment with change | `contexts/cash-register/domain/payment.test.ts` > given an account of 85000, when card 50000 and cash 40000 are recorded, then it is paid with 5000 change | ✅ COMPLIANT |
| Payments and Mixed Payments | Incomplete card data | `contexts/cash-register/application/charge-check/charge-check.test.ts` > given a card capture without an approval number, when the cashier submits it, then IncompleteCard and nothing is saved | ✅ COMPLIANT |
| Account Split | Equal split with remainder | `contexts/cash-register/domain/account-split.test.ts` > given an account of 100000 split in 3, when the split is created, then parts are 33334, 33333 and 33333 and each copies originTableId | ✅ COMPLIANT |
| Account Split | Partially paid split | `contexts/cash-register/domain/account-split.test.ts` > given a split account with one part paid, when viewed, then it stays open until all parts are paid | ✅ COMPLIANT |
| Tip Capture | Tip recorded apart | `contexts/cash-register/domain/payment.test.ts` > given an account of 100000, when the customer adds a 10000 tip by card, then the sale stays 100000 and the card tip is 10000 | ✅ COMPLIANT |
| Tip Capture | Tip declined | `contexts/cash-register/domain/payment.test.ts` > given the customer declines the tip, when payment is recorded, then a zero tip is stored | ✅ COMPLIANT |
| Cash Movements | Withdrawal recorded | `contexts/cash-register/application/record-movement/record-movement.test.ts` > given an open shift, when 300000 is withdrawn with a reason, then expected cash drops by 300000 | ✅ COMPLIANT |
| Cash Movements | Missing reason | `contexts/cash-register/domain/cash-movement.test.ts` > given an open shift, when a cash out has no reason, then MissingReason and the shift stays | ✅ COMPLIANT |
| Blind Count and Terminal Reconciliation | Difference needs approval | `contexts/cash-register/domain/cash-count.test.ts` > given the count is 10000 short, when the cashier closes the shift, then VarianceNeedsApproval and it stays counting | ✅ COMPLIANT |
| Blind Count and Terminal Reconciliation | Terminal mismatch | `contexts/cash-register/domain/cash-count.test.ts` > given terminal T recorded 900000 and its report says 880000, when reconciliation runs, then a 20000 difference is shown for T | ✅ COMPLIANT |
| Partial and Immutable Final Close | Partial close | `contexts/cash-register/application/close-shift/close-shift.test.ts` > given an open shift, when a partial close is done, then the shift stays open and keeps receiving payments | ✅ COMPLIANT |
| Partial and Immutable Final Close | Edit after close | `contexts/cash-register/application/close-shift/close-shift.test.ts` > given a closed shift, when a payment is added or edited, then ShiftClosed and nothing is saved | ✅ COMPLIANT |
| Sale Closure and Operating Mode | Paid during a cut (hybrid) | (none; outbox/SQLite/sync deferred by D-37) | DEFERRED |
| Sale Closure and Operating Mode | Cut in cloud mode | `apps/local-node/test/http/cash-register.controller.test.ts` > given every cloud cash route, when the node is called, then each is rejected and nothing is stored | ✅ COMPLIANT |

**Compliance summary**: 15/16 scenarios compliant. 1 scenario is an accepted D-37 deferral (hybrid outbox), not a critical finding. 0 failing. 0 untested scenarios inside this delivery.

The cloud-mode scenario is the local-node `403` body `{ error: "CashRegisterRejected" }` on every cloud cash route, including charge. Nothing is stored. `venue-app` is deferred in the design, so there is no screen assertion. That stand-in is the behavior this change owns.

Online sale handoff (one `queued` closure, then `MarkAccountPaid` / table `to_clean`) passed in `charge-check.test.ts`, `mark-account-paid.test.ts`, and `charge-check.controller.test.ts`. That is the cloud handoff. It does not cover the hybrid outbox scenario.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Shift Opening | ✅ Implemented | `CashShift.open` records cashier, register, and a single integer float. A second open throws `ShiftAlreadyOpen`. HTTP `POST .../open` returns 200 / 403 / 400 / 409 in `cash-shift.controller.test.ts`. |
| Payments and Mixed Payments | ✅ Implemented | Cash, card, transfer, wallet, voucher, and credit tenders. Change is capped by the cash tender. Card capture keeps terminal, approval, brand, and last 4. |
| Account Split | ✅ Implemented | Equal split uses the deterministic remainder (33334, 33333, 33333). A partly paid split stays open. Lines stay in orders; parts copy `originTableId`. |
| Tip Capture | ✅ Implemented | Tip is outside the sale, including a stored zero when declined. Missing tip decision throws `MissingTip`. |
| Cash Movements | ✅ Implemented | Withdrawal of 300000 reduces expected cash. Empty reason throws `MissingReason`. Movements are append-only in the domain. |
| Blind Count and Terminal Reconciliation | ✅ Implemented | Expected total is hidden until submit. A 10000 gap waits for another person's approval. Terminal 900000 vs 880000 stores a 20000 difference. HTTP GET omits expected cash. |
| Partial and Immutable Final Close | ✅ Implemented | Partial close stays `open` and still accepts charges on `CloseShift`. Final close rejects add/edit with `ShiftClosed`. A correction is a new movement. |
| Sale Closure and Operating Mode | ⚠️ Partial | Cloud collect-while-offline is the node 403. Fully paid online path queues one closure and sets the table `to_clean`. Hybrid outbox is D-37, not delivered. |

`apps/api-cloud/test/composition/bootstrap.test.ts` passed, including providers for `OpenShift`, `OrdersAccount`, `ChargeCheck`, `SubmitCount`, `ApproveVariance`, and `CloseShift`. `apps/local-node/src/http/tax.controller.ts` declares `POST tax-quotes`, `POST tax-rules`, and `POST fiscal-profiles/adopt` as `tax.configure`. The local-node tax test and the skeleton route-permission test passed.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| New `cash-register` context, integer COP, ports, no Nest/SQL/Zod in domain | ✅ Yes | Context, entry port, and domain tests exist. Architecture check passed. |
| D-37 cloud MVP: Postgres and memory; node stores nothing; no SQLite, outbox, or sync | ✅ Yes | Local-node controller returns 403 and has no repository. Missing hybrid outbox is this decision, not a defect of this change. |
| `MarkAccountPaid` sets `to_clean` and is idempotent; `ReleaseTable` stays | ✅ Yes | Orders tests passed, including a second mark staying `to_clean` and a free table rejected. |
| One queued `sale_closures` row; no `CalculateTaxes` | ✅ Yes | Charge tests assert one queued closure and no second pay for the same `commandId`. |
| Manual `CardTerminal`; last 4, brand, approval, terminal | ✅ Yes | Manual terminal test passed. |
| GET omits expected total until the count is submitted | ✅ Yes | Domain, submit-count, and HTTP tests passed. `shared/contracts/cash-register.ts` shift read has no expected field. |
| `counting` rejects charges; partial close stays `open`; variance needs another person inside `varianceCop` | ✅ Yes | Covered by `CashCount` / `CloseShift` tests, not by `ChargeCheck`. |
| Prefixes `shift_`, `movement_`, `payment_`, `part_`, `count_`, `closure_` | ✅ Yes | Invalid-id tests reject the wrong prefix. |
| Routes under `tenants/:tenantId/venues/:venueId` | ⚠️ Partial | Open, charge, count, approve, partial close, and final close exist. Cash in, cash out, and withdrawal routes do not. |
| api-cloud uses Postgres | ⚠️ No | Nest composition defaults to `InMemoryCashRegisterRepository`. Postgres is contract-tested. Bootstrap asserts no persistence dialect. |
| Opening float by denomination | ⚠️ No | Open takes one `openingFloatCop` integer. Denominations are on the count. The 200000 scenario still passes. |
| Split by diner | ⚠️ Partial | Product and diner splits share line assignment and `originTableId`. There is no diner id. Design says "No diner field." |
| Closed or counting shift reloads as that status | ⚠️ No | `toShift` always calls `CashShift.open`, which sets `open` and ignores `row.status`. |
| `ChargeCheck` refuses payment after close | ⚠️ No | `ChargeCheck.execute` does not read the count. `CloseShift` tests still cover the spec scenario. |
| `RecordAuditEvent` after save; `safeParse` before save | ✅ Yes | HTTP shift tests assert 403/400 save nothing and a successful open is audited. |

### Issues Found

**CRITICAL**:

- `pnpm test` exited 1. The only failure was `contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts` > `given an organization and its change, when they are saved, then both can be read back` (`Test timed out in 5000ms`). It is not one of the two named platform flakes, so the suite gate stays CRITICAL. An isolated retry of that file passed (4 tests, exit 0, 4.37s). This is a full-suite PGlite load timeout in platform organization persistence, not a failed cash-register assertion. Cash-register, orders, api-cloud, local-node, and skeleton scoped runs all passed. Archive stays blocked until `pnpm test` exits 0 or this flake is explicitly accepted.

**WARNING**:

- A saved counting or closed shift reloads as open. `CashShift.open` always sets state `open`. `DrizzleCashRegisterRepository.toShift` ignores `row.status` and calls `open`. `InMemoryCashRegisterRepository.save` throws `ShiftAlreadyOpen` when the register key already exists, so that adapter cannot append a later status or a later movement.
- `ChargeCheck` does not consult the count. A new `commandId` can still insert a payment and a queued closure after close. The spec scenario "Edit after close" remains compliant because `close-shift.test.ts` and `cash-count.test.ts` passed (`ShiftClosed`, nothing saved).
- No HTTP route for cash in, cash out, or withdrawal. Cloud and node controllers do not declare `cash.movement` or `cash.partial-withdrawal`. Domain and application movement tests passed, so the spec scenarios stay compliant.
- api-cloud composition defaults to in-memory cash stores (`application-module.ts`). The Postgres adapter is tested; it is not the Nest default. This matches the existing no-persistence-dialect rule (`bootstrap.test.ts` passed) and still differs from the design sentence "api-cloud uses Postgres".
- Opening float is one integer. Denominations live on the count. The open scenario (200000) passed. The requirement sentence "a float by denomination" is not what open records.
- Diner split has no diner id. `AccountSplit.assign` copies `originTableId` for product and diner parts. The design already says there is no diner field.
- `contexts/cash-register/domain/index.ts` fails Biome `assist/source/organizeImports` (exports are not sorted). In-scope `biome check` of the cash-register context, cash HTTP controllers, tax controller, contracts, and `mark-account-paid` exited 1 with that single diagnostic. No other in-scope lint diagnostic was reported.

**SUGGESTION**:

- Review budget: tasks forecast 4800–7000 changed lines, 400-line risk High, chained PRs recommended, and no `size:exception`. This is a review-size note, not a behavior failure.
- `pnpm lint` exit 1 is dominated by pre-existing CRLF formatter noise (398 errors, diagnostic cap hid 379). Separate that from the in-scope `organizeImports` warning above.
- dependency-cruiser's TypeScript >= 7 transpiler notice did not fail `pnpm architecture`.

**Accepted deferral (not a defect)**:

- Hybrid outbox, SQLite, and sync are D-37. The scenario "Paid during a cut (hybrid)" has no outbox test and is not marked compliant. It is not CRITICAL for this change. The local-node 403 is the cloud-mode behavior.

### Verdict

FAIL

`pnpm test` exited 1 on a platform PGlite timeout that the brief does not exempt. Spec scenarios for this change are 15/16 compliant, with the hybrid outbox deferred by D-37. Design deviations above are warnings and do not by themselves fail a scenario that has a passing test. Archive is not allowed.

**Archive allowed**: No
**Next**: sdd-apply
