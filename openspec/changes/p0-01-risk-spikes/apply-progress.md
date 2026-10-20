# Apply progress: p0-01-risk-spikes

Work unit 1 only (PR 1 on `p0-01-escpos-report`, base `p0-01-risk-spikes`). Mode: Standard (strict_tdd false) with ADR-017 RED then GREEN.

## Completed tasks

- [x] 1.1 Vitest project `spikes` includes `tools/spikes/**/*.test.ts`.
- [x] 2.1 RED `render-escpos.test.ts`.
- [x] 2.2 GREEN `render-escpos.mjs`.
- [x] 3.1 RED decision-report guard tests.
- [x] 3.2 RED checked-in example stays blocking.
- [x] 3.3 GREEN `decision-report.mjs`.
- [x] 3.4 `report.example.json` blocking, no concluded visit.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project spikes` — exit 0. `Test Files  2 passed (2)`. `Tests  18 passed (18)`. |
| Runtime harness command/scenario and exact result | N/A: no printer in this unit. |
| Rollback boundary | Delete `tools/spikes/escpos/render-escpos.*`, `decision-report.*`, `report.example.json`, and `tools/spikes/escpos/package.json`; revert the `spikes` project in `vitest.config.ts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.1 → 2.2 | `pnpm vitest run --project spikes` exit 1. `FAIL tools/spikes/escpos/render-escpos.test.ts` — `Cannot find module '#render-escpos'`. Test files 1 failed. | Same command after `render-escpos.mjs`: exit 0, 3 passed. |
| 3.1 → 3.3 | Same command exit 1. `FAIL tools/spikes/escpos/decision-report.test.ts` — `Cannot find module '#decision-report'`. Render file still passed (3). | After `decision-report.mjs`, guard tests passed. |
| 3.2 → 3.4 | After the module, before the example: exit 1. Two failures, `ENOENT` opening `report.example.json`. `Tests  2 failed \| 16 passed (18)`. | After `report.example.json`: exit 0, 18 passed. |

## Deviations

`tools/spikes/escpos/package.json` adds the smallest `imports` map (`#render-escpos`, `#decision-report`, `#report-example`). Tests import those specifiers. Source files do not use `./` or `../` imports. The map targets use `./` because Node subpath imports require it.
