```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:89c33653d21df72d6255e427c144fb00c4896fdf687e84b581a8dc75a741a1a8
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 13/14
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:b8d194298ea9a258899d071b6aa6dd3d81272ccf494dbd79f9f4a43088882c49
build_command: pnpm typecheck
build_exit_code: 0
build_output_hash: sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
lint_command: pnpm exec biome check
lint_exit_code: 1
lint_output_hash: sha256:06a090362ce4392351d3fb051dac80e5ba8ea58c9345d922a128c0dc19cfa4a0
architecture_command: pnpm architecture
architecture_exit_code: 0
architecture_output_hash: sha256:4febd50a82fea5598e689194eee4552fcf7d25da866d762fa4eaacbc275e3f9d
ci_test_status: pass
ci_test_run: "41966862437"
ci_test_sha: "881aae6556948c2ce776079434ae29aaa165c976"
environment_flake_evidence: "pnpm test local exited 0 (222 files, 1629 passed, 0 failed, 0 skipped, 0 timed out, 58.04s). No isolated rerun was executed."
archive_allowed: true
artifact_hashes:
  proposal: sha256:d917902b23aab20fa48defe8eca8da0c6019c171cac86da591be13ee15fe1f62
  spec: sha256:8824551b9ab46c472bb4e7835dc600833f0757a3d4e3f10c32548a7703e15305
  design: sha256:01ec9707c0d30b08d188194f3bc05a78af045c70028854735132ad4d2cc34731
  tasks: sha256:4af65ac3efa55afb1c7ac61c04f1d133e5118f39e07cda9bc3e970b279f6ef8b
```

## Verification Report

**Change**: p1-10-tips
**Version**: N/A
**Mode**: Standard (`strict_tdd: false`; `strict-tdd-verify.md` no se cargó)
**Checkout**: `master` en `881aae6556948c2ce776079434ae29aaa165c976`, igual que `origin/master`. Es el merge del PR #111. No se editó código ni la spec. No se archivó el cambio. No se creó commit.

Los hashes de salida son SHA-256 de los bytes de stdout seguidos de los bytes de stderr de cada comando. El ruido del perfil de PowerShell queda fuera de esas capturas. `evidence_revision` es el SHA-256 de esas cuatro capturas concatenadas en este orden: `pnpm test`, `pnpm typecheck`, `pnpm exec biome check`, `pnpm architecture`. Los cuatro comandos corrieron en secuencia, cada uno solo. `artifact_hashes` son los blobs de `HEAD` (LF). En disco esos archivos están en CRLF; `git status` solo marca `openspec/changes/p1-10-tips/specs/tips/spec.md` como modificado.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 15 |
| Tasks complete | 15 |
| Tasks incomplete | 0 |

Las tareas 1.1 a 8.1 están marcadas en `tasks.md`. La verificación completa sí corrió. `state.yaml` deja `apply: done`, `verify: pending` y `archive: pending`. `apply-progress.md` dice 15/15.

### Build & Tests Execution

**Build**: pasado (`pnpm typecheck`, exit 0). Stdout vacío. Stderr: `$ tsc -b`.

```text
pnpm typecheck
exit 0
build_output_hash: sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f
```

**Tests**: pasados. 1629 passed, 0 failed, 0 skipped. Exit 0. Duración 58.04s. Vitest levantó 222 workers. El stdout no contiene `FAIL` ni `timed out`.

```text
pnpm test
$ vitest run
Test Files  222 passed (222)
Tests  1629 passed (1629)
Duration  58.04s
exit 0
test_output_hash: sha256:b8d194298ea9a258899d071b6aa6dd3d81272ccf494dbd79f9f4a43088882c49
```

**Lint**: `pnpm exec biome check` exit 1. 632 errores, 1 warning. 613 diagnósticos quedaron ocultos. Los 20 que Biome imprimió son formato CRLF en `package.json` y `tsconfig.json` (admin-web, api-cloud, local-node, venue-app, customer-portal, attendance, cash-register, invoicing, orders, platform). Ninguno es una regla de lógica de propinas.

**Architecture**: pasado (exit 0). `no dependency violations found (695 modules, 2372 dependencies cruised)`. Sigue el aviso conocido de TypeScript 7 (`typescript >=2 <7`). El exit code es 0.

**Coverage**: no se recolectó. No hay proveedor de cobertura en esta corrida.

**ci_test_status**: `pass`, evidencia aparte del exit local. El job `checks` del workflow `delivery` en el run [41966862437](https://github.com/CesarJOtizM/blackHole/actions/runs/41966862437) terminó `success` para `881aae6556948c2ce776079434ae29aaa165c976`. Ese job ejecuta `pnpm exec biome check .`, `pnpm typecheck`, `pnpm test` y `pnpm architecture`. `release`, `staging` y `production` quedaron `skipped`. El workflow `ci` del run [41966862455](https://github.com/CesarJOtizM/blackHole/actions/runs/41966862455) también está `success`, y su Vitest es un subconjunto (`platform`, `orders`, `attendance`, `api-cloud`, `skeleton`). Ese subconjunto no sustituye a `pnpm test`. `gh pr checks 111` muestra `checks` y los planes de Terraform en `pass`. El PR #111 está `MERGED`.

**environment_flake_evidence**: en esta corrida `pnpm test` salió 0. 222 archivos, 1629 pruebas pasadas, 0 fallos, 0 omitidas, 0 timeouts, 58.04s. No hubo archivos que reejecutar en aislamiento. Este campo no cambia el veredicto. El veredicto sale de esta corrida, con exit 0.

### Spec Compliance Matrix

Un escenario es compliant cuando su prueba de cobertura pasó en el `pnpm test` oficial. El escenario híbrido queda diferido bajo D-37. No es fallo y no es blocker. La spec juzgada es la de `HEAD`. El PR #111 cambió el requisito a "percentage per person" y dejó el WHEN del escenario válido en "waiters 70 % and kitchen 30 %". El árbol de trabajo tiene, sin commit, la línea "employee A 70 % and employee B 30 %". Esa línea no está en master y no se usó como spec fusionada.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Distribution Rule | Valid percentage rule | `contexts/cash-register/application/configure-tip-rule/configure-tip-rule.test.ts` > given employee percentages of 70 and 30, when an allowed caller saves the rule, then those rows are stored and audited as tips.rule-changed | COMPLIANT |
| Distribution Rule | Percentages not summing 100 | `contexts/cash-register/application/configure-tip-rule/configure-tip-rule.test.ts` > given percentages of 60 and 30, when the rule is saved, then it is rejected and nothing is stored | COMPLIANT |
| Common Pool | Mixed methods | `contexts/cash-register/application/settle-tips/settle-tips.test.ts` > given tips of 20000 cash and 30000 card in a day, when an allowed caller settles, then the pool is 50000 by method and sale and tax are left out | COMPLIANT |
| Common Pool | Empty period | `contexts/cash-register/application/settle-tips/settle-tips.test.ts` > given no tips in the period, when settlement is attempted, then it closes with no shares | COMPLIANT |
| Participants From Attendance | Default participants | `apps/api-cloud/test/http/tip-participants.controller.test.ts` > given four workers clocked in during the shift, when settlement starts, then those four are proposed with their worked minutes | COMPLIANT |
| Participants From Attendance | Removal without reason | `contexts/cash-register/application/settle-tips/settle-tips.test.ts` > given a participant remove without a reason, when settlement is attempted, then the change is rejected and nothing is stored | COMPLIANT |
| Deterministic Calculation | Uneven split | `contexts/cash-register/domain/distribute-tips.test.ts` > given an uneven equal tip pool and no tax, when shares are computed, then bases plus residue equal the pool and the run repeats | COMPLIANT |
| Deterministic Calculation | Hours mode with zero hours | `contexts/cash-register/domain/distribute-tips.test.ts` > given a zero-minute hours row, when shares are computed, then that row stays at zero | COMPLIANT |
| Immutable Settlement | Rule changed later | `contexts/cash-register/application/adjust-tip-settlement/adjust-tip-settlement.test.ts` > given a closed settlement and a later venue rule, when an allowed caller adds a participant, then the new row keeps adjustsSettlementId and the original rule snapshot and the closed row stays unchanged | COMPLIANT |
| Immutable Settlement | Attempt to edit | `contexts/cash-register/domain/tip-settlement.test.ts` > given a closed settlement, when a stored share is edited, then the edit is rejected | COMPLIANT |
| Printable Settlement | Print for signatures | `shared/printing/domain/operation-templates.test.ts` > given a tips settlement on 80 mm and 58 mm, when it is rendered, then the methods, rule, residue, shares, and signature lines stay inside the columns and there is no pulse | COMPLIANT |
| Printable Settlement | Printer unavailable | `contexts/cash-register/application/print-tip-settlement/print-tip-settlement.test.ts` > given the main printer is offline, when a backup printer accepts the job, then the screen warns and the drawer stays closed; y > given the main printer is offline, when the job stays queued, then the screen warns and nothing is marked printed | COMPLIANT |
| Settlement Location and Outages | Hybrid outage | D-37 y las tareas dejan fuera SQLite, outbox, cola de nodo, emisión diferida y recibo de contingencia | DEFERRED |
| Settlement Location and Outages | Cloud outage | `apps/local-node/test/http/sensitive-actions.controller.test.ts` > given each sensitive route, when the node is called, then the response is 403 SensitiveActionRejected and nothing is stored. Incluye regla, liquidación, ajuste e impresión | COMPLIANT |

**Compliance summary**: 13/14 escenarios compliant. 1 diferido (Hybrid outage, D-37), fuera del conjunto de fallos. 0 partial. 0 untested. 0 failing. 7/7 requisitos con sus escenarios de alcance compliant.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Distribution Rule | Implementado | `employee_waiter` al 70 y `employee_cook` al 30 se guardan y se auditan como `tips.rule-changed`. Una clave de rol lanza `InvalidTipRoleShare`. `cash.settle-tips` corre antes de la escritura. |
| Common Pool | Implementado | 20.000 efectivo + 30.000 tarjeta = 50.000. `saleCop` e impuesto no se suman. Un período vacío cierra sin partes. |
| Participants From Attendance | Implementado | El inicio propone cuatro trabajadores con minutos. Un alta o una baja sin motivo lanza `ParticipantChangeReasonRequired` antes de escribir. |
| Deterministic Calculation | Implementado | Un pozo igual de 100.000 se repite. Una fila de horas con cero minutos queda en 0 y el pozo cuadra. |
| Immutable Settlement | Implementado | Una regla posterior no reescribe el snapshot cerrado. `editShare` lanza `TipShareEditRejected`. El ajuste es una fila nueva con `adjustsSettlementId`. |
| Printable Settlement | Implementado | 80 mm y 58 mm pintan partes y líneas de firma, con `kickDrawer: false`. Respaldo y cola llevan aviso. |
| Settlement Location and Outages | Nube cubierta / híbrido diferido | El nodo responde 403 `{ error: "SensitiveActionRejected" }` y no registra proveedores de propinas. La liquidación offline híbrida no está construida. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| PostgreSQL solo en api-cloud. El nodo responde 403 y no inserta (D-37) | Sí | Las rutas sensibles de propinas están en `SensitiveActionsController`. |
| Porcentaje por `employeeId`, enteros, suma 100. Sin clave de rol (D-24) | Sí en código | Las pruebas guardan empleados al 70 y 30 y rechazan una clave de rol. El WHEN comprometido en master todavía nombra waiters y kitchen. |
| `sum(baseCop) + residueCop = poolCop`. Los pesos extra siguen el orden de `userId` | Sí | Cubierto por las pruebas de distribución que pasaron. |
| Asistencia por `TipParticipantSource` | Sí | `pnpm architecture` no reportó violaciones. |
| `tips_settlement`, `kickDrawer: false`. El host encola y luego despacha | Sí | La prueba de impresión que pasó encola con el cajón cerrado. |
| Solo `RecordAuditEvent`: `tips.rule-changed`, `tips.settlement-closed`, `tips.settlement-adjusted` | Sí | El diseño no agrega evento de sync para esta entrega. |
| Ajuste append-only con el snapshot original | Sí | Cubierto por la prueba de ajuste que pasó. |
| Reutilizar `cash.settle-tips`. Solo HTTP. Sin apps de UI nuevas | Sí | Esta entrega no construye `admin-web` ni `venue-app`. |
| Día y semana semiabiertos en America/Bogota. El turno es la ventana del llamador | Sí | `tip-period.test.ts` forma parte de los 1629 que pasaron. |
| Zod 4 `.strict()` y `safeParse` | Sí | `shared/contracts/tips.ts` usa `.strict()` en los comandos. |

### Issues Found

**CRITICAL**:

Ninguno.

**WARNING**:

- En `881aae6` el escenario "Valid percentage rule" dice "WHEN they set waiters 70 % and kitchen 30 %". El PR #111 solo quitó "or role" del requisito ("percentage per person"). La redacción "employee A 70 % and employee B 30 %" está en el árbol de trabajo, sin commit, y no forma parte de master. La prueba que pasó guarda `employee_waiter` al 70 y `employee_cook` al 30. Otra prueba rechaza una clave de rol.
- `pnpm exec biome check` salió 1. 632 errores de formato, los impresos son CRLF en JSON y tsconfig. El job de delivery en Ubuntu, con `pnpm exec biome check .`, terminó en success. Ese resultado de CI no sustituye el exit local.
- `pnpm architecture` salió 0 y avisó que dependency-cruiser quiere TypeScript `>=2 <7`. El parser igual recorrió 695 módulos.

**SUGGESTION**:

- La línea de éxito de la propuesta sobre una liquidación firmada en un local real sigue abierta. Esta corrida no tuvo local ni impresora.

### Verdict

PASS WITH WARNINGS

13/14 escenarios compliant. El escenario híbrido queda DEFERRED bajo D-37 y no es blocker. `pnpm test` salió 0 y `pnpm typecheck` salió 0, así que `blockers` es 0 y `critical_findings` es 0. `archive_allowed` es true porque `test_exit_code` local es 0. Esta fase no archivó el cambio.
