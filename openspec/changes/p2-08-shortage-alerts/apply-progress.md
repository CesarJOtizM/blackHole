# Apply progress: p2-08-shortage-alerts

Change: `p2-08-shortage-alerts`
Work units recorded: 2 of 7 complete. Unit 2 is complete (2.1–2.6).
Mode: Standard (`strict_tdd: false`). RED then GREEN still ran, as required by ADR-017 and `rules.apply`. `strict-tdd.md` was not loaded.
Committed: no
Pushed: no

Tasks 1.1, 1.2, and 2.1–2.6 are complete. Coverage, dish, one tap, persistence, HTTP, and screens were not started. Ready for the next apply batch (3.1). Verify was not run.

## Completed tasks

- [x] 1.1 RED `contexts/inventory/domain/shortage-alert.test.ts`. Bad levels rejected. One critical. No flap. Round up. No Nest.
- [x] 1.2 GREEN `contexts/inventory/domain/shortage-alert.ts` and `domain/index.ts`. Sold out is at or under 0. `critical` uses the red clock.
- [x] 2.1 RED `contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts`. Site override. Reorder below minimum rejected. `inventory.configure-levels` only.
- [x] 2.2 GREEN `contexts/inventory/application/set-stock-levels/` and `application/ports/shortage-repository.ts`. This slice stores levels. It does not emit alerts.
- [x] 2.3 RED `contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts`. Yellow. One critical. No repeat. Flag off. `NegativeStockOpened` stays.
- [x] 2.4 GREEN `contexts/inventory/application/evaluate-stock-levels/`. Same transaction as the level read.
- [x] 2.5 RED mark seen and resolve tests. Who and when. Reason. Resolve only above reorder. `shortage-audit.ts` calls `RecordAuditEvent`.
- [x] 2.6 GREEN both use cases. No platform import in the use cases. Exported from `application/entry-port.ts`.

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
