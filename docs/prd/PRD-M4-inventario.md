# PRD-M4 · Inventario, bodegas y recetas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.4 |
| Fecha | 2026-10-17 |
| Fase | 2 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M4](../trd/TRD-M4-inventario.md) |
| Diagramas | [Flujo M4](../flujos/m4-inventario.md) · [C4 M4](../arquitectura/componentes/c4-m4-inventario.md) |

## 1. Resumen

M4 sabe qué se gastó, qué hay y qué se puede volver a preparar. El stock vive en el punto de la sede y en las bodegas. Las recetas son de la marca. Una venta no se frena porque el conteo quede negativo; sí se frena un plato cuando alguien confirma que hoy no se repone.

## 2. Alcance

**Incluye**

- Insumos con unidad de compra, de inventario y de receta.
- Recetas por producto y variante, sub-recetas, rendimiento, modificadores y versiones. Importación desde Excel.
- Compras, recepción a costo real, costo promedio, proveedores.
- Documento soporte y carga de facturas de proveedores, por Factus.
- Producción de preparaciones intermedias. El costo es configurable: promedio de los insumos consumidos, o costo estándar (D-26).
- Traslados: solicitado, despachado, en tránsito, recibido, recibido con diferencias. Incluye bodega general y traslados entre sedes. El costo del origen viaja tal cual (D-27). M4 dispara la impresión del comprobante de traslado; las plantillas y el controlador son compartidos (`shared/printing`).
- Bodega general del piloto con su propio nodo en modo bodega, con internet y personal propio (D-04).
- Mermas, conteos y ajustes contra el teórico. Un ajuste por encima del tope pide aprobación; el tope es configurable y parte de $1.000 (D-28).
- Unidades posibles, ingrediente limitante y disponibilidad en el menú del mesero.
- Alerta temprana por niveles y por cobertura, con reposición u orden de compra en un toque.
- Marca "hoy no se repone", confirmada por una persona.

**No incluye**

- Descontar al cobrar. Se descuenta al enviar a cocina (regla 2 de PRD-00).
- Inventario por estación. La estación no tiene stock.
- Contabilidad de la compra. Se exporta información; no se reemplaza el software contable.
- WhatsApp o correo de la alerta (Fase 5). En esta fase avisa en caja, cocina y celular dentro del sistema.
- La pantalla del mesero: [PRD-M1](PRD-M1-pedidos-y-salon.md) muestra agotado y el aviso.
- Operar una bodega general desde la web de administración, sin nodo. Queda abierto para clientes pequeños después del piloto (ADR-010, PA-44).

## 3. Usuarios y permisos

La matriz está en [PRD-01, 6.3](PRD-01-roles-y-permisos.md).

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Jefe de cocina | Ver recetas, merma dentro del tope, conteo, pedir reabastecimiento, confirmar que hoy no se repone | Merma por encima del tope |
| Bodeguero | Recibir compras, despachar y recibir traslados, conteos de su bodega | Recibir con diferencias; ajuste |
| Compras | Proveedores, órdenes, recepción y costos | No |
| Administrador de sede | Niveles, aprobar un ajuste de conteo por encima del tope (D-28), ver costos | Ajuste de inventario |
| Gerente y propietario | Recetas, costos y margen de su alcance | No |
| Mesero | Ver agotado o pocas unidades. No ve costos | No |

## 4. Historias de usuario

### HU-M4-01 · Cargar recetas y ver el costo

**Como** administrador, **quiero** cargar insumos y recetas de la marca, **para** conocer el costo teórico y el margen de cada plato.

Criterios de aceptación:

- [ ] Dado un Excel de insumos y recetas, cuando se importa, entonces cada plato tiene costo teórico, rendimiento y versión.
- [ ] Un modificador "extra queso" suma y "sin cebolla" resta.
- [ ] Durante un corte: la sede híbrida sigue con la versión ya copiada. Una receta nueva espera y baja al reconectar.
- [ ] Queda auditado: cada versión nueva. La venta ya enviada conserva la versión con la que se descontó.

### HU-M4-02 · Descontar al enviar a cocina

**Como** jefe de cocina, **quiero** que el inventario del punto baje al enviar el plato, **para** que el teórico refleje lo que salió a producción y no lo que se cobró horas después.

Criterios de aceptación:

- [ ] Dado una receta vigente, cuando M1 envía el producto, entonces se descuentan los ingredientes del punto, en la unidad de receta.
- [ ] Si se anula antes de empezar, se devuelve. Si se anula después, queda merma con motivo.
- [ ] Si no alcanza, el stock queda negativo, hay alerta y la venta sigue.
- [ ] Durante un corte: el movimiento queda en el nodo del punto.
- [ ] Queda auditado: la merma, con motivo y responsable.

### HU-M4-03 · Reabastecer desde la bodega

**Como** bodeguero, **quiero** despachar un traslado y que el punto confirme lo recibido, **para** que las diferencias no se pierdan.

Criterios de aceptación:

- [ ] Dado un traslado, cuando la bodega despacha y el punto recibe, entonces pasa por solicitado, despachado, en tránsito y recibido. El comprobante lleva QR.
- [ ] Si lo recibido no coincide, queda "recibido con diferencias" y hace falta permiso para aceptarlo.
- [ ] Durante un corte: bodega de la sede y punto, en el mismo nodo, siguen. Entre dos nodos, cada uno registra su mitad y se reconcilian al reconectar.
- [ ] Queda auditado: quién despachó, quién recibió y la diferencia.

### HU-M4-04 · Avisar antes de quedarse sin producto

**Como** administrador, **quiero** una alerta cuando el stock o la cobertura bajan, **para** crear la reposición o la compra con un toque.

Criterios de aceptación:

- [ ] Dado niveles por insumo y ubicación, cuando el stock cruza el punto de reposición, entonces hay alerta amarilla; en el mínimo, roja; en cero, crítica, y los platos que lo usan se marcan agotados.
- [ ] La cobertura usa el consumo de ese día de la semana. Por ejemplo: "al ritmo de los viernes alcanza para 3 horas".
- [ ] La alerta pasa por abierta, vista y resuelta. Se resuelve sola al superar el punto de reposición. Si nadie atiende una roja, escala.
- [ ] Durante un corte: se evalúa en el nodo de la sede.
- [ ] Queda auditado: quién vio la alerta y qué pedido creó desde ella.

### HU-M4-05 · Confirmar que hoy no se repone

**Como** jefe de cocina, **quiero** confirmar que un plato no sale en este servicio, **para** que el mesero avise al cliente y no se siga pidiendo.

Criterios de aceptación:

- [ ] El sistema lo propone solo si el punto no alcanza, las bodegas que abastecen tampoco y no hay un traslado en camino. Hasta la confirmación no se retiran platos de las mesas.
- [ ] Confirmado, el plato queda agotado en el menú y en las plataformas hasta el fin del servicio o hasta quitar la marca.
- [ ] Durante un corte: la confirmación vale en el nodo y el aviso al mesero sale por el mismo canal que "pedido listo".
- [ ] Queda auditado: quién confirmó, en qué mesas cayó y quién marcó cliente avisado (en M1).

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | Una venta no se bloquea por inventario negativo | No |
| 2 | El consumo se descuenta al enviar a cocina, con la versión de receta de ese momento | No |
| 3 | Anulación antes de empezar devuelve; después es merma | No |
| 4 | El stock es la suma de movimientos. No se edita el saldo a mano | No |
| 5 | El costo de la recepción es el real. El promedio se recalcula con esa entrada | No |
| 6 | Un traslado entre dos dueños son dos mitades con el mismo identificador. La bodega general del piloto es un dueño aparte, con su propio nodo (D-04) | No |
| 7 | La disponibilidad del menú usa solo el inventario del punto | No |
| 8 | "Hoy no se repone" exige confirmación de una persona | No |
| 9 | Niveles: máximo, punto de reposición, mínimo y agotado, por insumo y ubicación | Sí |
| 10 | La cobertura usa el consumo promedio de ese día de la semana. El sistema sugiere mínimo, punto de reposición y máximo, y la sede puede aceptarlos o escribirlos (D-32) | El sistema sugiere niveles; el administrador los ajusta |
| 11 | Una alerta roja sin atender escala de cocina a administrador y de ahí al gerente | El tiempo, por sede |
| 12 | El costo de lo producido es el promedio de los insumos consumidos o un costo estándar (D-26) | Sí, por empresa |
| 13 | El traslado mueve el costo del origen tal cual, sin sumarle nada (D-27) | No |
| 14 | Un ajuste por conteo por encima del tope pide aprobación. El predeterminado es $1.000 (D-28) | El tope, por empresa; la sede lo puede bajar |

## 6. Pantallas y flujos

Web de administración: insumos, recetas, versiones, importación, costos, niveles y consolidado.

En la sede, celular o PC: compras, recepción, producción, conteo, traslados y alertas. El QR del comprobante abre la recepción.

Cocina y caja: alerta y acción de un toque. El menú del mesero solo muestra el resultado.

Estados del traslado y de la alerta: [Flujo M4](../flujos/m4-inventario.md).

## 7. Reportes y métricas que alimenta

M6 calcula [PRD-00, 8.3](PRD-00-vision-producto.md): costo de alimentos, teórico contra real, mermas, valor del inventario, rotación, unidades posibles, alertas y cobertura. Los ajustes y los traslados con diferencias alimentan [8.4](PRD-00-vision-producto.md).

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Recetas de la sede piloto | Cargadas, con costo teórico y margen |
| Consumo de un servicio | Coincide con las recetas de lo vendido |
| Conteo físico | Diferencia contra el teórico registrada |
| Ciclo bodega general → punto | Completo, incluso si la sede recibe sin internet |
| Alertas | Al menos un caso real avisado antes del quiebre |
| Teórico contra real | Medido en al menos 3 sedes durante 1 mes |

## 9. Preguntas abiertas

- D-49: el conteo de inventario es a ciegas, como el arqueo. Ver [registro](../preguntas-abiertas.md).
- PA-44: bodega general operada desde la web para clientes pequeños, después del piloto. Ver [registro](../preguntas-abiertas.md).
