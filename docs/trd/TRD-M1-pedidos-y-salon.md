# TRD-M1 · Pedidos y salón

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fase | 1 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M1](../prd/PRD-M1-pedidos-y-salon.md) |
| Diagramas | [C4 M1](../arquitectura/componentes/c4-m1-pedidos-y-salon.md) |
| Nombres | [Glosario de código](../glosario-codigo.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Dónde corre el salón | En el nodo si la sede es híbrida; en la API central si está en modo nube. Mismos casos de uso |
| Menú | Dueña la nube. El nodo usa `MenuCatalog`, una copia |
| Pedido del mesero | Lo crea el dueño de la operación |
| Pedido QR | Nace en la nube como `QrOrderIntent`. El dueño de la operación lo aplica una vez |
| Enrutamiento | Regla pura producto → estación → pantalla, impresora o ambas. La caja siempre recibe la cuenta |
| Tiempo real | WebSocket. En la nube, `LISTEN/NOTIFY` entre instancias |
| Impresión | M1 dispara la comanda y la precuenta por el puerto `Printer`. Las plantillas y el controlador ESC/POS viven en `shared/printing`. La factura y el comprobante los dispara M3. El QR de la precuenta lo firma la sede, también sin internet |
| Inventario | Al enviar o anular llama al puerto de entrada de M4 (`RegisterSaleConsumption`, `ReturnStock`, `RecordWaste`). No calcula recetas |
| Código | `contexts/orders/domain`, `contexts/orders/application`, `contexts/orders/adapters` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `Table` | Estados: `free`, `occupied`, `check_requested`, `to_clean`. Mover, unir o transferir solo en `occupied` o `check_requested` |
| Agregado | `Order` | Pertenece a una cuenta (`Check`) y una sede. Canal: mesero, punto fijo, QR mesa, domicilio, plataforma. Líneas con hora en cada estado |
| Entidad | `OrderLine` | `sent` → `in_preparation` → `ready` → `delivered`. También `voided` o `not_delivered`. No vuelve atrás |
| Agregado | `Menu` | De la marca. `VenuePrice` no cambia el producto de la marca |
| Objeto de valor | `Modifier` | Con o sin precio. Ajusta el consumo que M4 interpretará |
| Objeto de valor | `TaxClassification` | La lee M3. Este módulo no calcula el impuesto |
| Regla | `StationRouter` | Un producto, una estación, una o dos salidas |
| Agregado | `QrOrderIntent` | Idempotente por su UUID. No anula, no descuenta, no cambia precios |
| Objeto de valor | `PortalToken` | Firmado, de un solo propósito (carta de mesa o precuenta) |

La cuenta es la suma de las líneas no anuladas y no retiradas. Dividirla parte líneas o importes sin perder el origen. Enviar un pedido sin líneas falla con `EmptyOrder`.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Menú, productos, precios, horarios | Nube | Copia hacia el nodo |
| Mesas, pedidos del mesero, estados de cocina | Nodo en híbrido; nube en modo nube | `LineSent` y `LineStateChanged` con hora, hacia la nube y hacia M6 |
| `QrOrderIntent` | Nube, hasta que se aplica | `QrOrderPendingApply` por el canal de la sede |
| Pedido ya aplicado | El dueño de la operación | `LineSent` y `LineStateChanged` |
| Token de precuenta | Lo firma quien opera el salón | — |

Al aplicar una intención que esperó un corte, se usa la disponibilidad de ese momento. Si el plato no se puede enviar, la intención queda rechazada y no se duplica al reintentar.

### Catálogo de eventos

| Evento | Cuándo | Lo consumen |
|--------|--------|-------------|
| `TableOpened` | La mesa pasa de `free` a `occupied` | M6 |
| `LineSent` | Una línea sale hacia su estación | Cocina, caja, M6 |
| `LineStateChanged` | Cualquier cambio posterior de la línea: `in_preparation`, `ready`, `delivered`, `voided`, `not_delivered`. Lleva el estado nuevo, la hora del nodo y, si aplica, el motivo | Cocina, mesero, caja, M6 |
| `CheckReassigned` | Mover mesa, unir mesas o transferir productos | Caja, M6 |
| `CheckRequested` | Pedir la cuenta | Caja (M2), M6 |
| `QrOrderPendingApply` | La nube registra una intención QR | Dueño de la operación |

No hay eventos aparte para anular o para "no se entrega": son `LineStateChanged` con el estado `voided` o `not_delivered`.

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `UpdateMenu` | Producto, variante, modificador, combo, precio y horario de sede | El precio de sede no pisa la marca | Copia de menú | Nube |
| `OpenTable` | Zona, mesa, comensales | Pasa de `free` a `occupied` | `TableOpened` | Dueño de la operación |
| `AddItems`, `SendToKitchen` | Líneas, tiempos | Enruta. Llama a `RegisterSaleConsumption` de M4. No bloquea por stock negativo. Sin líneas: `EmptyOrder` | `LineSent` | Dueño de la operación |
| `ViewVenueMenu`, `RecordQrOrderIntent` | Token de mesa | Una intención por envío | `QrOrderPendingApply` | Nube |
| `ApplyQrOrder` | Intención | Abre o suma. Idempotente. Respeta "hoy no se repone". Llama a `RegisterSaleConsumption` de M4 | `LineSent` o rechazo | Dueño de la operación |
| `CreateInternalOrder` | Pedido de M5 | Mismo enrutamiento, con canal y código externo. Llama a `RegisterSaleConsumption` de M4 | `LineSent` | Dueño de la operación |
| `ChangeLineState` | Estación y estado | Solo avanza. Guarda la hora | `LineStateChanged` | Dueño de la operación |
| `MarkNotDeliverable`, `WithdrawUnrestockedLines` | Aviso de M4 (`AvailabilityChanged`) o de la estación | Lo no empezado sale y no se cobra, y llama a `ReturnStock` de M4. Lo empezado sigue, salvo marca de la estación, que llama a `RecordWaste` | `LineStateChanged` (`not_delivered`) | Dueño de la operación |
| `VoidLine`, `VoidCheck` | Motivo, autorización | Antes de empezar: `ReturnStock` en M4. Después: `RecordWaste`. Pasa por `EvaluatePermission` de M0 | `LineStateChanged` (`voided`) | Dueño de la operación |
| `MoveTable`, `MergeTables`, `TransferItems` | Destino | Mesa en `occupied` o `check_requested`. Permiso de M0 | `CheckReassigned` | Dueño de la operación |
| `RequestCheck`, `SplitCheck` | Criterio de división | Dispara la impresión de la precuenta con token | `CheckRequested` | Dueño de la operación |
| `AttachReservation` | Llegada de M9 | Bloquea y luego abre la mesa de esa reserva | `TableOpened` | Dueño de la operación |
| `GetCheck` | Id de cuenta | La lee M2 | — | Dueño de la operación |

## 5. Contratos

**HTTP del salón** (nodo o nube, según el modo): mesas, líneas, anulación, precuenta, división.

**HTTP de administración:** menú de la marca y precios de la sede.

**Portal:** `GET/POST` de la carta bajo el token de mesa. No hay sesión de cliente.

**WebSocket:** cola por estación, aviso de listo, aviso de no se entrega, cuenta en vivo para caja.

**Puerto de entrada de M1** (`entry-port.ts`): `CreateInternalOrder`, `AttachReservation`, `GetCheck`.

**Hacia M4:** `RegisterSaleConsumption` al enviar; `ReturnStock` o `RecordWaste` al anular o retirar, en la misma operación.

**Desde M4:** evento `AvailabilityChanged` (disponible, pocas unidades, agotado, no se repone hoy).

**Impresión:** comanda y precuenta por `Printer`, con las plantillas de `shared/printing`.

Los esquemas Zod viven en `shared/contracts` y se escriben con el primer caso de uso que los necesite. El token de portal lleva sede, mesa y propósito, y vence.

## 6. Persistencia

`dining_tables`, `checks`, `orders`, `order_lines` (con hora por estado), `menus`, `products`, `variants`, `modifiers`, `venue_prices`, `qr_order_intents`.

- PostgreSQL con `tenant_id` y Row Level Security para menú e intenciones, y para la operación cuando la sede está en nube.
- SQLite en el nodo para mesas y pedidos de su sede.
- La intención QR tiene clave única. Aplicarla dos veces no crea dos líneas.
- Cada envío y cada cambio de estado van a la outbox en la misma transacción.

## 7. Operación sin internet

| Acción | Híbrido en corte | Nube en corte |
|--------|------------------|---------------|
| Pedido del mesero, cocina, precuenta, anulación | Sigue en el nodo | Detenido |
| Pedido QR | Espera en la nube y se aplica al reconectar | Igual: espera y se aplica al volver |
| Cambio de menú en la web | Espera y baja por el canal | No llega a la sede hasta que vuelva el enlace |
| Aviso "listo" | WebSocket del nodo. Con el celular bloqueado, el spike de la Fase 0 define el aviso (PA-30) | No hay cocina |

La PWA no reimplementa precios ni anulaciones: las pide al servidor del modo.

## 8. Seguridad y auditoría

Acciones que declaran permiso de PRD-01: abrir mesa no es sensible; anular, descontar, cortesía, cambiar precio, modificar tras la precuenta, transferir mesa a otro mesero, sí.

El portal no acepta esas acciones. El QR de mesa identifica la mesa, no a una persona. Un pedido desde fuera del local queda en esa mesa y el personal lo ve; la sede puede exigir aceptación en caja.

Eventos de auditoría (`RecordAuditEvent`): anulación, cambio de precio, cortesía, transferencia y "cliente avisado".

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| La línea no retrocede de estado | Dominio | De `ready` no vuelve a `sent` |
| Unir una mesa `free` o `to_clean` | Dominio | Se rechaza |
| Mover o unir una mesa en `check_requested` | Dominio | Se permite |
| `StationRouter` | Dominio | El producto cae en su estación y la caja siempre está |
| `QrOrderIntent` no permite anular | Dominio | El comando no existe en ese agregado |
| `SendToKitchen` sin líneas | Dominio | Falla con `EmptyOrder` |
| `SendToKitchen` | Aplicación, en memoria | Llama una vez a `RegisterSaleConsumption` y publica la comanda |
| `ApplyQrOrder` repetido | Aplicación | La segunda vez no duplica líneas |
| Anulación después de empezar | Aplicación | Sin autorización no cambia; con ella llama `RecordWaste`, no `ReturnStock` |
| `AvailabilityChanged` con no se repone | Aplicación | Retira solo líneas no empezadas y emite `LineStateChanged` con `not_delivered` |
| `OrderRepository` | Contrato (`order-repository.contract.ts`), memoria, SQLite y PostgreSQL | La cuenta y las horas se leen igual |
| Token de precuenta | Aplicación | Se firma sin llamar a la nube |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización del pedido QR: duplicado, desorden y corte
- [ ] Un recorrido Playwright: abrir mesa, enviar, marcar listo y pedir la cuenta

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| Aviso con el celular bloqueado | Spike de la Fase 0, antes de la entrega 1.2 (PA-30) |
| Alguien pide desde fuera con una foto del QR | Queda en la mesa; aceptación en caja opcional, apagada en el piloto (D-23) |
| Menú desactualizado en el nodo | La copia baja por el canal; el pedido usa la copia vigente al enviar |
| Impresora de comandas caída | La pantalla sigue y se avisa a caja |
