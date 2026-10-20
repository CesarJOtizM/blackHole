```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:9782853531973c17d513c0f1f2c0674082ab6b72fdc1e0085d24eb3d593de364
verdict: fail
blockers: 1
critical_findings: 1
requirements: 0/3
scenarios: 1/6
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:bb6a28f7e165b46682315325efda1946509d2e1a12cc74cf82e5bb920644356a
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
```

## Verification Report

**Change**: p0-01-risk-spikes
**Version**: N/A
**Mode**: Standard

Strict TDD is inactive (`strict_tdd: false`). Tasks were confirmed complete (12/12 checked) before the suite ran.

Output hashes are SHA-256 of each command's raw stdout bytes followed by its raw stderr bytes, captured from `pnpm.cmd` on this workspace. `evidence_revision` is the SHA-256 of those five captures concatenated in this order: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm architecture`, `pnpm vitest run --project spikes`.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 12 |
| Tasks complete | 12 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Build**: ✅ Passed (`pnpm typecheck`, exit 0)
```text
pnpm typecheck
$ tsc -b
exit 0
build_output_hash: sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
```

**Tests**: ✅ 52 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
pnpm test
$ vitest run
Test Files  10 passed (10)
     Tests  52 passed (52)
Duration  1.59s
exit 0
test_output_hash: sha256:bb6a28f7e165b46682315325efda1946509d2e1a12cc74cf82e5bb920644356a
```

**Focused spike command**: ✅ 29 passed
```text
pnpm vitest run --project spikes
Test Files  4 passed (4)
     Tests  29 passed (29)
Duration  265ms
exit 0
output hash: sha256:7f8df98041b931af41b7a33ada818acd67aa19a51ad8bcc90951c0b2f057303b
```

**Lint**: ❌ Failed (exit 1). Not a spike-file failure.
```text
pnpm lint
Checked 48 files in 48ms. No fixes applied.
Found 28 errors.
Diagnostics not shown: 8.
The shown diagnostics are Biome format findings (CRLF) under apps/api-cloud, apps/local-node, contexts/platform, shared/contracts, biome.json, and the root package.json.
No diagnostic path is under tools/spikes.
exit 1
output hash: sha256:d04d621df6cb15e9eda0ff0017d3e7092b8bd6d98acdbd3cbcd9f571e0cd9804
```

**Architecture**: ✅ Passed (exit 0), with the known TypeScript 7 transpiler warning.
```text
pnpm architecture
no dependency violations found (23 modules, 35 dependencies cruised)
missing-typescript-transpiler: dependency-cruiser wants typescript >=2 <7; TypeScript 7 sources may be skipped.
exit 0
output hash: sha256:c721d1442641e4d7b907d4afcd66d4277dd83925dd8929517f53934074d183c6
```

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available

No coverage package is installed. `openspec/config.yaml` sets `coverage_threshold: 0`.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Decision Report | Printing spike concluded | `decision-report.test.ts` > given every printer result, both network booleans, and delivery 1.6 unblocked, when the report is closed, then the spike is concluded. That test closes a synthetic in-memory report. `report.example.json` is `status: blocking`. | ❌ UNTESTED |
| Decision Report | Inconclusive spike | `decision-report.test.ts` > given one printer with null legibility, when the report is closed, then it is blocking with an owner and delivery 1.6 pending. Also `given report.example.json, when it is read...` and `given the checked-in example, when the report is closed, then the visit stays blocking`. | ✅ COMPLIANT |
| ESC/POS Printing and Cash Drawer | Print and open drawer | Design: on-site, not a CI pass. `report.example.json` keeps `ticketLegible` and `drawerOpened` null on every printer. Render tests prove column widths and the drawer pulse only. | ⚠️ NOT EXECUTED |
| ESC/POS Printing and Cash Drawer | Printer exposed to guests | Design: on-site, not a CI pass. `report.example.json` keeps `network.unregisteredDeviceReachedPrinterPort` null. | ⚠️ NOT EXECUTED |
| Recommended Router on the Visit | Current router isolates printers | Design: on-site, not a CI pass. `report.example.json` keeps `network.currentRouterIsolatesPrinters` null and `decision` `Visit not recorded.` A synthetic guard test exists and passed; it does not record a visit. | ⚠️ NOT EXECUTED |
| Recommended Router on the Visit | Router cannot isolate printers | Design: on-site, not a CI pass. The example does not record a site router without isolation. A synthetic guard test appends the dedicated-router sentence and passed; it does not record a visit. | ⚠️ NOT EXECUTED |

**Compliance summary**: 1/6 scenarios compliant. 1 untested (concluded spike). 4 not executed in this workspace (on-site visit).

Checked-in report guard, inspected and covered by the passing example tests: `status` is `blocking`, `owner` is `pilot-visit`, `delivery16` is `pending`, `spike` is `escpos-cash-drawer`, `dedicatedRouter` is `owner-buys`, `consumerDelivery` is `1.6`, `adr003` is `pending-hybrid`. The visit is not passed.

Deferred hybrid items (local HTTPS / PA-29 / ADR-003, locked-phone alerts / PA-30, SQLite peak) are not acceptance scenarios. They have no tasks and no files. That is correct.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Decision Report | ⚠️ Partial | The guard rejects an empty owner, a price, a non-`owner-buys` router token, and an `adr003` value other than `pending-hybrid`. `concluded` requires non-null legibility and drawer on every setup printer, both network booleans, and `delivery16: "unblocked"`. Otherwise the closed report is `blocking` with `delivery16: "pending"`. The checked-in example stays blocking. |
| ESC/POS Printing and Cash Drawer | ⚠️ Partial | `renderEscPos` wraps at 48 columns for 80 mm and 32 for 58 mm, appends `0x1b, 0x70, 0x00, 0x19, 0xfa` when `kickDrawer` is true, and ignores transport. `sendBytes` refuses `requirements.txt`, `CMakeLists.txt`, `*.md`, `*.mdx`, and `README.sh` before `fs.open`, refuses a non-hostname/IPv4 host or a non-numeric port before connect, defaults the port to 9100, and does not reference `child_process`. `run-onsite.mjs` renders and sends a cloud job and never assigns `ticketLegible` or `drawerOpened`. No printer was attached. |
| Recommended Router on the Visit | ⚠️ Partial | If `currentRouterIsolatesPrinters` is false and the decision text omits the owner instruction, the guard appends `Buy the dedicated router or use wired printers.` The example does not record a visit. |
| Deferred hybrid items | ✅ Absent, as specified | No task checkboxes and no implementation files for local HTTPS, locked-phone alerts, or SQLite peak. `tasks.md` only names them as out of scope. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Spike lives in `tools/spikes/escpos/` as `.mjs`, tests as `.test.ts`, run with `node`, no `tsx` | ✅ Yes | `run-onsite.mjs` is the on-site runner. |
| No `shared/printing` and no Nest profile in `local-node` or `api-cloud` | ✅ Yes | Spike files stay under `tools/spikes/escpos/`. |
| Cloud job is data in, bytes out; no HTTP route | ✅ Yes | `run-onsite.mjs` reads a JSON job (`paperMm` 80 or 58, `lines`, `kickDrawer: true`, `transport`). |
| `node:net` and `fs` write; no `child_process` | ✅ Yes | Default seam is `node:fs/promises` `open` and `node:net` `connect`. Tests pass an `io` seam. Refusal throws before either call. |
| `concluded` only from operator booleans; checked-in report stays `blocking` | ✅ Yes | Example and the passing close-on-example test stay `blocking` / `pilot-visit` / `pending`. |
| No Zod under `tools/` | ✅ Yes | `decision-report.mjs` is a hand-written guard. |
| Vitest project `spikes` includes `tools/spikes/**/*.test.ts` | ✅ Yes | `vitest.config.ts` project `spikes`. Focused run collected 4 files. |
| dependency-cruiser forbids `contexts/` and `apps/` → `tools/spikes/` | ✅ Yes | Rule `contexts-and-apps-do-not-import-spikes`. `boundary.test.ts` scans those trees for the string `tools/spikes`. `pnpm architecture` reported no violations. |
| On-site ticket, drawer, guest port, and router isolation are not a CI pass | ✅ Yes | This run did not mark them passed. |
| CI must not mark a visit concluded | ✅ Yes | The example is blocking. |
| No tasks and no files for deferred hybrid work | ✅ Yes | Confirmed. |
| File list omits `tools/spikes/escpos/package.json` | ⚠️ Deviation | The package adds a subpath `imports` map (`#render-escpos`, `#decision-report`, `#report-example`, `#send-bytes`). Apply recorded it. It does not break a spec. |

### Issues Found
**CRITICAL**: Printing spike concluded is not satisfied. The scenario requires a reviewed report after the ESC/POS spike was executed, showing setup, evidence, decision, delivery 1.6 as consumer, and ADR-003 still pending. The checked-in report is `blocking`, with null legibility, drawer, and network booleans, `delivery16: pending`, and decision `Visit not recorded.` The passing guard test fabricates those booleans in memory. That is not a covering test of an executed spike, and the design forbids CI from inventing a concluded visit. This blocks archive. It is not a production-code defect to patch in this workspace.

**WARNING**:
- Print and open drawer, Printer exposed to guests, Current router isolates printers, and Router cannot isolate printers were not executed. The example guard holds (`blocking`, `pilot-visit`, `pending`). A missing physical printer is not a code defect, and the visit is not passed.
- `pnpm lint` exited 1 with 28 Biome format diagnostics (8 truncated), all CRLF outside `tools/spikes`. Spike sources are not in that failure.
- `tools/spikes/escpos/package.json` is a design-file-list deviation (imports map only).
- `pnpm architecture` exited 0 and still printed `missing-typescript-transpiler` for TypeScript 7.

**SUGGESTION**: None.

### Verdict
FAIL
1/6 scenarios compliant. The inconclusive-spike guard passed, and the checked-in report correctly stays blocking, but the printing visit was not executed, so the change is not ready to archive.
