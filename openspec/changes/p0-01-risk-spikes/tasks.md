# Tasks: Risk Spikes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 420–520 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 render and report → PR 2 transport and boundary. If feature-branch-chain: PR 1 base = `p0-01-risk-spikes`; PR 2 base = PR 1 branch |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Widths, drawer pulse, report guard, blocking example | PR 1 | `pnpm vitest run --project spikes` | N/A: no printer in this unit | Delete `tools/spikes/escpos/render-escpos.*`, `decision-report.*`, `report.example.json`; revert the `spikes` project |
| 2 | Path refusal, on-site runner, import boundary | PR 2 | `pnpm vitest run --project spikes` | `node tools/spikes/escpos/run-onsite.mjs` is the on-site runner and is N/A in CI because there is no printer | Delete `send-bytes.*`, `run-onsite.mjs`, `boundary.test.ts`; revert the `tools/spikes` rule in `.dependency-cruiser.cjs` |

## Phase 1: Spike test project

- [ ] 1.1 In `vitest.config.ts`, add project `spikes` including `tools/spikes/**/*.test.ts`.

## Phase 2: ESC/POS render

- [ ] 2.1 RED `tools/spikes/escpos/render-escpos.test.ts`: given paper 80 or 58, when `renderEscPos` runs, then width is 48 or 32, the drawer pulse is `0x1b, 0x70, 0x00, 0x19, 0xfa`, and transport does not change the bytes.
- [ ] 2.2 GREEN `tools/spikes/escpos/render-escpos.mjs` until 2.1 passes. No I/O and no `child_process`.

## Phase 3: Decision report

- [ ] 3.1 RED `tools/spikes/escpos/decision-report.test.ts`: `concluded` only with non-null legibility and drawer on every printer, both network booleans, and `delivery16: "unblocked"`; else `blocking`, non-empty `owner`, `delivery16: "pending"`. `dedicatedRouter` is `owner-buys` (no price); `adr003` is `pending-hybrid`; no isolation says buy the dedicated router or use wired printers.
- [ ] 3.2 RED in that file: given `report.example.json`, when it is read, then `status` is `blocking`, `owner` is `pilot-visit`, and `delivery16` is `pending`.
- [ ] 3.3 GREEN `tools/spikes/escpos/decision-report.mjs` (no Zod) until 3.1 and 3.2 pass.
- [ ] 3.4 Create `tools/spikes/escpos/report.example.json` with those blocking fields, `spike: "escpos-cash-drawer"`, `dedicatedRouter: "owner-buys"`, `consumerDelivery: "1.6"`, and `adr003: "pending-hybrid"`. No concluded visit.

## Phase 4: Byte transport

- [ ] 4.1 RED `tools/spikes/escpos/send-bytes.test.ts`: given `requirements.txt`, `CMakeLists.txt`, `*.md`, `*.mdx`, or `README.sh`, when `sendBytes` runs, then it refuses before `fs.open`, spawns nothing, exits non-zero, and leaves the report unchanged. Refuse a non-hostname/IPv4 host or a non-numeric port before connect (default 9100).
- [ ] 4.2 GREEN `tools/spikes/escpos/send-bytes.mjs`: same bytes over TCP or a file write. No `child_process`.

## Phase 5: On-site runner

- [ ] 5.1 Create `tools/spikes/escpos/run-onsite.mjs`: load the cloud job (`paperMm` 80 or 58, `lines`, `kickDrawer: true`), render, and send. Never set `ticketLegible` or `drawerOpened`.

## Phase 6: Import boundary

- [ ] 6.1 Add `tools/spikes/escpos/boundary.test.ts`: given `contexts/` and `apps/`, when sources are scanned, then none mention `tools/spikes`.
- [ ] 6.2 In `.dependency-cruiser.cjs`, forbid `contexts/` and `apps/` from importing `tools/spikes/`.

Out of scope: HTTPS, alerts, SQLite, `local-node`, `api-cloud`, production printing.
