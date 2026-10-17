# C4 · Componentes de M9 Reservas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fuentes | [Flujos M9](../../flujos/m9-reservas.md), [TRD-M9](../../trd/TRD-M9-reservas.md), [TRD-00 §6.2](../../trd/TRD-00-arquitectura-base.md) |

La reserva y su cobro son de la nube, porque pueden nacer fuera del local. Lo que pasa en el salón el día de la reserva (llegada, mesa, no llegada) es del nodo; en una sede en modo nube también es de la nube. El medio de cobro depende del canal (D-01): por enlace, llamada o chat, solo una transferencia que el personal verifica en la app del banco (ADR-012); en persona en la sede, transferencia verificada o efectivo, que la caja registra en el turno abierto. En el piloto no hay pasarela: el cobro es verificación manual, y la pasarela llega en la entrega 5.3 (ADR-012, PA-45).

## En la nube: dueña de `Reservation` y `ReservationPayment`

```mermaid
flowchart LR
  CLI["<b>Cliente</b><br/>[Persona]"]:::persona
  PER["<b>Personal</b><br/>[Persona]<br/>Desde la web"]:::persona
  VER["<b>Quien verifica pagos</b><br/>[Persona con reservation.verify_payment]<br/>Revisa la transferencia en la app del banco"]:::persona
  INB["<b>Eventos de la sede</b><br/>[M0, por la outbox]<br/>Llegada, no llegada, provisional"]:::modulo
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo

  subgraph Entradas["Entradas"]
    PUB["<b>Enlace público</b><br/>[Controlador HTTP, portal]<br/>Reserva por sede con la política visible"]:::componente
    HTTP["<b>Reservas</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
    EVS["<b>Atenciones de la sede</b><br/>[Manejador]"]:::componente
    WVEN["<b>Vencimientos</b><br/>[Worker]<br/>Libera pendientes de pago"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_RES["<b>Reserva</b><br/>CreateReservation, CheckAvailability,<br/>CancelReservation, ConfirmProvisionalReservation,<br/>ResolveConflict"]:::componente
    UC_COB["<b>Cobro</b><br/>BuildPaymentMessage, AttachReceipt,<br/>VerifyPayment, RecordRefund"]:::componente
    UC_POL["<b>Política</b><br/>ApplyPolicy: retener o devolver<br/>por cancelación o no llegada"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_RES["<b>Reservation y ReservationPayment</b><br/>[Agregados]<br/>Estados, canal y medio;<br/>transacción única por cuenta"]:::componente
    D_POL["<b>ReservationPolicy</b><br/>[Regla pura]<br/>Copia en la reserva, tramos de devolución"]:::componente
  end

  subgraph Salida["Salidas"]
    PG[("<b>PostgreSQL</b><br/>Reservas y cobros")]:::contenedor
    OBJ[("<b>Archivos</b><br/>Comprobantes")]:::contenedor
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Permiso y auditoría"]:::modulo
    CAN["<b>Canal de la sede</b><br/>[M0]<br/>Reservas del día"]:::modulo
    PAS["<b>ReservationGateway</b><br/>[Sin uso en el piloto]<br/>Entrega 5.3, ADR-012, PA-45"]:::modulo
  end

  CLI --> PUB
  PER --> HTTP
  VER --> HTTP
  INB --> EVS
  PRG --> WVEN

  PUB --> UC_RES
  HTTP --> UC_RES
  HTTP --> UC_COB
  EVS -- "provisional" --> UC_RES
  EVS -- "llegada o no llegada" --> UC_POL
  WVEN --> UC_RES

  UC_RES --> D_RES
  UC_RES --> D_POL
  UC_COB --> D_RES
  UC_POL --> D_POL

  UC_RES --> PG
  UC_COB --> PG
  UC_COB --> OBJ
  UC_COB -- "verificar pago, aprobar devolución" --> M0
  UC_RES --> CAN
  UC_COB -. "desde la entrega 5.3" .-> PAS

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

Una cancelación de la reserva también pasa por la política, que decide si se retiene o se devuelve el anticipo.

## En la sede: dueña de `ReservationSeating`

En modo nube, esta parte corre en la API central.

```mermaid
flowchart LR
  CAN["<b>Canal de la sede</b><br/>[Nube, M0]<br/>Reservas del día"]:::modulo
  ANF["<b>Anfitrión o caja</b><br/>[Persona]"]:::persona
  M2I["<b>M2 Caja</b><br/>Aplicar anticipo"]:::modulo

  subgraph Entradas["Entradas"]
    EVT["<b>Reservas del día</b><br/>[Manejador]"]:::componente
    HN["<b>Reservas en la sede</b><br/>[Controlador HTTP]<br/>Crear desde la caja, verificar pago,<br/>cobro en efectivo, llegó, no llegó"]:::componente
    PIE["<b>Puerto de entrada de M9</b><br/>[entry-port.ts, en proceso]<br/>ApplyDeposit"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_ATE["<b>Atención</b><br/>BlockTable, RecordArrival,<br/>RecordNoShow, ApplyDeposit,<br/>CreateProvisionalReservation, RecordOfflineVerification,<br/>RecordCashPayment"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_ATE["<b>ReservationSeating</b><br/>[Agregado]"]:::componente
  end

  subgraph Salida["Salidas"]
    M1["<b>M1 Pedidos</b><br/>[Puerto de entrada]<br/>AttachReservation: plano de mesas y cuenta"]:::modulo
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Permiso y auditoría"]:::modulo
    M2O["<b>M2 Caja</b><br/>[Puerto de entrada]<br/>Efectivo en el turno abierto"]:::modulo
    OUT["<b>Persistencia y outbox</b><br/>[Drizzle + UnitOfWork]<br/>Llegada, no llegada, provisional"]:::componente
  end

  CAN -.-> EVT
  ANF --> HN
  M2I --> PIE

  EVT --> UC_ATE
  HN --> UC_ATE
  PIE --> UC_ATE

  UC_ATE --> D_ATE

  UC_ATE -- "bloquea mesa, abre cuenta" --> M1
  UC_ATE -- "verificar pago" --> M0
  UC_ATE -- "efectivo de una reserva en persona" --> M2O
  UC_ATE --> OUT

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

Con internet, una reserva creada desde la caja sube y la nube valida la disponibilidad. Sin internet, la caja crea una reserva provisional en el nodo y la verificación de un pago también se registra en el nodo. Las dos suben al reconectar; la nube confirma la provisional o marca un conflicto de disponibilidad para que el administrador lo resuelva.

El efectivo solo se acepta si la reserva se hizo en persona en la sede, y solo con un turno de caja abierto: `RecordCashPayment` lo registra en ese turno de M2 y deja el cobro verificado. Al consumir, `ApplyDeposit` lo abona sin volver a sumarlo al efectivo del arqueo.

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `ReservationRepository` | `adapters/postgres` | Copia de las reservas del día |
| `ReservationSeatingRepository` | Copia | `adapters/sqlite` |
| `FileStorage` | Comprobantes de pago y de devolución | — |
| `ReservationGateway` | No existe en el piloto: el cobro es verificación manual de la transferencia, o efectivo en la sede. Llega en la entrega 5.3 como puerto propio de M9, distinto de `PaymentGateway` del QR (ADR-012, PA-45) | — |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M9 → M1 | Evento `DayReservations` y llamada a `AttachReservation` en la llegada | Mesa bloqueada; mesa y cuenta asociadas |
| M2 → M9 | Llamada en proceso a `ApplyDeposit` | Anticipo como medio de pago; el de transferencia no entra al arqueo de efectivo y el de efectivo no se arquea otra vez |
| M9 → M2 | Llamada en proceso, en la sede | Efectivo de una reserva hecha en persona, como ingreso del turno abierto |
| M9 → M3 | En el documento de venta | El anticipo viaja como `prepayment_details` |
| M9 → M0 | Llamada en proceso | Permiso para verificar pagos y aprobar devoluciones |
| M9 → M6 | Eventos | Ocupación, no llegadas, anticipos retenidos |
