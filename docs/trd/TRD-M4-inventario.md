# TRD-M4 · Inventario, bodegas y recetas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fase | 2 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M4](../prd/PRD-M4-inventario.md) |
| Diagramas | [C4 M4](../arquitectura/componentes/c4-m4-inventario.md) |
| Nombres | [Glosario de código](../glosario-codigo.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Stock | Libro de movimientos que solo se agrega. El saldo y el costo promedio se derivan y se guardan en la misma transacción |
| Costo producido | Configurable por empresa: promedio de los insumos consumidos, o costo estándar (D-26) |
| Costo del traslado | El del origen en el despacho, sin sumar nada (D-27) |
| Ajuste por conteo | Por encima del tope pide aprobación. Tope configurable, predeterminado $1.000, y la sede lo puede bajar (D-28) |
| Dueño | Quien es dueño de la ubicación. El punto y la bodega de la sede: el nodo de la sede, o la nube si la sede está en modo nube. La bodega general del piloto: su propio nodo en modo bodega (D-04, ADR-010) |
| Bodega general sin nodo | Operarla desde la web de administración queda abierto para clientes pequeños después del piloto (PA-44). Este TRD no la implementa; los casos de uso ya sirven en la nube si se decide |
| Recetas | Dueña la nube, versionadas. El nodo usa `RecipeCatalog` |
| Venta | No se bloquea por saldo negativo. `AvailabilityChanged` avisa a M1 y, por la outbox, al hub de M5 |
| Traslado entre nodos | Dos mitades, un identificador. Sin recepción, queda `in_transit` |
| Alertas | Se evalúan en el nodo al cambiar el saldo, y la cobertura cada 15 minutos |
| "Hoy no se repone" | Lo propone el sistema y lo confirma una persona. Hasta entonces no se retiran líneas |
| Impresión | M4 dispara el comprobante de traslado por el puerto `Printer`, con las plantillas de `shared/printing` |
| Código | `contexts/inventory/domain`, `contexts/inventory/application`, `contexts/inventory/adapters` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `StockLedger` | Solo se agrega. Tipos: `purchase`, `sale_consumption`, `return`, `waste`, `production`, `transfer_out`, `transfer_in`, `adjustment`. El saldo nuevo se calcula, no se escribe a mano |
| Entidad | `Ingredient` | Tres unidades (compra, inventario, receta) y sus factores de conversión. El factor no es cero |
| Agregado | `Recipe` | Por producto y variante. Sub-recetas sin ciclo. Versión inmutable una vez usada en un consumo |
| Regla | `RecipeExplosion` | Aplica rendimiento y modificadores. Devuelve cantidades en unidad de inventario |
| Agregado | `Transfer` | Estados en orden: `requested`, `dispatched`, `in_transit`, `received`, `received_with_differences`. Las dos mitades comparten el identificador. La diferencia no se pierde |
| Regla | `PossibleUnits` | Mínimo entre ingredientes del punto. Identifica el limitante. La bodega se informa aparte, no habilita el menú |
| Agregado | `ShortageAlert` | `open`, `seen`, `resolved`. Histéresis: no reabre hasta volver a cruzar el umbral. Se resuelve sola al superar el punto de reposición |
| Entidad | `NoRestockToday` | La crea una persona. Vale hasta el fin del servicio o hasta quitarla |

El costo promedio cambia solo con una entrada a costo real. Una merma no modifica el costo, sí el saldo. La producción es una entrada a costo real: al promedio de lo consumido o al costo estándar, según la empresa (D-26). El traslado no es una entrada a costo nuevo: usa el del origen (D-27).

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Insumos, recetas, niveles | Nube | Copia versionada hacia los nodos |
| Movimientos del punto y de la bodega de la sede | Nodo de la sede | `StockMoved` hacia la nube y M6 |
| Movimientos de la bodega general | Nodo de la bodega, en modo bodega (D-04) | `StockMoved` hacia la nube |
| Traslado entre dos dueños | Cada mitad en su dueño | `TransferDispatched` en el origen, `TransferReceived` en el destino |
| Disponibilidad y no se repone | Quien evaluó el punto | `AvailabilityChanged` |
| Niveles sugeridos | Nube, a partir del histórico | Propuesta, no pisa el nivel vigente |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `UpdateRecipeCatalog`, `ImportRecipesFromExcel` | Insumos y recetas | Nueva versión, sin ciclos | Copia de recetas | Nube |
| `RegisterSaleConsumption` | Línea enviada por M1 o M5 | Explota la versión vigente. Permite saldo negativo. Idempotente por línea | `StockMoved` y `AvailabilityChanged` | Dueño del punto |
| `ReturnStock`, `RecordWaste` | Anulación o retiro de M1, o cancelación de M5 | `ReturnStock` si cocina no empezó; `RecordWaste` con motivo si ya empezó | `StockMoved` | Dueño del punto |
| `CreatePurchaseOrder`, `ReceivePurchase` | Proveedor, cantidades, costo real | El costo es el valor registrado, sin separar el IVA (D-15). Recalcula el promedio | `StockMoved` | Dueño de la ubicación |
| `RecordProduction` | Preparación | Consume ingredientes y genera stock del intermedio al costo configurado (D-26) | `StockMoved` | Dueño de la ubicación |
| `RequestTransfer` | Destino, insumos y cantidades | Lo pide el punto o lo sugiere una alerta | — | Dueño del destino |
| `DispatchTransfer` | Traslado solicitado | Registra la salida en el origen al costo de esa ubicación, sin sumar nada (D-27), e imprime el comprobante con QR | `TransferDispatched` | Dueño del origen |
| `ReceiveTransfer`, `ReceiveTransferWithDifferences` | Traslado despachado, o QR del comprobante | Misma id que la salida. Entra al costo del despacho (D-27). La diferencia exige permiso | `TransferReceived` | Dueño del destino |
| `RecordStockCount`, `ApproveAdjustment` | Cantidad contada | El ajuste es un movimiento, no un saldo editado. Por encima de $1.000, o del tope de la sede, pide aprobación (D-28) | `StockMoved` | Dueño de la ubicación |
| `EvaluateLevels`, `EvaluateCoverage`, `CalculatePossibleUnits` | Saldo o reloj de 15 min | Cobertura por día de la semana | `ShortageAlertOpened` o `ShortageAlertResolved` | Nodo de la sede, y la nube para el consolidado |
| `ConfirmNoRestockToday` | Plato y servicio | Solo una persona. Propone si no hay stock ni traslado en camino | `AvailabilityChanged` | Dueño del punto |
| `ProposeLevels` | Histórico | No activa solo | Propuesta | Nube |

## 5. Contratos

**Puerto de entrada** (`entry-port.ts`): `RegisterSaleConsumption`, `ReturnStock`, `RecordWaste`. Lo llaman M1 y M5 en proceso.

**Evento `AvailabilityChanged`:** sede, producto, estado (disponible, pocas, agotado) y si hoy no se repone. M1 lo aplica en el nodo. M5 lo recibe por la outbox en el hub.

**Eventos de traslado:** `TransferDispatched` y `TransferReceived`, con el identificador del traslado, origen, destino y cantidades. La nube los reconcilia por ese identificador.

**HTTP:** compras, traslados, producción, conteos, recepción por el QR del comprobante.

**Impresión:** comprobante de traslado con el identificador en el QR, por `Printer` (`shared/printing`).

Los esquemas Zod viven en `shared/contracts`. La cantidad viaja en unidad de inventario, como entero escalado, no como punto flotante.

## 6. Persistencia

`ingredients`, `unit_conversions`, `recipes`, `recipe_versions`, `stock_movements`, `stock_balances`, `transfers`, `shortage_alerts`, `stock_levels`, `no_restock_today`.

- `stock_movements` solo acepta inserción.
- El saldo se actualiza en la misma transacción que el movimiento. Si la transacción falla, no hay consumo a medias.
- PostgreSQL con `tenant_id` y Row Level Security. El nodo solo tiene sus ubicaciones.
- La versión de receta usada queda en el movimiento, para reconstruir el teórico aunque la receta cambie después.

## 7. Operación sin internet

El punto y la bodega de la misma sede operan en el nodo: consumo, merma, traslado interno, conteo y alertas.

La bodega general del piloto opera en su propio nodo con la misma regla: sin internet sigue registrando sus movimientos (D-04).

Un traslado desde la bodega general queda `in_transit` hasta que el otro nodo registra su mitad. Ningún lado inventa la mitad del otro.

La disponibilidad que ve el mesero es la del nodo. La de las plataformas espera a que el evento suba al hub.

"Hoy no se repone" vale en el nodo de inmediato. Al reconectar, M1 ya habrá retirado las líneas locales; el evento evita que la nube las vuelva a ofrecer.

## 8. Seguridad y auditoría

Permisos de PRD-01: merma, ajuste, conteo, aprobar conteo, recibir compra, recibir con diferencias, editar recetas, ver costos, configurar niveles.

El mesero no tiene un endpoint de costos. Ver el margen es un permiso distinto de ver el saldo operativo.

Eventos de auditoría (`RecordAuditEvent`): ajuste, diferencia de traslado, merma, confirmación de no se repone, cambio de receta.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Saldo igual a la suma de movimientos | Dominio | Incluye el negativo |
| Receta con ciclo | Dominio | Se rechaza |
| Modificador suma y resta | Dominio | Las cantidades explotadas coinciden |
| Costo promedio | Dominio | Solo cambia con una entrada a costo real |
| Costo de lo producido | Dominio | Con la regla de promedio, es el costo consumido dividido por lo producido. Con costo estándar, es ese valor (D-26) |
| Costo del traslado | Dominio | El destino recibe el costo del origen, sin sumar nada (D-27) |
| Ajuste por conteo | Dominio | Por encima del tope no se registra sin aprobación (D-28) |
| `PossibleUnits` | Dominio | El limitante es el ingrediente que da el mínimo del punto |
| `RegisterSaleConsumption` repetido para la misma línea | Aplicación | La segunda vez no descuenta otra vez |
| Anulación antes y después | Aplicación | `ReturnStock` o `RecordWaste`, no las dos |
| Traslado con el mismo id | Aplicación | `TransferDispatched` y `TransferReceived` forman dos mitades, con una diferencia visible |
| `ConfirmNoRestockToday` sin persona | Aplicación | No emite el evento |
| `StockMovementRepository` | Contrato (`stock-movement-repository.contract.ts`), memoria, SQLite y PostgreSQL | El saldo coincide |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización del traslado entre nodos: duplicado, desorden y corte
- [ ] Un recorrido Playwright: recibir un traslado por QR y ver la diferencia

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-010 Bodega general | Piloto: nodo propio en modo bodega (D-04). Operarla desde la web para clientes pequeños sigue abierto (PA-44) |
| Conteo mal hecho que cancele pedidos | "Hoy no se repone" exige confirmación |
| Receta cambiada a mitad del servicio | El consumo guarda la versión |
| Excel de carga incompleto | La importación informa la fila y no publica una versión a medias |
