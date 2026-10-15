# PRD-M9 · Reservas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 3 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M9](../trd/TRD-M9-reservas.md) |
| Diagramas | [Flujo M9](../flujos/m9-reservas.md) · [C4 M9](../arquitectura/componentes/c4-m9-reservas.md) |

## 1. Resumen

M9 reserva una mesa y, si la sede lo pide, cobra por reservarla. El cobro del piloto es una transferencia a Nequi, Daviplata o Bre-B que alguien verifica en la cuenta. El anticipo se abona cuando el cliente consume. La política de devolución queda guardada en la reserva, así un cambio posterior no la reescribe.

## 2. Alcance

**Incluye**

- Reserva con cliente, teléfono, fecha, hora, personas, zona o mesa, ocasión y notas.
- Canales: el personal (teléfono, WhatsApp, en persona) y, en la entrega 3.8, un enlace público por sede.
- Disponibilidad por franja, duración estimada y mesas reservables.
- La mesa se bloquea en el plano un tiempo antes de la hora.
- Estados: pendiente de pago, confirmada, cliente llegó, no llegó, cancelada.
- Cobro desde $0 hasta una tarifa, por sede, franja o tamaño de grupo. Anticipo que se abona, o tarifa que no se abona.
- Valor fijo, por persona o porcentaje de un consumo mínimo.
- Transferencia con comprobante, verificación en la cuenta y devolución por tramos.
- Reserva provisional si la sede la crea sin internet, y conflicto si al subir no hay cupo.

**No incluye**

- Pasarela con confirmación automática (ADR-012, Fase 5). No se usa la pasarela del pago QR de la mesa.
- Confirmación y recordatorio por WhatsApp, SMS o correo (Fase 5).
- El cobro de la cuenta del restaurante: al llegar, la mesa y la cuenta son de M1, y el anticipo entra en M2.
- Un pantallazo como prueba suficiente. Confirmar exige que alguien verifique el dinero en la cuenta.

## 3. Usuarios y permisos

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Anfitrión, cajero | Crear, recibir, marcar llegó o no llegó, verificar el pago | No para verificar (PRD-01 lo permite) |
| Administrador | Políticas, cuentas de recaudo, aprobar devoluciones | La devolución, si el rol del cajero no la tiene |
| Supervisor | Verificar pagos. Aprobar devolución solo con autorización si su matriz lo marca | Según PRD-01, 6.4 |
| Cliente en el enlace | Crear la reserva y ver la política vigente | No confirma el pago él solo |
| Contador | Ver anticipos retenidos e ingresos por reservas | No |

## 4. Historias de usuario

### HU-M9-01 · Reservar y cobrar

**Como** anfitrión, **quiero** registrar la reserva y el cobro por transferencia, **para** confirmarla solo cuando el dinero esté en la cuenta.

Criterios de aceptación:

- [ ] Dado fecha, hora y personas, cuando hay cupo, entonces la reserva queda pendiente de pago si la franja cobra, o confirmada si el valor es $0.
- [ ] El mensaje al cliente lleva valor, datos de Nequi, Daviplata o Bre-B y la referencia de la reserva.
- [ ] Pasa a confirmada cuando alguien con permiso marca el pago verificado. El comprobante queda adjunto. Quién verificó y cuándo queda registrado.
- [ ] Durante un corte: una reserva creada en la sede queda provisional y sube al reconectar. La verificación hecha sin internet también sube.
- [ ] Queda auditado: la verificación y un rechazo del comprobante.

### HU-M9-02 · Llegar a la mesa

**Como** anfitrión, **quiero** ver la reserva en el plano y sentar al cliente, **para** que el anticipo quede en su cuenta.

Criterios de aceptación:

- [ ] Dado el día de la reserva, cuando falta el tiempo configurado, entonces la mesa aparece bloqueada.
- [ ] Al marcar que llegó, se abre la mesa y la cuenta en M1. Al cobrar, el anticipo se abona y no entra al efectivo.
- [ ] Si no llega, se aplica la política guardada en la reserva.
- [ ] Durante un corte: llegada y no llegada se registran en el nodo y suben después.

### HU-M9-03 · Cancelar con la política de ese día

**Como** administrador, **quiero** que la devolución siga los tramos que el cliente vio al reservar, **para** que un cambio de política no cambie una reserva ya hecha.

Criterios de aceptación:

- [ ] Dado una cancelación, cuando se aplica la política, entonces el tramo (por ejemplo más de 24 h, entre 12 y 24, menos de 12) define el porcentaje, de 0 a 100.
- [ ] La devolución se hace por transferencia y lleva su comprobante.
- [ ] La política mostrada al reservar es la que queda copiada. Un cambio posterior no la afecta.
- [ ] Queda auditado: quién aprobó la devolución y el comprobante.

### HU-M9-04 · Reservar por el enlace

**Como** cliente, **quiero** reservar desde un enlace de la sede y ver cuánto se cobra y qué se devuelve, **para** no depender de una llamada.

Criterios de aceptación:

- [ ] Dado el enlace, cuando elige franja y personas, entonces ve la política y el valor antes de confirmar.
- [ ] Si no hay cupo, no se crea.
- [ ] El pago sigue siendo transferencia verificada por el personal.
- [ ] Queda auditado: la reserva nace con el canal enlace público.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | El cobro puede ser $0, un anticipo que se abona, o una tarifa que no se abona | Por sede, franja y tamaño de grupo |
| 2 | El valor es fijo, por persona o un porcentaje de un consumo mínimo | Sí |
| 3 | La reserva de pago no se confirma con el pantallazo. Alguien verifica el dinero en la cuenta | No |
| 4 | El número de transacción es único por cuenta de recaudo | No |
| 5 | La política de devolución se copia en la reserva | Tramos y porcentajes, por sede |
| 6 | La mesa se bloquea un tiempo antes. Al llegar se asocia a una cuenta | El tiempo, por sede |
| 7 | El anticipo viaja en la factura como anticipo y no entra al efectivo del arqueo | No |
| 8 | Una reserva provisional que choca con otra cupo queda en conflicto para que el administrador decida | No |
| 9 | Una pendiente de pago sin verificar se libera al vencer el plazo | El plazo |

## 6. Pantallas y flujos

Web y caja: agenda del día, plano con mesas bloqueadas, verificación, llegada, no llegada y devoluciones.

Enlace público, mobile first: disponibilidad, política visible y datos para transferir.

Cuentas de recaudo por sede: Nequi, Daviplata, llave o QR Bre-B.

Recorrido: [Flujo M9](../flujos/m9-reservas.md).

## 7. Reportes y métricas que alimenta

[PRD-00, 8.6](PRD-00-vision-producto.md): reservas por día, franja y canal; tasa de no llegada; ocupación; anticipos abonados, tarifas y montos retenidos; ticket de mesas con reserva contra mesas sin reserva.

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Una semana de reservas de una sede | Manejadas en el sistema |
| Anticipo | Cobrado, verificado y abonado a la cuenta |
| Cancelación | Una devolución parcial según el tramo |
| Enlace público | Reservas reales creadas por clientes |
| Comprobante falso | No confirma la reserva |

## 9. Preguntas abiertas

| # | Pregunta | Responsable |
|---|----------|-------------|
| 1 | Política y cuentas de recaudo de cada sede del piloto | Administrador, antes de la Fase 3 |
| 2 | Pasarela con confirmación automática | ADR-012, Fase 5. No bloquea este módulo |
