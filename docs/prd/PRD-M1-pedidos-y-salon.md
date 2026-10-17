# PRD-M1 · Pedidos y salón

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fase | 1 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M1](../trd/TRD-M1-pedidos-y-salon.md) |
| Diagramas | [Flujo M1](../flujos/m1-pedidos-y-salon.md) · [C4 M1](../arquitectura/componentes/c4-m1-pedidos-y-salon.md) |

## 1. Resumen

M1 es el camino de la mesa: el mesero, o el cliente desde el QR, arma el pedido; la cocina lo prepara por estación; la caja ve la cuenta. El menú es de la marca y cada sede ajusta precio, horario y disponibilidad. Un pedido de 4 productos debe tomarse en menos de 30 segundos y llegar a cocina en menos de 2 segundos (p90).

## 2. Alcance

**Incluye**

- Menú por marca: productos, variantes, modificadores con y sin costo, combos, clasificación tributaria, precios, disponibilidad y horarios por sede.
- Plano de mesas por zona y estados: libre, ocupada, cuenta pedida, por limpiar.
- Toma en el celular del mesero, en un punto fijo, o desde el QR fijo de la mesa.
- Envío por tiempos, reenvío, enrutamiento a estación (pantalla, impresora o ambas) y avisos de "listo".
- Mover mesa, unir mesas y transferir productos entre cuentas.
- Anulación, con devolución o merma según si cocina empezó.
- Precuenta con QR de facturación y división de la cuenta.
- Aviso al mesero cuando un plato marcado "hoy no se repone" ya no se puede entregar.

**No incluye**

- Cobro, propina y arqueo: [PRD-M2](PRD-M2-caja.md).
- Factura DIAN e impresión de la factura y del comprobante: [PRD-M3](PRD-M3-facturacion.md). M1 sí dispara la impresión de la comanda y de la precuenta. Las plantillas y el controlador de impresión son compartidos (`shared/printing`) y no son de ningún módulo.
- Recetas, stock y la decisión de "hoy no se repone": [PRD-M4](PRD-M4-inventario.md). Aquí se muestra el resultado y se avisa al mesero.
- Domicilio y plataformas: [PRD-M5](PRD-M5-domicilios.md). Cuando se aceptan, entran como pedido interno de este módulo.
- WhatsApp o correo al cliente (Fase 5).

## 3. Usuarios y permisos

La matriz está en [PRD-01, 6.1](PRD-01-roles-y-permisos.md).

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Mesero | Abrir mesa, pedir, enviar, entregar, pedir la cuenta, mover productos | Anular después de que cocina empieza; anular antes de cocina por encima del tope del turno |
| Cajero | Ver todas las cuentas, aceptar un pedido QR si la sede lo exige | Modificar la cuenta después de la precuenta, si el permiso lo marca |
| Jefe de cocina y estación | Ver su cola, marcar en preparación y listo, marcar que una línea no se puede terminar | No para avanzar estados |
| Cliente en el QR | Ver la carta de esa sede y sumar productos a la mesa | No puede anular, descontar ni cambiar precios |
| Administrador | Editar menú y precios de su alcance, con el tope de PRD-01 | Cambiar el precio dentro de una venta ya abierta |

## 4. Historias de usuario

### HU-M1-01 · Tomar y enviar un pedido

**Como** mesero, **quiero** armar un pedido con variantes, modificadores y notas y enviarlo por tiempos, **para** que cada producto llegue a su estación sin pasar por caja.

Criterios de aceptación:

- [ ] Dado un menú cargado y una mesa libre, cuando envía 4 productos, entonces cada uno queda en su estación en menos de 2 s (p90) y la cuenta aparece en caja.
- [ ] Durante un corte: en híbrido el envío sigue en el nodo. En modo nube el salón está detenido.
- [ ] Queda auditado: apertura de mesa, envío y, si aplica, la autorización de una anulación o un cambio de precio.

### HU-M1-02 · Pedir desde el QR de la mesa

**Como** cliente, **quiero** escanear el QR de mi mesa y pedir sin instalar nada, **para** no esperar a que el mesero tome el pedido.

Criterios de aceptación:

- [ ] Dado el QR de una mesa, cuando el cliente envía, entonces se abre la mesa si estaba libre, o se suma a la cuenta si estaba ocupada, con canal QR mesa.
- [ ] Durante un corte: la intención queda en la nube y entra a cocina al reconectar, una sola vez. Si al aplicar el plato ya no se puede enviar, no entra a cocina.
- [ ] Queda auditado: la intención y su aplicación. El cliente no genera anulaciones.

### HU-M1-03 · Cocina marca listo

**Como** estación de cocina, **quiero** tomar la comanda y marcarla lista, **para** que el mesero recoja el plato.

Criterios de aceptación:

- [ ] Dado un producto enviado, cuando la estación lo pasa a en preparación y luego a listo, entonces el mesero recibe el aviso y cada paso guarda la hora del nodo.
- [ ] Durante un corte: la pantalla y la impresora de comandas siguen en el nodo híbrido. Si la impresora falla, la comanda sigue en pantalla y se avisa a caja.
- [ ] Queda auditado: el cambio de estado con hora. No es una acción sensible, salvo marcar que no se entrega.

### HU-M1-04 · Anular antes o después de cocina

**Como** mesero, **quiero** anular un producto mal pedido, **para** que no se cobre y el inventario quede bien.

Criterios de aceptación:

- [ ] Dado un producto aún no empezado y dentro del tope del turno, cuando el mesero anula, entonces sale de la cuenta y M4 devuelve el consumo.
- [ ] Dado un producto ya en preparación, cuando se anula, entonces hace falta autorización de otra persona y M4 registra merma con motivo.
- [ ] Durante un corte: la anulación sigue en el nodo híbrido, con la misma autorización.
- [ ] Queda auditado: quién pidió, quién autorizó, motivo, valor y si fue antes o después de cocina.

### HU-M1-05 · Avisar que hoy no sale un plato

**Como** mesero, **quiero** enterarme al momento si un plato de mi mesa no se va a entregar, **para** decírselo al cliente sin que el resto de la cuenta se detenga.

Criterios de aceptación:

- [ ] Dado que cocina o administración confirmó "hoy no se repone", cuando hay líneas enviadas que cocina no ha empezado, entonces salen de la cola, no se cobran y el mesero de esa mesa recibe el aviso.
- [ ] Lo que ya está en preparación, listo o entregado sigue, salvo que la estación marque esa línea.
- [ ] Queda auditado: quién confirmó que no se repone (en M4) y quién marcó "cliente avisado".

### HU-M1-06 · Pedir la cuenta

**Como** mesero, **quiero** imprimir la precuenta con QR y poder dividirla, **para** que el cliente deje sus datos y la caja cobre.

Criterios de aceptación:

- [ ] Dado una mesa ocupada, cuando pide la cuenta, entonces se imprime la precuenta con QR, la mesa pasa a cuenta pedida y se puede dividir por comensal, por productos o en partes iguales.
- [ ] Durante un corte: la precuenta se imprime en el nodo. El cliente llena el portal con sus datos; la caja los ve al reconectar.
- [ ] Queda auditado: modificar la cuenta después de imprimir la precuenta, cuando PRD-01 lo exige.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | El menú es de la marca. La sede ajusta precio, disponibilidad y horario | Sí, por sede |
| 2 | Cada producto va a una estación. La caja siempre ve la cuenta. La estación no tiene stock | La estación y la salida (pantalla, impresora o ambas) |
| 3 | El pedido QR sale directo a cocina, salvo que la sede exija aceptación en caja. En el piloto esa opción empieza apagada (D-23) | Sí, por sede |
| 4 | El cliente del QR no anula, no descuenta y no cambia precios | No |
| 5 | Una venta no se bloquea por inventario negativo. Sí se bloquea el plato marcado "hoy no se repone" | La marca la confirma una persona (M4) |
| 6 | El consumo se descuenta al enviar a cocina, no al cobrar | No |
| 7 | Anular después de que cocina empieza exige autorización | Topes en PRD-01 |
| 8 | Mover, unir o transferir solo mientras la mesa sigue ocupada o en cuenta pedida | No |
| 9 | Al pagar, la mesa pasa a por limpiar. Volver a libre es una acción del salón | No |
| 10 | Cada cambio de estado guarda la hora del nodo | No |

## 6. Pantallas y flujos

PWA de la sede, primero en celular de gama media:

- Plano de mesas por zona.
- Toma de pedido: búsqueda, variantes, modificadores, notas, envío por tiempos.
- Aviso de listo y de "no se entrega", con confirmación de cliente avisado.
- Precuenta y división.

Cocina, en tablet o TV: cola por estación, semáforo de tiempos, en preparación y listo.

Web de administración: menú de la marca y ajustes de la sede.

Portal, sin cuenta ni instalación: carta de esa mesa y envío. El pago y los datos fiscales son de M2 y M3.

Estados y secuencia: [Flujo M1](../flujos/m1-pedidos-y-salon.md).

## 7. Reportes y métricas que alimenta

Cada cambio de estado guarda la hora. M6 calcula [PRD-00, 8.1](PRD-00-vision-producto.md): toma, espera en cocina, preparación, entrega, servicio total, duración de la mesa y tiempo de cobro. También ventas por canal (mesero o QR mesa), productos más y menos vendidos, rotación de mesas y anulaciones ([8.2](PRD-00-vision-producto.md) y [8.4](PRD-00-vision-producto.md)).

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Llegada a cocina dentro del local | Menos de 2 s (p90) |
| Pedido de 4 productos | Menos de 30 s para un mesero entrenado |
| Menú de la sede piloto | Cargado y visible en el celular |
| Pedido QR en un servicio de prueba | Llega a la estación correcta |
| Pedido QR durante un corte | Entra al reconectar, sin duplicarse |
| Anulación sin permiso | Bloqueada |

## 9. Preguntas abiertas

- PA-30: aviso al mesero con el celular bloqueado y sin internet. Ver [registro](../preguntas-abiertas.md).
- El cobro del bartender (D-22) y la aceptación en caja del pedido QR (D-23) quedaron decididos. Ver [registro](../preguntas-abiertas.md).
