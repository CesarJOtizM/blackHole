# Apply progress: p0-01-risk-spikes

Work units 1 and 2. Mode: Standard (strict_tdd false) with ADR-017 RED then GREEN.

Delivery: feature-branch-chain. Unit 2 is on `p0-01-escpos-transport` and is not committed.

## Completed tasks

- [x] 1.1 Vitest project `spikes` includes `tools/spikes/**/*.test.ts`.
- [x] 2.1 RED `render-escpos.test.ts`.
- [x] 2.2 GREEN `render-escpos.mjs`.
- [x] 3.1 RED decision-report guard tests.
- [x] 3.2 RED checked-in example stays blocking.
- [x] 3.3 GREEN `decision-report.mjs`.
- [x] 3.4 `report.example.json` blocking, no concluded visit.
- [x] 4.1 RED `send-bytes.test.ts`.
- [x] 4.2 GREEN `send-bytes.mjs`.
- [x] 5.1 `run-onsite.mjs`.
- [x] 6.1 `boundary.test.ts`.
- [x] 6.2 dependency-cruiser forbids `contexts/` and `apps/` from importing `tools/spikes/`.

## Work Unit Evidence

### Unit 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project spikes` — exit 0. `Test Files  2 passed (2)`. `Tests  18 passed (18)`. |
| Runtime harness command/scenario and exact result | N/A: no printer in this unit. |
| Rollback boundary | Delete `tools/spikes/escpos/render-escpos.*`, `decision-report.*`, `report.example.json`, and `tools/spikes/escpos/package.json`; revert the `spikes` project in `vitest.config.ts`. |

### Unit 2

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project spikes` — exit 0. `Test Files  4 passed (4)`. `Tests  29 passed (29)`. |
| Runtime harness command/scenario and exact result | `node tools/spikes/escpos/run-onsite.mjs` is N/A in CI because there is no printer. Local runs without a printer: refused USB path exit 1; temp file write exit 0 with bytes `48 65 6c 6c 6f 1b 70 00 19 fa`; refused host exit 1. `report.example.json` SHA-256 stayed `AF458100ED11E7FA0D5A9492E98FE1A88B29EEE57175314632A4ADFD2252C4DB`. |
| Rollback boundary | Delete `send-bytes.*`, `run-onsite.mjs`, `boundary.test.ts`; revert the `tools/spikes` rule in `.dependency-cruiser.cjs` and the `#send-bytes` import in `tools/spikes/escpos/package.json`. |

Local commands and results:

- `node tools/spikes/escpos/run-onsite.mjs C:\Users\csar-\AppData\Local\Temp\escpos-onsite-usb.json --path requirements.txt` — exit 1. `Error: Refused USB path: requirements.txt`.
- `node tools/spikes/escpos/run-onsite.mjs C:\Users\csar-\AppData\Local\Temp\escpos-onsite-usb.json --path C:\Users\csar-\AppData\Local\Temp\escpos-onsite-ticket.bin` — exit 0. File bytes `48 65 6c 6c 6f 1b 70 00 19 fa` (`Hello` plus the drawer pulse).
- `node tools/spikes/escpos/run-onsite.mjs C:\Users\csar-\AppData\Local\Temp\escpos-onsite-net.json --host "not a host" --port 9100` — exit 1. `Error: Refused host: expected a hostname or IPv4`.

`pnpm architecture` — exit 0. `no dependency violations found (23 modules, 35 dependencies cruised)`. The existing TypeScript 7 `missing-typescript-transpiler` warning remains.

`pnpm exec biome check tools/spikes/escpos .dependency-cruiser.cjs` — exit 0. Checked 11 files. No fixes applied.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.1 → 2.2 | `pnpm vitest run --project spikes` exit 1. `FAIL tools/spikes/escpos/render-escpos.test.ts` — `Cannot find module '#render-escpos'`. Test files 1 failed. | Same command after `render-escpos.mjs`: exit 0, 3 passed. |
| 3.1 → 3.3 | Same command exit 1. `FAIL tools/spikes/escpos/decision-report.test.ts` — `Cannot find module '#decision-report'`. Render file still passed (3). | After `decision-report.mjs`, guard tests passed. |
| 3.2 → 3.4 | After the module, before the example: exit 1. Two failures, `ENOENT` opening `report.example.json`. `Tests  2 failed \| 16 passed (18)`. | After `report.example.json`: exit 0, 18 passed. |
| 4.1 → 4.2 | `send-bytes.mjs` absent. `pnpm vitest run --project spikes` exit 1. `FAIL tools/spikes/escpos/send-bytes.test.ts` — `Cannot find module '#send-bytes'`. `Test Files  1 failed \| 2 passed (3)`. `Tests  18 passed (18)`. | After `send-bytes.mjs`: exit 0. `Test Files  3 passed (3)`. `Tests  28 passed (28)`. Final project run after the boundary test: exit 0, 4 files, 29 tests. |

## Deviations

`tools/spikes/escpos/package.json` adds the smallest `imports` map (`#render-escpos`, `#decision-report`, `#report-example`, `#send-bytes`). Tests and `run-onsite.mjs` import those specifiers. Source files do not use `./` or `../` imports. The map targets use `./` because Node subpath imports require it. `node tools/spikes/escpos/run-onsite.mjs` resolves `#render-escpos` and `#send-bytes` from that package map.

`sendBytes` takes an optional `io` seam (`openFile`, `connect`). The default seam is `node:fs/promises` `open` and `node:net` `connect`. Refusal throws before either call. There is no `child_process`.
