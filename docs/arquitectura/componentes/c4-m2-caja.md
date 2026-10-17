# C4 · Componentes de M2 Caja

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fuentes | [Flujos M2](../../flujos/m2-caja.md), [TRD-M2](../../trd/TRD-M2-caja.md), [TRD-00 §6.3 y §6.4](../../trd/TRD-00-arquitectura-base.md), [Glosario de código](../../glosario-codigo.md) |

La caja (`contexts/cash-register`) corre donde corre el salón: en el nodo si la sede es híbrida, o en la API central en modo nube. El pago QR siempre empieza en la nube, porque lo confirma la pasarela con un webhook; el nodo lo aplica al turno abierto. Los nombres son los de [TRD-M2](../../trd/TRD-M2-caja.md).

## En la sede

```mermaid
flowchart LR
  CSH["<b>Cajero</b><br/>[Persona]"]:::persona
  SUP["<b>Supervisor</b><br/>[Persona]"]:::persona
  CHN["<b>Canal de la sede</b><br/>[Nube, M0]<br/>QrPaymentPendingApply"]:::modulo
  M5I["<b>M5 Domicilios</b><br/>Contra entrega y<br/>saldo por cobrar"]:::modulo

  subgraph Inputs["Entradas"]
    HTTP["<b>Caja</b><br/>[Controlador HTTP]<br/>Turno, cobro, arqueo, propinas"]:::componente
    EVT["<b>Pago QR recibido</b><br/>[Manejador de evento]"]:::componente
    EP["<b>Puerto de entrada de M2</b><br/>[entry-port.ts]<br/>RecordDeliveryCollection,<br/>RecordReceivable"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_SHF["<b>Turno</b><br/>OpenShift, RecordCashInOut,<br/>WithdrawCash, OpenDrawerNoSale"]:::componente
    UC_CHG["<b>Cobro</b><br/>ChargeCheck, ApplyQrPayment,<br/>ChangePaymentMethod, ReopenCheck"]:::componente
    UC_CNT["<b>Arqueo</b><br/>BlindCashCount, PartialClose, CloseShift"]:::componente
    UC_TIP["<b>Propinas</b><br/>SettleTips, AdjustTipSettlement"]:::componente
  end

  subgraph Domain["Dominio"]
    D_SHF["<b>CashShift</b><br/>[Agregado]<br/>open, counting, closed e inmutable"]:::componente
    D_PAY["<b>Payment y medios</b><br/>[Entidades]<br/>Efectivo, tarjeta, transferencia,<br/>QR, anticipo, crédito, plataforma"]:::componente
    D_CNT["<b>CashCount</b><br/>[Regla pura]<br/>Contado contra esperado por medio"]:::componente
    D_TIP["<b>TipDistributionRule</b><br/>[Regla pura]<br/>Equitativo, porcentaje, por horas;<br/>redondeo determinista"]:::componente
  end

  subgraph Outputs["Salidas"]
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnitOfWork]"]:::componente
    RT["<b>Cuentas en vivo</b><br/>[Gateway WebSocket]"]:::componente
    CT["<b>CardTerminal</b><br/>[Adaptador manual en Fase 1]<br/>ADR-007"]:::componente
    PRN["<b>Printer</b><br/>[Puerto, shared/printing]<br/>Cierre, liquidación, cajón"]:::componente
    M1["<b>M1 Pedidos</b><br/>[Puerto de entrada]<br/>GetCheck"]:::modulo
    M3["<b>M3 Facturación</b><br/>[Puerto de entrada]<br/>CreateSalesDocument; calcula<br/>impuestos e imprime la factura"]:::modulo
    M8["<b>M8 Asistencia</b><br/>[Puerto de entrada]<br/>ParticipantsForPeriod"]:::modulo
    M9["<b>M9 Reservas</b><br/>[Puerto de entrada]<br/>ApplyDeposit"]:::modulo
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>EvaluatePermission, RecordAuditEvent"]:::modulo
  end

  PRT["<b>Impresora de caja y cajón</b><br/>[Dispositivo ESC/POS]"]:::externo

  CSH --> HTTP
  SUP -- "PIN de autorización" --> HTTP
  CHN -.-> EVT
  M5I --> EP

  HTTP --> UC_SHF
  HTTP --> UC_CHG
  HTTP --> UC_CNT
  HTTP --> UC_TIP
  EVT --> UC_CHG
  EP --> UC_CHG

  UC_SHF --> D_SHF
  UC_CHG --> D_PAY
  UC_CNT --> D_CNT
  UC_CNT --> D_SHF
  UC_TIP --> D_TIP

  UC_SHF --> REPO
  UC_CHG --> REPO
  UC_CHG --> RT
  UC_CHG --> CT
  UC_CHG -- "lee la cuenta" --> M1
  UC_CHG -- "ítems y clasificación tributaria" --> M3
  UC_CHG -- "aplicar anticipo" --> M9
  UC_TIP -- "participantes del periodo" --> M8
  UC_SHF -- "permiso" --> M0
  UC_CNT -- "autorizar diferencia" --> M0
  UC_SHF -- "comando de cajón" --> PRN
  UC_CNT -- "reporte de cierre" --> PRN
  UC_TIP -- "liquidación" --> PRN
  PRN -- "TCP 9100 o USB" --> PRT

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Inputs fill:none,stroke:#888,stroke-dasharray: 3 3
  style Application fill:none,stroke:#888,stroke-dasharray: 3 3
  style Domain fill:none,stroke:#888,stroke-dasharray: 3 3
  style Outputs fill:none,stroke:#888,stroke-dasharray: 3 3
```

M2 envía a M3 los ítems con su clasificación tributaria, la propina, los pagos, los anticipos y el adquirente. M3 calcula los impuestos, responde con el número, el CUFE y el QR (o el comprobante si no hay internet) y dispara la impresión de la factura o del comprobante. M2 solo imprime el cierre, la liquidación de propinas y el comando de cajón.

## En la nube: pago QR en la mesa

```mermaid
flowchart LR
  CUS["<b>Cliente</b><br/>[Persona]"]:::persona
  GWW["<b>Pasarela de pagos</b><br/>[Sistema externo, ADR-016]<br/>Avisa por webhook"]:::externo

  subgraph Inputs["Entradas"]
    PPAY["<b>Pago de la mesa</b><br/>[Controlador HTTP, portal]<br/>Saldo y propina"]:::componente
    WH["<b>Webhook de la pasarela</b><br/>[Controlador HTTP]<br/>Verifica la firma"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_START["<b>StartQrPayment</b><br/>Cobro por el saldo que fija la cuenta"]:::componente
    UC_CONF["<b>ConfirmQrPayment</b><br/>Idempotente por referencia"]:::componente
  end

  subgraph Domain["Dominio"]
    D_QR["<b>QrPaymentConfirmed</b><br/>[Agregado]<br/>Sin webhook no hay pago"]:::componente
  end

  subgraph Outputs["Salidas"]
    PGW["<b>PaymentGateway</b><br/>[Adaptador del proveedor]"]:::componente
    REPO["<b>QrPaymentRepository</b><br/>[Drizzle]<br/>PostgreSQL"]:::componente
    CHN["<b>Canal de la sede</b><br/>[M0]<br/>Al instante o al reconectar"]:::modulo
  end

  GW["<b>Pasarela de pagos</b><br/>[Sistema externo]<br/>API de cobro"]:::externo

  CUS --> PPAY --> UC_START
  GWW -. "webhook firmado" .-> WH --> UC_CONF
  UC_START --> D_QR
  UC_CONF --> D_QR
  UC_START -- "saldo + propina, referencia única" --> PGW
  UC_CONF --> REPO
  UC_CONF -- "QrPaymentPendingApply" --> CHN
  PGW -- "HTTPS" --> GW

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Inputs fill:none,stroke:#888,stroke-dasharray: 3 3
  style Application fill:none,stroke:#888,stroke-dasharray: 3 3
  style Domain fill:none,stroke:#888,stroke-dasharray: 3 3
  style Outputs fill:none,stroke:#888,stroke-dasharray: 3 3
```

La pasarela aparece dos veces porque cumple dos papeles: la API recibe sus avisos (izquierda) y también la llama para crear el cobro (derecha). En modo nube el pago lo aplica la misma API central, sin canal hacia un nodo.

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `CashRegisterRepository` | `adapters/postgres` | `adapters/sqlite` |
| `QrPaymentRepository` | PostgreSQL | — (el pago llega por el canal de la sede) |
| `PaymentGateway` | Varios adaptadores. Bold es uno (D-46) | — (el nodo no habla con la pasarela) |
| `CardTerminal` | Manual (registro de aprobación, franquicia, últimos 4) | Manual; integración directa por proveedor en ADR-007 |
| `Printer` (`shared/printing`) | Trabajo hacia el puente | Cola local; comando de cajón solo a la impresora de caja |
| `Clock` | Hora del servidor | Hora del nodo |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M1 → M2 | `GetCheck` por el puerto de entrada de M1 y WebSocket | Cuenta abierta, precuenta, división |
| M3 | Llamada en proceso a `CreateSalesDocument` | Ítems con su `TaxClassification`, propina, pagos, anticipos y adquirente. M3 calcula los impuestos e imprime |
| M8 | Llamada en proceso a `ParticipantsForPeriod` | Personas con marcación en el periodo |
| M9 | Llamada en proceso a `ApplyDeposit` | Valor del anticipo; no entra al efectivo |
| M5 → M2 | Llamada en proceso a `RecordDeliveryCollection` y `RecordReceivable` | Cobro contra entrega del domiciliario; saldo por cobrar a plataformas |
| M6 | Eventos de la outbox (`ShiftClosed`, `PaymentRecorded`) | Cierres, diferencias, medios de pago, propinas |
