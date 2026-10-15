# TRD-M2 · Caja

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 1 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M2](../prd/PRD-M2-caja.md) |
| Diagramas | [C4 M2](../arquitectura/componentes/c4-m2-caja.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Dónde corre la caja | Donde corre el salón: nodo en híbrido, API central en modo nube |
| Pago QR | Siempre nace en la nube. El nodo no habla con la pasarela. Aplica el pago al turno abierto |
| Datáfono | Puerto `Datafono`. En la Fase 1 el adaptador es manual. ADR-007 agrega uno por proveedor |
| Pasarela | Puerto `PasarelaPagos`. El proveedor se elige en ADR-016. Las reservas no usan este puerto |
| Dinero | Montos en enteros. El reparto de propinas redondea de forma determinista y el residuo queda explícito |
| Cierre | El turno cerrado no acepta comandos de edición. La corrección es otro movimiento |
| Documento | Al cerrar la venta llama a M3 `CrearDocumentoVenta` y espera número, CUFE y QR, o el comprobante |
| Código | `contextos/caja/dominio`, `contextos/caja/aplicacion` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `TurnoCaja` | Abierto, en arqueo, cerrado. Cerrado es inmutable. Una caja tiene un turno abierto |
| Entidad | `MovimientoCaja` | Ingreso, egreso o retiro, con motivo. No se borra |
| Entidad | `Pago` | Medios: efectivo, tarjeta, transferencia, bono, crédito, QR, anticipo, plataforma. La suma cierra la cuenta |
| Regla | `Arqueo` | Compara contado contra esperado por medio, después de que el cajero envió el conteo |
| Agregado | `PagoQrConfirmado` | Sin webhook firmado no hay pago. Una referencia, un pago |
| Regla | `RepartoPropinas` | Equitativo, porcentaje que suma 100 %, o por horas. El redondeo es determinista |
| Entidad | `LiquidacionPropinas` | Guarda la regla usada. Cerrada no se edita. El ajuste es otra liquidación |

La propina no entra en la base de la venta. El anticipo y el QR no entran en el esperado de efectivo.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Turnos, pagos de caja, arqueos, propinas | Nodo en híbrido; nube en modo nube | `TurnoCerrado`, `PagoRegistrado`, hacia la nube y M6 |
| Intención e inicio del cobro QR | Nube | Llamada a la pasarela |
| `PagoQrConfirmado` | Nube, hasta que el turno lo aplica | `PagoQrPorAplicar`, prioridad alta en la outbox |
| Pago ya aplicado | El dueño de la operación | `PagoRegistrado` |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `AbrirTurno` | Base por denominación, cajero, caja | No hay otro turno abierto en esa caja | `TurnoAbierto` | Dueño de la operación |
| `RegistrarIngresoEgreso`, `Retirar` | Monto y motivo | Permiso o autorización de M0 | `MovimientoCaja` | Dueño de la operación |
| `AbrirCajonSinVenta` | Motivo | Autorización. Comando de cajón solo a la impresora de caja | `CajonAbierto` | Dueño de la operación |
| `CobrarCuenta` | Medios, propina, adquirente elegido | Lee la cuenta en M1. Abona anticipo en M9. Llama a M3 | `PagoRegistrado` | Dueño de la operación |
| `IniciarCobroQr` | Saldo que fija la cuenta, propina | El cliente no envía el monto | Referencia única | Nube |
| `ConfirmarPagoQr` | Webhook firmado | Idempotente por referencia | `PagoQrPorAplicar` | Nube |
| `AplicarPagoQr` | Pago confirmado | Entra al turno abierto. No suma al efectivo. Pide factura a M3 | `PagoRegistrado` | Dueño de la operación |
| `CambiarMedioPago`, `ReabrirCuenta` | Autorización | No edita el turno cerrado: deja movimientos de reversa | `PagoAjustado` | Dueño de la operación |
| `ArqueoCiego`, `CierreParcial`, `CerrarTurno` | Conteo | El esperado se revela después. La diferencia exige otra persona | `TurnoCerrado` | Dueño de la operación |
| `LiquidarPropinas` | Periodo y regla | Participantes desde M8. Suma 100 % si es por porcentaje | `LiquidacionCerrada` | Dueño de la operación |
| `RegistrarCobroDomicilio`, `RegistrarPorCobrar` | M5 | Contra entrega entra al turno. Plataforma queda por cobrar | `PagoRegistrado` | Dueño de la operación |

## 5. Contratos

**HTTP de caja:** turno, movimientos, cobro, arqueo, liquidación.

**Portal:** saldo de la cuenta (lo lee de M1 a través de la nube) y inicio del cobro. No acepta un monto escrito por el cliente.

**Webhook:** aviso de la pasarela, con firma. Respuesta idempotente.

**Puerto de entrada de M2:** `RegistrarCobroDomicilio`, `RegistrarPorCobrar`.

**Hacia otros módulos:** `ConsultarCuenta` (M1), `CrearDocumentoVenta` (M3), `ParticipantesDelPeriodo` (M8), `AplicarAnticipo` (M9), `EvaluarPermiso` (M0).

**WebSocket:** cuentas en vivo para la pantalla de caja.

El cuerpo Zod del webhook depende del adaptador de ADR-016. El contrato interno de `PagoQrConfirmado` no: referencia, sede, cuenta, monto, propina, medio.

## 6. Persistencia

`turnos_caja`, `movimientos_caja`, `pagos`, `pagos_qr`, `arqueos`, `liquidaciones_propinas`.

- El turno cerrado no tiene `UPDATE` de sus pagos. Los ajustes son filas nuevas que apuntan al pago original.
- `pagos_qr.referencia` es única.
- PostgreSQL con `tenant_id` y Row Level Security en la nube. SQLite en el nodo.
- Outbox en la misma transacción que el pago. El pago QR confirmado sube con prioridad máxima, junto con los documentos DIAN.

## 7. Operación sin internet

| Acción | Híbrido en corte | Nube en corte |
|--------|------------------|---------------|
| Cobro en caja, arqueo, cajón | Sigue en el nodo | Detenido |
| Pago QR | El cliente paga contra la pasarela. Se aplica al reconectar | Igual |
| Factura | M3 deja comprobante. Este módulo no reintenta a Factus | Pendiente hasta que vuelva el enlace |
| Liquidación | Con las marcaciones que el nodo ya tiene | Detenida |

`AplicarPagoQr` es idempotente: si el lote llega dos veces, hay un solo pago en el turno.

## 8. Seguridad y auditoría

Declaran permiso: apertura, egreso, retiro, cajón sin venta, ver el esperado, aprobar diferencia, cambiar medio, reabrir, liquidar y cambiar la regla.

El webhook rechaza una firma inválida y no crea pago. El portal no lista cuentas ajenas: el token identifica una cuenta.

Eventos: diferencia aprobada, cajón sin venta, cambio de medio, reapertura, cambio de regla de propinas.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Turno cerrado rechaza un cobro nuevo | Dominio | Solo acepta un movimiento de ajuste |
| Arqueo no revela el esperado antes del conteo | Dominio | El resultado nace después del conteo |
| Porcentajes que no suman 100 % | Dominio | Se rechaza |
| Redondeo del reparto | Dominio | La suma de las partes más el residuo iguala el fondo |
| `ConfirmarPagoQr` repetido | Aplicación | La segunda vez no duplica |
| `CobrarCuenta` | Aplicación | Llama a M3 una vez y no suma el anticipo al efectivo |
| Diferencia sin autorización | Aplicación | El turno no cierra |
| `RepositorioCaja` | Contrato, memoria, SQLite y PostgreSQL | El esperado por medio coincide |
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
| ADR-016 Pasarela del QR | Bloquea la entrega 1.13, no el resto de la caja |
| ADR-007 Datáfono directo | Después de la Fase 1. El puerto ya existe |
| Doble webhook | Referencia única |
| Cliente paga un monto distinto | El monto lo arma el servidor con el saldo de la cuenta |
