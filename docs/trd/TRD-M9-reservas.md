# TRD-M9 · Reservas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-17 |
| Fase | 3 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M9](../prd/PRD-M9-reservas.md) |
| Diagramas | [C4 M9](../arquitectura/componentes/c4-m9-reservas.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Reserva y cobro | Dueños la nube. Pueden nacer fuera del local |
| Atención del día | Dueño el nodo en híbrido: llegada, mesa, no llegada, provisional. En modo nube también es la nube |
| Medio de cobro | Depende del canal (D-01). Por enlace, llamada o chat: solo transferencia verificada por una persona. En persona en la sede: transferencia verificada o efectivo |
| Transferencia | Verificada por una persona en la app del banco (ADR-012). No hay webhook bancario |
| Efectivo | Solo con canal `in_person`. Lo recibe la caja y queda registrado en el turno abierto de M2. Sin turno abierto no se acepta |
| Pasarela | En el piloto no hay pasarela: el cobro es verificación manual o efectivo en la sede. La entrega 5.3 agrega el puerto `ReservationGateway`, propio de M9 y distinto de `PaymentGateway` del QR (ADR-012, PA-45) |
| Política | Se copia dentro de la reserva al crearla |
| Cupo | Lo valida la nube. Sin internet, la sede crea una provisional y la nube confirma o marca conflicto |
| Anticipo | `ApplyDeposit` lo entrega a M2. En la factura viaja como anticipo (`prepayment_details` en el documento de M3) |
| Código | `contexts/reservations/domain`, `contexts/reservations/application` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `Reservation` | Estados `pending_payment`, `confirmed`, `arrived`, `no_show`, `cancelled`, `provisional`, `conflict`. Canal `public_link`, `phone`, `chat` o `in_person`. No pasa a `confirmed` sin pago verificado, salvo valor $0 |
| Agregado | `ReservationPayment` | Estados `pending`, `receipt_received`, `verified`, `rejected`. Medio `transfer` o `cash`. `cash` solo si la reserva tiene canal `in_person`. El número de transacción es único por cuenta de recaudo y solo aplica a `transfer` |
| Regla | `ReservationPolicy` | Copia inmutable en la reserva. Tramos de anticipación con porcentaje de 0 a 100. Distingue anticipo abonable de tarifa no abonable |
| Regla | Disponibilidad | Capacidad de la franja, duración y mesas reservables. Sin cupo no hay reserva confirmada |
| Agregado | `ReservationSeating` | Bloqueo de mesa, llegada, no llegada. La llegada abre mesa y cuenta en M1 |
| Entidad | `ReservationRefund` | Monto según el tramo, con comprobante. No edita el cobro verificado: lo referencia |

Transiciones de `Reservation`:

| Desde | Hacia | Cuándo |
|-------|-------|--------|
| — | `pending_payment` | La franja cobra |
| — | `confirmed` | Valor $0 |
| — | `provisional` | La sede la crea sin canal con la nube |
| `provisional` | `confirmed` o `pending_payment` | La nube encuentra cupo, según el cobro |
| `provisional` | `conflict` | La nube no encuentra cupo |
| `conflict` | `confirmed`, `pending_payment` o `cancelled` | Lo decide una persona con `ResolveConflict` |
| `pending_payment` | `confirmed` | Pago `verified`, por transferencia o en efectivo |
| `pending_payment` | `cancelled` | Vence el plazo o se cancela |
| `confirmed` | `arrived`, `no_show` o `cancelled` | El día de la reserva, o una cancelación |

Un conflicto de cupo no se resuelve solo. Lo cierra `ResolveConflict`.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Reserva, cobro, política copiada, comprobantes | Nube | `DayReservations` hacia el nodo |
| Llegada, no llegada, mesa | Nodo en híbrido | Hacia la nube |
| Provisional creada sin internet | Nodo, hasta que la nube confirma | `ProvisionalReservationCreated` |
| Verificación hecha sin internet | Nodo | Sube y la nube la aplica si el cobro sigue pendiente |
| Cobro en efectivo en la sede | Dueño de la caja, en el turno abierto | Sube con el turno y confirma el cobro en la nube |
| Anticipo aplicado | Dueño de la caja | Lo registra M2 |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `CreateReservation`, `CheckAvailability` | Fecha, hora, personas, canal | Copia la política. Guarda el canal. Sin cupo, rechaza | `DayReservations` | Nube. El enlace público entra por aquí |
| `CreateProvisionalReservation` | La caja, sin canal con la nube | Queda `provisional` | Sube al reconectar | Nodo |
| `ConfirmProvisionalReservation`, `ResolveConflict` | Cupo al recibirla | Confirma o deja el `conflict` a una persona | — | Nube |
| `BuildPaymentMessage` | Reserva pendiente | Valor, cuentas de la sede y referencia | — | Nube |
| `AttachReceipt`, `VerifyPayment`, `RecordOfflineVerification` | Comprobante y número de transacción | Medio `transfer`. Número único. Verificar exige `reservation.verify_payment`. El pantallazo no confirma solo | `PaymentVerified` | Nube, o nodo si no hay enlace |
| `RecordCashPayment` | Reserva `in_person`, valor, turno abierto | Rechaza si el canal no es `in_person` o no hay turno abierto. Registra el ingreso en el turno con `RecordReservationCash` de M2 y deja el cobro `verified` | `PaymentVerified` | Dueño de la caja |
| `CancelReservation`, `ApplyPolicy` | Momento de la cancelación o no llegada | Usa la copia, no la política vigente | `RefundDue` si el tramo lo dice | Nube |
| `RecordRefund` | Comprobante de la transferencia de vuelta | Exige `reservation.approve_refund` | Auditoría | Nube |
| `BlockTable`, `RecordArrival`, `RecordNoShow` | Reloj y plano | Llegada llama a M1 `AttachReservation` | `SeatingRecorded` | Dueño de la operación |
| `ApplyDeposit` | Cuenta de M2 | El de transferencia no entra al efectivo; el de efectivo no se arquea otra vez. Una sola vez | — | Dueño de la operación |
| `ReleaseUnpaidReservations` | Worker | Vence las no verificadas | Mesa libre | Nube |

## 5. Contratos

**HTTP de administración y de caja:** crear, verificar, cobrar en efectivo, llegar, no llegó, resolver conflicto, devolver.

**Enlace público:** disponibilidad y alta. Sin sesión de cliente. Muestra la política que se va a copiar. Solo ofrece transferencia.

**Puerto de entrada** (`entry-port.ts`): `ApplyDeposit`.

**Hacia M1:** evento `DayReservations` y, al llegar, `AttachReservation` para asociar mesa y cuenta.

**Hacia M2:** el cobro en efectivo se registra como ingreso del turno abierto. El nombre de esa entrada de M2 lo fija TRD-M2.

**Hacia M3:** el anticipo va en el documento de venta. M9 no llama a Factus.

**Archivos:** comprobante de pago y de devolución en el almacén de objetos.

No hay webhook bancario. Los esquemas Zod viven en `shared/contracts`.

## 6. Persistencia

`reservations`, `reservation_policies`, `reservation_payments`, `reservation_refunds`, `reservation_seatings`, `collection_accounts`.

- La política copiada es un documento dentro de la reserva, no una clave que cambie si editan la plantilla.
- `reservations.channel` y `reservation_payments.method` guardan el canal y el medio; una restricción impide `cash` si el canal no es `in_person`.
- `transaction_number` único por cuenta de recaudo, cuando el medio es `transfer`.
- PostgreSQL con `tenant_id` y Row Level Security para reservas y cobros.
- El nodo guarda en SQLite la atención y la copia de las reservas del día, no el histórico de la empresa.
- Comprobantes en el almacén de objetos. El nodo no los necesita para sentar al cliente.

## 7. Operación sin internet

Crear desde la caja deja una provisional. Verificar un pago también se anota en el nodo. Al reconectar, la nube confirma la provisional si hay cupo, o la marca en conflicto. La verificación se aplica si el cobro sigue pendiente; si alguien ya lo verificó en la nube, no se duplica el anticipo.

El cobro en efectivo de una reserva hecha en persona queda en el turno del nodo y sube con él. Si la reserva era provisional y termina en conflicto, el efectivo ya está en el turno; la resolución decide si se confirma o se devuelve.

Llegada, no llegada y bloqueo de mesa siguen en el nodo. El enlace público no: vive en la nube y durante un corte el cliente no crea por ahí.

El anticipo se abona en el nodo al cobrar, con la copia del cobro verificado que ya bajó. Si la verificación todavía no bajó, la caja no inventa el anticipo.

## 8. Seguridad y auditoría

Permisos: `reservation.verify_payment` (verificar pago) y `reservation.approve_refund` (aprobar devolución). Quien verifica queda en la cadena, con la hora y el número de transacción. El cobro en efectivo queda con el cajero y el turno que lo recibió.

El enlace público no lista reservas de otras personas ni muestra saldos de la cuenta bancaria más allá de los datos de recaudo que la sede publicó.

El comprobante no es secreto operativo, pero no se sirve sin el permiso de la reserva. Exportarlo es un dato personal y pasa por la auditoría.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Confirmar sin verificación cuando el valor es mayor a cero | Dominio | Se rechaza |
| Valor $0 | Dominio | Pasa a `confirmed` sin cobro |
| Efectivo con canal `public_link`, `phone` o `chat` | Dominio | Se rechaza |
| Efectivo con canal `in_person` | Dominio | Se acepta y el cobro queda `verified` |
| Política copiada | Dominio | Un cambio de la plantilla no cambia el tramo de la reserva |
| Tramo de devolución | Dominio | El porcentaje es el del ejemplo de 24 h, 12 h y menos de 12 h, con los tramos de la sede |
| Número de transacción repetido | Dominio | Se rechaza |
| `provisional` sin cupo | Dominio | Pasa a `conflict`, nunca a `confirmed` sola |
| `RecordCashPayment` sin turno abierto | Aplicación | Se rechaza y el cobro sigue `pending` |
| `RecordCashPayment` | Aplicación | Registra el ingreso en el turno de M2 una vez |
| `ApplyDeposit` repetido | Aplicación | La segunda vez no abona otra vez |
| `ApplyDeposit` de un anticipo en efectivo | Aplicación | No suma otra vez al efectivo esperado del arqueo |
| Provisional sin cupo | Aplicación | Queda en `conflict` y no confirma sola |
| `VerifyPayment` sin permiso | Aplicación | El estado sigue en `receipt_received` |
| `ReservationRepository` | Contrato, memoria y PostgreSQL | La copia del día y el histórico no se mezclan |
| Llegada | Aplicación | Llama a M1 una vez |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización: provisional duplicada, verificación repetida, efectivo en una provisional que termina en conflicto, y corte
- [ ] Un recorrido Playwright: crear una reserva de valor $0 y ver la mesa bloqueada

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-012 Cobro manual | Decidido para el piloto. La pasarela llega en la entrega 5.3 (PA-45) y no comparte el flujo del QR |
| Comprobante falso | La confirmación es humana y queda auditada |
| Efectivo fuera de la sede | El dominio lo rechaza si el canal no es `in_person` |
| Dos reservas provisionales para el mismo cupo | Conflicto explícito, sin resolución automática |
| Política cambiada el viernes | La copia de la reserva manda |
| Tratamiento del anticipo y del monto retenido (D-12) | El anticipo va en la factura del servicio. El monto retenido usa su propia clasificación |
