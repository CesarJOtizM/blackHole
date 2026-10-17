# TRD-M7 · SaaS comercial

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.4 |
| Fecha | 2026-10-17 |
| Fase | 4 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M7](../prd/PRD-M7-saas.md) |
| Diagramas | [C4 M7](../arquitectura/componentes/c4-m7-saas.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Dónde corre | Solo en la nube (`apps/api-cloud`). No hay copia de planes ni de bolsa en el nodo |
| Alta | Llama al puerto de M0 `CreateOrganization`. No inserta en las tablas de M0 por su cuenta |
| Soporte | Token con `tenant_id` y vencimiento, que evalúa M0. Sin token no hay sesión de cliente |
| Panel de soporte | Vista de `apps/admin-web`, visible con permisos de soporte. No es una app aparte (D-05) |
| Bolsa | Cupo por NIT dentro de la bolsa de la empresa (D-16). El consumo llega por `DocumentConsumed`. La conciliación lee `GET /v2/subscriptions` de esa cuenta. El saldo visible de la empresa es la suma de los cupos |
| Sin saldo | M3 deja pendiente la factura del NIT cuyo cupo llegó a cero. Al recargar ese cupo, M7 llama a M3 `IssuePendingDocuments` para emitir las de motivo "sin saldo" |
| Suscripción | Activa, en gracia, suspendida. El cobro va detrás de `SubscriptionGateway`, distinto de `PaymentGateway` del QR |
| Carga inicial | Archivos en el almacén de objetos. Los casos de uso de menú y recetas son los de M1 y M4 |
| Código | `contexts/saas/domain`, `contexts/saas/application` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `Subscription` | Estados `active`, `in_grace`, `suspended`. De `active` solo pasa a `in_grace`; de `in_grace`, a `suspended` o a `active`; de `suspended`, a `active`. No se borra la empresa al suspender |
| Entidad | `Plan` | Precio por sede. Cambiar el precio no reescribe periodos ya cobrados |
| Agregado | `DocumentWallet` | Saldo de la empresa igual a la suma de los cupos por NIT (D-16). El consumo nombra NIT y sede, y baja el cupo de ese NIT. El saldo no baja de un registro que no sea un documento |
| Entidad | `BalanceAlert` | Niveles `yellow`, `red`, `critical`. No se reabre hasta cambiar de tramo |
| Entidad | `SupportAccess` | Lo concede el propietario. Tiene vencimiento. Revocar lo cierra antes |
| Entidad | `TaxIdRequirement` | Lista de pendientes de activación del NIT en Factus. No marca el NIT listo si falta uno |

El administrador de la plataforma no es un `User` con alcance de operación.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Planes, suscripciones, bolsa, accesos | Nube | `SubscriptionChanged` hacia M0, para que la sede sepa si está suspendida |
| Consumo | Lo emite M3 | `DocumentConsumed` |
| Recarga | Nube | Llamada a M3 `IssuePendingDocuments` |
| Requisitos y archivos de carga | Nube | — |

Nada de esto baja al nodo, salvo el estado de suspensión, que M0 necesita para rechazar la operación.

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `OnboardCompany`, `RegisterTaxpayer` | Datos del cliente | Delega en M0 `CreateOrganization`. Crea la bolsa | `OrganizationChanged` vía M0 | Nube |
| `TrackTaxIdRequirements` | Documentos del NIT | No marca listo con un requisito vacío | — | Nube |
| `ImportInitialCatalog` (menú, insumos y recetas) | Archivo | Usa los casos de M1 y M4. Una fila mala no publica a medias | — | Nube |
| `RecordDocumentConsumption` | `DocumentConsumed` | Idempotente por documento. Atribuye NIT y sede | Saldo | Nube |
| `EvaluateCoverage` | Ritmo diario | 15 y 5 días, o los que configuró la empresa | `BalanceAlertRaised` | Nube |
| `ReconcileBalance` | Adaptador Factus | Si la API no responde, queda el saldo interno y una señal | Señal a M6 | Nube |
| `RecordTopUp` | Documentos añadidos | Después pide emitir pendientes | Llamada a M3 | Nube |
| `ActivateSubscription`, `StartGracePeriod`, `SuspendSubscription`, `ReactivateSubscription` | Cobro o reloj | Respeta el orden de estados | `SubscriptionChanged` | Nube |
| `GrantSupportAccess`, `RevokeSupportAccess` | Propietario y vencimiento | Token con `tenant_id` | Auditoría en el cliente | Nube |

## 5. Contratos

**HTTP de backoffice:** empresas, planes, recargas, señales. Rol de plataforma, sin `tenant_id` de operación.

**HTTP del cliente:** saldo, requisitos, configuración guiada, conceder y revocar soporte.

**Panel de soporte:** vista de `apps/admin-web`. Lee el estado de nodos y la cola de sincronización de M0, las facturas pendientes de M3 y las señales de Factus de M6, siempre con el token vigente de esa empresa. M7 no le abre una entrada propia: el soporte entra por M0.

**Evento de entrada:** `DocumentConsumed` (empresa, NIT, sede, tipo, id de documento).

**Hacia M3:** `IssuePendingDocuments` con motivo "sin saldo".

**Hacia M0:** `CreateOrganization` y entrega del token de soporte.

`SubscriptionGateway` se nombra aquí y se elige en la entrega 4.3 (PA-38). No comparte adaptador con ADR-016.

Los esquemas Zod viven en `shared/contracts`.

## 6. Persistencia

`plans`, `subscriptions`, `document_wallets`, `document_consumptions`, `balance_alerts`, `support_accesses`, `tax_id_requirements`.

- `document_consumptions` es único por id de documento, para no descontar dos veces.
- `tenant_id` y Row Level Security. El backoffice usa un rol que no lee pedidos, pagos ni facturas.
- Los archivos de importación van al almacén de objetos y se pueden borrar después de aplicados.
- Secretos de la pasarela de suscripción en el gestor de secretos.

## 7. Operación sin internet

La bolsa y la suscripción no se consultan en el nodo para cobrar una mesa. M3 ya decidió en la nube si había saldo al intentar emitir.

Si la sede está en híbrido y sin internet, sigue vendiendo. La factura queda pendiente por falta de enlace, no por la bolsa. Al reconectar, el worker de M3 distingue el motivo.

Una suspensión decidida en la nube llega al nodo con la configuración. Hasta que baja, el nodo sigue. Por eso la suspensión no es un corte de segundo: el canal la aplica al reconectar, y queda auditado el desfase.

## 8. Seguridad y auditoría

- El rol de plataforma no tiene políticas de lectura sobre tablas operativas.
- El token de soporte lleva empresa, vencimiento y el usuario de soporte. M0 lo rechaza si venció.
- Permisos: `support.grant_access` (propietario) y `support.view_panel` (rol de soporte). La vista de soporte de `apps/admin-web` exige `support.view_panel` y, para ver una empresa, su token vigente.
- Conceder, revocar, recargar, suspender y exportar señales quedan en auditoría. La del soporte se escribe en la cadena del cliente.
- El panel muestra estado de nodos y colas. No abre el escritorio del mini PC ni entrega la credencial del nodo.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Suscripción no salta la gracia | Dominio | De `active` no pasa a `suspended` |
| Saldo no queda negativo por un consumo de más | Dominio | El documento queda pendiente; el saldo llega a cero |
| Acceso vencido | Dominio | No está vigente |
| `RecordDocumentConsumption` repetido | Aplicación | El saldo baja una vez |
| Recarga | Aplicación | Llama a `IssuePendingDocuments` |
| Alta | Aplicación | Llama a M0 y no inserta usuarios por otro camino |
| Token de soporte | Aplicación | Sin concesión, M0 no abre la empresa |
| Panel de soporte sin permiso | Aplicación | Un usuario sin `support.view_panel`, o sin token vigente, no recibe el estado de nodos |
| `DocumentWalletRepository` | Contrato, memoria y PostgreSQL | Consumo por NIT y sede |
| Backoffice | Aplicación | Una consulta de pedidos del cliente se rechaza |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] El consumo duplicado no descuenta dos veces
- [ ] Un recorrido Playwright: alta guiada hasta el primer NIT con requisitos visibles

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-002 Bolsa con cupo por NIT (D-16) | Cada NIT tiene su cupo. La empresa ve la suma. El saldo se concilia con `GET /v2/subscriptions` |
| Precio sin costos reales (PA-39) | El costo de Factus está en D-18. La entrega 4.3 no cierra el precio al cliente antes de sumar infraestructura y soporte |
| Soporte con acceso de más | Vencimiento y revocación. Sin token no hay datos |
| Suspensión durante un corte | Se aplica al reconectar. No se pierden las ventas de ese lapso |
