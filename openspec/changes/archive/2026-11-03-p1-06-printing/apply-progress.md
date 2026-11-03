# Apply progress: p1-06-printing

Work unit 16. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch stays on `feat/printing-node` and targets `feat/printing-reprint` (PR https://github.com/CesarJOtizM/blackHole/pull/66), not `main`, and stops at tasks 6.5–6.6. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

The local node rejects printing. `POST /tenants/:tenantId/reprints` returns 403 `{ error: "PrintingRejected" }`. The controller has no constructor dependencies and does not call a repository. `ApplicationModule` still has no providers and no imports, so nothing is stored and the drawer stays closed. The printed routes include `reprints` and do not include a drawer route. There is no Postgres, SQLite, TCP, or ESC/POS. The node does not import `@blackhole/printing`, does not enqueue a job, and does not record `sale.reprint`. Units 1–15 stay recorded below.

Work unit 15. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch stays on `feat/printing-reprint` and targets `feat/printing-http` (PR https://github.com/CesarJOtizM/blackHole/pull/65), not `main`, and stops at tasks 6.3–6.4. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

Reprint HTTP and structure printer fields. Under a numeric cap, `POST /tenants/:tenantId/reprints` records one `sale.reprint` with actor, device, document, and time. A null cap returns 409 `ReprintCapUnconfigured` and stores nothing. The body is `reprintDocumentCommand.safeParse`. A caller cannot send `limit`. `addCashRegister` and `addKitchenStation` accept drawer, printer, paper, and backup. `structureCommand.safeParse` stays. Drawer `present` and the printer id are stored on the organization. Paper is written through `savePrinter`. Backup is kept on the cloud structure printer record. There is no over-cap authorizer, no `ReprintNeedsAuthorization`, and no TCP bridge. Tasks 6.5–6.6 stay unchecked. Units 1–14 stay recorded below.

Work unit 14. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch stays on `feat/printing-http` and targets `feat/printing-documents` (PR https://github.com/CesarJOtizM/blackHole/pull/64), not `main`, and stops at tasks 6.1–6.2. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

Cloud HTTP acceptance. A charge, a pre-bill, a kitchen send, a kitchen resend, and a final cash close return `printed: false` only while the accepted job is `waiting`. The in-memory sale printer stores that job as `waiting`. `PendingDrawerAudit` is gone. `RecordedDrawerAudit` calls `RecordAuditEvent` once, after the charge is saved, and only for a cash tender on a register whose drawer is `present` and whose `printerId` is set. A repeated `commandId` does not enqueue or audit again. Card, a present drawer without a printer, an absent drawer, a rejected charge, and a partial close do not audit `cash.drawer-opened`. Final close enqueues `cash_close` with `kickDrawer: false`. There is no TCP bridge, no physical printer, and no `@blackhole/printing` import. `PrintDocument` is not called. Units 1–13 stay recorded below.

Work unit 13. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 13. It stays on `feat/printing-documents` and targets `feat/printing-tenders`, not `main`, and stops at tasks 5.7–5.8. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

Invoice and offline-receipt payloads. An accepted sales document that carries number, CUFE, and QR returns one `invoice` payload with those three fields and `kickDrawer: false`. A `pending_issuance` document returns one `offline_receipt` whose statement is `This is not an invoice.` and whose `lookupQr` is the lookup QR, also with `kickDrawer: false`. `PrintDocument` does not enqueue and does not call `EnqueuePrintJob`. The payload has no `status`, `commandId`, or `printerId`. No ESC/POS bytes. The invoicing package does not import `@blackhole/printing`. Units 1–12 stay recorded below.

Work unit 12. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 12. It stays on `feat/printing-tenders` and targets `feat/printing`, not `main`, and stops at tasks 5.5–5.6. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

Other tenders and cash close. A charge that includes cash enqueues one `offline_receipt`. Drawer `present` sets `kickDrawer: true` and audits `cash.drawer-opened` once, after the charge is saved. Drawer `absent` enqueues that receipt with `kickDrawer: false` and writes no drawer audit. `card`, `transfer`, `wallet`, `voucher`, `customer_credit`, and `corporate_credit` do not enqueue and do not kick. A mix with no cash does not kick. Final close enqueues `cash_close` with `kickDrawer: false` when the register has a printer. It does not audit `cash.drawer-opened`. A missing printer, a rejected close, and a partial close enqueue nothing. No ESC/POS bytes. The cash-register package does not import `@blackhole/printing`. There is still no open-without-sale action. Units 1–11 stay recorded below.

Work unit 11. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 11. It targets the previous printing slice (unit 10), not `main`, and stops at tasks 5.3–5.4. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

Cash sale and the drawer. A register with drawer `present` and a cash sale enqueues one `offline_receipt` on that register's printer with `kickDrawer: true`, then audits `cash.drawer-opened` once, after the charge is saved. The same `commandId` does not enqueue or audit again. A register with drawer `absent` still enqueues that receipt with `kickDrawer: false`, writes no drawer audit, and `ChargeCheck` has no open-without-sale action. Card and mixed tenders are not kicked here. No ESC/POS bytes. The cash-register package does not import `@blackhole/printing`. Units 1–10 stay recorded below.

Work unit 10. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 10. It targets the previous printing slice (unit 9), not `main`, and stops at tasks 5.1–5.2. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

Kitchen ticket and pre-bill. `TakeOrder` enqueues `kitchen_ticket` with `kickDrawer: false`. `RequestCheck` enqueues `pre_bill` with `kickDrawer: false`. A job that stays `waiting` or becomes `failed` publishes `printer_failed`. A job that is `printed` does not. Orders does not emit ESC/POS and does not import `@blackhole/printing`. The pre-bill `qr` is empty until the portal QR in 1.8. Units 1–9 stay recorded below.

Work unit 9. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. This batch is PR 9. It targets the previous printing slice (unit 8), not `main`, and stops at tasks 4.3–4.4. Not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

Drawer columns in Postgres. `0013_register_drawer.sql` adds `drawer` default `absent` and a nullable `printer_id` on `cash_registers`, and a nullable `printer_id` on `kitchen_stations`. `printer_id` is not a foreign key. The migration does not create a role. `0002_organization.sql` already forces RLS for `organization_app`. A row written before the columns reloads as `absent` and `null`. A saved `present` drawer and printer id round-trip. Units 1–8 stay recorded below.

Drawer on the organization model (unit 8). A cash register stores `drawer: present | absent`. A missing drawer is stored `absent`. One venue may mix a register with a drawer and a register without one. `printerId` on a register and on a kitchen station is not a foreign key.

Cloud queue in Postgres (D-37). PGlite runs `0012_printing.sql` as role `printing_app` with forced RLS. `printers` and `print_jobs` keep a hidden `tenant_id`. The enqueue port still has no `tenantId`. `EnqueuePrintJob` was not rewritten. No SQLite, HTTP, TCP, USB, socket, or bridge.

## Completed tasks

- [x] 1.1 RED `shared/printing/domain/render.test.ts`: 80 mm maps to 48 columns, 58 mm to 32. Pulse `1B-70-00-19-FA` only on a kicked invoice or offline receipt. Any other kick throws `DrawerKickRejected`.
- [x] 1.2 GREEN `domain/render.ts`, package `@blackhole/printing`, `tsconfig.json`, vitest project `printing`. Removed `shared/printing` from the skeleton absent list.
- [x] 1.3 RED `shared/printing/domain/sale-templates.test.ts`: a 58 mm invoice keeps number, CUFE, and QR. An offline receipt says it is not an invoice and includes the lookup QR.
- [x] 1.4 GREEN both templates in `shared/printing/domain/templates.ts`. 80 mm invoice is 48 columns and 58 mm is 32, through `renderTicket`. A kick is present only when the caller sets `kickDrawer`.
- [x] 1.5 RED `shared/printing/domain/operation-templates.test.ts`: kitchen ticket, pre-bill, cash close, transfer, and tips settlement. Both 80 mm (48 columns) and 58 mm (32 columns). None of them emit the drawer pulse.
- [x] 1.6 GREEN those five templates in `shared/printing/domain/templates.ts`. A kick throws `DrawerKickRejected`. Sale templates stay.
- [x] 2.1 RED `shared/printing/application/enqueue-print-job/enqueue-print-job.test.ts`: the job is stored `waiting`. The same `commandId` does not insert a second row. An unknown printer throws `PrinterNotConfigured`. The stored job keeps the kick flag. No socket is opened.
- [x] 2.2 GREEN `enqueue-print-job.ts`, `savePrinter`, and `application/entry-port.ts`.
- [x] 2.3 RED `shared/printing/application/dispatch-print-jobs/dispatch-print-jobs.test.ts`: a memory transport retries, then sends the job to the backup printer, and otherwise marks it `failed`.
- [x] 2.4 GREEN `dispatch-print-jobs.ts`. No TCP/USB.
- [x] 2.5 RED `shared/printing/application/reprint-document/reprint-document.test.ts`: under the limit, `sale.reprint` carries actor, device, document, and time. A null cap throws `ReprintCapUnconfigured`.
- [x] 2.6 GREEN `reprint-document.ts`. No authorizer. No over-cap path.
- [x] 3.1 RED `shared/printing/adapters/postgres/drizzle-print-job-repository.contract.test.ts`: PGlite, `0012_printing.sql`, role `printing_app`, forced RLS. No SQLite. Drizzle is not mocked.
- [x] 3.2 GREEN `schema.ts`, `0012_printing.sql`, and the drizzle repository for `printers` and `print_jobs`. A waiting job round-trips. The same command cannot be inserted twice. A tenant cannot read another tenant's job.
- [x] 4.1 RED `contexts/platform/domain/organization.test.ts` and `contexts/platform/application/update-structure/update-structure.test.ts`: drawer `present` or `absent`, register and station `printerId`, a mixed venue, and a missing drawer stored as `absent`.
- [x] 4.2 GREEN `domain/organization.ts`, `organization-repository.ts`, and `update-structure.ts`. A missing drawer is `absent`. `printerId` is stored as given and is not a foreign key. A missing printer is `null`.
- [x] 4.3 RED `contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts`: `0013_register_drawer.sql` defaults `absent`; `printerId` is nullable. A saved `present` drawer and a printer id round-trip. A row without those columns reloads as `absent` and `null`.
- [x] 4.4 GREEN platform `schema.ts` and `0013_register_drawer.sql`. The Drizzle organization repository writes and reads `drawer` and `printerId` on the register, and `printerId` on the station.
- [x] 5.1 RED `contexts/orders/application/take-order/take-order.test.ts` and `contexts/orders/application/request-check/request-check.test.ts`: a kitchen ticket and a pre-bill are enqueued with `kickDrawer: false`. `failed` or `waiting` publishes `printer_failed`. `printed` does not.
- [x] 5.2 GREEN `contexts/orders/application/ports/printer.ts`, `take-order.ts`, and `request-check.ts`. No ESC/POS bytes. The orders package does not import `@blackhole/printing`.
- [x] 5.3 RED `contexts/cash-register/application/charge-check/charge-check.test.ts`: a present drawer and a cash sale kicks that register's printer and audits `cash.drawer-opened` once. An absent drawer prints, with no kick, no drawer audit, and no open-without-sale.
- [x] 5.4 GREEN `charge-check.ts`, `ports/register-lookup.ts`, and the cash-register `ports/printer.ts`. No ESC/POS bytes. No `@blackhole/printing` import.
- [x] 5.5 RED `contexts/cash-register/application/close-shift/close-shift.test.ts` and the charge tests: `card`, `transfer`, `wallet`, `voucher`, `customer_credit`, and `corporate_credit` do not kick. `cash_close` does not kick. A mix kicks only when it includes cash and the drawer is `present`.
- [x] 5.6 GREEN `charge-check.ts` and `close-shift.ts`. A cash tender on a `present` drawer kicks once. Final close enqueues `cash_close` with `kickDrawer: false`. No ESC/POS bytes. No `@blackhole/printing` import.
- [x] 5.7 RED `contexts/invoicing/application/print-document/print-document.test.ts`: an issued invoice carries number, CUFE, and QR. A `pending_issuance` receipt says it is not an invoice and carries the lookup QR. Neither kicks.
- [x] 5.8 GREEN `print-document.ts` and the invoicing `entry-port.ts`. No enqueue. No `@blackhole/printing` import.
- [x] 6.1 RED `apps/api-cloud/test/http` charge, request-check, take-order, and cash-count: `printed: false` while the job is `waiting`. Drawer audit only after a saved cash tender on a drawer `present`.
- [x] 6.2 GREEN those controllers and `src/composition/application-module.ts`. One `RecordAuditEvent` for `cash.drawer-opened`. No bridge.
- [x] 6.3 RED `apps/api-cloud/test/http/printing.controller.test.ts` and `update-structure.controller.test.ts`: under the cap, one `sale.reprint` with actor, device, document, and time. A null cap is 409 `ReprintCapUnconfigured` and stores nothing. Structure sets drawer, printer, paper, and backup. `safeParse`.
- [x] 6.4 GREEN `shared/contracts/printing.ts`, `shared/contracts/index.ts`, and `apps/api-cloud/src/http/printing.controller.ts`. The audit action is `sale.reprint`.
- [x] 6.5 RED `apps/local-node/test/http/printing.controller.test.ts`: 403 `PrintingRejected`. Nothing stored. No drawer.
- [x] 6.6 GREEN `apps/local-node/src/http/printing.controller.ts` and `apps/local-node/src/composition/application-module.ts`. The new source is allowed in `tools/skeleton/skeleton.test.ts`. No Postgres.

## Work Unit Evidence

### Unit 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project printing` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. Re-run after `pnpm exec biome check --write` on the touched printing files. |
| Skeleton assertion | `pnpm exec vitest run --project skeleton -t "sync, PWAs"` — exit 0. `Tests  1 passed | 9 skipped (10)`. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `renderTicket` does not open files, sockets, or a database. |
| Review line count | 174 insertions, 1 deletion (175 changed lines) in the code slice. Under the 400-line budget. |
| Rollback boundary | `shared/printing/**`, the `printing` project in `vitest.config.ts`, and the `shared/printing` entry removed from `tools/skeleton/skeleton.test.ts`. |

### Unit 2

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project printing` — exit 0. `Test Files  2 passed (2)`. `Tests  11 passed (11)`. |
| Typecheck | `pnpm exec tsc -b shared/printing --pretty false` — exit 0. |
| Runtime harness command/scenario and exact result | N/A, pure domain. Templates call `renderTicket` and return text, columns, and pulse. No socket, file, or database. |
| Review line count | 182 insertions, 1 deletion (183 changed lines) against the unit 1 slice. Under the 400-line budget. |
| Rollback boundary | `shared/printing/domain/sale-templates.test.ts`, `shared/printing/domain/templates.ts`, the `./domain/templates` export, the removed `"types": ["node"]` line, and the root `tsconfig.json` reference `{ "path": "shared/printing" }`. |

### Unit 3

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project printing` — exit 0. `Test Files  3 passed (3)`. `Tests  17 passed (17)`. Re-run after `pnpm exec biome check --write` on the two touched domain files. |
| Typecheck | `pnpm exec tsc -b shared/printing --pretty false` — exit 0. |
| Runtime harness command/scenario and exact result | N/A, pure domain. The five templates call `renderTicket` and return text, columns, and a null pulse. No socket, file, database, or HTTP. |
| Review line count | 359 insertions, 5 deletions (364 changed lines) against the unit 2 slice. Under the 400-line budget. |
| Rollback boundary | `shared/printing/domain/operation-templates.test.ts` and `shared/printing/domain/templates.ts`. |

### Unit 4

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project printing` — exit 0. `Test Files  4 passed (4)`. `Tests  22 passed (22)`. Re-run after `pnpm exec biome check --write` on the touched printing files. |
| Typecheck | `pnpm exec tsc -b shared/printing --pretty false` — exit 0. |
| Runtime harness command/scenario and exact result | In-memory `PrinterRepository` and `PrintJobRepository`. `savePrinter` records id and paper. `EnqueuePrintJob` renders the invoice template and stores `waiting`. The same `commandId` returns the first row. An unknown printer throws `PrinterNotConfigured` and inserts nothing. `vi.mock("node:net")` records no `connect` or `createConnection`. No TCP, USB, file, database, or HTTP. |
| Review line count | 383 insertions, 3 deletions (386 changed lines) against the unit 3 slice. Under the 400-line budget. |
| Rollback boundary | `shared/printing/application/**`, the `./application/entry-port` export, the `#application/*` and `#application/enqueue-print-job/*` import patterns, and `"include": ["domain", "application"]`. |

### Unit 5

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project printing` — exit 0. `Test Files  5 passed (5)`. `Tests  28 passed (28)`. `pnpm exec biome check --write` on the dispatch files reported no further fixes before this run. |
| Typecheck | `pnpm exec tsc -b shared/printing --pretty false` — exit 0. |
| Runtime harness command/scenario and exact result | In-memory `PrintTransport`, `DispatchJobRepository`, and `DispatchPrinterRepository`. `retryLimit` is the number of primary send attempts. After those fail, one send goes to `backupPrinterId`. A successful send stores `printed` and `deliveredPrinterId`. Primary and backup both failing, or no backup, stores `failed`. A missing printer stores `failed` and does not call the transport. A second `execute` does not send a job that is no longer `waiting`. `vi.mock("node:net")` records no `connect` or `createConnection`. `fetch` is not called. No TCP, USB, file, database, HTTP, drawer pulse, or `tenantId`. |
| Review line count | 379 insertions, 0 deletions (379 changed lines) against the unit 4 slice. Under the 400-line budget. |
| Rollback boundary | `shared/printing/application/dispatch-print-jobs/**` and the `#application/dispatch-print-jobs/*` import pattern in `shared/printing/package.json`. |

### Unit 6

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project printing` — exit 0. `Test Files  6 passed (6)`. `Tests  30 passed (30)`. `pnpm exec biome check --write` on the reprint files fixed 2 files before this run. |
| Typecheck | `pnpm exec tsc -b shared/printing --pretty false` — exit 0. |
| Runtime harness command/scenario and exact result | In-memory `ReprintAudit`. A configured cap (`limit: 3`) records one `sale.reprint` with `actorId`, `deviceId`, `document`, and `occurredAt`. `limit: null` throws `ReprintCapUnconfigured` and stores nothing. `vi.mock("node:net")` records no `connect` or `createConnection`. No TCP, USB, file, database, HTTP, authorizer, or `tenantId`. |
| Review line count | 129 insertions, 0 deletions (129 changed lines) against the unit 5 slice. Under the 400-line budget. |
| Rollback boundary | `shared/printing/application/reprint-document/**` and the `#application/reprint-document/*` import pattern in `shared/printing/package.json`. `application/entry-port.ts` is unchanged. |

### Unit 7

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project printing` — exit 0. `Test Files  7 passed (7)`. `Tests  36 passed (36)`. `pnpm exec biome check --write` on the postgres files fixed 3 files before this run. |
| Typecheck | `pnpm exec tsc -b shared/printing --pretty false` — exit 0. |
| Runtime harness command/scenario and exact result | PGlite executes `0012_printing.sql`. Role `printing_app`. RLS is enabled and forced. A waiting invoice round-trips, including pulse `1B 70 00 19 FA`, and the returned job has no `tenantId`. Mutating the inserted object or the returned object leaves the stored row unchanged. A second insert of the same `commandId` throws `This command is already queued.` The same command stored for tenant B stays hidden from tenant A, and the reverse. A printer's paper is hidden the same way. `SET ROLE printing_app` plus `app.tenant_id` and a select without a tenant filter returns only the current tenant's printer and job. No SQLite. Drizzle is not mocked. No HTTP. |
| Review line count | 527 insertions, 3 deletions (530 changed lines) against the unit 6 slice, including the 9-line `pnpm-lock.yaml` importer. Over the 400-line budget. The pair was not split. |
| Rollback boundary | `shared/printing/adapters/postgres/**`, the `#adapters/postgres/*` import, the `drizzle-orm` and `@electric-sql/pglite` catalog dependencies, the `adapters` tsconfig include, and the `shared/printing` importer in `pnpm-lock.yaml`. `EnqueuePrintJob` and `application/entry-port.ts` are unchanged. |

### Unit 8

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project platform organization` — exit 0. `Test Files  3 passed (3)`. `Tests  18 passed (18)`. `update-structure.test.ts` is outside that filename filter, so it was also run: `pnpm exec vitest run --project platform contexts/platform/application/update-structure/update-structure.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. After `pnpm exec biome check --write` on the five touched platform files, both sets together: exit 0. `Test Files  4 passed (4)`. `Tests  24 passed (24)`. |
| Typecheck | `pnpm exec tsc -b contexts/platform --pretty false` — exit 0. Re-run after Biome: exit 0. |
| Runtime harness command/scenario and exact result | In-memory `Organization` and `UpdateStructure`. One venue stores a register `drawer: present` with `printerId` `printer-drawer`, a register `drawer: absent` with `printer-card`, and a register that omits `drawer` stored `absent` with `printer-quiet`. A station stores `printer-bar`. A station and a register that omit `printerId` store `null`. Rename keeps `absent` and `null`. `printerId` is not an `organization_` id and is not looked up. No SQL, HTTP, or printing import. |
| Review line count | 287 insertions, 15 deletions (302 changed lines) against the unit 7 slice. Under the 400-line budget. |
| Rollback boundary | `contexts/platform/domain/organization.ts`, `contexts/platform/domain/organization.test.ts`, `contexts/platform/application/update-structure/`, and `contexts/platform/application/ports/organization-repository.ts`. No `0013_register_drawer.sql`. No `shared/printing`. |

### Unit 9

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project platform drizzle-organization-repository` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. `pnpm exec biome check --write` on the three touched TypeScript files fixed 3 files before this run. The same command was re-run after Biome and exited 0 with the same counts. |
| Typecheck | `pnpm exec tsc -b contexts/platform --pretty false` — exit 0, after Biome. |
| Runtime harness command/scenario and exact result | PGlite executes `0002_organization.sql`, then `0013_register_drawer.sql`. Role `organization_app` already exists; the new file does not create a role. RLS stays enabled and forced from `0002`. `cash_registers.drawer` defaults to `'absent'::text` and is not nullable. `printer_id` is nullable on `cash_registers` and `kitchen_stations`, with no default and no foreign key. A register and a station inserted before `0013` reload as `drawer: absent` and `printerId: null`. A saved register `drawer: present` with `printer-front`, and a station with `printer-grill`, round-trip. No SQLite. Drizzle is not mocked. No HTTP and no `shared/printing`. |
| Review line count | 314 insertions, 0 deletions (314 changed lines) against the unit 8 slice, including the 10-line `0013_register_drawer.sql`. Under the 400-line budget. |
| Rollback boundary | `contexts/platform/adapters/postgres/0013_register_drawer.sql`, `contexts/platform/adapters/postgres/schema.ts`, `contexts/platform/adapters/postgres/drizzle-organization-repository.ts`, and `contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts`. No HTTP, contracts, or `shared/printing`. |

### Unit 10

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project orders take-order request-check` — exit 0. `Test Files  2 passed (2)`. `Tests  15 passed (15)`. `pnpm exec biome check --write` on the eight touched orders files fixed 8 files before this run. The same command was re-run after Biome and exited 0 with the same counts. `pnpm exec vitest run --project orders in-memory-printer` — exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. |
| Typecheck | `pnpm exec tsc -b contexts/orders --pretty false` — exit 0, after Biome. |
| Runtime harness command/scenario and exact result | In-memory `Printer` and `RealtimeHub`. A sent soup enqueues one `kitchen_ticket` with `kickDrawer: false`, station, table, and the note. A resend uses a distinct `commandId` ending in `:resend` and still does not kick. Held steak is not on the pre-bill. The pre-bill enqueues `pre_bill` with quantity, name, amount, total, `qr: ""`, and `kickDrawer: false`. Status `waiting` or `failed` publishes `printer_failed`. Status `printed` publishes only `ids`. A printer-only station still puts the plain UTF-8 ticket on the alert, and that text has no `0x1b` or `0x1d`. No socket, file, database, HTTP, or ESC/POS pulse. |
| Review line count | 422 insertions, 56 deletions (478 changed lines) against the unit 9 slice. Over the 400-line budget. The pair was not split. |
| Rollback boundary | `contexts/orders/application/ports/printer.ts`, `contexts/orders/application/ports/realtime-hub.ts`, `contexts/orders/application/take-order/`, `contexts/orders/application/request-check/`, and `contexts/orders/adapters/memory/in-memory-printer.ts` with its contract test. No `shared/printing`. No `pnpm-lock.yaml`. |

### Unit 11

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project cash-register charge-check` — exit 0. `Test Files  1 passed (1)`. `Tests  13 passed (13)`. `pnpm exec biome check --write` on the ten touched cash-register files fixed 3 files before this run. |
| Typecheck | `pnpm exec tsc -b contexts/cash-register --pretty false` — exit 0, after Biome and the GREEN test run. |
| Runtime harness command/scenario and exact result | In-memory `RegisterLookup`, `Printer`, and `DrawerAudit`. A register `drawer: present` with `printer-front` and a cash sale of 85000 enqueues one `offline_receipt` with `kickDrawer: true` after the ledger insert and the paid mark, then records one `cash.drawer-opened` for that payment, register, and printer. The same `commandId` does not enqueue or audit again. A register `drawer: absent` with `printer-quiet` enqueues one receipt with `kickDrawer: false`, records no drawer audit, and `ChargeCheck` exposes only `constructor` and `execute`. The job text has no `1B 70` and no `\\u001b`. No socket, file, database, HTTP, or ESC/POS pulse. |
| Review line count | 275 insertions, 11 deletions (286 changed lines) against the unit 10 slice, including the new `ports/printer.ts` (15 lines). Under the 400-line budget. |
| Rollback boundary | `contexts/cash-register/application/charge-check/`, `contexts/cash-register/application/ports/printer.ts`, `contexts/cash-register/application/ports/register-lookup.ts`, and the `drawer: "absent"`, `printerId: null` fields on the other in-package register lookup doubles. No `shared/printing`. No `pnpm-lock.yaml`. No HTTP. |

### Unit 12

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project cash-register charge-check close-shift` — exit 0. `Test Files  2 passed (2)`. `Tests  40 passed (40)`. `pnpm exec biome check --write` on the five touched cash-register files fixed 1 file before this run. |
| Typecheck | `pnpm exec tsc -b contexts/cash-register --pretty false` — exit 0, after Biome and the GREEN test run. |
| Runtime harness command/scenario and exact result | In-memory `RegisterLookup`, `Printer`, and `DrawerAudit`. Card plus cash of 85000 on drawer `present` with `printer-front` enqueues one `offline_receipt` with `kickDrawer: true` after the ledger insert and the paid mark, then records one `cash.drawer-opened`. The same `commandId` does not enqueue or audit again. The same mix on drawer `absent` with `printer-quiet` enqueues one receipt with `kickDrawer: false` and records nothing. `card`, `transfer`, `wallet`, `voucher`, `customer_credit`, `corporate_credit`, and card plus transfer enqueue nothing. Final close on a register with a printer enqueues one `cash_close` with `kickDrawer: false` for drawer `present` and drawer `absent`, after the count is saved. A second final close throws `ShiftClosed` and does not enqueue again. No printer, a rejected close, and a partial close enqueue nothing. The job text has no `cash.drawer-opened`, no `1B 70`, and no `\\u001b`. `CloseShift` has no `openDrawer`. No socket, file, database, HTTP, or ESC/POS pulse. |
| Review line count | 303 insertions, 11 deletions (314 changed lines) against the unit 11 slice. Under the 400-line budget. |
| Rollback boundary | `contexts/cash-register/application/charge-check/`, `contexts/cash-register/application/close-shift/`, and `contexts/cash-register/application/ports/printer.ts`. No `shared/printing`. No `pnpm-lock.yaml`. No HTTP. No `apps/api-cloud`. |

### Unit 13

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project invoicing print-document` — exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `pnpm exec biome check --write` on the four touched invoicing files fixed 4 files before this run. |
| Typecheck | `pnpm exec tsc -b contexts/invoicing --pretty false` — exit 0, after Biome and the GREEN test run. |
| Runtime harness command/scenario and exact result | In-memory `PrintDocument` with no ports. An accepted document carrying number, CUFE, and QR returns one `invoice` payload with those values and `kickDrawer: false`. It has no lookup QR, status, command id, or printer id. A `pending_issuance` document returns one `offline_receipt` whose statement is `This is not an invoice.` and whose `lookupQr` is the lookup URL, with `kickDrawer: false`. It has no number, CUFE, or QR. `PrintDocument` exposes only `constructor` and `execute`. The payload text has no `1B 70` and no `\\u001b`. No socket, file, database, HTTP, enqueue, or ESC/POS pulse. |
| Review line count | 189 insertions, 0 deletions (189 changed lines) against the unit 12 slice. Under the 400-line budget. |
| Rollback boundary | `contexts/invoicing/application/print-document/`, the `PrintDocument` export in `contexts/invoicing/application/entry-port.ts`, and the `#application/print-document/*` import in `contexts/invoicing/package.json`. No `shared/printing`. No `pnpm-lock.yaml`. No HTTP. |

### Unit 14

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/charge-check.controller.test.ts apps/api-cloud/test/http/request-check.controller.test.ts apps/api-cloud/test/http/take-order.controller.test.ts apps/api-cloud/test/http/cash-count.controller.test.ts` — exit 0. `Test Files  4 passed (4)`. `Tests  36 passed (36)`. `pnpm exec biome check --write` on the fourteen touched files fixed 11 files before the recorded GREEN run. The same command was re-run after the `PendingSaleJob` type fix and exited 0 with the same counts. |
| Typecheck | `pnpm exec tsc -b apps/api-cloud --pretty false` — exit 0, after the type fix. |
| Runtime harness command/scenario and exact result | Nest `inject` against in-memory ports. No socket, TCP, or `@blackhole/printing`. A cash sale on drawer `present` with `printer-front` returns `printed: false`, stores one `offline_receipt` with `status: "waiting"` and `kickDrawer: true`, and records one `cash.drawer-opened` after the closure is saved. The same `commandId` does not enqueue or audit again. Drawer `absent` stores that receipt with `kickDrawer: false` and writes no drawer audit. Card, a present drawer with `printerId: null`, and a rejected charge enqueue nothing and write no drawer audit. A pre-bill and a kitchen send or resend return `printed: false` while the orders job is `waiting` and `kickDrawer` is false. A failed kitchen printer omits `printed`. Final close stores one `cash_close` with `status: "waiting"` and `kickDrawer: false`. Partial close enqueues nothing. The stored jobs have no `1B 70` and no `\\u001b`. |
| Review line count | 534 insertions, 40 deletions (574 changed lines) in the code slice, before the OpenSpec progress edit. Over the 400-line budget. The pair was not split. |
| Rollback boundary | `apps/api-cloud` HTTP controllers, `src/composition/sale-receipt.ts`, `src/composition/application-module.ts`, `apps/api-cloud/test/http` for charge, request-check, take-order, cash-count, and dining-room session, `apps/api-cloud/test/composition/bootstrap.test.ts`, and the optional `printed` field on `shared/contracts` `chargedCheck`, `cashCountView`, `requestedCheck`, `savedOrderLine`, and `sentCourse`. No `pnpm-lock.yaml`. No `apps/local-node`. No reprint route. |

### Unit 15

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud test/http/printing.controller.test.ts test/http/update-structure.controller.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  11 passed (11)`. `pnpm exec biome check --write` on the ten touched TypeScript files fixed 9 files before this run. |
| Typecheck | `pnpm exec tsc -b apps/api-cloud shared/contracts --pretty false` — exit 0, after `printing.ts` was added to the contracts `include` list. The first run exited 2 with `TS6307` because that file was not listed. |
| Runtime harness command/scenario and exact result | Nest `inject`. No socket and no TCP. A numeric cap of 3 records one `sale.reprint` for `identity_cashier`, `device_register`, `invoice_setp990000001`, at `2026-11-02T18:00:00.000Z`. A null cap returns 409 `ReprintCapUnconfigured` and the audit list stays empty. An empty document returns 400 and stores nothing. `reprintDocumentCommand.safeParse` rejects an empty document and a body that includes `limit`. A station and a register posted with drawer, printer, paper, and backup store `drawer: present`, the printer ids, paper `58` and `80`, and the backup printer ids. `structureCommand.safeParse` rejects paper `letter` and drawer `open`. |
| Review line count | 530 insertions, 3 deletions (533 changed lines) in the code slice, before the OpenSpec progress edit. Over the 400-line budget. The pair was not split. |
| Rollback boundary | `apps/api-cloud` reprint controller, structure controller, composition, package dependency, and the two HTTP tests, `shared/contracts/printing.ts` plus the structure command fields, the `ReprintDocument` export in `shared/printing/application/entry-port.ts`, and the three-line `@blackhole/printing` importer in `pnpm-lock.yaml`. No SQL migration. No `apps/local-node`. No over-cap authorizer. |

### Unit 16

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project local-node test/http/printing.controller.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. |
| Typecheck | `pnpm exec tsc -b apps/local-node --pretty false` — exit 0. |
| Skeleton assertion | `pnpm exec vitest run --project skeleton -t "local-node, when its sources are listed"` — exit 0. `Test Files  1 passed \| 1 skipped (2)`. `Tests  1 passed \| 9 skipped (10)`. |
| Runtime harness command/scenario and exact result | Nest `inject` on the local node. `POST /tenants/organization_tenant_1/reprints` with actor `identity_cashier`, device `device_register`, document `invoice_setp990000001`, and `kickDrawer: true` returns 403 `{ error: "PrintingRejected" }`. `PrintingController` has no constructor arguments. `ApplicationModule` providers and imports stay empty. The printed routes include `reprints` and do not include a drawer route. No repository call, no `sale.reprint` record, no Postgres, SQLite, TCP, or ESC/POS. |
| Review line count | 72 insertions, 0 deletions (72 changed lines) in the code slice, before the OpenSpec progress edit. Under the 400-line budget. |
| Rollback boundary | `apps/local-node/src/http/printing.controller.ts`, `apps/local-node/test/http/printing.controller.test.ts`, the `PrintingController` registration in `apps/local-node/src/composition/application-module.ts`, and the `printing.controller.ts` allowlist line in `tools/skeleton/skeleton.test.ts`. No `apps/api-cloud`. No `pnpm-lock.yaml`. No `@blackhole/printing` dependency. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm exec vitest run --project printing` exit 1. `FAIL shared/printing/domain/render.test.ts` — `Cannot find module '#domain/render.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/render.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |
| 1.3 → 1.4 | `pnpm exec vitest run --project printing` exit 1. `FAIL shared/printing/domain/sale-templates.test.ts` — `Cannot find module '#domain/templates.js'`. `Test Files  1 failed \| 1 passed (2)`. `Tests  6 passed (6)`. | Same command after `domain/templates.ts`: exit 0. `Test Files  2 passed (2)`. `Tests  11 passed (11)`. `pnpm exec tsc -b shared/printing --pretty false` exit 0. |
| 1.5 → 1.6 | `pnpm exec vitest run --project printing` exit 1. `FAIL shared/printing/domain/operation-templates.test.ts` — `renderKitchenTicket is not a function` (same for pre-bill, cash close, transfer, and tips settlement). `Test Files  1 failed \| 2 passed (3)`. `Tests  6 failed \| 11 passed (17)`. | Same command after the five templates: exit 0. `Test Files  3 passed (3)`. `Tests  17 passed (17)`. `pnpm exec tsc -b shared/printing --pretty false` exit 0. Re-run after Biome: both commands exit 0. |
| 2.1 → 2.2 | `pnpm exec vitest run --project printing` exit 1. `FAIL shared/printing/application/enqueue-print-job/enqueue-print-job.test.ts` — `Missing "#application/enqueue-print-job/enqueue-print-job.js" specifier in "@blackhole/printing" package`. `Test Files  1 failed \| 3 passed (4)`. `Tests  17 passed (17)`. | Same command after `enqueue-print-job.ts`, `savePrinter`, and `application/entry-port.ts`: exit 0. `Test Files  4 passed (4)`. `Tests  22 passed (22)`. `pnpm exec tsc -b shared/printing --pretty false` exit 0. Re-run after Biome: both commands exit 0. |
| 2.3 → 2.4 | `pnpm exec vitest run --project printing` exit 1. `FAIL shared/printing/application/dispatch-print-jobs/dispatch-print-jobs.test.ts` — `Cannot find module '#application/dispatch-print-jobs/dispatch-print-jobs.js'`. `Test Files  1 failed \| 4 passed (5)`. `Tests  22 passed (22)`. | Same command after `dispatch-print-jobs.ts` and the `#application/dispatch-print-jobs/*` import: exit 0. `Test Files  5 passed (5)`. `Tests  28 passed (28)`. `pnpm exec tsc -b shared/printing --pretty false` exit 0. Biome had already organized imports; the recorded GREEN run is after that format. |
| 2.5 → 2.6 | `pnpm exec vitest run --project printing` exit 1. `FAIL shared/printing/application/reprint-document/reprint-document.test.ts` — `Cannot find module '#application/reprint-document/reprint-document.js'`. `Test Files  1 failed \| 5 passed (6)`. `Tests  28 passed (28)`. | Same command after `reprint-document.ts` and the `#application/reprint-document/*` import: exit 0. `Test Files  6 passed (6)`. `Tests  30 passed (30)`. `pnpm exec tsc -b shared/printing --pretty false` exit 0. Biome organized imports before that GREEN run. |
| 3.1 → 3.2 | `pnpm exec vitest run --project printing` exit 1. `FAIL shared/printing/adapters/postgres/drizzle-print-job-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-print-job-repository.js'`. `Test Files  1 failed \| 6 passed (7)`. `Tests  30 passed (30)`. | Same command after `schema.ts`, `0012_printing.sql`, and `drizzle-print-job-repository.ts`: exit 0. `Test Files  7 passed (7)`. `Tests  36 passed (36)`. `pnpm exec tsc -b shared/printing --pretty false` exit 0. Biome fixed 3 files before that GREEN run. |
| 4.1 → 4.2 | `pnpm exec vitest run --project platform contexts/platform/domain/organization.test.ts contexts/platform/application/update-structure/update-structure.test.ts` exit 1. `Test Files  2 failed (2)`. `Tests  4 failed \| 13 passed (17)`. The stored station and register had no `printerId` or `drawer`. | `pnpm exec vitest run --project platform organization` exit 0. `Test Files  3 passed (3)`. `Tests  18 passed (18)`. Update-structure file exit 0. `Tests  6 passed (6)`. `pnpm exec tsc -b contexts/platform --pretty false` exit 0. Biome fixed 5 files; the same tests and typecheck were re-run and both exited 0 (`Tests  24 passed (24)` across the four files). |
| 4.3 → 4.4 | `pnpm exec vitest run --project platform drizzle-organization-repository` exit 1. `FAIL` the three new tests — `ENOENT` `0013_register_drawer.sql`. `Test Files  1 failed (1)`. `Tests  3 failed \| 4 passed (7)`. | Same command after `schema.ts`, `0013_register_drawer.sql`, and the repository mapping: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. `pnpm exec tsc -b contexts/platform --pretty false` exit 0. Biome fixed 3 files; the same test command was re-run and exited 0. |
| 5.1 → 5.2 | `pnpm exec vitest run --project orders take-order request-check` exit 1. `Test Files  2 failed (2)`. `Tests  8 failed \| 7 passed (15)`. Enqueued jobs were `[]`. A waiting send published only `ids`. The printer-only alert was missing. | Same command after `ports/printer.ts`, `take-order.ts`, and `request-check.ts`: exit 0. `Test Files  2 passed (2)`. `Tests  15 passed (15)`. `pnpm exec tsc -b contexts/orders --pretty false` exit 0. Biome fixed 8 files; the same test command was re-run and exited 0. |
| 5.3 → 5.4 | `pnpm exec vitest run --project cash-register charge-check` exit 1. `Test Files  1 failed (1)`. `Tests  2 failed \| 11 passed (13)`. Both new tests received `jobs` `[]`. | Same command after `charge-check.ts`, `ports/printer.ts`, and `ports/register-lookup.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  13 passed (13)`. `pnpm exec tsc -b contexts/cash-register --pretty false` exit 0. Biome fixed 3 files before that GREEN run. |
| 5.5 → 5.6 | `pnpm exec vitest run --project cash-register charge-check close-shift` exit 1. `Test Files  2 failed (2)`. `Tests  4 failed \| 36 passed (40)`. Card plus cash, on a present drawer and on an absent drawer, received `jobs` `[]`. Final close with a printer, for both drawers, received `jobs` `[]`. | Same command after `includesCash`, the `cash_close` enqueue, and the `SaleReceiptJob` union: exit 0. `Test Files  2 passed (2)`. `Tests  40 passed (40)`. `pnpm exec tsc -b contexts/cash-register --pretty false` exit 0. Biome fixed 1 file before that GREEN run. |
| 5.7 → 5.8 | `pnpm exec vitest run --project invoicing print-document` exit 1. `FAIL contexts/invoicing/application/print-document/print-document.test.ts` — `Cannot find module '#application/print-document/print-document.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `print-document.ts` and the invoicing entry-port export: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. `pnpm exec tsc -b contexts/invoicing --pretty false` exit 0. Biome fixed 4 files before that GREEN run. |
| 6.1 → 6.2 | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/charge-check.controller.test.ts apps/api-cloud/test/http/request-check.controller.test.ts apps/api-cloud/test/http/take-order.controller.test.ts apps/api-cloud/test/http/cash-count.controller.test.ts` exit 1. `Test Files  4 failed (4)`. `Tests  11 failed \| 25 passed (36)`. Responses omitted `printed: false`. `PendingSalePrinter` was not a Nest provider. | Same command after the controllers, `RecordedDrawerAudit`, and the shared printer: exit 0. `Test Files  4 passed (4)`. `Tests  36 passed (36)`. `pnpm exec tsc -b apps/api-cloud --pretty false` exit 0. Biome fixed 11 files before the first GREEN run. The `PendingSaleJob` type was then changed from an interface to a type alias so `tsc -b apps/api-cloud` exited 0, and the same vitest command was re-run and exited 0. |
| 6.3 → 6.4 | `pnpm exec vitest run --project api-cloud test/http/printing.controller.test.ts test/http/update-structure.controller.test.ts` exit 1. `FAIL` `printing.controller.test.ts` — `Cannot find module '#src/http/printing.controller.js'`. `FAIL` the structure test — `expected true to be false` because `paper: "letter"` was accepted. `Test Files  2 failed (2)`. `Tests  1 failed \| 7 passed (8)`. | Same command after the reprint controller, the printing contract, and the structure printer fields: exit 0. `Test Files  2 passed (2)`. `Tests  11 passed (11)`. `pnpm exec tsc -b apps/api-cloud shared/contracts --pretty false` exit 0. Biome fixed 9 files before that GREEN test run. |
| 6.5 → 6.6 | `pnpm exec vitest run --project local-node test/http/printing.controller.test.ts` exit 1. `FAIL` `printing.controller.test.ts` — `Cannot find module '#src/http/printing.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `printing.controller.ts`, the module registration, and the skeleton allowlist: exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. `pnpm exec tsc -b apps/local-node --pretty false` exit 0. `pnpm exec vitest run --project skeleton -t "local-node, when its sources are listed"` exit 0. `Tests  1 passed \| 9 skipped (10)`. |

## Deviations from Design

Unit 1 had no design deviation. Widths are 48 and 32. The pulse bytes are `1B 70 00 19 FA` and are returned only when `kickDrawer` is true on `invoice` or `offline_receipt`. Kitchen ticket, pre-bill, cash close, transfer, and tips settlement throw `DrawerKickRejected` when a kick is requested. A kick that is false carries no pulse.

`pnpm-workspace.yaml` already includes `shared/*`, so the package is in the workspace without an edit.

Unit 2 adds the root project reference `{ "path": "shared/printing" }` beside `shared/contracts`. Sale templates are text wrapped to the column count from `renderTicket`. The invoice text keeps number, CUFE, and QR. The offline receipt text is `This is not an invoice.` plus the lookup QR. No ESC/POS QR graphic and no spike import. A kick is copied from `renderTicket` only when the caller passes `kickDrawer: true`.

`"types": ["node"]` was removed from `shared/printing/tsconfig.json`. The package has no `@types/node` dependency, so `tsc -b shared/printing` exited 2 with `TS2688`. Adding the dependency would edit the lockfile, which is outside the allowed roots. The domain sources use no Node globals. `shared/contracts` also omits that option.

Unit 3 keeps that sale output. The private helper is now `renderDocument` and covers all seven document names. Kitchen, pre-bill, cash close, transfer, and tips settlement print caller text and wrap it to 48 or 32 columns. A requested kick throws `DrawerKickRejected` before a pulse exists. Transfer and tips take caller payloads. The pre-bill also prints its portal QR, and the cash close prints register, expected, counted, and difference as text. No tax, cash, or transfer rule is calculated here.

Unit 4 stores a `waiting` job and does not send it. `savePrinter` is a function: it writes `{ id, paper }` through `PrinterRepository`. The printer has no host, port, backup, or retry limit. `EnqueuePrintJob` loads that printer, calls the matching template (all seven documents), and inserts one row. A repeated `commandId` returns the stored row, including its original kick flag, and does not render again. `PrinterNotConfigured` is thrown before insert when the printer was never saved. The job status literal is `waiting`; `printed` and `failed` stay with dispatch. The stored job has no `tenantId`. No socket API is imported.

Unit 5 does not extend that stored job or `ConfiguredPrinter`. Dispatch has its own in-memory ports: a waiting-job queue, a printer route (`retryLimit`, `backupPrinterId`), and `PrintTransport`. `retryLimit` is the number of primary attempts, not a clock. The backup is one attempt after those fail. There is no sleep, TCP, USB, HTTP, or drawer pulse. The enqueue row still has no `tenantId`, and this unit adds no SQL. `DispatchPrintJobs` is not re-exported from `application/entry-port.ts`; producers do not call it. A later worker can export it when the bridge exists. An unknown printer is stored `failed` without a transport call, so one missing route does not leave the job `waiting`.

Unit 6 does not invent a reprint count. PRD-01 §7 has none, so the injected cap is `limit: number \| null` and this use case does not store how many reprints already happened. `null` throws `ReprintCapUnconfigured` before `record`. A number means the cap is configured and the caller is already under it; this file does not compare a consumption count and does not contain an over-cap branch, an authorizer, or `ReprintNeedsAuthorization`. The audit action is the string `sale.reprint`. The platform permission catalog is not imported. The narrow port carries `actorId`, `deviceId`, `document`, and `occurredAt`. It has no `tenantId`, `authorizerId`, or `siteId`, and it does not call `RecordAuditEvent`. `ReprintDocument` is not re-exported from `application/entry-port.ts`. It does not call `EnqueuePrintJob` or `DispatchPrintJobs`. The spec sentence "it prints" stays with the existing queue; this unit's accepted effect is the audit record.

Unit 7 keeps that port. `PrintJob` and `ConfiguredPrinter` still have no `tenantId`. Each drizzle repository takes the tenant in its constructor and sets `app.tenant_id` for `printing_app`, the same hidden-tenant shape as the other forced-RLS tables. The ticket text column is `body`. The pulse is a nullable jsonb array of bytes because this Drizzle version has no `bytea` column helper. `print_jobs.status` allows `waiting`, `printed`, and `failed`; this repository only writes and reads `waiting`. The role is granted `SELECT` and `INSERT` only. `pnpm-lock.yaml` gained the `shared/printing` importer for the existing catalog versions of `drizzle-orm` and `@electric-sql/pglite`. That file is outside the allowed edit roots; the package cannot resolve those modules without it. `tsconfig.json` points `typeRoots` at the existing `@types/node` store so `node:fs` typechecks without a new `@types/node` dependency.

Unit 8 stores the drawer on the organization aggregate. `present` and `absent` are the only stored values. An omitted `drawer` becomes `absent` inside `addCashRegister`. An omitted `printerId` becomes `null`. The identifier is copied as given and is not checked against `organization_` and not resolved as a printer row. Rename changes the name only, so the drawer and printer stay. The snapshot on `OrganizationChanged` carries both fields. At the end of unit 8 the Drizzle organization repository still rebuilt a register from `id`, `venueId`, and `name`. The in-memory repository keeps the aggregate. The printing package was not imported.

Unit 9 stores those fields on the Postgres row. `0013_register_drawer.sql` adds `drawer text NOT NULL DEFAULT 'absent'` and nullable `printer_id` on `cash_registers`, plus nullable `printer_id` on `kitchen_stations`. A check allows only `present` and `absent`. There is no foreign key and no new role. The existing `organization_app` grants and forced RLS cover the new columns. The Drizzle repository writes and reads `drawer` and `printerId` for a register, and `printerId` for a station. A stored drawer outside those two values throws `Stored drawer is not supported.` The contract opens `0013` after `0002`. A row inserted before the columns reloads as `absent` and `null`. A saved `present` drawer and printer id round-trip. No HTTP, contracts, or `shared/printing`.

Unit 10 enqueues through the orders `Printer` port. `TakeOrder` submits one `kitchen_ticket` per routed line, `kickDrawer: false`, and does not call `shared/printing`. `RequestCheck` submits one `pre_bill` for lines that are not `held`, with `qr: ""` because the portal QR is 1.8. `waiting` and `failed` publish `printer_failed`. `printed` does not. A station with a screen omits the ticket text. A printer-only station still attaches the existing plain `KitchenTicket` text, which has no ESC/POS pulse. The orders package does not depend on `@blackhole/printing`: that workspace link would edit `pnpm-lock.yaml`, which is outside the allowed roots. Composition that calls the printing entry port stays with tasks 6.1–6.2. `PrinterFailed.lineId` and `stationId` are optional so a pre-bill alert does not invent a station.

Unit 11 enqueues the cash receipt through the cash-register `Printer` port. A cash sale is a charge whose every tender method is `cash`. `drawer: present` sets `kickDrawer: true` on that register's `printerId` and, after `insert` and `markPaid`, records one `cash.drawer-opened` with the payment id, the register id, and the printer id. `drawer: absent` still enqueues `offline_receipt` with `kickDrawer: false` and records nothing. A repeated `commandId` returns the stored charge and does not enqueue again. The job has no number, CUFE, lookup QR, or pulse. Card, transfer, wallet, voucher, customer credit, corporate credit, and a mix that includes cash do not enqueue and do not kick. That matrix stays with tasks 5.5–5.6. `ChargeCheck` has no open-without-sale method. A null `printerId` does not enqueue. The package does not import `@blackhole/printing`.

Unit 13 keeps the payload in invoicing. `pending_issuance` is the offline receipt, and it requires a non-empty `lookupQr`. The statement on that payload is `This is not an invoice.` An accepted document with number, CUFE, and QR is the invoice payload; a lookup QR passed with it is not copied. `kickDrawer` is the literal `false` on both. Any other document throws `SalesDocumentNotPrintable`. There is no printer port and no call to `EnqueuePrintJob`. The package does not depend on `@blackhole/printing`. The ESC/POS template that prints the same sentence stays in `shared/printing`.

Unit 14 keeps the cloud on the existing in-memory printer ports. `api-cloud` does not import `@blackhole/printing` and does not edit `pnpm-lock.yaml`. `PendingSalePrinter` records each sale or close job as `waiting`. `CloseShift` receives that printer, so a final close enqueues `cash_close` with `kickDrawer: false`. `RecordedDrawerAudit` is the only new `RecordAuditEvent`. It runs inside `ChargeCheck`, after the ledger insert, and only when the use case asks for `cash.drawer-opened`. The controller still records `sale.charge` and does not record the drawer a second time. The session scope travels on `AsyncLocalStorage` because the drawer port has no actor. `printed: false` is optional on the response schemas and is set only when the job accepted by that request is `waiting`. A failed kitchen job omits it. `PrintDocument` is not called: the charge response is the queued closure, not an invoice or offline-receipt payload. No ESC/POS bytes are rendered in `api-cloud`. No reprint route and no structure fields `drawer`, `printerId`, paper, or backup.

Unit 15 exports `ReprintDocument` and leaves its execute path unchanged. The HTTP cap is injected. `null` is 409 `ReprintCapUnconfigured` and writes no audit. A number records one `sale.reprint`. The body cannot carry `limit`. Structure `safeParse` now keeps drawer, `printerId`, paper, and `backupPrinterId`. Drawer and printer id stay on the organization. Paper goes through `savePrinter`. Backup stays on the in-memory `StructurePrinters` record because `ConfiguredPrinter` and `0012_printing.sql` have no backup column and the organization aggregate has no backup field. No migration was added. There is no TCP bridge and no over-cap authorizer.

Unit 16 rejects `POST /tenants/:tenantId/reprints` with 403 `PrintingRejected`. The handler has no constructor, so it cannot call a repository or open a drawer. `routePermissions` names `sale.reprint` and the handler does not record that audit. `ApplicationModule` still has no providers and no imports. The node package does not depend on `@blackhole/printing`. Biome's only finding on the touched files was CRLF versus LF. Those files stay CRLF, matching the other local-node sources. `biome check --write` was not applied, because it would rewrite `tools/skeleton/skeleton.test.ts` and `application-module.ts` beyond the allowlist line.

Unit 12 treats a charge as cash when any tender method is `cash`. Drawer `present` still kicks and audits once after the save. Drawer `absent` still prints with `kickDrawer: false` and writes no drawer audit. A charge with no cash tender does not enqueue. A cash tip on a non-cash tender does not kick. `SaleReceiptJob` is now `offline_receipt` or `cash_close`. The `cash_close` variant types `kickDrawer` as `false`. Final close enqueues that job with `commandId` equal to the count id, after the count is saved, when the injected printer is present and the register `printerId` is set. Partial close, a rejected close, and a null `printerId` enqueue nothing. The job has no register, expected, counted, difference, number, CUFE, or QR. `CloseShift` takes the printer as an optional third argument that defaults to `null`, so `apps/api-cloud/src/composition/application-module.ts` still constructs it with two arguments. That file is outside the allowed roots and was not edited. A null port enqueues nothing. There is still no open-without-sale action. The package does not import `@blackhole/printing`.

## Issues Found

Unit 7 is 530 changed lines, over the 400-line review budget. The RED/GREEN pair was not split. `pnpm-lock.yaml` is outside the allowed edit roots and now contains the `shared/printing` importer (9 lines). No other file outside `shared/printing` and this change folder was edited for the queue.

Unit 8 is 302 changed lines, under the 400-line budget. `apps/api-cloud/test/http/update-structure.controller.test.ts` still expects a kitchen station without `printerId`. That file is outside the allowed roots and was not edited. The HTTP structure schema still strips `drawer` and `printerId` until tasks 6.3–6.4.

Unit 9 is 314 changed lines, under the 400-line budget. Postgres now stores the drawer columns. The HTTP structure schema still strips `drawer` and `printerId` until tasks 6.3–6.4. That controller test was not edited.

Unit 10 is 478 changed lines, over the 400-line budget. The RED/GREEN pair was not split. `InMemoryPrinter.fail` still maps to status `failed`, so the existing cloud send test can keep setting `fail` without a new constructor argument on `TakeOrder`.

Unit 11 is 286 changed lines, under the 400-line budget. At the end of unit 11, a mixed tender that includes cash does not kick. Unit 12 changes that.

After unit 11, the cloud composition was updated so `tsc -b apps/api-cloud` passes. `RequestCheck` receives the orders printer and the realtime hub. `ChargeCheck` receives `PendingSalePrinter` and `PendingDrawerAudit`. Those two classes keep a receipt at `waiting` and do not write `cash.drawer-opened`. `OrganizationRegisterDirectory` now returns `drawer` and `printerId`. The HTTP slice (6.1–6.2) still has to enqueue through `@blackhole/printing` and record the audit.

Unit 12 is 314 changed lines, under the 400-line budget. `CloseShift` still defaults its printer to `null`, so a cloud close does not enqueue `cash_close` until tasks 6.1–6.2 pass the port. `PendingSalePrinter` and `PendingDrawerAudit` stay. `SaleReceiptJob` now includes `cash_close` with `kickDrawer: false`, which that pending printer already accepts. `apps/api-cloud` was not edited.

Unit 13 is 189 changed lines, under the 400-line budget. `PrintDocument` is exported from the invoicing entry port and is not called by HTTP or by the cloud composition. Those callers stay with tasks 6.1–6.6. `apps/api-cloud` was not edited. `pnpm-lock.yaml` was not edited.

Unit 14 is 574 changed lines in the code slice (534 insertions, 40 deletions), over the 400-line budget. The RED/GREEN pair was not split. `apps/api-cloud/test/composition/bootstrap.test.ts` already expected `RequestCheck` to inject only the dining room and the clock, and its provider list ends before the invoicing providers the module already registers. That equality failure is older than this unit. This unit updates the `ChargeCheck` inject list and adds `PendingSalePrinter` to that expectation. `ChargeCheck`, `RequestCheck`, and `TakeOrder` constructor shapes are unchanged. `pnpm-lock.yaml` was not edited.

Unit 15 is 533 changed lines in the code slice (530 insertions, 3 deletions), over the 400-line budget. The RED/GREEN pair was not split. `ReprintDocument` is exported from `application/entry-port.ts`. Its execute path is unchanged. A null cap still throws `ReprintCapUnconfigured` before `record`. There is no over-cap branch. Paper is stored by `savePrinter`. `ConfiguredPrinter` and `0012_printing.sql` `printers` have no backup column, and the organization aggregate has no backup field. Backup is kept on `StructurePrinters` in `api-cloud`, beside the saved paper. No SQL migration was added. The structure HTTP test that expected a kitchen station without `printerId` now expects `printerId: null`, which the aggregate already stores. `apps/local-node` was not edited. `tools/skeleton/skeleton.test.ts` was not edited.

Unit 16 is 72 changed lines in the code slice (72 insertions, 0 deletions), under the 400-line budget. The RED/GREEN pair was not split. `apps/api-cloud` and `pnpm-lock.yaml` were not edited. The pre-existing line-ending stat noise under orders, platform, `shared/printing`, and `tools/delivery` was left untouched.

## Remaining Tasks

None. Tasks 6.5 and 6.6 were the last tasks. Verify has not run. The change is not archived.

## Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 16. The local node rejects printing. On `feat/printing-node`, base = `feat/printing-reprint`, not `main`
- Boundary: tasks 6.5 and 6.6 only. The RED/GREEN pair was not split.
- Estimated review budget impact: 72 changed lines in this slice (72 insertions, 0 deletions), before the OpenSpec progress edit. Under the 400-line budget. The change forecast stays High. `size:exception` was not granted.

## Status

32/32 tasks complete. Ready for verify. Not verified. Apply remains partial until verify. Not archived.
