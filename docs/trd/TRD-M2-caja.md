# TRD-M2 · Caja

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-17 |
| Fase | 1 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M2](../prd/PRD-M2-caja.md) |
| Diagramas | [C4 M2](../arquitectura/componentes/c4-m2-caja.md) |
| Nombres | [Glosario de código](../glosario-codigo.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Dónde corre la caja | Donde corre el salón: nodo en híbrido, API central en modo nube |
| Pago QR | Siempre nace en la nube. El nodo no habla con la pasarela. Aplica el pago al turno abierto |
| Datáfono | Puerto `CardTerminal`. En la Fase 1 el adaptador es manual. ADR-007 agrega uno por proveedor |
| Pasarela | Puerto `PaymentGateway`, con varios adaptadores. Bold es uno (D-46). Las reservas no usan este puerto |
| Dinero | Montos en enteros. El reparto de propinas redondea de forma determinista y el residuo queda explícito |
| Cierre | El turno cerrado no acepta comandos de edición. La corrección es otro movimiento |
| Documento | Al cerrar la venta llama a M3 `CreateSalesDocument` con los ítems y su clasificación tributaria. M3 calcula los impuestos, responde con número, CUFE y QR, o con el comprobante, y dispara su impresión |
| Impresión | M2 dispara el reporte de cierre, la liquidación de propinas y el comando de cajón por el puerto `Printer`, con las plantillas de `shared/printing`. La factura y el comprobante los imprime M3 |
| Código | `contexts/cash-register/domain`, `contexts/cash-register/application`, `contexts/cash-register/adapters` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `CashShift` | Estados `open`, `counting`, `closed`. Cerrado es inmutable. Una caja tiene un turno abierto |
| Entidad | `CashMovement` | Ingreso, egreso o retiro, con motivo. No se borra |
| Entidad | `Payment` | Medios: efectivo, tarjeta, transferencia, bono, crédito, QR, anticipo, plataforma. La suma cierra la cuenta |
| Regla | `CashCount` | Compara contado contra esperado por medio, después de que el cajero envió el conteo |
| Agregado | `QrPaymentConfirmed` | Sin webhook firmado no hay pago. Una referencia, un pago |
| Regla | `TipDistributionRule` | Por sede. Modo `equal`, `percentage` (suma 100 %) o `by_hours`. El redondeo es determinista |
| Entidad | `TipSettlement` | Guarda la regla usada. Cerrada no se edita. El ajuste es otra liquidación que apunta a la original |

La propina no entra en la base de la venta. El anticipo y el QR no entran en el esperado de efectivo.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Turnos, pagos de caja, arqueos, propinas | Nodo en híbrido; nube en modo nube | `ShiftClosed`, `PaymentRecorded`, hacia la nube y M6 |
| Intención e inicio del cobro QR | Nube | Llamada a la pasarela |
| `QrPaymentConfirmed` | Nube, hasta que el turno lo aplica | `QrPaymentPendingApply`, prioridad alta en la outbox |
| Pago ya aplicado | El dueño de la operación | `PaymentRecorded` |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `OpenShift` | Base por denominación, cajero, caja | No hay otro turno abierto en esa caja | `ShiftOpened` | Dueño de la operación |
| `RecordCashInOut`, `WithdrawCash` | Monto y motivo | Permiso o autorización de M0 | `CashMovementRecorded` | Dueño de la operación |
| `OpenDrawerNoSale` | Motivo | Autorización. Comando de cajón solo a la impresora de caja | `DrawerOpened` | Dueño de la operación |
| `ChargeCheck` | Medios, propina, adquirente elegido | Lee la cuenta con `GetCheck` de M1. Abona anticipo con `ApplyDeposit` de M9. Llama a `CreateSalesDocument` de M3 | `PaymentRecorded` | Dueño de la operación |
| `StartQrPayment` | Saldo que fija la cuenta, propina | El cliente no envía el monto | Referencia única | Nube |
| `ConfirmQrPayment` | Webhook firmado | Idempotente por referencia | `QrPaymentPendingApply` | Nube |
| `ApplyQrPayment` | Pago confirmado | Entra al turno abierto. No suma al efectivo. Pide el documento a M3 con `CreateSalesDocument` | `PaymentRecorded` | Dueño de la operación |
| `ChangePaymentMethod`, `ReopenCheck` | Autorización | No edita el turno cerrado: deja movimientos de reversa | `PaymentAdjusted` | Dueño de la operación |
| `BlindCashCount`, `PartialClose`, `CloseShift` | Conteo | El esperado se revela después. La diferencia exige otra persona | `ShiftClosed` | Dueño de la operación |
| `SettleTips` | Periodo y regla | Participantes con `ParticipantsForPeriod` de M8. Suma 100 % si es por porcentaje | `TipSettlementClosed` | Dueño de la operación |
| `AdjustTipSettlement` | Liquidación cerrada, motivo y corrección | No toca la original: crea una liquidación nueva que la referencia. Permiso de liquidar | `TipSettlementClosed` | Dueño de la operación |
| `RecordDeliveryCollection`, `RecordReceivable` | M5 | Contra entrega entra al turno. Plataforma queda por cobrar | `PaymentRecorded` | Dueño de la operación |
| `RecordReservationCash` | M9: reserva, valor | Exige un turno abierto en la caja. Entra al efectivo esperado de ese turno. Idempotente por reserva | `CashMovementRecorded` | Dueño de la operación |

## 5. Contratos

**HTTP de caja:** turno, movimientos, cobro, arqueo, liquidación.

**Portal:** saldo de la cuenta (lo lee de M1 a través de la nube) y inicio del cobro. No acepta un monto escrito por el cliente.

**Webhook:** aviso de la pasarela, con firma. Respuesta idempotente.

**Puerto de entrada de M2** (`entry-port.ts`): `RecordDeliveryCollection`, `RecordReceivable`, `RecordReservationCash`.

**Hacia otros módulos:** `GetCheck` (M1), `CreateSalesDocument` (M3), `ParticipantsForPeriod` (M8), `ApplyDeposit` (M9), `EvaluatePermission` y `RecordAuditEvent` (M0).

**Hacia M3:** ítems con su `TaxClassification`, propina, pagos, anticipos y adquirente elegido. M2 no envía impuestos calculados.

**WebSocket:** cuentas en vivo para la pantalla de caja.

El cuerpo Zod del webhook depende del adaptador de ADR-016. El contrato interno de `QrPaymentConfirmed` no: referencia, sede, cuenta, monto, propina, medio. Los esquemas viven en `shared/contracts`.

## 6. Persistencia

`cash_shifts`, `cash_movements`, `payments`, `qr_payments`, `cash_counts`, `tip_settlements`.

- El turno cerrado no tiene `UPDATE` de sus pagos. Los ajustes son filas nuevas que apuntan al pago original.
- `qr_payments.reference` es única.
- Una liquidación de ajuste es una fila nueva de `tip_settlements` que apunta a la original.
- PostgreSQL con `tenant_id` y Row Level Security en la nube. SQLite en el nodo.
- Outbox en la misma transacción que el pago. El pago QR confirmado sube con prioridad máxima, junto con los documentos DIAN.

## 7. Operación sin internet

| Acción | Híbrido en corte | Nube en corte |
|--------|------------------|---------------|
| Cobro en caja, arqueo, cajón | Sigue en el nodo | Detenido |
| Pago QR | El cliente paga contra la pasarela. Se aplica al reconectar | Igual |
| Factura | M3 deja el documento `pending_issuance` e imprime el comprobante. Este módulo no reintenta a Factus | Pendiente hasta que vuelva el enlace |
| Liquidación | Con las marcaciones que el nodo ya tiene | Detenida |

`ApplyQrPayment` es idempotente: si el lote llega dos veces, hay un solo pago en el turno.

## 8. Seguridad y auditoría

Declaran permiso: apertura, egreso, retiro, cajón sin venta, ver el esperado, aprobar diferencia, cambiar medio, reabrir, liquidar, ajustar una liquidación y cambiar la regla.

El webhook rechaza una firma inválida y no crea pago. El portal no lista cuentas ajenas: el token identifica una cuenta.

Eventos de auditoría (`RecordAuditEvent`): diferencia aprobada, cajón sin venta, cambio de medio, reapertura, liquidación de ajuste, cambio de regla de propinas.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Turno cerrado rechaza un cobro nuevo | Dominio | Solo acepta un movimiento de ajuste |
| Arqueo no revela el esperado antes del conteo | Dominio | El resultado nace después del conteo |
| Porcentajes que no suman 100 % | Dominio | Se rechaza |
| Redondeo del reparto | Dominio | La suma de las partes más el residuo iguala el fondo |
| `AdjustTipSettlement` | Dominio | La liquidación original queda igual y la nueva la referencia |
| `ConfirmQrPayment` repetido | Aplicación | La segunda vez no duplica |
| `ChargeCheck` | Aplicación | Llama a `CreateSalesDocument` una vez, sin impuestos calculados, y no suma el anticipo al efectivo |
| Diferencia sin autorización | Aplicación | El turno no cierra |
| `CashRegisterRepository` | Contrato (`cash-register-repository.contract.ts`), memoria, SQLite y PostgreSQL | El esperado por medio coincide |
| Webhook con firma inválida | Aplicación | No hay pago |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización del pago QR: duplicado, desorden y corte
- [ ] Un recorrido Playwright: abrir turno, cobrar en efectivo y cerrar a ciegas

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-016 Pasarela del QR | Varios adaptadores. Bold es uno (D-46). No bloquea el resto de la caja |
| ADR-007 Datáfono directo | Después de la Fase 1. El puerto ya existe (PA-43) |
| Doble webhook | Referencia única |
| Cliente paga un monto distinto | El monto lo arma el servidor con el saldo de la cuenta |
