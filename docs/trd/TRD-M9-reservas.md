# TRD-M9 · Reservas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 3 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M9](../prd/PRD-M9-reservas.md) |
| Diagramas | [C4 M9](../arquitectura/componentes/c4-m9-reservas.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Reserva y cobro | Dueños la nube. Pueden nacer fuera del local |
| Atención del día | Dueño el nodo en híbrido: llegada, mesa, no llegada, provisional. En modo nube también es la nube |
| Cobro | Transferencia verificada por una persona (ADR-012). No hay webhook bancario |
| Pasarela | El puerto `PasarelaPagos` no se usa aquí. Una pasarela futura sería otro adaptador, en la Fase 5 |
| Política | Se copia dentro de la reserva al crearla |
| Cupo | Lo valida la nube. Sin internet, la sede crea una provisional y la nube confirma o marca conflicto |
| Anticipo | `AplicarAnticipo` lo entrega a M2. En la factura viaja como anticipo (`prepayment_details` en el documento de M3) |
| Código | `contextos/reservas/dominio`, `contextos/reservas/aplicacion` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `Reserva` | Estados: pendiente de pago, confirmada, cliente llegó, no llegó, cancelada, provisional, en conflicto. No pasa a confirmada sin pago verificado, salvo valor $0 |
| Agregado | `CobroReserva` | Pendiente, comprobante recibido, verificado, rechazado. El número de transacción es único por cuenta de recaudo |
| Regla | `PoliticaReserva` | Copia inmutable en la reserva. Tramos de anticipación con porcentaje de 0 a 100. Distingue anticipo abonable de tarifa no abonable |
| Regla | Disponibilidad | Capacidad de la franja, duración y mesas reservables. Sin cupo no hay reserva confirmada |
| Agregado | `AtencionReserva` | Bloqueo de mesa, llegada, no llegada. La llegada abre mesa y cuenta en M1 |
| Entidad | `Devolucion` | Monto según el tramo, con comprobante. No edita el cobro verificado: lo referencia |

Un conflicto de cupo no se resuelve solo. Lo cierra `ResolverConflicto`.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Reserva, cobro, política copiada, comprobantes | Nube | `ReservasDelDia` hacia el nodo |
| Llegada, no llegada, mesa | Nodo en híbrido | Hacia la nube |
| Provisional creada sin internet | Nodo, hasta que la nube confirma | `ReservaProvisional` |
| Verificación hecha sin internet | Nodo | Sube y la nube la aplica si el cobro sigue pendiente |
| Anticipo aplicado | Dueño de la caja | Lo registra M2 |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `CrearReserva`, `ValidarDisponibilidad` | Fecha, hora, personas, canal | Copia la política. Sin cupo, rechaza | `ReservasDelDia` | Nube. El enlace público entra por aquí |
| `CrearProvisional` | La caja, sin canal con la nube | Queda provisional | Sube al reconectar | Nodo |
| `ConfirmarProvisional`, `ResolverConflicto` | Cupo al recibirla | Confirma o deja el conflicto a una persona | — | Nube |
| `GenerarMensajeCobro` | Reserva pendiente | Valor, cuentas de la sede y referencia | — | Nube |
| `AdjuntarComprobante`, `VerificarPago`, `RegistrarVerificacionSinInternet` | Comprobante y número de transacción | Único. Verificar exige permiso. El pantallazo no confirma solo | `CobroVerificado` | Nube, o nodo si no hay enlace |
| `CancelarReserva`, `AplicarPolitica` | Momento de la cancelación o no llegada | Usa la copia, no la política vigente | `Devolucion` si el tramo lo dice | Nube |
| `RegistrarDevolucion` | Comprobante de la transferencia de vuelta | Permiso de aprobar | Auditoría | Nube |
| `BloquearMesa`, `RegistrarLlegada`, `RegistrarNoLlegada` | Reloj y plano | Llegada llama a M1 | `Atencion` | Dueño de la operación |
| `AplicarAnticipo` | Cuenta de M2 | No entra al efectivo. Una sola vez | — | Dueño de la operación |
| Liberar pendientes | Worker | Vence las no verificadas | Mesa libre | Nube |

## 5. Contratos

**HTTP de administración y de caja:** crear, verificar, llegar, no llegó, devolver.

**Enlace público:** disponibilidad y alta. Sin sesión de cliente. Muestra la política que se va a copiar.

**Puerto de entrada:** `AplicarAnticipo`.

**Hacia M1:** evento `ReservasDelDia` y, al llegar, asociar mesa y cuenta.

**Hacia M3:** el anticipo va en el documento de venta. M9 no llama a Factus.

**Archivos:** comprobante de pago y de devolución en el almacén de objetos.

No hay webhook bancario. Los esquemas Zod viven en `compartido/contratos`.

## 6. Persistencia

`reservas`, `politicas_reserva`, `cobros_reserva`, `devoluciones`, `atenciones_reserva`, `cuentas_recaudo`.

- La política copiada es un documento dentro de la reserva, no una clave que cambie si editan la plantilla.
- `numero_transaccion` único por cuenta de recaudo.
- PostgreSQL con `tenant_id` y Row Level Security para reservas y cobros.
- El nodo guarda en SQLite la atención y la copia de las reservas del día, no el histórico de la empresa.
- Comprobantes en el almacén de objetos. El nodo no los necesita para sentar al cliente.

## 7. Operación sin internet

Crear desde la caja deja una provisional. Verificar un pago también se anota en el nodo. Al reconectar, la nube confirma la provisional si hay cupo, o la marca en conflicto. La verificación se aplica si el cobro sigue pendiente; si alguien ya lo verificó en la nube, no se duplica el anticipo.

Llegada, no llegada y bloqueo de mesa siguen en el nodo. El enlace público no: vive en la nube y durante un corte el cliente no crea por ahí.

El anticipo se abona en el nodo al cobrar, con la copia del cobro verificado que ya bajó. Si la verificación todavía no bajó, la caja no inventa el anticipo.

## 8. Seguridad y auditoría

Permisos: verificar pago, aprobar devolución. Quien verifica queda en la cadena, con la hora y el número de transacción.

El enlace público no lista reservas de otras personas ni muestra saldos de la cuenta bancaria más allá de los datos de recaudo que la sede publicó.

El comprobante no es secreto operativo, pero no se sirve sin el permiso de la reserva. Exportarlo es un dato personal y pasa por la auditoría.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Confirmar sin verificación cuando el valor es mayor a cero | Dominio | Se rechaza |
| Valor $0 | Dominio | Pasa a confirmada sin cobro |
| Política copiada | Dominio | Un cambio de la plantilla no cambia el tramo de la reserva |
| Tramo de devolución | Dominio | El porcentaje es el del ejemplo de 24 h, 12 h y menos de 12 h, con los tramos de la sede |
| Número de transacción repetido | Dominio | Se rechaza |
| `AplicarAnticipo` repetido | Aplicación | La segunda vez no abona otra vez |
| Provisional sin cupo | Aplicación | Queda en conflicto y no confirma sola |
| `VerificarPago` sin permiso | Aplicación | El estado sigue en comprobante recibido |
| `RepositorioReservas` | Contrato, memoria y PostgreSQL | La copia del día y el histórico no se mezclan |
| Llegada | Aplicación | Llama a M1 una vez |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización: provisional duplicada, verificación repetida y corte
- [ ] Un recorrido Playwright: crear una reserva de valor $0 y ver la mesa bloqueada

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-012 Cobro manual | Decidido para el piloto. La pasarela queda en la Fase 5 y no comparte el flujo del QR |
| Comprobante falso | La confirmación es humana y queda auditada |
| Dos reservas provisionales para el mismo cupo | Conflicto explícito, sin resolución automática |
| Política cambiada el viernes | La copia de la reserva manda |
