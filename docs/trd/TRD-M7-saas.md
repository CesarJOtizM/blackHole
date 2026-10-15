# TRD-M7 · SaaS comercial

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 4 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M7](../prd/PRD-M7-saas.md) |
| Diagramas | [C4 M7](../arquitectura/componentes/c4-m7-saas.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Dónde corre | Solo en la nube. No hay copia de planes ni de bolsa en el nodo |
| Alta | Llama al puerto de M0 `CrearOrganizacion`. No inserta en las tablas de M0 por su cuenta |
| Soporte | Token con `tenant_id` y vencimiento, que evalúa M0. Sin token no hay sesión de cliente |
| Bolsa | Saldo por empresa. El consumo llega por `DocumentoConsumido`. La conciliación con Factus es un adaptador, por si la API no muestra el saldo |
| Sin saldo | M3 deja la factura pendiente. Al recargar, M7 llama a M3 para emitir las de motivo "sin saldo" |
| Suscripción | Activa, en gracia, suspendida. El cobro va detrás de `PasarelaSuscripcion`, distinto de `PasarelaPagos` del QR |
| Carga inicial | Archivos en el almacén de objetos. Los casos de uso de menú y recetas son los de M1 y M4 |
| Código | `contextos/saas/dominio`, `contextos/saas/aplicacion` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `Suscripcion` | Estados: activa, en gracia, suspendida. De activa solo pasa a gracia; de gracia, a suspendida o a activa; de suspendida, a activa. No se borra la empresa al suspender |
| Entidad | `Plan` | Precio por sede. Cambiar el precio no reescribe periodos ya cobrados |
| Agregado | `BolsaDocumentos` | Saldo por empresa. El consumo nombra NIT y sede. El saldo no baja de un registro que no sea un documento |
| Entidad | `AlertaSaldo` | Amarilla, roja o crítica. No se reabre hasta cambiar de tramo |
| Entidad | `AccesoSoporte` | Lo concede el propietario. Tiene vencimiento. Revocar lo cierra antes |
| Entidad | `RequisitoNit` | Lista de pendientes de activación en Factus. No marca el NIT listo si falta uno |

El administrador de la plataforma no es un `Usuario` con alcance de operación.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Planes, suscripciones, bolsa, accesos | Nube | `SuscripcionCambiada` hacia M0, para que la sede sepa si está suspendida |
| Consumo | Lo emite M3 | `DocumentoConsumido` |
| Recarga | Nube | Llamada a M3 `EmitirPendientes` |
| Requisitos y archivos de carga | Nube | — |

Nada de esto baja al nodo, salvo el estado de suspensión, que M0 necesita para rechazar la operación.

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `CrearEmpresa`, `RegistrarContribuyente` | Datos del cliente | Delega en M0. Crea la bolsa | `OrganizacionCambiada` vía M0 | Nube |
| `SeguirRequisitosNit` | Documentos del NIT | No marca listo con un requisito vacío | — | Nube |
| `Importar` menú, insumos y recetas | Archivo | Usa los casos de M1 y M4. Una fila mala no publica a medias | — | Nube |
| `RegistrarConsumo` | `DocumentoConsumido` | Idempotente por documento. Atribuye NIT y sede | Saldo | Nube |
| `EvaluarCobertura` | Ritmo diario | 15 y 5 días, o los que configuró la empresa | `AlertaSaldo` | Nube |
| `ConciliarSaldo` | Adaptador Factus | Si la API no responde, queda el saldo interno y una señal | Señal a M6 | Nube |
| `RegistrarRecarga` | Documentos añadidos | Después pide emitir pendientes | Llamada a M3 | Nube |
| `Activar`, `PasarAGracia`, `Suspender`, `Reactivar` | Cobro o reloj | Respeta el orden de estados | `SuscripcionCambiada` | Nube |
| `ConcederAcceso`, `RevocarAcceso` | Propietario y vencimiento | Token con `tenant_id` | Auditoría en el cliente | Nube |

## 5. Contratos

**HTTP de backoffice:** empresas, planes, recargas, señales. Rol de plataforma, sin `tenant_id` de operación.

**HTTP del cliente:** saldo, requisitos, configuración guiada, conceder y revocar soporte.

**Evento de entrada:** `DocumentoConsumido` (empresa, NIT, sede, tipo, id de documento).

**Hacia M3:** emitir pendientes con motivo "sin saldo".

**Hacia M0:** crear organización y entregar el token de soporte.

`PasarelaSuscripcion` se nombra aquí y se elige en la entrega 4.3. No comparte adaptador con ADR-016.

Los esquemas Zod viven en `compartido/contratos`.

## 6. Persistencia

`planes`, `suscripciones`, `bolsas`, `consumos_documentos`, `alertas_saldo`, `accesos_soporte`, `requisitos_nit`.

- `consumos_documentos` es único por id de documento, para no descontar dos veces.
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
- Conceder, revocar, recargar, suspender y exportar señales quedan en auditoría. La del soporte se escribe en la cadena del cliente.
- El panel muestra estado de nodos y colas. No abre el escritorio del mini PC ni entrega la credencial del nodo.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Suscripción no salta la gracia | Dominio | De activa no pasa a suspendida |
| Saldo no queda negativo por un consumo de más | Dominio | El documento queda pendiente; el saldo llega a cero |
| Acceso vencido | Dominio | No está vigente |
| `RegistrarConsumo` repetido | Aplicación | El saldo baja una vez |
| Recarga | Aplicación | Llama a emitir pendientes |
| Alta | Aplicación | Llama a M0 y no inserta usuarios por otro camino |
| Token de soporte | Aplicación | Sin concesión, M0 no abre la empresa |
| `RepositorioBolsas` | Contrato, memoria y PostgreSQL | Consumo por NIT y sede |
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
| ADR-002 Bolsa compartida entre NIT | Se arranca con una bolsa por empresa. Si Factus dice que no, el saldo se parte por NIT sin cambiar el caso de uso |
| Precio sin costos reales | La entrega 4.3 no cierra el número antes de tener Factus, infraestructura y soporte |
| Soporte con acceso de más | Vencimiento y revocación. Sin token no hay datos |
| Suspensión durante un corte | Se aplica al reconectar. No se pierden las ventas de ese lapso |
