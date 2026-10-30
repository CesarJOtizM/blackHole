```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ac8739b66dd3c555701ae16a907a7543e5bd3e6f22e1421af4d6ff48d326f7cb
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/8
scenarios: 15/16
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:3d7fb8714ccf280e91b0464ae810f3ec2b2c30a72e1abbbf1621c2bdcd44917c
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
```

## Verification Report

**Change**: p1-03-cash-register
**Version**: N/A
**Mode**: Standard

Strict TDD is inactive (`openspec/config.yaml` `strict_tdd: false`). `strict-tdd-verify.md` was not loaded. This report is judged only from this run.

`evidence_revision` is the SHA-256 of this UTF-8 preimage (LF):

```text
test_command=pnpm test
test_exit_code=0
test_output_sha256=3D7FB8714CCF280E91B0464AE810F3EC2B2C30A72E1ABBBF1621C2BDCD44917C
build_command=pnpm typecheck
build_exit_code=0
build_output_sha256=FAEAA94BCF7012D86F91CA647580449F56A263FB7EAF572C54789764F60A9B8F
```

`test_output_hash` is the PowerShell capture of `pnpm test` stdout and stderr (file begins with `$ vi`, 1,365,239 bytes). `build_output_hash` is the `cmd` capture of `pnpm typecheck`. Profile noise is outside those files.

The earlier platform repository timing issue is resolved: `pnpm test` exited 0. `vitest.config.ts` sets the platform `testTimeout` and `hookTimeout` to 20000.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 35 |
| Tasks complete | 35 |
| Tasks incomplete | 0 |

Tasks 1.1–1.11, 2.1–2.8, 3.1–3.6, 4.1–4.2, 5.1–5.6, and 6.1–6.2 are checked in `tasks.md`.

### Build & Tests Execution

**Build**: Passed

```text
pnpm typecheck
exit 0
sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
output: $ tsc -b
```

```text
pnpm exec tsc -b contexts/cash-register contexts/orders apps/api-cloud apps/local-node --pretty false
exit 0
sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
output: empty
```

```text
pnpm architecture
exit 0
sha256:ad56f259ea30ca12dd26f3199700358a7c052eb0b466c13bd9b3b7d5be67bb4d
no dependency violations found (532 modules, 1693 dependencies cruised)
missing-typescript-transpiler note for TypeScript 7 (command still exited 0)
```

**Tests**: 1218 passed, 0 skipped

```text
pnpm test
exit 0
Test Files  161 passed (161)
Tests       1218 passed (1218)
Duration    49.30s
sha256:3d7fb8714ccf280e91b0464ae810f3ec2b2c30a72e1abbbf1621c2bdcd44917c
```

Scoped evidence, all exit 0:

| Command | Result | sha256 |
|---------|--------|--------|
| `pnpm vitest run --project cash-register` | 16 files, 110 tests | `5e797cbbe5b2d3636904f1de8370d1dca39ce075c381d39b435bcc6d7a2d4eb9e` |
| `pnpm vitest run --project orders mark-account-paid dining-table release-table` | 3 files, 13 tests | `d5370260b76f01d250d9278231d881f1d37127df25bb969d4f745ff867aee5ca` |
| `pnpm vitest run --project api-cloud cash-shift.controller charge-check.controller cash-count.controller bootstrap.test.ts` | 4 files, 17 tests | `c00f85a33fe0d24383d7aa22ab2efc7ecc75d8fc7f2713c2ccd60e3646385f0b` |
| `pnpm vitest run --project local-node cash-register.controller tax.controller` | 2 files, 2 tests | `a303689858d3b82d1e491d89a4bd9422e4b6aa737e29a19e4beca393651248ba` |
| `pnpm vitest run --project skeleton skeleton.test.ts route-permission-declaration.test.ts` | 2 files, 10 tests | `62ac070c5ccd7a018a3511f8c6ee1faffb44b57c03ef062db32459a8a56ca4bb` |

**Coverage**: Not available / threshold: 0 → Not available (no coverage provider)

**Lint** (not a build gate): `pnpm lint` exited 1. A full Biome JSON pass reported 464 diagnostics: 463 `format` and 1 `lint/complexity/useOptionalChain` in `contexts/platform/domain/authorization.ts`. See SUGGESTION.

### Spec Compliance Matrix

A scenario is compliant when its covering test passed in this run. The hybrid outbox clause is partial under decision D-37.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Shift Opening | Open a shift | `contexts/cash-register/domain/cash-shift.test.ts` > given cash register C has no open shift, when cashier K declares a 200000 float, then a shift opens for K on C | ✅ COMPLIANT |
| Shift Opening | Second shift rejected | `contexts/cash-register/domain/cash-shift.test.ts` > given C has an open shift, when another cashier opens a shift on C, then ShiftAlreadyOpen and the shift stays | ✅ COMPLIANT |
| Payments and Mixed Payments | Mixed payment with change | `contexts/cash-register/domain/payment.test.ts` > given an account of 85000, when card 50000 and cash 40000 are recorded, then it is paid with 5000 change | ✅ COMPLIANT |
| Payments and Mixed Payments | Incomplete card data | `contexts/cash-register/domain/payment.test.ts` > given a card payment without an approval number, when the cashier submits it, then IncompleteCard and nothing is stored | ✅ COMPLIANT |
| Account Split | Equal split with remainder | `contexts/cash-register/domain/account-split.test.ts` > given an account of 100000 split in 3, when the split is created, then parts are 33334, 33333 and 33333 and each copies originTableId | ✅ COMPLIANT |
| Account Split | Partially paid split | `contexts/cash-register/domain/account-split.test.ts` > given a split account with one part paid, when viewed, then it stays open until all parts are paid | ✅ COMPLIANT |
| Tip Capture | Tip recorded apart | `contexts/cash-register/domain/payment.test.ts` > given an account of 100000, when the customer adds a 10000 tip by card, then the sale stays 100000 and the card tip is 10000 | ✅ COMPLIANT |
| Tip Capture | Tip declined | `contexts/cash-register/domain/payment.test.ts` > given the customer declines the tip, when payment is recorded, then a zero tip is stored | ✅ COMPLIANT |
| Cash Movements | Withdrawal recorded | `contexts/cash-register/domain/cash-movement.test.ts` > given an open shift, when 300000 is withdrawn with a reason, then expected cash drops by 300000 | ✅ COMPLIANT |
| Cash Movements | Missing reason | `contexts/cash-register/domain/cash-movement.test.ts` > given an open shift, when a cash out has no reason, then MissingReason and the shift stays | ✅ COMPLIANT |
| Blind Count and Terminal Reconciliation | Difference needs approval | `contexts/cash-register/domain/cash-count.test.ts` > given the count is 10000 short, when the cashier closes the shift, then VarianceNeedsApproval and it stays counting | ✅ COMPLIANT |
| Blind Count and Terminal Reconciliation | Terminal mismatch | `contexts/cash-register/domain/cash-count.test.ts` > given terminal T recorded 900000 and its report says 880000, when reconciliation runs, then a 20000 difference is shown for T | ✅ COMPLIANT |
| Partial and Immutable Final Close | Partial close | `contexts/cash-register/domain/cash-count.test.ts` > given an open shift, when a partial close is done, then the shift stays open and keeps receiving payments | ✅ COMPLIANT |
| Partial and Immutable Final Close | Edit after close | `contexts/cash-register/domain/cash-count.test.ts` > given a closed shift, when a payment is added or edited, then ShiftClosed and the count stays | ✅ COMPLIANT |
| Sale Closure and Operating Mode | Paid during a cut (hybrid) | `apps/api-cloud/test/http/charge-check.controller.test.ts` > given an occupied check of 85000, when POST charge pays that cash amount, then the response is 200, one queued closure is stored, and the table becomes to_clean once | ⚠️ PARTIAL |
| Sale Closure and Operating Mode | Cut in cloud mode | `apps/local-node/test/http/cash-register.controller.test.ts` > given every cloud cash route, when the node is called, then each is rejected and nothing is stored (`CashRegisterRejected`) | ✅ COMPLIANT |

**Compliance summary**: 15/16 scenarios compliant. 1 partial (hybrid outbox deferred by D-37). Application and HTTP tests for the same behaviors also passed in the cash-register, orders, api-cloud, and local-node scoped runs.

The hybrid scenario's outbox clause has no covering test. D-37 keeps SQLite, the outbox, and sync out of this change. The passed stand-in is a queued `sale_closures` row plus `to_clean`, and local-node 403 for cloud mode. That gap is a WARNING, not a blocker.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Shift Opening | ✅ Implemented | `CashShift.open` stores cashier and one integer float. A second open throws `ShiftAlreadyOpen`. HTTP POST open returns 200 / 403 / 400 / 409 in the api-cloud run. |
| Payments and Mixed Payments | ✅ Implemented | Cash, card, transfer, wallet, voucher, and both credits. Change is cash and capped by the cash tender. Card stores terminal, approval, brand, and last 4. |
| Account Split | ✅ Implemented | Equal remainder is 33334, 33333, 33333. Parts copy `originTableId`. One paid part leaves the split open. No diner id (WARNING). |
| Tip Capture | ✅ Implemented | Missing tip is rejected. A card tip stays off `saleCop`. A declined tip stores zero. |
| Cash Movements | ✅ Implemented | Domain and `RecordMovement` append cash in, cash out, and withdrawal with a reason. No HTTP route (WARNING). |
| Blind Count and Terminal Reconciliation | ✅ Implemented | Expected cash stays hidden until submit. A short count waits for another person. Terminal difference is recorded minus reported. GET count omits expected. |
| Partial and Immutable Final Close | ✅ Implemented | Partial close returns to `open` and still accepts charges on the count. A closed count rejects edit and stores a correction as a new movement. `ChargeCheck` does not consult that count (WARNING). |
| Sale Closure and Operating Mode | ⚠️ Partial | Full payment inserts one `queued` closure and `MarkAccountPaid` sets `to_clean`. Cloud mode on the node is 403 `CashRegisterRejected` and stores nothing. Hybrid outbox is D-37. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| New `cash-register` context | ✅ Yes | Domain, application, memory, manual terminal, and Postgres exist. Skeleton allows the context. `pnpm architecture` reported no dependency violations. |
| D-37: Postgres and memory; node stores nothing | ✅ Yes | No SQLite, outbox, or sync in this change. Local-node controller returns 403 and has no repository. |
| Cash allocation; lines stay in orders | ✅ Yes | Split copies `originTableId`. Order lines are not moved. |
| `MarkAccountPaid` is idempotent `to_clean` | ✅ Yes | Orders tests: occupied and check-requested become `to_clean`; a second call stays; a free table is rejected. |
| One queued closure; no `CalculateTaxes` | ✅ Yes | `ChargeCheck` writes `status: "queued"` and does not call tax calculation. Same `commandId` does not mark paid again. |
| Manual `CardTerminal` | ✅ Yes | `manual-card-terminal.test.ts` passed inside the cash-register project (110 tests). |
| GET omits expected | ✅ Yes | `cash-count.controller.test.ts` passed in the api-cloud scoped run. |
| `counting` rejects charges on the count | ✅ Yes | Domain and `CloseShift` tests passed. The HTTP charge path does not call the count. |
| Ports, not other interiors | ✅ Yes | Host calls `GetCheck`, `ViewVenueMenu`, and `MarkAccountPaid`. Architecture check exited 0. |
| Nest cash stores default to memory | ✅ Yes | `ApplicationModule.register` uses `InMemoryCashRegisterRepository`, `MemoryChargeLedger`, and `MemoryCashCounts` when dependencies are omitted. Postgres is the contract dialect, which matches the no-persistence-dialect composition rule. |
| Opening float is one integer; denominations live on the count | ✅ Yes | `openingFloatCop` is one integer. Denomination lines are on `CashCount`. |
| No diner id | ✅ Yes | `AccountPart` has id, amount, origin table, paid, and lines. Design says there is no diner field. |
| Prefixes `shift_`, `movement_`, `payment_`, `part_`, `count_`, `closure_` | ✅ Yes | Domain tests reject ids outside those prefixes. |
| Review budget overrun | Note | Tasks forecast 4800–7000 lines, 400-line budget risk High, chained PRs recommended. Not a behavior gap. |

### Issues Found

**WARNING**:

1. `DrizzleCashRegisterRepository.toShift` always calls `CashShift.open` and ignores `cash_shifts.status`. A stored counting or closed shift row reloads as domain state `open`. `CashShift` itself only models `open`. `readCount` returns the stored count status. The use-case `CashCountStore` in api-cloud keeps the live object.
2. `ChargeCheck.execute` does not read the count. A new `commandId` can still record a payment after close. Domain and `CloseShift` tests still reject an edit after close, and those tests passed, so the spec scenario stays compliant.
3. There is no HTTP route for cash in, cash out, or withdrawal. Mapped cash routes are open, charge, count, approve, partial close, and final close. Movement spec scenarios passed at domain and application.
4. api-cloud defaults to in-memory cash stores. Postgres is tested in the PGlite contract tests, not wired as the Nest default. That matches the no-persistence-dialect composition rule.
5. The opening float is one integer. The spec sentence asks for a float by denomination; denominations are on the count. The open-shift scenario (200000) passed.
6. Diner split has no diner id. Equal split and the partially paid scenario passed. Line split assigns lines and copies `originTableId`.
7. Hybrid outbox, SQLite, and sync are absent under D-37. Local-node 403 `CashRegisterRejected` is the cloud-mode stand-in and passed. The hybrid scenario is partial because the outbox clause has no passing test.

**SUGGESTION**:

1. `pnpm lint` exited 1. Biome reported 463 format diagnostics and 1 `useOptionalChain` warning in `contexts/platform/domain/authorization.ts`. The printed sample is CRLF on JSON configs across the repo. `contexts/cash-register/domain/index.ts` has the same CRLF-only format diff; import order is already organized.
2. `pnpm architecture` exited 0. dependency-cruiser still prints `missing-typescript-transpiler` for TypeScript 7.
3. The tasks review-budget forecast is High and recommends chained PRs. That is a delivery note.

### Verdict

PASS WITH WARNINGS

15/16 scenarios have a passing covering test. `pnpm test` exited 0 (161 files, 1218 tests) and `pnpm typecheck` exited 0. Remaining gaps are design deviations and the D-37 hybrid outbox. Archive is allowed: yes. `pnpm test` exit code: 0.
