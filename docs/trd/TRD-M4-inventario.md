# TRD-M4 · Inventario, bodegas y recetas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 2 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M4](../prd/PRD-M4-inventario.md) |
| Diagramas | [C4 M4](../arquitectura/componentes/c4-m4-inventario.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Stock | Libro de movimientos que solo se agrega. El saldo y el costo promedio se derivan y se guardan en la misma transacción |
| Dueño | Quien es dueño de la ubicación. El punto y la bodega de la sede: el nodo de la sede, o la nube si la sede está en modo nube. La bodega general: su nodo (ADR-010) o la nube si no tiene nodo |
| Recetas | Dueña la nube, versionadas. El nodo usa `CatalogoRecetas` |
| Venta | No se bloquea por saldo negativo. `DisponibilidadCambiada` avisa a M1 y, por la outbox, al hub de M5 |
| Traslado entre nodos | Dos mitades, un identificador. Sin recepción, queda en tránsito |
| Alertas | Se evalúan en el nodo al cambiar el saldo, y la cobertura cada 15 minutos |
| "Hoy no se repone" | Lo propone el sistema y lo confirma una persona. Hasta entonces no se retiran líneas |
| Código | `contextos/inventario/dominio`, `contextos/inventario/aplicacion` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `LibroMovimientos` | Solo se agrega. Tipos: compra, consumo, devolución, merma, producción, salida de traslado, entrada de traslado, ajuste. El saldo nuevo se calcula, no se escribe a mano |
| Entidad | `Insumo` | Tres unidades y sus factores de conversión. El factor no es cero |
| Agregado | `Receta` | Por producto y variante. Sub-recetas sin ciclo. Versión inmutable una vez usada en un consumo |
| Regla | Explosión de receta | Aplica rendimiento y modificadores. Devuelve cantidades en unidad de inventario |
| Agregado | `Traslado` | Estados en orden. Las dos mitades comparten el identificador. La diferencia no se pierde |
| Regla | `UnidadesPosibles` | Mínimo entre ingredientes del punto. Identifica el limitante. La bodega se informa aparte, no habilita el menú |
| Agregado | `AlertaEscasez` | Abierta, vista, resuelta. Histéresis: no reabre hasta volver a cruzar el umbral. Se resuelve sola al superar el punto de reposición |
| Entidad | `NoSeReponeHoy` | La crea una persona. Vale hasta el fin del servicio o hasta quitarla |

El costo promedio cambia solo con una entrada a costo real. Una merma no modifica el costo, sí el saldo.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Insumos, recetas, niveles | Nube | Copia versionada hacia los nodos |
| Movimientos del punto y de la bodega de la sede | Nodo de la sede | Hacia la nube y M6 |
| Movimientos de la bodega general | Nodo de la bodega, o la nube si no tiene nodo | Hacia la nube |
| Traslado entre dos dueños | Cada mitad en su dueño | `TrasladoDespachado`, `TrasladoRecibido` |
| Disponibilidad y no se repone | Quien evaluó el punto | `DisponibilidadCambiada` |
| Niveles sugeridos | Nube, a partir del histórico | Propuesta, no pisa el nivel vigente |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| Catálogo e importar Excel | Insumos y recetas | Nueva versión, sin ciclos | Copia de recetas | Nube |
| `RegistrarConsumoVenta` | Línea enviada por M1 o M5 | Explota la versión vigente. Permite saldo negativo | `Movimiento` y `DisponibilidadCambiada` | Dueño del punto |
| `Devolucion`, `Merma` | Anulación de M1 o cancelación de M5 | Según si cocina empezó | `Movimiento` | Dueño del punto |
| `CrearOrdenCompra`, `RecibirCompra` | Proveedor, cantidades, costo real | Recalcula el promedio | `Movimiento` | Dueño de la ubicación |
| `CargarFacturaProveedor` | XML o documento soporte | Fase 2, vía M3 | `Movimiento` | Nube llama a M3; el stock lo escribe el dueño |
| `RegistrarProduccion` | Preparación | Consume ingredientes y genera stock del intermedio | `Movimiento` | Dueño de la ubicación |
| `Solicitar`, `Despachar`, `Recibir`, `RecibirConDiferencias` | Traslado | Mitades con el mismo id. Diferencia con permiso | `Traslado*` | Cada dueño la suya |
| `RegistrarConteo`, `AprobarAjuste` | Cantidad contada | El ajuste es un movimiento, no un saldo editado | `Movimiento` | Dueño de la ubicación |
| `EvaluarNiveles`, `EvaluarCobertura`, `CalcularUnidadesPosibles` | Saldo o reloj de 15 min | Cobertura por día de la semana | `AlertaAbierta` o resuelta | Nodo de la sede, y la nube para el consolidado |
| `ConfirmarNoSeRepone` | Plato y servicio | Solo una persona. Propone si no hay stock ni traslado en camino | `DisponibilidadCambiada` | Dueño del punto |
| `ProponerNiveles` | Histórico | No activa solo | Propuesta | Nube |

## 5. Contratos

**Puerto de entrada:** `RegistrarConsumoVenta`, `Devolucion`, `Merma`. Lo llaman M1 y M5 en proceso.

**Evento `DisponibilidadCambiada`:** sede, producto, estado (disponible, pocas, agotado) y si hoy no se repone. M1 lo aplica en el nodo. M5 lo recibe por la outbox en el hub.

**HTTP:** compras, traslados, producción, conteos, recepción por el QR del comprobante.

**Impresión:** comprobante de traslado con el identificador en el QR.

Los esquemas Zod viven en `compartido/contratos`. La cantidad viaja en unidad de inventario, como entero escalado, no como punto flotante.

## 6. Persistencia

`insumos`, `conversiones`, `recetas`, `versiones_receta`, `movimientos`, `saldos`, `traslados`, `alertas`, `niveles`, `no_se_repone`.

- `movimientos` solo acepta inserción.
- El saldo se actualiza en la misma transacción que el movimiento. Si la transacción falla, no hay consumo a medias.
- PostgreSQL con `tenant_id` y Row Level Security. El nodo solo tiene sus ubicaciones.
- La versión de receta usada queda en el movimiento, para reconstruir el teórico aunque la receta cambie después.

## 7. Operación sin internet

El punto y la bodega de la misma sede operan en el nodo: consumo, merma, traslado interno, conteo y alertas.

Un traslado desde la bodega general queda en tránsito hasta que el otro nodo registra su mitad. Ningún lado inventa la mitad del otro.

La disponibilidad que ve el mesero es la del nodo. La de las plataformas espera a que el evento suba al hub.

"Hoy no se repone" vale en el nodo de inmediato. Al reconectar, M1 ya habrá retirado las líneas locales; el evento evita que la nube las vuelva a ofrecer.

## 8. Seguridad y auditoría

Permisos de PRD-01: merma, ajuste, conteo, aprobar conteo, recibir compra, recibir con diferencias, editar recetas, ver costos, configurar niveles.

El mesero no tiene un endpoint de costos. Ver el margen es un permiso distinto de ver el saldo operativo.

Eventos: ajuste, diferencia de traslado, merma, confirmación de no se repone, cambio de receta.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Saldo igual a la suma de movimientos | Dominio | Incluye el negativo |
| Receta con ciclo | Dominio | Se rechaza |
| Modificador suma y resta | Dominio | Las cantidades explotadas coinciden |
| Costo promedio | Dominio | Solo cambia con una entrada a costo real |
| `UnidadesPosibles` | Dominio | El limitante es el ingrediente que da el mínimo del punto |
| Consumo repetido de la misma línea | Aplicación | La segunda vez no descuenta otra vez |
| Anulación antes y después | Aplicación | Devolución o merma, no las dos |
| Traslado con el mismo id | Aplicación | Dos mitades, una diferencia visible |
| Confirmar no se repone sin persona | Aplicación | No emite el evento |
| `RepositorioMovimientos` | Contrato, memoria, SQLite y PostgreSQL | El saldo coincide |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización del traslado entre nodos: duplicado, desorden y corte
- [ ] Un recorrido Playwright: recibir un traslado por QR y ver la diferencia

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-010 Bodega general | Nodo en modo bodega, o la web si el cliente es pequeño |
| Conteo mal hecho que cancele pedidos | "Hoy no se repone" exige confirmación |
| Receta cambiada a mitad del servicio | El consumo guarda la versión |
| Excel de carga incompleto | La importación informa la fila y no publica una versión a medias |
