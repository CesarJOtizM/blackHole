# C4 · Componentes de M1 Pedidos y salón

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fuentes | [Flujos M1](../../flujos/m1-pedidos-y-salon.md), [TRD-M1](../../trd/TRD-M1-pedidos-y-salon.md), [TRD-00 §6 y §6.4](../../trd/TRD-00-arquitectura-base.md), [Glosario de código](../../glosario-codigo.md) |

El salón corre en el nodo si la sede está en híbrido, o en la API central si está en modo nube. Los casos de uso de `contexts/orders` son los mismos. Dos piezas viven siempre en la nube: el menú y catálogo, que es de la marca y se administra en la web (PRD-00, M1), y la intención de pedido QR, porque el celular del cliente no entra a la red del personal. Los nombres son los de [TRD-M1](../../trd/TRD-M1-pedidos-y-salon.md).

## En la sede

Corre en el nodo, o en la API central si la sede está en modo nube.

```mermaid
flowchart LR
  WAI["<b>Mesero</b><br/>[Persona]"]:::persona
  KIT["<b>Cocina y jefe de cocina</b><br/>[Persona]"]:::persona
  CHN["<b>Canal de la sede</b><br/>[Nube, M0]<br/>Pedido QR, copia del menú,<br/>reservas del día, disponibilidad"]:::modulo
  M5I["<b>M5 Domicilios</b><br/>Pedido aceptado"]:::modulo
  M9I["<b>M9 Reservas</b><br/>Llegada del cliente"]:::modulo
  M2I["<b>M2 Caja</b><br/>Lee la cuenta"]:::modulo

  subgraph Inputs["Entradas"]
    HTTP["<b>Salón</b><br/>[Controlador HTTP]<br/>Mesas, pedidos, anulaciones, cuenta"]:::componente
    WSK["<b>Cola de cocina</b><br/>[Gateway WebSocket]<br/>Estados por estación"]:::componente
    EVT["<b>Eventos entrantes</b><br/>[Manejador]<br/>QrOrderPendingApply, AvailabilityChanged"]:::componente
    EP["<b>Puerto de entrada de M1</b><br/>[entry-port.ts]<br/>CreateInternalOrder, AttachReservation,<br/>GetCheck"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_TAB["<b>Mesas</b><br/>OpenTable, MoveTable, MergeTables,<br/>TransferItems, AttachReservation"]:::componente
    UC_ORD["<b>Pedido</b><br/>AddItems, SendToKitchen,<br/>ApplyQrOrder, CreateInternalOrder"]:::componente
    UC_KIT["<b>Cocina</b><br/>ChangeLineState, MarkNotDeliverable,<br/>WithdrawUnrestockedLines"]:::componente
    UC_VOID["<b>Anulación</b><br/>VoidLine, VoidCheck"]:::componente
    UC_CHK["<b>Cuenta</b><br/>RequestCheck, SplitCheck, GetCheck"]:::componente
  end

  subgraph Domain["Dominio"]
    D_TAB["<b>Table</b><br/>[Agregado]<br/>free, occupied, check_requested, to_clean"]:::componente
    D_ORD["<b>Order y OrderLine</b><br/>[Agregado]<br/>Estados con hora, canal"]:::componente
    D_RTR["<b>StationRouter</b><br/>[Regla pura]<br/>Producto → estación → salida"]:::componente
    D_TOK["<b>PortalToken</b><br/>[Objeto de valor]<br/>Firmado, de un solo propósito"]:::componente
  end

  subgraph Outputs["Salidas"]
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnitOfWork]<br/>SQLite en el nodo, PostgreSQL en modo nube"]:::componente
    MENU["<b>MenuCatalog</b><br/>[Adaptador]<br/>Copia del menú y precios de la sede"]:::componente
    RT["<b>RealtimeNotifier</b><br/>[Gateway WebSocket]<br/>Comandas, avisos de listo, cuenta en caja"]:::componente
    PRN["<b>Printer</b><br/>[Puerto, shared/printing]<br/>M1 dispara comanda y precuenta"]:::componente
    M4["<b>M4 Inventario</b><br/>[Puerto de entrada]<br/>RegisterSaleConsumption,<br/>ReturnStock, RecordWaste"]:::modulo
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>EvaluatePermission, RecordAuditEvent"]:::modulo
  end

  PRT["<b>Impresoras de comandas</b><br/>[Dispositivo ESC/POS]"]:::externo

  WAI -- "HTTPS + WSS" --> HTTP
  KIT --> WSK
  CHN -.-> EVT
  M5I --> EP
  M9I --> EP
  M2I --> EP

  HTTP --> UC_TAB
  HTTP --> UC_ORD
  HTTP --> UC_VOID
  HTTP --> UC_CHK
  WSK --> UC_KIT
  EVT -- "pedido QR" --> UC_ORD
  EVT -- "no se repone hoy" --> UC_KIT
  EP --> UC_ORD
  EP --> UC_TAB
  EP --> UC_CHK

  UC_TAB --> D_TAB
  UC_ORD --> D_ORD
  UC_ORD --> D_RTR
  UC_KIT --> D_ORD
  UC_VOID --> D_ORD
  UC_CHK --> D_TOK

  UC_TAB --> REPO
  UC_ORD --> REPO
  UC_ORD --> MENU
  UC_ORD -- "comanda" --> RT
  UC_ORD -- "comanda" --> PRN
  UC_ORD -- "RegisterSaleConsumption" --> M4
  UC_KIT -- "aviso de listo" --> RT
  UC_KIT -- "ReturnStock o RecordWaste" --> M4
  UC_VOID -- "ReturnStock o RecordWaste" --> M4
  UC_VOID -- "autorización" --> M0
  UC_TAB -- "permiso" --> M0
  UC_CHK -- "precuenta con QR" --> PRN
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

Todos los casos de uso guardan con la persistencia y dejan su evento (`LineSent`, `LineStateChanged`, `CheckRequested`…) en la outbox; el diagrama solo dibuja dos de esas flechas. M6 recibe los eventos por la outbox. M1 dispara la comanda y la precuenta; la factura y el comprobante los dispara M3. Las plantillas y el controlador ESC/POS viven en `shared/printing`.

## En la nube: menú y pedido QR

```mermaid
flowchart LR
  ADM["<b>Administrador</b><br/>[Persona]"]:::persona
  CUS["<b>Cliente</b><br/>[Persona]"]:::persona

  subgraph Inputs["Entradas"]
    MENC["<b>Menú y catálogo</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
    PQR["<b>Pedido de la mesa</b><br/>[Controlador HTTP, portal]<br/>/m/token-mesa"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_MEN["<b>Catálogo</b><br/>UpdateMenu<br/>Productos, variantes, modificadores,<br/>combos, estaciones; precio,<br/>disponibilidad y horario por sede"]:::componente
    UC_QR["<b>Pedido QR</b><br/>ViewVenueMenu,<br/>RecordQrOrderIntent"]:::componente
  end

  subgraph Domain["Dominio"]
    D_MEN["<b>Menu</b><br/>[Agregado]<br/>Product, Variant, Modifier,<br/>VenuePrice, TaxClassification"]:::componente
    D_INT["<b>QrOrderIntent</b><br/>[Agregado]<br/>UUID idempotente; sin anular,<br/>descontar ni cambiar precios"]:::componente
  end

  subgraph Outputs["Salidas"]
    REPO["<b>MenuRepository, QrOrderIntentRepository</b><br/>[Drizzle]<br/>PostgreSQL"]:::componente
    CHN["<b>Canal de la sede</b><br/>[M0]<br/>Copia del menú y QrOrderPendingApply,<br/>al instante o al reconectar"]:::modulo
  end

  ADM --> MENC --> UC_MEN
  CUS --> PQR --> UC_QR
  UC_MEN --> D_MEN
  UC_QR --> D_MEN
  UC_QR --> D_INT
  UC_MEN --> REPO
  UC_QR --> REPO
  UC_MEN -- "publica la copia" --> CHN
  UC_QR -- "intención por aplicar" --> CHN

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Inputs fill:none,stroke:#888,stroke-dasharray: 3 3
  style Application fill:none,stroke:#888,stroke-dasharray: 3 3
  style Domain fill:none,stroke:#888,stroke-dasharray: 3 3
  style Outputs fill:none,stroke:#888,stroke-dasharray: 3 3
```

En modo nube no hay canal hacia un nodo: el pedido QR lo aplica la misma API central.

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `OrderRepository`, `TableRepository` | `adapters/postgres` | `adapters/sqlite` |
| `QrOrderIntentRepository` | PostgreSQL | — (el nodo recibe la intención por el canal de la sede) |
| `MenuRepository` | `adapters/postgres`; dueña del menú, precios y horarios | — |
| `MenuCatalog` | Lectura directa del menú | Copia sincronizada desde la nube |
| `Printer` (`shared/printing`) | Trabajo hacia el puente de la sede | Cola local ESC/POS |
| `RealtimeNotifier` | Gateway WebSocket con `LISTEN/NOTIFY` entre instancias | Gateway WebSocket del nodo |
| `TokenSigner` | Llave de la nube | Llave de la sede, así la precuenta sale sin internet |
| `Clock` | Hora del servidor | Hora del nodo |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M4 | Llamada en proceso a su puerto de entrada | `RegisterSaleConsumption` al enviar; `ReturnStock` o `RecordWaste` al anular o retirar |
| M4 → M1 | Evento `AvailabilityChanged` | Disponible, pocas unidades, agotado, no se repone hoy |
| M1 → M2 | M2 lee la cuenta con `GetCheck` y por WebSocket | Cuenta en tiempo real y precuenta |
| M5 → M1 | Llamada en proceso a `CreateInternalOrder` | Pedido aceptado de plataforma o domicilio propio |
| M9 → M1 | Evento `DayReservations` y llamada a `AttachReservation` en la llegada | Mesa bloqueada; mesa y cuenta asociadas |
| M0 | Llamada en proceso a `EvaluatePermission` y `RecordAuditEvent` | Permiso, autorización y auditoría |
| M6 | Eventos de la outbox (`LineSent`, `LineStateChanged`) | Cada cambio de estado con la hora del nodo |
