# PRD-M2 · Caja

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fase | 1 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M2](../trd/TRD-M2-caja.md) |
| Diagramas | [Flujo M2](../flujos/m2-caja.md) · [C4 M2](../arquitectura/componentes/c4-m2-caja.md) |

## 1. Resumen

M2 cobra la cuenta que armó el salón, registra cada medio de pago y cierra el turno con un arqueo a ciegas. La propina es voluntaria y se reparte aparte. Un turno cerrado no se edita: una corrección es un movimiento nuevo.

## 2. Alcance

**Incluye**

- Turnos por cajero: apertura con base por denominación, cierre parcial y cierre final.
- Medios: efectivo, tarjeta (datáfono registrado), transferencias y billeteras, bonos o vales, crédito a cliente o cuenta corporativa, anticipo de reserva y pago QR de la mesa.
- Pagos mixtos, división ya hecha en M1, cambio en efectivo, ingresos, egresos y retiros.
- Arqueo a ciegas por denominación y por medio. En tarjetas, contra el cierre de cada datáfono. En QR, contra el reporte de la pasarela.
- Propinas: fondo común por turno, día o semana; reparto equitativo, por porcentaje o por horas.
- Pago QR: el cliente paga el saldo exacto; el pago existe solo cuando la pasarela confirma.

**No incluye**

- Armar la cuenta y la precuenta: [PRD-M1](PRD-M1-pedidos-y-salon.md).
- Emitir e imprimir la factura o el comprobante: [PRD-M3](PRD-M3-facturacion.md). Aquí se pide al cerrar la venta, con los ítems y su clasificación tributaria; M3 calcula los impuestos.
- Integración directa con el datáfono (el monto viaja solo): Fase 5, ADR-007. En la Fase 1 el pago con tarjeta se registra.
- Varias pasarelas detrás del mismo contrato. Bold es una. La sede activa la que contrató. La comisión es la de ese contrato (D-46).
- Nómina. El reparto de propinas no calcula salario.

## 3. Usuarios y permisos

La matriz está en [PRD-01, 6.2](PRD-01-roles-y-permisos.md).

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Cajero | Abrir y cerrar su turno, cobrar, registrar ingresos y retiros | Egreso, retiro, cajón sin venta, diferencia de arqueo |
| Supervisor | Cobrar y aprobar diferencias dentro de su tope | No ve el total esperado antes de contar |
| Administrador | Aprobar diferencias más altas, cambiar medio de pago, reabrir cuenta, liquidar propinas | Según el tope de PRD-01 |
| Cliente en el QR | Pagar el saldo y dejar propina | No escribe el monto |
| Contador | Ver cierres e impuestos | No cobra |

El cajero y el supervisor no pueden ver el esperado antes de contar.

## 4. Historias de usuario

### HU-M2-01 · Abrir, contar y cerrar el turno

**Como** cajero, **quiero** abrir con la base contada y cerrar a ciegas, **para** que la diferencia salga de lo contado y no de lo que el sistema me muestra antes.

Criterios de aceptación:

- [ ] Dado un turno nuevo, cuando declara la base por denominación, entonces el turno queda abierto y es el único que recibe los cobros de esa caja.
- [ ] Dado el arqueo, cuando cuenta sin ver el esperado, entonces el sistema compara por medio y, si hay diferencia, pide justificación y aprobación de otra persona.
- [ ] Durante un corte: en híbrido el turno sigue en el nodo. En modo nube la caja está detenida.
- [ ] Queda auditado: el cierre, inmutable, y la aprobación de la diferencia.

### HU-M2-02 · Cobrar con varios medios

**Como** cajero, **quiero** cobrar una cuenta con uno o varios medios y preguntar la propina, **para** cerrar la venta y disparar la factura.

Criterios de aceptación:

- [ ] Dado una cuenta con precuenta, cuando cobra, entonces elige los datos de facturación si llegaron por dos vías, registra los medios, pregunta la propina y pide el documento a M3.
- [ ] Si hay anticipo de reserva, se abona y no entra al efectivo del arqueo.
- [ ] Durante un corte: el cobro queda en el nodo y M3 imprime el comprobante, que no es factura.
- [ ] Queda auditado: cajón sin venta, cambio de medio posterior y reapertura de una cuenta pagada.

### HU-M2-03 · Pagar desde el QR de la mesa

**Como** cliente, **quiero** pagar el saldo de mi mesa desde el celular, **para** no hacer fila en caja.

Criterios de aceptación:

- [ ] Dado un saldo, cuando la pasarela confirma una sola referencia por el monto exacto más la propina, entonces el pago entra al turno, sale la factura y la mesa pasa a por limpiar.
- [ ] Un segundo aviso con la misma referencia no cobra dos veces.
- [ ] Durante un corte de la sede: el cliente igual paga, porque su celular habla con la pasarela. El turno lo aplica al reconectar.
- [ ] Queda auditado: la referencia de la pasarela. En el arqueo ese total se compara con el reporte de la pasarela y no se mezcla con el efectivo.

### HU-M2-04 · Liquidar propinas

**Como** administrador, **quiero** repartir el fondo común de un periodo, **para** entregar a cada persona lo que le corresponde según la regla de la sede.

Criterios de aceptación:

- [ ] Dado el periodo (turno, día o semana), cuando liquida, entonces suma las propinas, toma de M8 a quienes trabajaron y reparte en partes iguales, por porcentaje que suma 100 %, o por horas.
- [ ] La regla usada queda dentro de la liquidación. Un cambio posterior no altera un periodo cerrado.
- [ ] Durante un corte: se puede liquidar en el nodo con las marcaciones ya copiadas. La impresión sale en el local.
- [ ] Queda auditado: el cambio de la regla de reparto. Una corrección es una liquidación de ajuste.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | Un turno cerrado no se modifica. La corrección es un movimiento nuevo | No |
| 2 | El arqueo es ciego para cajero y supervisor | No |
| 3 | La propina es voluntaria, se pregunta siempre, va separada de la venta y no es ingreso del restaurante. Cada sede elige partes iguales o porcentaje por empleado (D-24) | El periodo y la regla de reparto, por sede |
| 4 | Los porcentajes de reparto suman 100 % | Sí, dentro de esa suma |
| 5 | El pago QR no existe sin confirmación de la pasarela, y el monto lo fija la cuenta | No |
| 6 | Efectivo, datáfono y QR pueden convivir si la cuenta está dividida | No |
| 7 | El anticipo de reserva y el saldo de plataforma no entran al efectivo | No |
| 8 | En tarjeta se registran datáfono, aprobación, franquicia y últimos 4 dígitos | El datáfono de la sede: Credibanco, Bold o Redeban |
| 9 | Si portal y caja traen datos fiscales distintos, decide el cajero antes de cobrar | No |
| 10 | Las retenciones de un cliente corporativo se registran en el pago | Sí, cuando el cliente es agente de retención |

## 6. Pantallas y flujos

PWA de caja, en el PC o tablet de la caja:

- Apertura, movimientos, cobro, arqueo y cierre.
- Cuentas en vivo que llegan de M1.
- Conciliación del datáfono y del total QR.

Portal: saldo, propina y botón de pago. Sin teclado de monto.

Liquidación de propinas: imprimible, con el detalle por persona y espacio de firma.

Recorrido: [Flujo M2](../flujos/m2-caja.md).

## 7. Reportes y métricas que alimenta

M6 usa los cierres y los pagos para [PRD-00, 8.2](PRD-00-vision-producto.md) (ticket, medios de pago, propinas por venta) y [8.4](PRD-00-vision-producto.md) (diferencias de arqueo, cajón sin venta, cuentas reabiertas). El reparto alimenta [8.5](PRD-00-vision-producto.md).

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Turno de ensayo con todos los medios | Cuadra contra lo contado |
| Pago QR | Una sola confirmación, factura emitida, mesa por limpiar |
| Arqueo | El QR separado del efectivo |
| Liquidación de una semana real | Impresa y firmada por el personal |
| Acción sensible sin autorización | Bloqueada |

## 9. Preguntas abiertas

- Con el cobro QR activo se puede pagar con el turno cerrado. Ese pago no modifica el turno cerrado (D-44). El domicilio puede seguir con su QR aunque el salón cierre.
- Varias pasarelas; Bold es una (D-46).
- PA-43: integración directa con cada datáfono. Ver [registro](../preguntas-abiertas.md).
