# Flujos · M2 Caja

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fuentes | [PRD-00 §6.5 y M2](../prd/PRD-00-vision-producto.md), [PRD-M2](../prd/PRD-M2-caja.md), [TRD-M2](../trd/TRD-M2-caja.md), [TRD-00 §6.3](../trd/TRD-00-arquitectura-base.md) |

La caja cobra la cuenta que armó el salón, registra cada medio de pago y cierra el turno con un arqueo a ciegas. El turno cerrado no se edita. Los nombres de casos de uso y eventos son los de [TRD-M2](../trd/TRD-M2-caja.md).

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M1 | Recibe la cuenta en tiempo real y la precuenta (`GetCheck`). |
| M0 | Apertura de cajón sin venta, egresos, diferencias y cambios de medio de pago piden permiso o autorización. |
| M3 | Al cerrar la venta, M2 envía los ítems con su clasificación tributaria, la propina, los pagos y el adquirente (`CreateSalesDocument`). M3 calcula los impuestos e imprime la factura o el comprobante. |
| Portal | Un pago QR confirmado por la pasarela cierra el saldo, con su propina. |
| M8 | El reparto de propinas toma a quienes marcaron asistencia en el periodo (`ParticipantsForPeriod`). |
| M9 | Un anticipo de reserva se abona como medio de pago y no entra al efectivo del arqueo (`ApplyDeposit`). |
| M5 | El cobro contra entrega del domiciliario se concilia en el turno. El pago de una plataforma queda por cobrar. |
| M6 | El cierre y las diferencias alimentan el control de caja. |

## Turno de caja

```mermaid
stateDiagram-v2
  state "Abierto" as open
  state "En arqueo" as counting
  state "Cerrado" as closed

  [*] --> open: Base inicial por denominación
  open --> open: Ventas, ingresos, egresos, retiros
  open --> counting: El cajero cuenta a ciegas
  counting --> open: Cierre parcial, el turno sigue
  counting --> closed: Cierre final
  closed --> [*]
```

Un turno cerrado no se modifica. Una corrección es un movimiento nuevo, con motivo y auditoría.

## Apertura, arqueo y cierre

```mermaid
sequenceDiagram
  actor Cajero
  participant Nodo
  actor Supervisor
  participant Imp as Impresora

  Cajero->>Nodo: OpenShift con base por denominación
  Note over Cajero,Nodo: Durante el turno: ventas, ingresos, egresos y retiros
  Cajero->>Nodo: BlindCashCount, sin ver el esperado
  Nodo->>Nodo: Compara contado contra esperado, por medio de pago
  alt Hay diferencia
    Cajero->>Nodo: Justificación
    Supervisor->>Nodo: Aprueba dentro de su tope, o escala
  end
  Nodo->>Imp: Reporte de cierre
  Nodo->>Nodo: CloseShift, el cierre queda inmutable
```

El cajero y el supervisor no pueden ver el total esperado antes de contar. En tarjetas, el total de cada datáfono (Credibanco, Bold o Redeban) se compara con el cierre de ese datáfono. En la Fase 1 el pago con tarjeta se registra: datáfono, aprobación, franquicia y últimos 4 dígitos. El monto no viaja solo al datáfono.

## Cobro de una cuenta

```mermaid
flowchart TD
  A["Cuenta con precuenta"] --> B{"¿Llegaron datos de facturación?"}
  B -->|"Por el portal y por la caja"| C["El cajero elige cuáles usar"]
  B -->|"Por un solo lado, o ninguno"| D["Se usan esos, o consumidor final"]
  C --> E["Medios de pago"]
  D --> E
  E --> F["Uno o varios: efectivo, tarjeta, transferencia, bono, crédito"]
  F --> G["Se pregunta la propina"]
  G --> H{"¿Hay anticipo de reserva?"}
  H -->|Sí| I["Se abona y no entra al efectivo"]
  H -->|No| J["Total a cobrar"]
  I --> J
  J --> K["M3 recibe ítems y clasificación tributaria,<br/>calcula impuestos y crea el documento"]
  K --> L{"¿Hay internet hasta la nube?"}
  L -->|Sí| M["M3 imprime la factura con CUFE y QR"]
  L -->|No| N["M3 imprime el comprobante, que no es factura"]
  M --> O["La mesa pasa a por limpiar"]
  N --> O
```

El cambio en efectivo sale del mismo cobro. Abrir el cajón sin una venta exige permiso y queda auditado. Cambiar el medio de pago de una venta ya cobrada, reabrir una cuenta pagada o emitir una nota crédito son acciones aparte, con autorización de M0.

## Pago desde el QR de la mesa

```mermaid
sequenceDiagram
  actor Cliente
  participant Portal as Portal
  participant Pasarela
  participant Nodo
  participant Caja

  Cliente->>Portal: Ve el saldo y elige propina
  Portal->>Pasarela: StartQrPayment por el monto exacto
  Pasarela-->>Portal: Confirmación, una sola referencia (ConfirmQrPayment)
  Portal-->>Nodo: QrPaymentPendingApply, al instante o al reconectar
  Nodo->>Nodo: ApplyQrPayment en el turno y pide el documento a M3
  Nodo-->>Caja: La cuenta queda pagada
```

Sin la confirmación de la pasarela el pago no existe. Un segundo aviso con la misma referencia no cobra dos veces. El dinero no entra al efectivo: en el arqueo se compara el total QR contra el reporte de la pasarela. Efectivo y datáfono siguen en la caja, y pueden convivir con un pago QR si la cuenta ya estaba dividida.

## Propinas

La propina es voluntaria, se registra por venta y por medio de pago, y queda fuera de la venta.

```mermaid
flowchart TD
  A["Cierre del periodo<br/>turno, día o semana"] --> B["Sumar el fondo común"]
  B --> C["Participantes: marcaciones de M8"]
  C --> D{"Regla de la sede"}
  D -->|Equitativo| E["Partes iguales"]
  D -->|Porcentaje| F["Por persona o por rol, suma 100 %"]
  D -->|Por horas| G["Según horas trabajadas"]
  E --> H["Liquidación cerrada e imprimible"]
  F --> H
  G --> H
  H --> I["Firma de recibido"]
```

La regla usada se guarda dentro de la liquidación (`SettleTips`). Un cambio posterior de la regla no altera un periodo ya cerrado. Una corrección es una liquidación de ajuste (`AdjustTipSettlement`), que apunta a la original sin cambiarla. Cambiar la regla queda auditado.
