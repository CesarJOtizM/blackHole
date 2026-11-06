```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e2d458fffad7ec8f0a0fc78dc533cf88aec3a9e38840ee74e3dadc78ff9558b0
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 11/11
scenarios: 20/22
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:f24965478545f1ee87375bde96e51560eec8856a420fe8a7e0079bbbf7588e9b
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:1de08e7c59b5fe34b6c30da5e43ca23050ae4d9ac4ebba35f75abec87805234c
lint_command: pnpm exec biome check
lint_exit_code: 1
lint_output_hash: sha256:100f8ad79468a6fc94ab33910febcf7933d72c4006749230c5cd338e8c7b3a11
architecture_command: pnpm architecture
architecture_exit_code: 0
architecture_output_hash: sha256:9e647edb2066a7237f40d29c006a3af64fee6e3e05cabffb53f2a9a40de1e156
environment_flake_evidence: "pnpm test local exited 0 (226 files, 1650 passed, 0 failed, 0 skipped, 0 timed out, 62.67s). The 5s Postgres contract timeout did not appear. No isolated rerun was executed."
archive_allowed: true
artifact_hashes:
  proposal: sha256:24c634a07152972ae4feab09732a1e4b3c1e10047774210d401a324e54bf5946
  spec_authorization: sha256:0da31a75f9e041d530da65144f462355cbb6c239389fa84c82aa6c2ae2cac462
  spec_sensitive_actions: sha256:fa8e58d8505d13d174ab8710144e4aa40ffa46708280daa9380df4ca9609034e
  design: sha256:e46d5d073e7553f7b23f695f6914943e75aedbdd69e4cf6697d119fdb3a2aebc
  tasks: sha256:e5d24628c0a3f80c9d3e93c92ad83f7d220d37e9bc8f01516c6a90d3a102e2fd
```

## Verification Report

**Change**: p1-07-anti-theft-controls
**Version**: N/A
**Mode**: Standard (`strict_tdd: false`; `strict-tdd-verify.md` no se cargó)
**Checkout**: `master` en `27e730779e56470a5fa0566492d7c4d8e4c3c98d` (`27e7307`). Esta corrida no hizo fetch. No se editó código ni specs. No se archivó el cambio. No se creó commit.

Los hashes de salida son SHA-256 de los bytes de stdout seguidos de los bytes de stderr de cada comando. El ruido del perfil de PowerShell queda fuera de esas capturas. `evidence_revision` es el SHA-256 de esas cuatro capturas concatenadas en este orden: `pnpm test`, `pnpm typecheck`, `pnpm exec biome check`, `pnpm architecture`. La ejecución fue otra: `pnpm typecheck`, luego `pnpm test`, luego `pnpm exec biome check`, luego `pnpm architecture`. `artifact_hashes` son los blobs de `HEAD` (LF).

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 25 |
| Tasks complete | 25 |
| Tasks incomplete | 0 |

Las tareas 1.1 a 7.1 están marcadas en `tasks.md`. No hay casillas abiertas. La verificación completa sí corrió. `apply-progress.md` dice 25/25. `state.yaml` sigue en `status: tasked`, con `apply: pending`, `verify: pending` y `archive: pending`.

### Build & Tests Execution

**Build**: pasado (`pnpm typecheck`, exit 0). Stdout vacío. Stderr: pnpm resolvió el lockfile, instaló 46 paquetes ya presentes en el almacén, avisó que hay agent skills de `@tanstack/react-router` pendientes de `pnpm approve`, y cerró con `$ tsc -b`. `git status` no muestra cambios rastreados después de esa corrida.

```text
pnpm typecheck
exit 0
build_output_hash: sha256:1de08e7c59b5fe34b6c30da5e43ca23050ae4d9ac4ebba35f75abec87805234c
```

**Tests**: pasados. 226 archivos, 1650 passed, 0 failed, 0 skipped. Exit 0. Duración 62.67s. El stdout no contiene `FAIL` ni `timed out`.

```text
pnpm test
$ vitest run
Test Files  226 passed (226)
Tests  1650 passed (1650)
Duration  62.67s
exit 0
test_output_hash: sha256:f24965478545f1ee87375bde96e51560eec8856a420fe8a7e0079bbbf7588e9b
```

**Lint**: `pnpm exec biome check` exit 1. 648 errores, 1 warning. 629 diagnósticos quedaron ocultos. Los 20 que Biome imprimió son formato CRLF en `package.json` y `tsconfig.json` (admin-web, api-cloud, customer-portal, local-node, venue-app, attendance, cash-register, invoicing, orders, platform, y el `package.json` de la raíz). El warning no salió entre los diagnósticos impresos.

**Architecture**: pasado (exit 0). `no dependency violations found (712 modules, 2397 dependencies cruised)`. Sigue el aviso conocido de TypeScript 7 (`typescript >=2.0.0 <7.0.0`). El exit code es 0.

**Coverage**: no se recolectó. No hay proveedor de cobertura en esta corrida.

### Flake de contratos Postgres

Esta corrida no entró en el caso condicional. `pnpm test` salió 0. No hubo timeouts de 5 s, ni archivos fallidos, ni un conjunto que cambiar entre corridas dentro de esta verificación. No se reescribió el exit a otro valor y no hubo reejecución aislada. El exit registrado es el de esta corrida.

### Spec Compliance Matrix

Un escenario es compliant cuando su prueba de cobertura pasó en el `pnpm test` oficial. Los dos escenarios de nube híbrida quedan diferidos bajo D-37. No son fallo y no son blocker. No se marcan como pass. La spec juzgada es la de `HEAD`.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Authorization Bound to One Operation | Value matches | `contexts/platform/domain/authorization.test.ts` > given an approved discount of 10 percent on account A, when that discount is consumed, then the grant is consumed once. También `contexts/orders/application/apply-discount/apply-discount.test.ts` > given an approved discount of 10 percent on account A, when the cashier applies 10 percent on account A, then the grant is consumed before the audit and the prices stay | COMPLIANT |
| Authorization Bound to One Operation | Value increased | `contexts/platform/domain/authorization.test.ts` > given an approved discount of 10 percent on account A, when 20 percent is consumed, then the grant stays unconsumed. También `contexts/orders/application/apply-discount/apply-discount.test.ts` > given an approved discount of 10 percent on account A, when the cashier applies 20 percent, then the discount is rejected | COMPLIANT |
| Shift Accumulators From Executed Operations | Courtesy cap reached | `contexts/platform/domain/evaluate.test.ts` > given an administrator with a courtesy cap of 100000 and 90000 used, when they grant 20000 more, then authorization is required. También `contexts/orders/application/apply-courtesy/apply-courtesy.test.ts` > given an admin with a courtesy cap of 100000 and 90000 used, when she grants 20000, then the courtesy waits for another person | COMPLIANT |
| Shift Accumulators From Executed Operations | Rejected request not counted | `contexts/platform/application/count-executed-operations/count-executed-operations.test.ts` > given a failed PIN, a denied decision, and an unchanged audit beside executed operations, when the shift is counted, then only the successful audits count | COMPLIANT |
| Authorization by Operating Mode | Hybrid offline PIN | D-37 y el diseño dejan fuera PIN sin internet, SQLite, outbox, cola de nodo y sync posterior | DEFERRED |
| Authorization by Operating Mode | Cloud mode cut | `apps/local-node/test/http/sensitive-actions.controller.test.ts` > given each sensitive route, when the node is called, then the response is 403 SensitiveActionRejected and nothing is stored. Incluye el void | COMPLIANT |
| Blocked Without Authorization | Direct call blocked | `apps/api-cloud/test/http/apply-discount.controller.test.ts` > given a kitchen chief session and an open shift, when POST /checks/:checkId/discount is injected, then the response is 200, the line price stays, and no discount is audited. También `contexts/orders/application/apply-discount/apply-discount.test.ts` > given the cashier is denied a discount, when she applies 10 percent, then the account stays | COMPLIANT |
| Blocked Without Authorization | Authorized by PIN | `contexts/orders/application/apply-courtesy/apply-courtesy.test.ts` > given a courtesy needing authorization, when a supervisor enters her PIN and a reason, then the audit records requester, authorizer, reason and value. El PIN lo resuelve `operate-authorization.test.ts`; esta prueba consume el grant y audita actor, autorizador, motivo y valor | COMPLIANT |
| Voids | Within waiter cap | `contexts/orders/application/void-line/void-line.test.ts` > given a waiter with 2 of 3 allowed voids this shift, when she voids a sent line not yet started, then the line leaves the account | COMPLIANT |
| Voids | After kitchen started | `contexts/orders/application/void-line/void-line.test.ts` > given a line in preparation or later, when the waiter voids it without authorization, then the line stays | COMPLIANT |
| Discounts, Courtesies and Price Changes | Discount over cap | `contexts/orders/application/apply-discount/apply-discount.test.ts` > given a cashier with a 5 percent cap, when she applies 10 percent, then the discount waits and the account stays. También `contexts/platform/domain/evaluate.test.ts` > given a cashier with a 5 percent discount cap, when they apply 10 percent, then authorization is required and the cap is returned | COMPLIANT |
| Discounts, Courtesies and Price Changes | Price change | `contexts/orders/application/change-price/change-price.test.ts` > given an authorized price change on a line, when applied, then only that line changes and the site price stays | COMPLIANT |
| Edits After Pre-bill and Table Transfer | Edit after pre-bill | `contexts/orders/application/take-order/take-order.test.ts` > given a printed pre-bill, when a waiter adds a product without sale.edit-printed-check, then the account stays unchanged | COMPLIANT |
| Edits After Pre-bill and Table Transfer | Supervisor transfers table | `contexts/orders/application/reassign-check/reassign-check.test.ts` > given a supervisor allowed to transfer, when she moves table 5 to waiter W, then W owns it and the change is audited | COMPLIANT |
| Reopen and Payment Method Change | Change payment method | `contexts/cash-register/application/change-tender/change-tender.test.ts` > given an authorized change from cash to card, when it is applied, then the open shift records a reversal and a new payment linked to the original | COMPLIANT |
| Reopen and Payment Method Change | Closed shift | `contexts/cash-register/application/reopen-paid-account/reopen-paid-account.test.ts` > given the sale belongs to a closed shift, when the account is reopened with authorization, then the reversal lands on the open shift and points at the original payment | COMPLIANT |
| Drawer Without Sale | Authorized opening | `contexts/cash-register/application/open-drawer/open-drawer.test.ts` > given a supervisor grant for this register, when the cashier opens the drawer without a sale, then one drawer_open job kicks the drawer and cash.drawer-opened is audited once | COMPLIANT |
| Drawer Without Sale | Unauthorized opening | `contexts/cash-register/application/open-drawer/open-drawer.test.ts` > given no authorization, when the cashier requests an opening, then no drawer command is sent | COMPLIANT |
| Control Reports | Authorized void listed | `contexts/platform/application/read-control-report/read-control-report.test.ts` > given successful sensitive audits, when an owner with audit.view opens the control report, then it lists voids, discounts, courtesies, cash differences, openings, and accounts reopened or edited after the pre-bill. La fila de anulación trae usuario, autorizador, motivo y "after kitchen" | COMPLIANT |
| Control Reports | Offline action | D-37 y el diseño dejan fuera el void en nodo híbrido offline y su aparición única tras el sync | DEFERRED |
| Unusual Behavior Alerts | Too many voids | `contexts/platform/application/detect-unusual-behavior/detect-unusual-behavior.test.ts` > given six voids after kitchen, six discounts, six pairs, and six failed PINs, when detectors run, then each pattern alerts without the PIN | COMPLIANT |
| Unusual Behavior Alerts | Self-authorization | `contexts/platform/application/operate-authorization/operate-authorization.test.ts` > given a sole authorizer and the shift flag, when they resolve their own request, then it is self-authorized and noticed. La solicitud es `sale.void-after-kitchen` y la resolución queda `selfAuthorized`. También `detect-unusual-behavior.test.ts` > given the published seed and one self-authorized void, when detectors run, then only that self-authorization alerts | COMPLIANT |

**Compliance summary**: 20/22 escenarios compliant. 2 diferidos (Hybrid offline PIN y Offline action, D-37), fuera del conjunto de fallos. 0 partial. 0 untested. 0 failing. 11/11 requisitos con sus escenarios de alcance compliant.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Authorization Bound to One Operation | Implementado | Un 10 % sobre la cuenta A se consume una vez. Un 20 % deja el grant sin consumir y el descuento no se aplica. |
| Shift Accumulators From Executed Operations | Implementado | 90.000 de 100.000 exigen autorización para una cortesía de 20.000. Un PIN fallido, una decisión negada y un audit sin cambio no entran en el conteo. |
| Authorization by Operating Mode | Nube cubierta / híbrido diferido | El nodo responde 403 `{ error: "SensitiveActionRejected" }` y no guarda. El PIN offline y el sync posterior no están construidos. |
| Blocked Without Authorization | Implementado | Una sesión sin permiso deja la cuenta quieta y no audita el descuento. La cortesía autorizada guarda actor, autorizador, motivo y valor. |
| Voids | Implementado | Con 2 de 3 anulaciones, una línea `sent` sale de la cuenta. Una línea en preparación se queda. |
| Discounts, Courtesies and Price Changes | Implementado | Un 10 % sobre un tope de 5 % espera y no cambia la cuenta. El precio autorizado cambia esa línea y deja el precio del sitio. |
| Edits After Pre-bill and Table Transfer | Implementado | Sin `sale.edit-printed-check` la cuenta no gana la línea. El traslado deja la mesa 5 en el mesero W y lo audita. |
| Reopen and Payment Method Change | Implementado en memoria | Efectivo a tarjeta deja reversa y pago nuevo ligados al original, en el turno abierto. El turno cerrado no se reescribe. |
| Drawer Without Sale | Implementado | El grant encola `drawer_open` con `kickDrawer: true` y audita `cash.drawer-opened`. Sin autorización no hay comando. |
| Control Reports | Nube cubierta / híbrido diferido | El reporte lista la anulación posterior a cocina con usuario, autorizador, motivo y momento. La fila offline no está. |
| Unusual Behavior Alerts | Implementado | Seis anulaciones posteriores a cocina alertan. La autoautorización de un void queda marcada en la resolución y el detector emite la alerta. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Caso de uso llama al entry port antes de escribir. Consume primero | Sí | Los pasos observados en las pruebas son count, evaluate y, si hace falta, consume antes de mutar. |
| `drawer_open` en el `Printer` de cash-register. `kickDrawer: true`. Sin importar `@blackhole/printing` | Sí | `shared/printing` no cambia. El diseño corrige a la propuesta, que lo marcaba como modificado. |
| Reversas en el turno abierto, ligadas al pago | Sí en el caso de uso | Las pruebas de reapertura y cambio de medio pasan. El adaptador Drizzle de caja sigue guardando solo movimientos. |
| Conteos desde audits exitosos. El cliente no manda el total | Sí | `CountExecutedOperations` ignora PIN fallido, denegado y estado sin cambio. |
| Semilla de voids en 5. Toda autoautorización alerta. Las otras semillas son 5 y la sede puede cambiarlas (D-31) | Sí | El detector usa 5 para voids y acepta umbrales de sede para descuento, pareja y PIN. |
| Zod 4 `safeParse`. El nodo responde 403 y no inserta (D-37) | Sí | `sensitiveActionEnvelope` valida con el esquema. El controlador del nodo no tiene constructor ni providers. |
| `pnpm architecture` sin violar el entry port | Sí | 712 módulos, 0 violaciones. |
| Alertas desde el stream de audit. `audit.view` | Sí, con límite | El reporte y el detector leen audits. La tabla SQL `authorization_alerts` existe y es insert-only, y el detector no escribe en ella. |

### Issues Found

**CRITICAL**:

Ninguno.

**WARNING**:

- `pnpm exec biome check` salió 1. 648 errores de formato y 1 warning. Los 20 diagnósticos impresos son CRLF en `package.json` y `tsconfig.json`. 629 quedaron ocultos, entre ellos el warning. No son reglas de la lógica anti-robo.
- `pnpm architecture` salió 0 y avisó que dependency-cruiser quiere TypeScript `>=2.0.0 <7.0.0`. El parser igual recorrió 712 módulos.
- `state.yaml` deja `apply: pending` y `verify: pending` aunque `tasks.md` y `apply-progress.md` dicen 25/25.
- El repositorio Drizzle de caja sigue persistiendo solo movimientos. Las reversas y el pago de reemplazo viven en el turno en memoria. Las pruebas de la spec pasan contra ese doble.
- `DetectUnusualBehavior` no inserta en `authorization_alerts`. La alerta sale en la respuesta del detector. La tabla SQL queda sin uso en ese camino.
- La propuesta dice que `shared/printing` se modifica. El diseño y el código lo dejan igual. El diseño es el que se siguió.

**SUGGESTION**:

- Los criterios de éxito de la propuesta siguen sin marcar.
- La pregunta abierta del diseño sobre las semillas 5 sigue abierta. El código usa 5 y permite filas de sede.
- Varios cortes de apply superaron 400 líneas sin `size:exception`. Ya están en `master`. Esta verificación no los reabre.

### Verdict

PASS WITH WARNINGS

20/22 escenarios compliant. Los dos escenarios híbridos quedan DEFERRED bajo D-37 y no son blockers. `pnpm test` salió 0 y `pnpm typecheck` salió 0, así que `blockers` es 0 y `critical_findings` es 0. `archive_allowed` es true porque se cumplen `test_exit_code` 0, `build_exit_code` 0, blockers 0 y critical 0. El exit 1 de Biome es warning y no entra en esa cuenta. Esta fase no archivó el cambio.
