# TRD-M1 · Pedidos y salón

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 1 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M1](../prd/PRD-M1-pedidos-y-salon.md) |
| Diagramas | [C4 M1](../arquitectura/componentes/c4-m1-pedidos-y-salon.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Dónde corre el salón | En el nodo si la sede es híbrida; en la API central si está en modo nube. Mismos casos de uso |
| Menú | Dueña la nube. El nodo usa `CatalogoMenu`, una copia |
| Pedido del mesero | Lo crea el dueño de la operación |
| Pedido QR | Nace en la nube como `IntencionPedidoQr`. El dueño de la operación lo aplica una vez |
| Enrutamiento | Regla pura producto → estación → pantalla, impresora o ambas. La caja siempre recibe la cuenta |
| Tiempo real | WebSocket. En la nube, `LISTEN/NOTIFY` entre instancias |
| Impresión de comanda y precuenta | Puerto `Impresora` de `compartido/impresion`. El QR de la precuenta lo firma la sede, también sin internet |
| Inventario | Al enviar llama al puerto de M4. No calcula recetas |
| Código | `contextos/pedidos/dominio`, `contextos/pedidos/aplicacion` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `Mesa` | Estados: libre, ocupada, cuenta pedida, por limpiar. Mover, unir o transferir solo si no está libre ni por limpiar |
| Agregado | `Pedido` | Pertenece a una cuenta y una sede. Canal: mesero, punto fijo, QR mesa, domicilio, plataforma. Líneas con hora en cada estado |
| Entidad | `LineaPedido` | Enviado → en preparación → listo → entregado. También anulado o no se entrega. No vuelve atrás |
| Agregado | `Menu` | De la marca. `PrecioSede` no cambia el producto de la marca |
| Objeto de valor | `Modificador` | Con o sin precio. Ajusta el consumo que M4 interpretará |
| Objeto de valor | `ClasificacionTributaria` | La lee M3. Este módulo no calcula el impuesto |
| Regla | `Enrutador` | Un producto, una estación, una o dos salidas |
| Agregado | `IntencionPedidoQr` | Idempotente por su UUID. No anula, no descuenta, no cambia precios |
| Objeto de valor | `TokenPortal` | Firmado, de un solo propósito (carta de mesa o precuenta) |

La cuenta es la suma de las líneas no anuladas y no retiradas. Dividirla parte líneas o importes sin perder el origen.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Menú, productos, precios, horarios | Nube | Copia hacia el nodo |
| Mesas, pedidos del mesero, estados de cocina | Nodo en híbrido; nube en modo nube | `LineaCambioEstado` con hora, hacia la nube y hacia M6 |
| `IntencionPedidoQr` | Nube, hasta que se aplica | `PedidoQrPorAplicar` por el canal de la sede |
| Pedido ya aplicado | El dueño de la operación | El mismo evento de línea |
| Token de precuenta | Lo firma quien opera el salón | — |

Al aplicar una intención que esperó un corte, se usa la disponibilidad de ese momento. Si el plato no se puede enviar, la intención queda rechazada y no se duplica al reintentar.

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| Catálogo de menú | Producto, variante, modificador, combo, precio y horario de sede | El precio de sede no pisa la marca | Copia de menú | Nube |
| `AbrirMesa` | Zona, mesa, comensales | Pasa de libre a ocupada | `MesaAbierta` | Dueño de la operación |
| `AgregarProductos`, `EnviarACocina` | Líneas, tiempos | Enruta. Llama a M4 para el consumo. No bloquea por stock negativo | `LineaEnviada` | Dueño de la operación |
| `VerCartaDeLaSede`, `RegistrarIntencionPedidoQr` | Token de mesa | Una intención por envío | `PedidoQrPorAplicar` | Nube |
| `AplicarPedidoQr` | Intención | Abre o suma. Idempotente. Respeta "hoy no se repone" | `LineaEnviada` o rechazo | Dueño de la operación |
| `CrearPedidoInterno` | Pedido de M5 | Mismo enrutamiento, con canal y código externo | `LineaEnviada` | Dueño de la operación |
| `CambiarEstadoLinea` | Estación y estado | Solo avanza. Guarda la hora | `LineaCambioEstado` | Dueño de la operación |
| `MarcarNoSeEntrega`, `RetirarLineasNoSeRepone` | Aviso de M4 o de la estación | Lo no empezado sale y no se cobra. Lo empezado sigue, salvo marca de la estación | `LineaNoSeEntrega` | Dueño de la operación |
| `AnularLinea`, `AnularCuenta` | Motivo, autorización | Antes de empezar: devolución en M4. Después: merma. Pasa por M0 | `LineaAnulada` | Dueño de la operación |
| `MoverMesa`, `UnirMesas`, `TransferirProductos` | Destino | Permiso de M0 | `CuentaReasignada` | Dueño de la operación |
| `PedirCuenta`, `DividirCuenta` | Criterio de división | Imprime precuenta con token | `CuentaPedida` | Dueño de la operación |
| `AsociarReserva` | Llegada de M9 | Bloquea y luego abre la mesa de esa reserva | `MesaAbierta` | Dueño de la operación |
| `ConsultarCuenta` | Id de cuenta | La lee M2 | — | Dueño de la operación |

## 5. Contratos

**HTTP del salón** (nodo o nube, según el modo): mesas, líneas, anulación, precuenta, división.

**HTTP de administración:** menú de la marca y precios de la sede.

**Portal:** `GET/POST` de la carta bajo el token de mesa. No hay sesión de cliente.

**WebSocket:** cola por estación, aviso de listo, aviso de no se entrega, cuenta en vivo para caja.

**Puerto de entrada de M1:** `CrearPedidoInterno`, `AsociarReserva`, `ConsultarCuenta`.

**Hacia M4:** consumo, devolución o merma, en la misma operación de enviar o anular.

**Desde M4:** evento `DisponibilidadCambiada` (disponible, pocas unidades, agotado, no se repone hoy).

Los esquemas Zod viven en `compartido/contratos` y se escriben con el primer caso de uso que los necesite. El token de portal lleva sede, mesa y propósito, y vence.

## 6. Persistencia

`mesas`, `cuentas`, `pedidos`, `lineas_pedido` (con hora por estado), `menus`, `productos`, `variantes`, `modificadores`, `precios_sede`, `intenciones_pedido_qr`.

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
| Aviso "listo" | WebSocket del nodo. Con el celular bloqueado, el spike de la Fase 0 define el aviso | No hay cocina |

La PWA no reimplementa precios ni anulaciones: las pide al servidor del modo.

## 8. Seguridad y auditoría

Acciones que declaran permiso de PRD-01: abrir mesa no es sensible; anular, descontar, cortesía, cambiar precio, modificar tras la precuenta, transferir mesa a otro mesero, sí.

El portal no acepta esas acciones. El QR de mesa identifica la mesa, no a una persona. Un pedido desde fuera del local queda en esa mesa y el personal lo ve; la sede puede exigir aceptación en caja.

Eventos de auditoría: anulación, cambio de precio, cortesía, transferencia y "cliente avisado".

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| La línea no retrocede de estado | Dominio | De listo no vuelve a enviado |
| Unir una mesa libre o por limpiar | Dominio | Se rechaza |
| `Enrutador` | Dominio | El producto cae en su estación y la caja siempre está |
| `IntencionPedidoQr` no permite anular | Dominio | El comando no existe en ese agregado |
| `EnviarACocina` | Aplicación, en memoria | Llama una vez a M4 y publica la comanda |
| `AplicarPedidoQr` repetido | Aplicación | La segunda vez no duplica líneas |
| Anulación después de empezar | Aplicación | Sin autorización no cambia; con ella llama merma, no devolución |
| `DisponibilidadCambiada` con no se repone | Aplicación | Retira solo líneas no empezadas |
| `RepositorioPedidos` | Contrato, memoria, SQLite y PostgreSQL | La cuenta y las horas se leen igual |
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
| Aviso con el celular bloqueado | Spike de la Fase 0, antes de la entrega 1.2 |
| Alguien pide desde fuera con una foto del QR | Queda en la mesa; aceptación en caja opcional |
| Menú desactualizado en el nodo | La copia baja por el canal; el pedido usa la copia vigente al enviar |
| Impresora de comandas caída | La pantalla sigue y se avisa a caja |
