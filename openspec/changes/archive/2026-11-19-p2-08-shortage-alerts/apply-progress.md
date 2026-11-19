# Apply progress: p2-08-shortage-alerts

Change: `p2-08-shortage-alerts`
Work units recorded: 4 of 7 complete. Units 3 and 4 are complete (3.1–3.6, 4.1–4.4).
Mode: Standard (`strict_tdd: false`). RED then GREEN still ran, as required by ADR-017 and `rules.apply`. `strict-tdd.md` was not loaded.
Committed: no
Pushed: no

Tasks 1.1 through 4.4 are complete. Persistence, HTTP, and screens were not started. Ready for the next apply batch (5.1). Verify was not run. `state.yaml` stays `applying` / `apply: partial`.

## Completed tasks

- [x] 1.1 RED `contexts/inventory/domain/shortage-alert.test.ts`. Bad levels rejected. One critical. No flap. Round up. No Nest.
- [x] 1.2 GREEN `contexts/inventory/domain/shortage-alert.ts` and `domain/index.ts`. Sold out is at or under 0. `critical` uses the red clock.
- [x] 2.1 RED `contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts`. Site override. Reorder below minimum rejected. `inventory.configure-levels` only.
- [x] 2.2 GREEN `contexts/inventory/application/set-stock-levels/` and `application/ports/shortage-repository.ts`. This slice stores levels. It does not emit alerts.
- [x] 2.3 RED `contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts`. Yellow. One critical. No repeat. Flag off. `NegativeStockOpened` stays.
- [x] 2.4 GREEN `contexts/inventory/application/evaluate-stock-levels/`. Same transaction as the level read.
- [x] 2.5 RED mark seen and resolve tests. Who and when. Reason. Resolve only above reorder. `shortage-audit.ts` calls `RecordAuditEvent`.
- [x] 2.6 GREEN both use cases. No platform import in the use cases. Exported from `application/entry-port.ts`.
- [x] 3.1 RED coverage hours. History under N skips. Missing N, margin, slot, or service window skips. No numeric default.
- [x] 3.2 GREEN `evaluate-coverage/` and `ports/consumption-history.ts`.
- [x] 3.3 RED dish alert. Name every limiter. No minimum skips. Port `producible-units.ts`.
- [x] 3.4 GREEN `evaluate-dish-alert/`. p2-07 files untouched.
- [x] 3.5 RED escalation. Red clock only. Critical shares it. Yellow and coverage do not.
- [x] 3.6 GREEN `escalate-alerts/`. One `RoleNotice` per role. No WhatsApp, SMS, email, or Web Push.
- [x] 4.1 RED restock. 16 kg. One link is the destination. Several links need the actor warehouse id. Zero links offer a purchase order. Actor `supplierId`. No preferred supplier.
- [x] 4.2 GREEN `restock-from-alert/` via `ports/transfer-request.ts` or `CreatePurchaseOrder`. Document id stored. Existing cases unchanged.
- [x] 4.3 RED propose and accept. Pending stays ignored. Accept activates.
- [x] 4.4 GREEN both. Appended on `entry-port.ts`. New import keys in `contexts/inventory/package.json`.

## Unit 1 RED / GREEN evidence

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/domain/shortage-alert.test.ts
```

RED (before `shortage-alert.ts` existed):

- Exit code: 1
- `FAIL contexts/inventory/domain/shortage-alert.test.ts`
- `Error: Cannot find module '#domain/shortage-alert.js'`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 220ms

GREEN (after `shortage-alert.ts`, the `domain/index.ts` exports, and Biome on the new files):

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 24 passed (24)
- Duration: 235ms

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/shortage-alert.test.ts`. RED exit 1 (`Cannot find module '#domain/shortage-alert.js'`, 1 failed file, no tests). GREEN exit 0 (1 file, 24 passed). |
| Runtime harness command/scenario and exact result | N/A. This unit is a pure domain rule with no HTTP, database, or process boundary. |
| Rollback boundary | Delete `contexts/inventory/domain/shortage-alert.test.ts` and `contexts/inventory/domain/shortage-alert.ts`. Remove the `shortage-alert.js` export lines from `contexts/inventory/domain/index.ts`. Revert tasks 1.1 and 1.2, `state.yaml` apply/status, and this file. |

## Domain behavior covered

- Reorder below minimum, maximum below reorder, a negative minimum, and a fractional scaled quantity throw `InvalidStockLevels`. Ordered whole levels, including equal maximum, reorder, and minimum, are kept.
- Yellow is at or under the reorder point. Red is at or under the minimum. Critical and sold out are at or under 0. Stock above the reorder point opens nothing.
- A jump to at or under 0 opens one critical alert. A deeper cross raises the open alert to one critical. The result has no movement, supplier, or channel.
- The same severity does not emit again. An open red alert stays open just above the minimum. An open alert resolves only above the reorder point.
- Restock quantity is maximum minus stock, rounded up to the purchase unit. 4 kg against a 20 kg maximum and a 1 kg unit is 16 kg. A 15 kg shortfall on a 2 kg unit is 16 kg.
- `ESCALATION_CLOCK` has only `red`. Critical and red both use it. Yellow, coverage, and dish do not.

## Workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: PR 1 on tracker, tasks 1.1–1.2
- Boundary: inventory domain shortage alert only
- Estimated review budget impact: this slice stays inside the domain files. The change-wide forecast stays High; later units stay on their own PRs.

## Deviations from Design

None. Implementation matches the domain rules. There is no second escalation clock, no preferred supplier, and no stock movement on this type.

## Issues Found

None.

## Remaining tasks

- [x] 2.1–2.6 Levels
- [ ] 3.1–3.6 Coverage, dish, escalation
- [ ] 4.1–4.4 One tap and suggested levels
- [ ] 5.1–5.5 Persistence
- [ ] 6.1–6.4 HTTP
- [ ] 7.1–7.2 Screens

8/29 tasks complete. Next batch is 3.1.

## Unit 2 RED

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts
```

RED (test written, `set-stock-levels.ts` and `shortage-repository.ts` not created yet):

- Exit code: 1
- `FAIL contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts`
- `Error: Missing "#application/set-stock-levels/set-stock-levels.js" specifier in "@blackhole/inventory" package`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 269ms

GREEN (after `set-stock-levels.ts`, `shortage-repository.ts`, the `#application/set-stock-levels/*` import, and Biome on the new files):

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 3 passed (3)
- Duration: 337ms

## Unit 2 behavior covered

- A brand reorder point of 10 kg stays on the brand template. Site A stores 15 kg. Site B has no override and still resolves 10 kg.
- A reorder point of 5 kg under a minimum of 8 kg throws `InvalidStockLevels`. Nothing is stored for the site. The brand template stays.
- A session that is not allowed `inventory.configure-levels` throws `StockLevelsDenied`. Nothing is stored.
- The use case asks only for `inventory.configure-levels` on the site. It stores maximum, reorder point, and minimum. It does not emit an alert, move stock, or record a supplier or channel.
- Yellow, red, critical, and sold out stay domain rules. This slice does not call `evaluateLevel`.

## Work Unit Evidence (tasks 2.1–2.2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts`. RED exit 1 (`Missing "#application/set-stock-levels/set-stock-levels.js" specifier in "@blackhole/inventory" package`, 1 failed file, no tests). GREEN exit 0 (1 file, 3 passed). |
| Runtime harness command/scenario and exact result | N/A. The use case talks to an in-memory port double. There is no HTTP, database, or process boundary. |
| Rollback boundary | Delete `contexts/inventory/application/set-stock-levels/` and `contexts/inventory/application/ports/shortage-repository.ts`. Remove the `#application/set-stock-levels/*` line from `contexts/inventory/package.json`. Revert tasks 2.1 and 2.2 and the unit 2 sections of this file. |

## Workload / PR boundary (tasks 2.1–2.2)

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: levels slice, tasks 2.1–2.2 only. Evaluate, mark seen, and resolve stay on a later batch.
- Boundary: set stock levels and the shortage repository port
- Estimated review budget impact: this slice is the use case, its test, and the port. The change-wide forecast stays High.

## Deviations from Design (tasks 2.1–2.2)

The site override is stored by `venueId`. The spec scenario and the assigned rule store it for that site. The design also says a location overrides the brand; this slice does not add a separate location id.

`contexts/inventory/package.json` gained `#application/set-stock-levels/*`. The new folder cannot be imported without that map entry. No other package field changed.

## Issues Found (tasks 2.1–2.2)

None.

## Unit 2 RED (tasks 2.3)

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts
```

RED (test written, `evaluate-stock-levels.ts` not created yet, package import not added yet):

- Exit code: 1
- `FAIL contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts`
- `Error: Missing "#application/evaluate-stock-levels/evaluate-stock-levels.js" specifier in "@blackhole/inventory" package`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 298ms

## Unit 2 RED (tasks 2.5)

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/mark-alert-seen contexts/inventory/application/resolve-alert
```

RED (tests written, use cases and `PlatformShortageAudit` not created yet, package imports not added yet):

- Exit code: 1
- `FAIL contexts/inventory/application/mark-alert-seen/mark-alert-seen.test.ts`
- `Error: Missing "#application/mark-alert-seen/mark-alert-seen.js" specifier in "@blackhole/inventory" package`
- `FAIL contexts/inventory/application/resolve-alert/resolve-alert.test.ts`
- `Error: Missing "#application/resolve-alert/resolve-alert.js" specifier in "@blackhole/inventory" package`
- Test Files: 2 failed (2)
- Tests: no tests
- Duration: 250ms

## Unit 2 GREEN (tasks 2.4 and 2.6)

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts contexts/inventory/application/mark-alert-seen contexts/inventory/application/resolve-alert
```

GREEN (after the three use cases, the repository location override, `PlatformShortageAudit`, the package imports, and the entry-port exports):

- Exit code: 0
- Test Files: 4 passed (4)
- Tests: 16 passed (16)
- Duration: 400ms

The three existing site-override tests are included in that 16 and still pass.

## Unit 2 behavior covered (tasks 2.3–2.6)

- Yellow opens at or under the reorder point. Red stays the open severity just above the minimum, and that same state is not written again. A jump to at or under 0 opens one critical alert. Raising an open yellow alert to zero keeps one row and uses the red clock. There is no second clock.
- The venue flag off writes no alert and no audit. `NegativeStockOpened` is not folded into the level alert. The result has no supplier, channel, or stock movement.
- A location reorder point beats the brand and the venue override. A location without its own row still uses the venue override. A site without either uses the brand template.
- Balance read, level read, and alert write share the caller transaction. Rolling that transaction back leaves the alert unstored.
- Mark seen stores who and when. Resolve requires a reason and a balance above the effective reorder point. At or under that point, nothing resolves.
- `PlatformShortageAudit.record` calls `RecordAuditEvent.execute`. Evaluate, mark seen, and resolve do not import the platform package.

## Work Unit Evidence (tasks 2.3–2.6)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts contexts/inventory/application/mark-alert-seen contexts/inventory/application/resolve-alert`. RED evaluate exit 1 (`Missing "#application/evaluate-stock-levels/evaluate-stock-levels.js" specifier`, 1 failed file, no tests, 298ms). RED mark/resolve exit 1 (missing `mark-alert-seen` and `resolve-alert` specifiers, 2 failed files, no tests, 250ms). GREEN exit 0 (4 files, 16 passed, 400ms). |
| Runtime harness command/scenario and exact result | N/A. The use cases talk to in-memory port doubles. There is no HTTP, database, or process boundary. |
| Rollback boundary | Delete `contexts/inventory/application/evaluate-stock-levels/`, `mark-alert-seen/`, `resolve-alert/`, and `application/ports/shortage-audit.ts`. Revert the location and alert members added to `application/ports/shortage-repository.ts`. Remove the three new `#application/...` import keys and the three use-case exports. Revert tasks 2.3–2.6 and the unit 2 sections of this file. Leave tasks 1.1, 1.2, 2.1, and 2.2 in place. |

## Workload / PR boundary (tasks 2.3–2.6)

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: levels slice, tasks 2.3–2.6. Coverage, dish, one tap, persistence, HTTP, and screens stay on later batches.
- Boundary: evaluate stock levels, mark seen, resolve, and the shortage audit port
- Estimated review budget impact: this slice is the three use cases, their tests, the audit port, and the repository extension. The change-wide forecast stays High.

## Deviations from Design (tasks 2.3–2.6)

`effectiveLevels` checks a location row, then the venue row, then the brand template. The venue override from tasks 2.1–2.2 stays. The base repository does not persist a location row until an adapter overrides `saveLocationLevel`; `findLocationLevel` returns null. The in-memory adapter remains phase 5.

Evaluate stores and audits the level alert. Role notices stay with the later notice and HTTP units. `NegativeStockOpened` is unchanged.

`contexts/inventory/package.json` gained `#application/evaluate-stock-levels/*`, `#application/mark-alert-seen/*`, and `#application/resolve-alert/*`. `application/entry-port.ts` exports the three use cases. No existing key or export was removed.

## Issues Found (tasks 2.3–2.6)

None in this slice.

## Unit 3 RED / GREEN evidence (tasks 3.1–3.6)

Coverage command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/evaluate-coverage/evaluate-coverage.test.ts
```

RED (before the import key):

- Exit code: 1
- Missing `"#application/evaluate-coverage/evaluate-coverage.js"` specifier in `@blackhole/inventory`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 304ms
- Start: 18:17:42

GREEN:

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 6 passed (6)
- Duration: 251ms
- Start: 18:19:47

Dish command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/evaluate-dish-alert/evaluate-dish-alert.test.ts
```

RED:

- Exit code: 1
- Missing `"#application/evaluate-dish-alert/evaluate-dish-alert.js"` specifier
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 301ms
- Start: 18:20:55

GREEN:

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 5 passed (5)
- Duration: 253ms
- Start: 18:21:31

Escalation command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/escalate-alerts/escalate-alerts.test.ts
```

RED:

- Exit code: 1
- Missing `"#application/escalate-alerts/escalate-alerts.js"` specifier
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 450ms
- Start: 18:23:01

GREEN:

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 6 passed (6)
- Duration: 226ms
- Start: 18:24:00

## Unit 4 RED / GREEN evidence (tasks 4.1–4.4)

Restock command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/restock-from-alert/restock-from-alert.test.ts
```

RED:

- Exit code: 1
- Missing `"#application/restock-from-alert/restock-from-alert.js"` specifier
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 239ms
- Start: 18:25:54

GREEN:

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 7 passed (7)
- Duration: 383ms
- Start: 18:26:48

Propose and accept command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/propose-stock-levels/propose-stock-levels.test.ts contexts/inventory/application/accept-stock-levels/accept-stock-levels.test.ts
```

RED:

- Exit code: 1
- Missing `"#application/propose-stock-levels/propose-stock-levels.js"` and `"#application/accept-stock-levels/accept-stock-levels.js"` specifiers
- Test Files: 2 failed (2)
- Tests: no tests
- Duration: 259ms
- Start: 18:28:37

GREEN:

- Exit code: 0
- Test Files: 2 passed (2)
- Tests: 3 passed (3)
- Duration: 322ms
- Start: 18:29:28

Regression command (new tests plus the level, transfer, and purchase cases):

```text
pnpm exec vitest run --project inventory contexts/inventory/application/evaluate-coverage contexts/inventory/application/evaluate-dish-alert contexts/inventory/application/escalate-alerts contexts/inventory/application/restock-from-alert contexts/inventory/application/propose-stock-levels contexts/inventory/application/accept-stock-levels contexts/inventory/application/set-stock-levels contexts/inventory/application/evaluate-stock-levels contexts/inventory/application/mark-alert-seen contexts/inventory/application/resolve-alert contexts/inventory/domain/shortage-alert.test.ts contexts/inventory/application/request-transfer contexts/inventory/application/create-purchase-order
```

- Exit code: 0
- Test Files: 13 passed (13)
- Tests: 70 passed (70)
- Duration: 778ms
- Start: 18:30:36

Final new-only command, after the entry-port append:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/evaluate-coverage/evaluate-coverage.test.ts contexts/inventory/application/evaluate-dish-alert/evaluate-dish-alert.test.ts contexts/inventory/application/escalate-alerts/escalate-alerts.test.ts contexts/inventory/application/restock-from-alert/restock-from-alert.test.ts contexts/inventory/application/propose-stock-levels/propose-stock-levels.test.ts contexts/inventory/application/accept-stock-levels/accept-stock-levels.test.ts
```

- Exit code: 0
- Test Files: 6 passed (6)
- Tests: 27 passed (27)
- Duration: 365ms
- Start: 18:35:49

## Unit 3 and 4 behavior covered

- Coverage uses Friday hours. History with fewer distinct weeks than N skips before the balance is read. A missing week count, margin, slot, service start, or service end skips before history. There is no numeric default. Equal coverage does not alert. An open coverage alert is not repeated. The venue flag off skips before settings.
- Dish names every limiter id, in the order the port returns them. No dish minimum skips before the port is called. Units equal to the minimum do not alert. An open dish alert is not repeated. p2-07 files were not edited.
- Escalation reads the red clock only. Critical shares that clock. Yellow, coverage, and dish do not. Elapsed time at the limit writes one `siteAdministrator` notice. Twice the limit also writes `generalManager`. A second run does not duplicate. A null limit does not become 20. The flag off does not list alerts. No WhatsApp, SMS, email, or Web Push.
- Restock of 4 kg on hand against a 20 kg maximum and a 1 kg purchase unit requests 16 kg. One supply link is the destination. Several links require the actor warehouse id. A foreign id is rejected. Zero links with no actor supplier offer a purchase order and create none. The actor supplier id is the only supplier used. The document id is stored. `request-transfer` and `create-purchase-order` were not edited. Their tests still pass.
- A proposal stays `pending`. Evaluation ignores it and keeps the brand reorder point. Accept writes the site level and marks the suggestion `active`. A denied session leaves the suggestion pending.

## Work Unit Evidence (tasks 3.1–4.4)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | New-only final run: `pnpm exec vitest run --project inventory` on the six new test files. Exit 0. Test Files 6 passed. Tests 27 passed. Duration 365ms. Start 18:35:49. Pair RED/GREEN results are listed above. Regression run exit 0, 13 files, 70 passed, 778ms, start 18:30:36. |
| Runtime harness command/scenario and exact result | N/A. The use cases talk to in-memory port doubles. There is no HTTP, database, or process boundary. |
| Rollback boundary | Delete `evaluate-coverage/`, `evaluate-dish-alert/`, `escalate-alerts/`, `restock-from-alert/`, `propose-stock-levels/`, `accept-stock-levels/`, `ports/consumption-history.ts`, `ports/producible-units.ts`, and `ports/transfer-request.ts`. Revert the coverage, dish, notice, document, and suggestion members added to `ports/shortage-repository.ts`. Remove the six new `#application/...` import keys and the appended entry-port exports. Revert tasks 3.1–4.4 and the unit 3–4 sections of this file. Leave units 1 and 2 in place. |

## Workload / PR boundary (tasks 3.1–4.4)

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: coverage, dish, escalation, restock, propose, and accept. Persistence, HTTP, and screens stay on later batches.
- Boundary: the six new use cases, three ports, the repository defaults, the package import keys, and the appended entry-port exports
- Estimated review budget impact: this slice is the application behavior. The change-wide forecast stays High.

## Deviations from Design (tasks 3.1–4.4)

Coverage hours use the UTC clock of the given instant. Friday `2026-11-13T18:00:00.000Z` through a 23:00 UTC service end is 5 hours left. This slice does not convert America/Bogota.

The first notice is `siteAdministrator`. `generalManager` is added at twice the limit. There is no `kitchenChief` notice in this use case. `openedAt` is on the open-shortage read, not on `LevelAlert`, so `evaluate-stock-levels` was not edited.

`TransferRequest.request` takes the supplying warehouse as `destinationLocationId`. `RequestTransfer` was not edited. Zero links and no actor `supplierId` return `purchase-offered` and do not choose a supplier. The actor `supplierId` is passed to the existing `CreatePurchaseOrder`. The document id is stored on `AlertDocument`.

A proposal copies the active minimum, sets reorder to daily consumption times lead days, and sets maximum to two lead covers. `effectiveLevels` does not read suggestions. Accept writes a site level.

`domain/index.ts` was not edited. New types stay on the application modules and the shortage repository port. `shortage-repository.ts` gained default methods so the phase 2 doubles still compile. The adapter remains phase 5.

`entry-port.ts` only appends. `biome check` still reports `assist/source/organizeImports` on that file because `ConfigureProductionCost` and `CorrectProduction` already sit after `ReceivePurchase` at HEAD. Sorting would move those existing exports. The new use-case files passed `biome lint`.

## Issues Found (tasks 3.1–4.4)

Engram was unavailable at the start of this batch (`user-engram` live discovery failed). The openspec file is the persistence record. A save was attempted at the close.

## Unit 5: Persistence (tasks 5.1–5.5)

### 5.1 RED — shortage repository contract on memory

```text
pnpm exec vitest run --project inventory contexts/inventory/application/ports/shortage-repository.contract.ts
```

- Exit code: 1
- `Error: Cannot find module '#adapters/memory/in-memory-shortage-repository.js'`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 233ms
- Start: 18:51:42

### 5.2 GREEN — in-memory shortage repository

Same command.

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 4 passed (4)
- Duration: 288ms
- Start: 18:53:25

### 5.3 RED — same contract on PGlite

```text
pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-shortage-repository.contract.test.ts
```

- Exit code: 1
- `Error: Cannot find module '#adapters/postgres/drizzle-shortage-repository.js'`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 241ms
- Start: 18:53:58

### 5.4 GREEN — schema, Drizzle adapter, `0009_shortage_alerts.sql`

Same PGlite command.

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 5 passed (5) — 4 shared contract cases plus the empty-migration assertion
- Duration: 5.59s
- Start: 18:56:36

### 5.5 — EvaluateStockLevels inside the four ledger transactions

The four writer tests were added with the wiring. The first run of those tests was already green. There is no separate failing RED for 5.5.

```text
pnpm exec vitest run --project inventory contexts/inventory/application/ports/shortage-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-shortage-repository.contract.test.ts contexts/inventory/application/register-sale-consumption/register-sale-consumption.test.ts contexts/inventory/application/record-waste/record-waste.test.ts contexts/inventory/application/return-stock/return-stock.test.ts contexts/inventory/application/receive-purchase/receive-purchase.test.ts
```

- Exit code: 0
- Test Files: 6 passed (6)
- Tests: 46 passed (46)
- Duration: 5.57s
- Start: 18:59:38

Biome `--write` on the owned files, then the same command again:

- Exit code: 0
- Test Files: 6 passed (6)
- Tests: 46 passed (46)
- Duration: 6.39s
- Start: 19:00:49

## Unit 5 behavior covered

- The memory contract hides the other tenant, rolls an in-transaction alert back while a committed brand level stays, and keeps one open level row. The second write keeps the first `openedAt`.
- PGlite sets the tenant with `SELECT set_config('app.tenant_id', id, true)` inside the transaction, then `SET LOCAL ROLE inventory_app`. That is the local setting the other inventory adapters already use.
- `0009_shortage_alerts.sql` creates `stock_level_templates`, `stock_levels`, `dish_levels`, `coverage_settings`, `notification_rules`, `shortage_alerts`, `role_notices`, and `suggested_stock_levels`. No backfill. `shortage_alerts_enabled` defaults to false. Count tables and `output_quantity` from 0006 and 0008 remain. 0004, 0006, 0007, and 0008 were not edited.
- Sale, waste, and return call `EvaluateStockLevels` after the stock append and before publish or enqueue. `NegativeStockOpened` is still built before the transaction and published only after it succeeds.
- Receive evaluates after `purchasing.confirm` when `ledger`, `levels`, `brandId`, and `venueId` are all present. Existing constructors stay valid: the new dependencies are optional trailing arguments.

## Work Unit Evidence (tasks 5.1–5.5)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Final post-Biome run: the six-file command above. Exit 0. Test Files 6 passed. Tests 46 passed. Duration 6.39s. Start 19:00:49. Pair RED/GREEN for 5.1–5.4 are listed above. |
| Runtime harness command/scenario and exact result | PGlite contract: exit 0, 5 passed, duration 5.59s, start 18:56:36. Empty database has the eight shortage tables, the 0008 count tables, `output_quantity`, and `shortage_alerts_enabled` default `false`. No shortage or stock rows. |
| Rollback boundary | Delete `shortage-repository.contract.ts`, `in-memory-shortage-repository.ts`, `drizzle-shortage-repository.ts`, `drizzle-shortage-repository.contract.test.ts`, and `0009_shortage_alerts.sql`. Revert the shortage tables in `schema.ts`, the `vitest.config.ts` include, `ShortageTransaction.onRollback`, the concrete shortage defaults, `StockLedgerRepository.inTransaction`, and the memory ledger override. Revert the four use-case call sites and their new tests. Leave units 1–4 in place. |

## Workload / PR boundary (tasks 5.1–5.5)

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: persistence. HTTP 6.x and screens 7.x stay on later batches.
- Boundary: shortage repository contract, memory and Drizzle adapters, `0009_shortage_alerts.sql`, shortage tables in `schema.ts`, and the `EvaluateStockLevels` call inside the four writers
- Estimated review budget impact: this slice is the database and the shared transaction hook. The change-wide forecast stays High.

## Deviations from Design (tasks 5.1–5.5)

`drizzle-stock-ledger-repository.ts` and `domain/stock-ledger.ts` were not edited. `inTransaction` lives on the abstract `StockLedgerRepository` and restores only shortage undos registered through `onRollback`. `InMemoryStockLedgerRepository` also snapshots its rows. The Drizzle ledger keeps the inherited default, so a production stock append and the shortage write are not one SQL transaction.

`ReceivePurchase` rolls the stock lines back through that memory snapshot. The purchase receipt row stored by the purchasing repository is not rolled back. There is no purchasing undo API, and that repository was not in this slice. An idempotent retry can see the receipt and skip posting stock again.

`openedAt` is the first write's ISO timestamp. Callers do not pass a clock. `saveDishLevel`, `saveCoverageSettings`, `saveNotificationRule`, and `saveAlertsEnabled` are concrete port methods with no-op defaults so the phase 2 doubles still compile. `vitest.config.ts` includes the contract file because it is not named `*.test.ts`.

`package.json` and `entry-port.ts` were not edited. `application-module.ts` was not edited. The new constructor arguments are optional, so the existing composition still typechecks.

## Issues Found (tasks 5.1–5.5)

None in the owned tests. HTTP 6.x and screens 7.x are not started. `state.yaml` stays `applying` / `apply: partial`.

## Task 6.1 — shortage notice contract

`shortageNotice` is a strict Zod object. `alertId` and `venueId` are non-empty strings. The enums are copied from the domain and the escalation use case. The domain file was not given a Zod import.

| Field | Values |
|---|---|
| kind | `level`, `coverage`, `dish` |
| severity | `yellow`, `red`, `critical` |
| role | `siteAdministrator`, `generalManager` |

`kitchenChief` is not a role. The first notice role is `siteAdministrator`. `generalManager` is the second role, used only at twice the escalation limit. Severity is required and is one of `LEVEL_SEVERITY`. The schema does not accept `null`.

There was no existing shortage contract test. `apps/api-cloud/test/contracts/shortage-alerts.test.ts` is the focused test. It parses a valid notice, including `generalManager`, `coverage`, and `dish`, and rejects an unknown key and a `kitchenChief` role.

### RED

```text
pnpm exec vitest run --project api-cloud apps/api-cloud/test/contracts/shortage-alerts.test.ts
```

- Exit code: 1
- `TypeError: Cannot read properties of undefined (reading 'safeParse')`
- Test Files: 1 failed (1)
- Tests: 3 failed (3)
- Duration: 424ms
- Start: 19:24:05

### GREEN

Same command, after `shared/contracts/shortage-alerts.ts` and the appended `index.ts` export.

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 3 passed (3)
- Duration: 401ms
- Start: 19:24:52

The same command after the export was placed at the end of `index.ts`:

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 3 passed (3)
- Duration: 393ms
- Start: 19:26:54

`index.ts` keeps the production, purchasing, reporting, dining-room, stock-movement, and transfer exports. `shortageNotice` and `ShortageNotice` are appended after `update-structure`.

## Work Unit Evidence (task 6.1)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/contracts/shortage-alerts.test.ts`. Final run: exit 0. Test Files 1 passed. Tests 3 passed. Duration 393ms. Start 19:26:54. RED at 19:24:05 was exit 1, 3 failed, missing export. First GREEN at 19:24:52 was exit 0, 3 passed, duration 401ms. |
| Runtime harness command/scenario and exact result | N/A. Task 6.1 is a shared Zod contract. It has no HTTP, socket, database, or worker boundary. Those stay on 6.2–6.4. |
| Rollback boundary | Delete `shared/contracts/shortage-alerts.ts` and `apps/api-cloud/test/contracts/shortage-alerts.test.ts`. Remove the appended `shortage-alerts` export from `shared/contracts/index.ts`. Uncheck 6.1 and remove this section. Leave 6.2–7.2 and units 1–5 in place. |

## Workload / PR boundary (task 6.1)

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`). No branch and no commit in this batch.
- Current work unit: the notice contract only. Controllers, worker, and screens stay unchecked.
- Boundary: `shortageNotice` / `ShortageNotice`, the barrel append, and the focused contract test
- Estimated review budget impact: one schema, one export, and three tests. The change-wide forecast stays High.

## Deviations from Design (task 6.1)

None. The notice fields match the design: `alertId`, `kind`, `severity`, `role`, `venueId`.

## Issues Found (task 6.1)

None. 6.2, 6.3, 6.4, 7.1, and 7.2 stay open. `state.yaml` was not edited.

## Task 6.4 — shortage alert worker

Four PgBoss queues, each with its own handler. Cron `*/15 * * * *`, time zone `UTC`. Coverage `occurredAt` comes from `new Date(clock.now()).toISOString()`. Yellow, coverage, and dish stay out of escalation because the worker calls `EscalateAlerts`, which already ignores those clocks. The first notice role stays `siteAdministrator`; `generalManager` is only at twice the limit. No `kitchenChief` notice. No WhatsApp, SMS, email, or Web Push. No `listen()`.

Queues:

| Queue | Use case |
|---|---|
| `inventory.evaluate-coverage` | `EvaluateCoverage` |
| `inventory.evaluate-dish-alert` | `EvaluateDishAlert` |
| `inventory.escalate-alerts` | `EscalateAlerts` |
| `inventory.propose-stock-levels` | `ProposeStockLevels` |

`contexts/inventory/package.json` appends `./adapters/postgres/drizzle-shortage-repository` after the stock-count export. Existing export keys stay in place. `shortageAlertsFromPostgres` constructs `DrizzleShortageRepository`. `startWorker` keeps close-open-shifts and Factus, then registers these four queues. Without an open Postgres client it uses `disabledShortageAlerts`, so the flag reads off and the use cases are not called.

### RED

`pnpm exec vitest run --project api-cloud apps/api-cloud/test/composition/shortage-alerts.worker.test.ts`

- Exit code: 1
- Test Files: 1 failed
- Tests: no tests
- `Error: Cannot find module '#src/composition/shortage-alerts.worker.js'`
- Duration: 221ms
- Start: 19:35:31

### GREEN

Same command, after `shortage-alerts.worker.ts`, the `worker.ts` registration, and the repository export.

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 3 passed (3)
- Duration: 770ms
- Start: 19:39:11

The fake boss records `createQueue`, `work`, and `schedule`. It does not start PgBoss or Postgres. A disabled venue flag does not call any of the four use cases. An enabled coverage job calls `EvaluateCoverage` with `occurredAt` `2026-11-15T20:00:00.000Z`.

## Work Unit Evidence (task 6.4)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/composition/shortage-alerts.worker.test.ts`. RED exit 1 at 19:35:31, 1 failed file, no tests, missing module, duration 221ms. GREEN exit 0 at 19:39:11, 1 file, 3 passed, duration 770ms. |
| Runtime harness command/scenario and exact result | N/A for a live PgBoss or Postgres process. `apps/api-cloud/test/composition/worker.test.ts` does not start either, and this batch matches that style with a fake boss. No `listen()`. |
| Rollback boundary | Delete `apps/api-cloud/src/composition/shortage-alerts.worker.ts` and `apps/api-cloud/test/composition/shortage-alerts.worker.test.ts`. Remove the shortage registration from `apps/api-cloud/src/composition/worker.ts`. Remove the appended `drizzle-shortage-repository` export. Uncheck 6.4 and remove this section. Leave 6.1, 6.2, 6.3, 7.1, 7.2, and units 1–5 in place. |

## Workload / PR boundary (task 6.4)

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`). No branch and no commit in this batch.
- Current work unit: the shortage worker only. Controllers and screens stay unchecked.
- Boundary: four queues, the 15-minute UTC cron, the flag gate, and the drizzle shortage repository export
- Estimated review budget impact: one worker module, a short `startWorker` registration, one export line, and three tests. The change-wide forecast stays High.

## Deviations from Design (task 6.4)

The cron payload is empty. The shortage repository has no method that lists venues, so a tick with no `tenantId` and `venueId` writes nothing. A job that carries a venue checks the flag and then calls only that queue's use case.

`startWorker()` with no database client does not open Postgres. `DrizzleShortageRepository` needs an already open client. Pass that client as the second argument to use `shortageAlertsFromPostgres`.

History, producible units, and the shortage audit are not exported to `api-cloud`. The Postgres factory passes empty history, empty units, and a silent audit into the real use cases. Coverage and dish then follow those ports and do not open an alert. Escalation can store a notice without an audit row until an audit adapter is injected.

## Issues Found (task 6.4)

6.2, 6.3, 7.1, and 7.2 stay open. `state.yaml`, `application-module.ts`, and the HTTP controllers were not edited.

## Tasks 6.2 and 6.3 — shortage HTTP

Fastify `inject`, no `listen()`. `shortageAlertsEnabled` defaults off, the same `=== true` gate as `wasteAndCountsEnabled`. With the flag off the stock-level, seen, restock, and shortage-realtime routes answer 404 and the controllers are not registered. Postgres is required when the flag is on. api-cloud does not import sqlite.

`POST .../shortage-alerts/:alertId/restock` is guarded by `RestockFromAlert`, which checks `inventory.request-replenishment`. A waiter receives 403 `RestockDenied` and no document id is stored. A kitchen chief passes that check; with no open alert the response is 404 `ShortageAlertNotFound`.

`GET .../shortage-realtime` replays stored role notices for the venue. The kitchen chief sees the `siteAdministrator` level/red notice. A stored `kitchenChief` role is dropped because `shortageNotice` does not allow it. A waiter is denied with 403 `ShortageNoticeDenied`. Cashier, site administrator, and general manager are not denied by that check. Yellow, coverage, and dish are not escalated here; a notice is emitted only when it parses as `shortageNotice`.

Routes:

| Method | Path | Guard |
|---|---|---|
| POST | `/tenants/:tenantId/venues/:venueId/stock-levels` | `inventory.configure-levels` via `SetStockLevels` |
| POST | `/tenants/:tenantId/venues/:venueId/stock-level-suggestions/:suggestionId/acceptance` | `inventory.configure-levels` via `AcceptStockLevels` |
| POST | `/tenants/:tenantId/venues/:venueId/shortage-alerts/:alertId/seen` | session, `MarkAlertSeen` |
| POST | `/tenants/:tenantId/venues/:venueId/shortage-alerts/:alertId/resolution` | session, `ResolveAlert` |
| POST | `/tenants/:tenantId/venues/:venueId/shortage-alerts/:alertId/restock` | `inventory.request-replenishment` via `RestockFromAlert` |
| GET | `/tenants/:tenantId/venues/:venueId/shortage-realtime` | session; waiter denied |

Purchasing, `productionEnabled`, `transfersEnabled`, inventory reports, `noRestockTodayEnabled` (including `NotRestockedProductReader`), and `wasteAndCountsEnabled` stay in `application-module.ts`. The worker, `entry-port.ts`, and `package.json` were not edited.

### RED

```text
pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/shortage-alerts.controller.test.ts apps/api-cloud/test/http/shortage-realtime.controller.test.ts
```

- Exit code: 1
- Test Files: 2 failed (2)
- Tests: no tests
- `Error: Cannot find module '#src/http/shortage-alerts.controller.js'`
- `Error: Cannot find module '#src/http/shortage-realtime.controller.js'`
- Duration: 236ms
- Start: 20:06:24

### GREEN

Same command, after the two controllers, the test harness, and the appended composition.

- Exit code: 0
- Test Files: 2 passed (2)
- Tests: 6 passed (6)
- Duration: 5.73s
- Start: 20:10:13

## Work Unit Evidence (tasks 6.2–6.3)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/shortage-alerts.controller.test.ts apps/api-cloud/test/http/shortage-realtime.controller.test.ts`. RED exit 1 at 20:06:24, 2 failed files, no tests, missing modules, duration 236ms. GREEN exit 0 at 20:10:13, 2 files, 6 passed, duration 5.73s. |
| Runtime harness command/scenario and exact result | Nest Fastify `inject` on those six tests. No `listen()`. Flag off returns 404. Waiter restock returns 403 `RestockDenied`. Kitchen restock with no alert returns 404 `ShortageAlertNotFound`. Kitchen SSE receives the `siteAdministrator` notice and drops `kitchenChief`. |
| Rollback boundary | Delete `apps/api-cloud/src/http/shortage-alerts.controller.ts`, `apps/api-cloud/src/http/shortage-realtime.controller.ts`, `apps/api-cloud/test/http/shortage-alerts.controller.test.ts`, `apps/api-cloud/test/http/shortage-realtime.controller.test.ts`, and `apps/api-cloud/test/http/shortage-alerts-cloud.ts`. Remove the appended shortage flag, `openShortageAlerts`, controller spreads, and the realtime middleware route from `application-module.ts`. Uncheck 6.2 and 6.3 and remove this section. Leave 6.1, 6.4, 7.1, 7.2, and units 1–5 in place. |

## Workload / PR boundary (tasks 6.2–6.3)

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`). No branch and no commit in this batch.
- Current work unit: the shortage HTTP controllers only. Screens stay unchecked.
- Boundary: flag-gated routes, the one-tap permission, and the shortage SSE notice
- Estimated review budget impact: two controllers, an appended composition function, and six HTTP tests. The change-wide forecast stays High.

## Deviations from Design (tasks 6.2–6.3)

`DrizzleShortageRepository.findLevelAlert` always opens its own transaction and ignores the caller transaction. Wrapping `RestockFromAlert` in `inTransaction` deadlocks the single Postgres connection. The HTTP runner therefore calls the use case with a balance of 0, which is the same balance `PostgresShortageTransaction` already returns, and lets each repository method open its own transaction.

The one-tap transfer port returns `transfer_${alertId}`. `RestockFromAlert` still stores that document id through the Postgres shortage repository when a restock completes. These tests stop at the permission denial and the missing alert, so they do not create a transfer row.

The SSE replays notices already stored for the venue. It does not push a notice that is saved after the socket is open. `kitchenChief` is a viewer role that may open the stream; it is not a notice role.

## Issues Found (tasks 6.2–6.3)

7.1 and 7.2 stay open. `state.yaml` was not edited. The worker was not edited.

## Tasks 7.1 and 7.2 — shortage screens

`StockLevelsScreen` in `apps/admin-web/src/inventory/inventory-screen.tsx` posts levels and accepts a proposal. Purchase, production, and transfer screens stay in that file. Kitchen and cash register show the SSE notice and one restock tap. The kitchen production POST stays. Nothing is written to local or session storage.

Paths, header `x-session-id` from the existing admin and venue scopes:

| Action | Method | Path |
|---|---|---|
| Save levels | POST | `/tenants/pilot/venues/chapinero/stock-levels` |
| Accept proposal | POST | `/tenants/pilot/venues/chapinero/stock-level-suggestions/:suggestionId/acceptance` |
| Notice | GET | `/tenants/pilot/venues/chapinero/shortage-realtime` |
| One tap | POST | `/tenants/pilot/venues/chapinero/shortage-alerts/:alertId/restock` |

A 404 leaves the route absent: no active levels and no notice. A rejected level post does not replace the active levels. Typing a proposal does not accept it. Accept sends no body. One tap sends `purchaseUnit` 1, a new `documentId`, a new `lineId`, and null `warehouseId` and `supplierId`. A `purchase-order` outcome offers a purchase order. A transfer outcome says the restock was recorded. A notice for another venue stays hidden. `orders-realtime` is unchanged.

### RED

```text
pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/stock-levels-screen.test.tsx
```

- Exit code: 1
- Test Files: 1 failed (1)
- Tests: 7 failed | 1 passed (8)
- `StockLevelsScreen` was undefined
- Duration: 2.35s
- Start: 20:17:42

```text
pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/kitchen/shortage-notice.test.tsx apps/venue-app/test/cash-register/shortage-notice.test.tsx
```

- Exit code: 1
- Test Files: 2 failed (2)
- Tests: 7 failed | 2 passed (9)
- The two passes were the flag-off cases, which already showed no notice
- Duration: 6.85s
- Start: 20:17:42

### GREEN

Admin command, after `StockLevelsScreen`:

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 8 passed (8)
- Duration: 2.00s
- Start: 20:20:35

Venue command, after the notice panel on kitchen and cash register:

- Exit code: 0
- Test Files: 2 passed (2)
- Tests: 9 passed (9)
- Duration: 1.73s
- Start: 20:20:35

The same screens with their existing tests, after the notice panel:

- Admin inventory folder: exit 0 at 20:19:19, 4 files, 27 passed, duration 2.88s
- Venue kitchen and cash register: exit 0 at 20:19:53, 4 files, 17 passed, duration 2.00s

## Work Unit Evidence (tasks 7.1–7.2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Admin: `pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/stock-levels-screen.test.tsx`. RED exit 1 at 20:17:42, 7 failed and 1 passed, duration 2.35s. GREEN exit 0 at 20:20:35, 8 passed, duration 2.00s. Venue: `pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/kitchen/shortage-notice.test.tsx apps/venue-app/test/cash-register/shortage-notice.test.tsx`. RED exit 1 at 20:17:42, 7 failed and 2 passed, duration 6.85s. GREEN exit 0 at 20:20:35, 9 passed, duration 1.73s. |
| Runtime harness command/scenario and exact result | N/A for a browser session. jsdom clicks save, accept, restock, and the kitchen production post. No `listen()` and no dev server. |
| Rollback boundary | Remove `StockLevelsScreen` from `apps/admin-web/src/inventory/inventory-screen.tsx`. Remove `ShortageNoticePanel` from `apps/venue-app/src/kitchen/kitchen-screen.tsx` and its use in `apps/venue-app/src/cash-register/register-screen.tsx`. Delete `apps/admin-web/test/inventory/stock-levels-screen.test.tsx`, `apps/venue-app/test/kitchen/shortage-notice.test.tsx`, and `apps/venue-app/test/cash-register/shortage-notice.test.tsx`. Uncheck 7.1 and 7.2 and remove this section. Leave purchase, production, transfer, the kitchen production POST, and tasks 1.1–6.4 in place. |

## Workload / PR boundary (tasks 7.1–7.2)

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`). No branch and no commit in this batch.
- Current work unit: the shortage screens only. HTTP controllers and the worker stay as the previous batch left them.
- Boundary: admin level editing and proposal acceptance, plus the venue notice and one tap
- Estimated review budget impact: three screens and three test files. The change-wide forecast stays High.

## Deviations from Design (tasks 7.1–7.2)

`StockLevelsScreen` is a new export in the inventory screen file. `router.tsx` was not edited, so this batch does not mount it on a route. The screen tests render it the same way the purchase tests render `PurchaseScreen`.

The one tap sends purchase unit 1 because the restock body requires it and the screen has no second field. `documentId` and `lineId` are created on the tap. `warehouseId` and `supplierId` are null. The cloud chooses a transfer or a purchase order.

The cash register imports `ShortageNoticePanel` from the kitchen screen through `#src/kitchen/kitchen-screen.js`. The SSE read uses `fetch` with `x-session-id`, the same shape as the existing orders stream.

## Issues Found (tasks 7.1–7.2)

`state.yaml` was not edited. `application-module.ts`, the controllers, `worker.ts`, `router.tsx`, `venue-cloud.ts`, `service-session.tsx`, `shared/contracts`, `package.json`, and `orders-realtime.controller.ts` were not edited. Tasks 1.1–6.4 stay checked. 7.1 and 7.2 are now checked. No archive.
