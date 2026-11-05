# Apply progress: Tips

**Change**: p1-10-tips
**Mode**: Standard (ADR-017 test-first; `strict_tdd` is false)
**PR slice**: feature-branch-chain. Each completed slice is its own branch. `size:exception` was not granted. HTTP and the local node are still open.
**Work unit**: tasks 1.1 through 6.1 and 5.1 through 5.2.
**Chain strategy**: feature-branch-chain
**size:exception**: not granted
**Latest batch**: the completed slices are committed on stacked branches. Tasks 7.1 through 8.1 remain open.

## Completed tasks

- [x] 1.1 RED/GREEN `contexts/cash-register/domain/tip-period.ts` + test: half-open America/Bogota day and week (UTC−5). Shift is the caller's `from`/`to`.
- [x] 1.2 RED/GREEN `contexts/cash-register/domain/tip-rule.ts` + test: `equal`, `percentage`, `hours`. `{ employeeId, percent }` integers sum 100. Reject other sums and role keys (D-24).
- [x] 1.3 RED/GREEN `contexts/cash-register/domain/distribute-tips.ts` + test: `sum(baseCop) + residueCop = poolCop`. Integer extra pesos by `userId` `localeCompare` on the share. Zero minutes stay 0. Removed percent stays in `residueCop`. Zero pool, no shares. Repeat matches.
- [x] 3.1 RED/GREEN `contexts/attendance/application/list-tip-participants/` `entry-port.ts` `package.json`: `userId` and `workedMinutes` via `projectHours`, same policy path as `export-hours`.
- [x] 1.4 RED/GREEN `contexts/cash-register/domain/tip-settlement.ts` `domain/index.ts` + test: append-only snapshot. Adjustment has `adjustsSettlementId` and the original rule snapshot. Same `settlement_` id returns the first row. Share edit rejected.
- [x] 5.1 RED/GREEN `shared/printing/domain/templates.ts` `domain/operation-templates.test.ts` `application/enqueue-print-job/enqueue-print-job.ts` `application/entry-port.ts`: methods, rule, residue, share, signature; 80 mm and 58 mm; `kickDrawer` false. Export `DispatchPrintJobs`. printing
- [x] 2.1 RED/GREEN `contexts/cash-register/application/configure-tip-rule/` `entry-port.ts` `package.json`: `cash.settle-tips` before write. Employee percents. Sum 100. Audit `tips.rule-changed` only. cash-register
- [x] 4.1 RED/GREEN `contexts/cash-register/application/settle-tips/` `ports/tip-pool.ts` `ports/tip-participant-source.ts` `entry-port.ts` `package.json`: permission first. `PaymentTip.amountCop` by `recorded_at` and method (20,000 cash + 30,000 card = 50,000). No `saleCop` or tax. Empty means no shares. Add or remove needs a reason. Removed employee excluded. Same id returns first row. Audit `tips.settlement-closed`. cash-register
- [x] 4.2 RED/GREEN `contexts/cash-register/application/adjust-tip-settlement/` `entry-port.ts` `package.json`: permission first. New row, `adjustsSettlementId`, original snapshot after a later rule change. Audit `tips.settlement-adjusted`. cash-register
- [x] 6.1 RED/GREEN `contexts/cash-register/adapters/postgres/0015_tips.sql` `schema.ts` `drizzle-cash-register-ledger.contract.test.ts` `application/charge-check/`: `tip_rules`, append-only `tip_settlements`. New `payments.recorded_at` from the platform clock. Backfill `1970-01-01T00:00:00.000Z`. Role `cash_register_app`. Tax unchanged. PGlite. cash-register
- [x] 5.2 RED/GREEN `contexts/cash-register/application/print-tip-settlement/` `ports/printer.ts` `entry-port.ts` `package.json`: permission before enqueue. `tips_settlement`, `kickDrawer: false`. Backup or queued failure. No `@blackhole/printing` import. cash-register

## Work Unit Evidence

### Unit 1 — Tip period window (task 1.1)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm exec vitest run --project cash-register contexts/cash-register/domain/tip-period.test.ts`. RED exit 1: 1 failed file, no tests. GREEN exit 0: 1 file, 6 passed. Same command after Biome LF format: exit 0, 1 file, 6 passed. |
| Runtime harness | N/A. Domain only. |
| Rollback boundary | `contexts/cash-register/domain/tip-period.ts`, `contexts/cash-register/domain/tip-period.test.ts` |
| Pair size | 187 lines (109 implementation + 78 test). Additions only. Under the 400-line budget. The pair was not split. |

#### RED

Command: `pnpm exec vitest run --project cash-register contexts/cash-register/domain/tip-period.test.ts`

Result: exit 1. Test Files 1 failed. Tests: no tests.

Failure before production code existed:

- `Cannot find module '#domain/tip-period.js'` imported from `contexts/cash-register/domain/tip-period.test.ts`.

#### GREEN

Same command. Exit 0. Test Files 1 passed. Tests 6 passed (6).

Biome `--write` converted CRLF to LF and wrapped one return. Same command again. Exit 0. Test Files 1 passed. Tests 6 passed (6).

### Behavior

- `TipPeriod.day({ at })` is the half-open America/Bogota civil day at a fixed UTC−5 offset, the same midnight arithmetic as attendance export. The start instant is included. The next local midnight is excluded. An instant 1 ms before `05:00Z` belongs to the previous civil day.
- `TipPeriod.week({ at })` is the half-open civil week from Monday 00:00 America/Bogota to the next Monday 00:00 exclusive. Sunday evening belongs to the week that opened the previous Monday.
- `TipPeriod.shift({ from, to })` keeps the caller strings. It does not snap those bounds to a Bogota midnight. `contains` compares instants and is half-open, so a shift that crosses local midnight still includes the instant after midnight and excludes `to`.
- A shift with `from >= to` throws `InvalidTipWindow`. An unparseable instant throws `InvalidTipInstant`.

### Unit 2 — Tip rule (task 1.2)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm exec vitest run --project cash-register contexts/cash-register/domain/tip-rule.test.ts`. RED exit 1: 1 failed file, no tests. GREEN exit 0: 1 file, 9 passed. Same command after Biome check --write: exit 0, 1 file, 9 passed. |
| Runtime harness | N/A. Domain only. No runtime boundary. |
| Rollback boundary | Delete `contexts/cash-register/domain/tip-rule.ts` and `contexts/cash-register/domain/tip-rule.test.ts`. Uncheck task 1.2. Remove this Unit 2 section. Leave task 1.1 and its files in place. |
| Pair size | 188 lines (90 implementation + 98 test). Additions only. Under the 400-line budget. The pair was not split. No overage. |

#### RED

Command: `pnpm exec vitest run --project cash-register contexts/cash-register/domain/tip-rule.test.ts`

Result: exit 1. Test Files 1 failed. Tests: no tests.

Failure before production code existed:

- `Cannot find module '#domain/tip-rule.js'` imported from `contexts/cash-register/domain/tip-rule.test.ts`.

#### GREEN

Same command. Exit 0. Test Files 1 passed. Tests 9 passed (9).

`pnpm exec biome check --write` on the pair fixed 2 files (line endings). Same command again. Exit 0. Test Files 1 passed. Tests 9 passed (9).

### Behavior

- `TipRule.equal()` is mode `equal` and stores no percentage rows.
- `TipRule.hours()` is mode `hours` and stores no percentage rows.
- `TipRule.percentage` accepts rows `{ employeeId, percent }`. Each percent is an integer from 0 through 100. The rows must sum to 100. A single employee at 100 is valid. 60 and 40 are kept in order.
- Any other sum throws `InvalidTipPercentage`. A non-integer percent throws `InvalidTipPercentage`. A negative percent whose partner still sums to 100 throws `InvalidTipPercentage`. A blank `employeeId` throws `InvalidTipPercentage`.
- A row that contains a `role` key throws `InvalidTipRoleShare`, including when `employeeId` is also present and the percents sum to 100. Rows that only name a role throw `InvalidTipRoleShare`. There is no percentage per role (D-24).

## Decisions

The design says a half-open America/Bogota week and does not name the weekday. This slice uses Monday, the Colombian civil week. `domain/index.ts` stays unchanged; task 1.4 owns that export. `state.yaml` stays `apply: pending`.

Task 1.2 imports `#domain/tip-rule.js` and does not export `TipRule` from `domain/index.ts`. The mode name is `hours`, matching the design, rather than the TRD name `by_hours`.

Task 1.3 imports `#domain/distribute-tips.js` and does not export `distributeTips` from `domain/index.ts`. Integer extra pesos are stored on `share.residueCop` in `userId` `localeCompare` order. The returned `residueCop` is the unallocated amount, including a removed employee's percent. `sum(baseCop) + sum(share.residueCop) + residueCop = poolCop`. Percentage shares use a denominator of 100 and are not rescaled after a removal. `TipRule` remains the gate that percentages sum to 100. A zero pool returns no shares. There is no tax input.

## Deviations from Design

None beyond the Monday week start recorded above. The inverted-shift rejection keeps a half-open window non-empty. The implementation matches the day, week, and shift rules in the design.

Task 1.2 matches the design: percent per `employeeId`, integers, sum 100, no role key. Each percent is also bounded to 0 through 100, and a blank `employeeId` is rejected, so 150 and −50 cannot pass by summing to 100.

Task 1.3 matches the design contract. Extra pesos stay visible on the share. A removed percent stays in the unallocated residue.

## Issues Found

None.

## Remaining tasks

- [ ] 7.1 through 8.1

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`)
- Current work unit: PR1. Task 1.1 was the previous batch. This batch is task 1.2 only.
- Boundary: starts and ends at the tip-rule domain pair. The tip-period pair stays as already applied.
- Estimated review budget impact: this pair is 188 changed lines. No overage. Combined with the 187-line tip-period pair, the child is 375 lines and still under 400.
- Task 1.3 pair: 386 lines (207 implementation + 179 test). Additions only. Under 400. No overage. The pair was not split. It stays on `feat/tips-period`.
- Task 1.4 pair: 364 lines (229 implementation + 135 test). Additions only. Under 400. No overage. The pair was not split. `domain/index.ts` is +40 and is counted separately.
- Task 2.1 pair: 453 lines (146 implementation + 297 test + 9 entry-port + 1 package.json). Additions only. 53 lines over the 400-line budget. `size:exception` was not granted. The pair was not split.
- Task 4.1 pair: 970 lines (400 settle-tips.ts + 506 test + 24 tip-pool.ts + 15 tip-participant-source.ts + 24 entry-port + 1 package.json). Additions only. 570 lines over the 400-line budget. `size:exception` was not granted. The pair was not split. The uncommitted configure-tip-rule lines in `entry-port.ts` and `package.json` stay in the task 2.1 count and are not included here.
- Task 4.2 pair: 700 lines (283 adjust-tip-settlement.ts + 414 test + 2 entry-port + 1 package.json). Additions only. 300 lines over the 400-line budget. `size:exception` was not granted. The pair was not split. The earlier settle-tips and configure-tip-rule lines in `entry-port.ts` and `package.json` stay in the task 4.1 and 2.1 counts and are not included here.
- Task 5.2 pair: 457 changed lines (456 additions + 1 deletion): 156 `print-tip-settlement.ts` + 261 test + 33 `printer.ts` (32 additions + 1 deletion) + 6 entry-port + 1 package.json. 57 lines over the 400-line budget. `size:exception` was not granted. The pair was not split. Earlier settle, configure, and adjust lines in `entry-port.ts` and `package.json` stay in the task 4.2, 4.1, and 2.1 counts and are not included here.

## Status

11/15 tasks complete. Ready for the next apply batch. Not ready for verify.

### Unit 6.1 — Tip ledger (task 6.1)

Postgres and `ChargeCheck` only. `0015_tips.sql` adds `tip_rules`, append-only `tip_settlements`, and `payments.recorded_at`. Existing payment rows backfill to `1970-01-01T00:00:00.000Z`. Role `cash_register_app`. Tax rows are unchanged. A reload keeps the per-method pool and the reason on each participant add or removal. `ChargeCheck` writes `recordedAt` from the injected clock. RED exit 1: 4 failed, 29 passed (`0015_tips.sql` missing, `recordedAt` undefined). GREEN exit 0: 2 files, 33 passed. `tsc -p contexts/cash-register` exit 0 after this slice.

Pair size: 749 additions and 12 deletions (761 changed lines), including 100 new SQL lines. 361 lines over the 400-line budget. `size:exception` was not granted. The pair was not split.

`api-cloud` still constructs `ChargeCheck` without that clock. Until the composition passes it, a missing clock uses `Date.now()`. The HTTP slices must pass the platform clock.

### Unit 6 — Tip settlement template (task 5.1)

Printing only. `tips_settlement` renders payment methods, the rule, the residue, each share, and a signature line at 80 mm and 58 mm. `kickDrawer` is false. The printing entry port exports `DispatchPrintJobs`. RED exit 1: the text did not contain `Payment methods` (1 failed, 5 passed). GREEN exit 0: 6 passed. Same command after Biome: exit 0, 6 passed.

Pair size: 80 additions and 3 deletions (83 changed lines). Under the 400-line budget. `size:exception` was not granted. The pair was not split. No cash-register use case and no `@blackhole/printing` import from cash-register.

### Unit 3 — Tip participants (task 3.1)

Attendance only. `ListTipParticipants` returns `userId` and `workedMinutes` for clock events in `[from, to)`. Minutes come from `projectHours` through the same policy inputs as `export-hours` `hoursOf`. RED exit 1: missing `#application/list-tip-participants/list-tip-participants.js`. GREEN exit 0: 1 file, 5 passed. Same command after Biome: exit 0, 5 passed.

Pair size: 440 lines (174 implementation, 258 test, 6 entry-port, 2 package.json). Additions only. 40 lines over the 400-line budget. `size:exception` was not granted. The pair was not split.

`hoursOf` is private in export-hours, so the policy branch is repeated here. `projectHours` stays the only hours calculator. A flagged mark or an open clock stays on the list at 0 minutes. An empty period returns `[]`. No attendance permission check: the port answers the query, as `HasOpenClockIn` does.

### Unit 4 — Distribute tips (task 1.3)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm exec vitest run --project cash-register contexts/cash-register/domain/distribute-tips.test.ts`. RED exit 1: 1 failed file, no tests. GREEN exit 0: 1 file, 6 passed. Same command after `pnpm exec biome check --write` reported no fixes: exit 0, 1 file, 6 passed. |
| Runtime harness | N/A. Domain only. No runtime boundary. |
| Rollback boundary | Delete `contexts/cash-register/domain/distribute-tips.ts` and `contexts/cash-register/domain/distribute-tips.test.ts`. Uncheck task 1.3. Remove this Unit 4 section. Leave tasks 1.1, 1.2, and 3.1 and their files in place. |
| Pair size | 386 lines (207 implementation + 179 test). Additions only. Under the 400-line budget. The pair was not split. No overage. |

#### RED

Command: `pnpm exec vitest run --project cash-register contexts/cash-register/domain/distribute-tips.test.ts`

Result: exit 1. Test Files 1 failed. Tests: no tests.

Failure before production code existed:

- `Cannot find module '#domain/distribute-tips.js'` imported from `contexts/cash-register/domain/distribute-tips.test.ts`.

#### GREEN

Same command. Exit 0. Test Files 1 passed. Tests 6 passed (6).

`pnpm exec biome check --write` on the pair reported no fixes. Same command again. Exit 0. Test Files 1 passed. Tests 6 passed (6).

### Behavior

- `distributeTips` is a pure function. The same input returns the same shares.
- An equal pool of 100,000 across three people floors to 33,333 each. The one extra peso is stored on the share of the first `userId` in `localeCompare` order, not the input order. There is no tax input. Every amount is an integer peso. The returned residue is 0, and bases plus per-share residue plus that residue equal 100,000.
- A percentage of 60 and 40 on a pool of 101 floors to 60 and 40. The extra peso goes to the earlier `userId`.
- A zero-minute hours row stays at base 0 and residue 0, even when that `userId` sorts first. The extra peso goes to the next person who has minutes.
- A removed employee's percent is not rescaled onto the others. On a pool of 10,000, 60 stays 6,000 and the removed 40 stays in `residueCop` as 4,000. The removed user is absent from the shares.
- A zero pool returns `{ shares: [], residueCop: 0 }` for equal, hours, and percentage, even when participants exist.
- A non-integer pool throws `InvalidTipDistribution`.
- Not exported from `domain/index.ts`. Task 1.4 owns that export.

### Unit 5 — Tip settlement (task 1.4)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm exec vitest run --project cash-register contexts/cash-register/domain/tip-settlement.test.ts`. RED exit 1: 1 failed file, no tests. GREEN exit 0: 1 file, 4 passed. Same command after `pnpm exec biome check --write` fixed 3 files: exit 0, 1 file, 4 passed. |
| Runtime harness | N/A. Domain only. No runtime boundary. |
| Rollback boundary | Delete `contexts/cash-register/domain/tip-settlement.ts` and `contexts/cash-register/domain/tip-settlement.test.ts`. Remove the tip exports added to `contexts/cash-register/domain/index.ts`. Uncheck task 1.4. Remove this Unit 5 section. Leave tasks 1.1, 1.2, 1.3, and 3.1 and their files in place. |
| Pair size | 364 lines (229 implementation + 135 test). Additions only. Under the 400-line budget. The pair was not split. No overage. `domain/index.ts` diff is +40 and is not included in the pair. |

#### RED

Command: `pnpm exec vitest run --project cash-register contexts/cash-register/domain/tip-settlement.test.ts`

Result: exit 1. Test Files 1 failed. Tests: no tests.

Failure before production code existed:

- `Cannot find module '#domain/tip-settlement.js'` imported from `contexts/cash-register/domain/tip-settlement.test.ts`.

#### GREEN

Same command. Exit 0. Test Files 1 passed. Tests 4 passed (4).

`pnpm exec biome check --write` on the pair and `domain/index.ts` fixed 3 files. Same command again. Exit 0. Test Files 1 passed. Tests 4 passed (4).

### Behavior

- `TipSettlements.close` stores a copy of the pool, participants, shares, and rule. Changing the caller's share or percentage afterward leaves the closed row on the original snapshot. `adjustsSettlementId` on that row is null.
- `TipSettlements.adjust` appends a new row. It sets `adjustsSettlementId` to the closed row and copies that row's rule snapshot. A later rule passed on the adjustment is not stored. The closed row's shares stay as first recorded.
- Closing the same `settlement_` id again returns the first row and does not append. `settlement(id)` also returns that first row.
- `editShare` throws `TipShareEditRejected` and does not change the stored share.
- `domain/index.ts` exports the tip period, rule, distribution, and settlement beside the existing cash-count, cash-shift, account-split, and payment exports. Those existing export blocks were not rewritten.

### Unit 7 — Configure tip rule (task 2.1)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm exec vitest run --project cash-register contexts/cash-register/application/configure-tip-rule/configure-tip-rule.test.ts`. RED exit 1: 1 failed file, no tests. GREEN exit 0: 1 file, 9 passed. Same command after `pnpm exec biome check --write` fixed 3 files: exit 0, 1 file, 9 passed. |
| Runtime harness | N/A. No HTTP, Postgres, or printer boundary in this slice. The store, permission, and audit are in-memory doubles. Postgres is task 6.1 and HTTP is task 7.1. |
| Rollback boundary | Delete `contexts/cash-register/application/configure-tip-rule/configure-tip-rule.ts` and `configure-tip-rule.test.ts`. Remove the configure-tip-rule exports from `contexts/cash-register/application/entry-port.ts`. Remove the `#application/configure-tip-rule/*` import from `contexts/cash-register/package.json`. Uncheck task 2.1. Remove this Unit 7 section. Leave tasks 1.1, 1.2, 1.3, 1.4, 3.1, and 5.1 and their files in place. |
| Pair size | 453 lines (146 implementation + 297 test + 9 entry-port + 1 package.json). Additions only. 53 lines over the 400-line budget. `size:exception` was not granted. The pair was not split. |

#### RED

Command: `pnpm exec vitest run --project cash-register contexts/cash-register/application/configure-tip-rule/configure-tip-rule.test.ts`

Result: exit 1. Test Files 1 failed. Tests: no tests.

Failure before production code existed:

- `Cannot find module '#application/configure-tip-rule/configure-tip-rule.js'` imported from `contexts/cash-register/application/configure-tip-rule/configure-tip-rule.test.ts`.

The `#application/configure-tip-rule/*` import key was added before that import. Each `*` is one path segment.

#### GREEN

Same command. Exit 0. Test Files 1 passed. Tests 9 passed (9).

`pnpm exec biome check --write` on the pair, `entry-port.ts`, and `package.json` fixed 3 files. Same command again. Exit 0. Test Files 1 passed. Tests 9 passed (9).

### Behavior

- `ConfigureTipRule` calls `EvaluatePermission` from `@blackhole/platform/application/entry-port` before any read, write, or audit. The permission is `cash.settle-tips`. The target is the venue. `value` is null. There is no limit, so shift totals stay at zero and no authorization grant is consumed.
- A denied caller returns null. The store stays empty and `RecordAuditEvent` is not called, including when the payload contains a role key. Any decision other than `allowed` follows that same path.
- An allowed percentage of 70 and 30 is stored per `employeeId` as integers. A later save of 100 for one employee keeps the first snapshot in `before` and does not mutate it. The returned rule is a copy of the stored row.
- 60 and 30, and a non-integer percent, throw `InvalidTipPercentage` after the permission check. Nothing is stored or audited.
- A `role` key throws `InvalidTipRoleShare`. Nothing is stored or audited.
- `equal` and `hours` store no percentage rows. `by_hours` is rejected. A period other than `shift`, `day`, or `week` throws `InvalidTipRulePeriod` before the write.
- The only audit action is `tips.rule-changed`. The entity is the venue. `authorizerId` is copied from the command.
- The entry port exports `ConfigureTipRule`, `TipRuleStore`, and `InvalidTipRulePeriod`. Domain tip files were not edited.

### Unit 8 — Settle tips (task 4.1)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm exec vitest run --project cash-register contexts/cash-register/application/settle-tips/settle-tips.test.ts`. RED exit 1: 1 failed file, no tests. GREEN exit 0: 1 file, 9 passed. Same command after `pnpm exec biome check --write` fixed 4 files: exit 0, 1 file, 9 passed. `pnpm exec tsc -b contexts/cash-register --pretty false` exit 0. |
| Runtime harness | N/A. No HTTP, Postgres, or printer boundary in this slice. The pool, participants, settlement store, permission, and audit are in-memory doubles. Postgres is task 6.1 and HTTP is task 7.2. |
| Rollback boundary | Delete `contexts/cash-register/application/settle-tips/`, `contexts/cash-register/application/ports/tip-pool.ts`, and `contexts/cash-register/application/ports/tip-participant-source.ts`. Remove the settle-tips and tip-port exports from `contexts/cash-register/application/entry-port.ts`. Remove the `#application/settle-tips/*` import from `contexts/cash-register/package.json`. Leave the configure-tip-rule export and import in place. Uncheck task 4.1. Remove this Unit 8 section. Leave tasks 1.1, 1.2, 1.3, 1.4, 2.1, 3.1, and 5.1 and their files in place. |
| Pair size | 970 lines (400 settle-tips.ts + 506 test + 24 tip-pool.ts + 15 tip-participant-source.ts + 24 entry-port + 1 package.json). Additions only. 570 lines over the 400-line budget. `size:exception` was not granted. The pair was not split. |

#### RED

Command: `pnpm exec vitest run --project cash-register contexts/cash-register/application/settle-tips/settle-tips.test.ts`

Result: exit 1. Test Files 1 failed. Tests: no tests.

Failure before production code existed:

- `Cannot find module '#application/settle-tips/settle-tips.js'` imported from `contexts/cash-register/application/settle-tips/settle-tips.test.ts`.

The `#application/settle-tips/*` import key was added before that import. Each `*` is one path segment. `#application/ports/*` already covered `tip-pool.ts` and `tip-participant-source.ts`, so no new ports key was added.

#### GREEN

Same command. Exit 0. Test Files 1 passed. Tests 9 passed (9).

`pnpm exec biome check --write` on the pair, `entry-port.ts`, and `package.json` fixed 4 files. Same command again. Exit 0. Test Files 1 passed. Tests 9 passed (9).

### Behavior

- `SettleTips` calls `EvaluatePermission` before any read, write, or audit. The permission is `cash.settle-tips`. The target is the venue. `value` is null. Shift totals stay at zero. A denied caller returns null, including when a removal has no reason. The pool, the participant source, the settlement store, and `RecordAuditEvent` are not called.
- An add or a removal with a blank reason throws `ParticipantChangeReasonRequired` after the permission check and before any read. Nothing is stored or audited.
- The active rule comes from `TipRuleStore`. A missing rule throws `MissingTipRule` after that read and before the pool. Nothing is stored or audited.
- The window comes from `TipPeriod`: `day` and `week` use `at` in America/Bogota, and `shift` keeps the caller `from`/`to`. The pool port is asked for that window, then `TipPeriod.contains` keeps `PaymentTip.amountCop` whose `recordedAt` falls inside it, grouped by method. 20,000 cash plus 30,000 card is a 50,000 pool. `saleCop` and `taxCop` are not added. A tip at the exclusive end of the day stays out.
- Participants come from `TipParticipantSource`. Cash-register does not import `@blackhole/attendance`. An added participant with a reason is included and the reason is stored on the closed row. A removed employee is excluded. On a 10,000 pool, a 60/40 rule leaves 6,000 for the remaining employee and 4,000 in `residueCop`. The rule snapshot still has both percents.
- An empty pool closes with `poolCop` 0, no method lines, and no shares. The close is still stored and audited.
- The same `settlement_` id is replayed through `TipSettlements` and the first row is returned. A later tip in the pool does not change it. There is no second append and no second audit.
- The only audit action is `tips.settlement-closed`. `authorizerId` is copied from the command. Amounts are integer pesos from `distributeTips`.
- Domain tip files were not edited. Reasons and method totals live on the application row because `TipSettlement` stores `poolCop` and has no reason field.

### Unit 9 — Adjust tip settlement (task 4.2)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm exec vitest run --project cash-register contexts/cash-register/application/adjust-tip-settlement/adjust-tip-settlement.test.ts`. RED exit 1: 1 failed file, no tests. GREEN exit 0: 1 file, 7 passed. Same command after `pnpm exec biome check --write` fixed 2 files: exit 0, 1 file, 7 passed. |
| Runtime harness | N/A. No HTTP, Postgres, or printer boundary in this slice. The settlement store, rule store, permission, and audit are in-memory doubles. Postgres is task 6.1 and HTTP is task 7.2. |
| Rollback boundary | Delete `contexts/cash-register/application/adjust-tip-settlement/`. Remove the adjust-tip-settlement exports from `contexts/cash-register/application/entry-port.ts`. Remove the `#application/adjust-tip-settlement/*` import from `contexts/cash-register/package.json`. Leave the settle-tips and configure-tip-rule exports and imports in place. Uncheck task 4.2. Remove this Unit 9 section. Leave tasks 1.1, 1.2, 1.3, 1.4, 2.1, 3.1, 4.1, and 5.1 and their files in place. |
| Pair size | 700 lines (283 adjust-tip-settlement.ts + 414 test + 2 entry-port + 1 package.json). Additions only. 300 lines over the 400-line budget. `size:exception` was not granted. The pair was not split. |

#### RED

Command: `pnpm exec vitest run --project cash-register contexts/cash-register/application/adjust-tip-settlement/adjust-tip-settlement.test.ts`

Result: exit 1. Test Files 1 failed. Tests: no tests.

Failure before production code existed:

- `Cannot find module '#application/adjust-tip-settlement/adjust-tip-settlement.js'` imported from `contexts/cash-register/application/adjust-tip-settlement/adjust-tip-settlement.test.ts`.

The `#application/adjust-tip-settlement/*` import key was added before the entry-port import. Each `*` is one path segment.

#### GREEN

Same command. Exit 0. Test Files 1 passed. Tests 7 passed (7).

`pnpm exec biome check --write` on the pair, `entry-port.ts`, and `package.json` fixed 2 files. Same command again. Exit 0. Test Files 1 passed. Tests 7 passed (7).

### Behavior

- `AdjustTipSettlement` calls `EvaluatePermission` before any read, write, or audit. The permission is `cash.settle-tips`. The target is the venue. `value` is null. Shift totals stay at zero. A denied caller returns null, including when a removal has no reason. The settlement store, the rule store, and `RecordAuditEvent` are not called.
- An add or a removal with a blank reason throws `ParticipantChangeReasonRequired` after the permission check and before any read. The closed row stays in place. Nothing new is stored or audited.
- A missing closed settlement throws `MissingTipSettlement` after the list and before the rule read. Nothing is stored or audited.
- The correction keeps the closed pool and redistributes it with `distributeTips` using the closed rule snapshot. A later venue rule is read and passed into `TipSettlements.adjust`, which stores the original snapshot instead. Adding a zero-minute participant under a later `hours` rule still splits an equal snapshot into equal shares. Removing an employee from a percentage snapshot leaves that percent in `residueCop`.
- The adjustment is a new row. `adjustsSettlementId` points at the closed row. The closed row object is not replaced and its shares, participants, and rule stay as first recorded.
- The same adjustment id is replayed through `TipSettlements` and the first row is returned. A later venue rule does not change it. There is no second append and no second audit.
- The only audit action is `tips.settlement-adjusted`. `before` is the closed row and `after` is the new row. `authorizerId` is copied from the command.
- Domain tip files and `settle-tips.ts` were not edited. The use case calls `TipSettlementStore`, `TipSettlements.adjust`, and `ParticipantChangeReasonRequired`.

### Unit 10 — Print tip settlement (task 5.2)

| Evidence | Required value |
| --- | --- |
| Focused test command and exact result | `pnpm exec vitest run --project cash-register contexts/cash-register/application/print-tip-settlement/print-tip-settlement.test.ts`. RED exit 1: 1 failed file, no tests. GREEN exit 0: 1 file, 6 passed. Same command after `pnpm exec biome check --write` fixed 4 files: exit 0, 1 file, 6 passed. |
| Runtime harness | N/A. No HTTP or Postgres boundary in this slice. The settlement store, permission, and printer are in-memory doubles. HTTP print is task 7.3. The cash-register use case does not call `DispatchPrintJobs`. |
| Rollback boundary | Delete `contexts/cash-register/application/print-tip-settlement/`. Remove the `TipsSettlementJob` members from `contexts/cash-register/application/ports/printer.ts`. Remove the print-tip-settlement exports and `TipsSettlementJob` from `contexts/cash-register/application/entry-port.ts`. Remove the `#application/print-tip-settlement/*` import from `contexts/cash-register/package.json`. Leave the settle, configure, and adjust exports and imports in place. Uncheck task 5.2. Remove this Unit 10 section. Leave tasks 1.1, 1.2, 1.3, 1.4, 2.1, 3.1, 4.1, 4.2, 5.1, and 6.1 and their files in place. |
| Pair size | 457 changed lines (456 additions + 1 deletion): 156 `print-tip-settlement.ts` + 261 test + 33 `printer.ts` (32 additions + 1 deletion) + 6 entry-port + 1 package.json. 57 lines over the 400-line budget. `size:exception` was not granted. The pair was not split. |

#### RED

Command: `pnpm exec vitest run --project cash-register contexts/cash-register/application/print-tip-settlement/print-tip-settlement.test.ts`

Result: exit 1. Test Files 1 failed. Tests: no tests.

Failure before production code existed:

- `Cannot find module '#application/print-tip-settlement/print-tip-settlement.js'` imported from `contexts/cash-register/application/print-tip-settlement/print-tip-settlement.test.ts`.

The `#application/print-tip-settlement/*` import key was added before that import. Each `*` is one path segment.

#### GREEN

Same command. Exit 0. Test Files 1 passed. Tests 6 passed (6).

`pnpm exec biome check --write` on the pair, `entry-port.ts`, `printer.ts`, and `package.json` fixed 4 files. Same command again. Exit 0. Test Files 1 passed. Tests 6 passed (6).

### Behavior

- `PrintTipSettlement` calls `EvaluatePermission` before any read or enqueue. The permission is `cash.settle-tips`. The target is the venue. `value` is null. Shift totals stay at zero. A denied caller returns null. The settlement store and the printer are not called.
- A missing closed settlement throws `MissingTipSettlement` after the list and before enqueue. Nothing is enqueued.
- An allowed print enqueues one `tips_settlement` job with `kickDrawer: false`. The job carries the period, method totals, rule label, residue, each share as `baseCop + residueCop`, and the pool. The stored row is not replaced.
- A receipt printed on a different printer is `backup` and warns `Printed on the backup printer.` The enqueued job still targets the requested printer and keeps `kickDrawer: false`.
- A waiting receipt is `queued` and warns `The print job stayed queued.` A failed receipt is `failed` and warns `The print job failed.` Both jobs stay enqueued with `kickDrawer: false`.
- There is no audit event. The use case does not import `@blackhole/printing`. It uses the cash-register `Printer` port. `domain` tip files, `settle-tips.ts`, and `adjust-tip-settlement.ts` were not edited.
