# C4 · Componentes de M4 Inventario, bodegas y recetas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.5 |
| Fecha | 2026-11-19 |
| Fuentes | [Flujos M4](../../flujos/m4-inventario.md), [TRD-M4](../../trd/TRD-M4-inventario.md), [TRD-00 §5.1, §5.5 y §9](../../trd/TRD-00-arquitectura-base.md), [Glosario de código](../../glosario-codigo.md) |

M4 (`contexts/inventory`) corre con los mismos casos de uso en el nodo de cada sede híbrida (punto y bodegas de la sede), en el nodo de la bodega general (perfil bodega) y en la nube. La bodega general del piloto tiene su propio nodo en modo bodega (D-04). En la nube vive siempre lo que es de la empresa: insumos, recetas, consolidado y niveles sugeridos. Operar una bodega sin nodo desde la web queda abierto para clientes pequeños (PA-44). En una sede en modo nube, la parte local también corre en la API central. Cada movimiento lo registra el dueño de esa ubicación. Los nombres son los de [TRD-M4](../../trd/TRD-M4-inventario.md).

El corte cerrado el 2026-11-19 es el de la nube: los casos de uso de esta página corren en la API central, con PostgreSQL. El nodo de sede, el nodo de bodega y el libro SQLite siguen dibujados porque son el producto híbrido, y todavía no están construidos.

## En el nodo de sede o de bodega

En modo nube, esta misma parte corre en la API central. Se divide en dos diagramas: lo que registra el bodeguero, y lo que pasa sola con cada venta.

### Compras, traslados, producción y conteos

```mermaid
flowchart LR
  WHK["<b>Bodeguero o cocina</b><br/>[Persona]"]:::persona

  subgraph Inputs["Entradas"]
    HTTP["<b>Inventario</b><br/>[Controlador HTTP]<br/>Compras, traslados, producción, conteos"]:::componente
    QRT["<b>Recepción por QR</b><br/>[Controlador HTTP]<br/>Comprobante de despacho"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_PUR["<b>Compras</b><br/>Proveedores, CreatePurchaseOrder,<br/>ReceivePurchase a costo real"]:::componente
    UC_PRD["<b>Producción</b><br/>RecordProduction"]:::componente
    UC_CNT["<b>Conteo</b><br/>RecordStockCount, ApproveAdjustment"]:::componente
    UC_TRF["<b>Traslados</b><br/>RequestTransfer, DispatchTransfer,<br/>ReceiveTransfer,<br/>ReceiveTransferWithDifferences"]:::componente
  end

  subgraph Outputs["Dominio y salidas"]
    D_LED["<b>StockLedger</b><br/>[Agregado]<br/>Solo se agrega; saldo y costo promedio"]:::componente
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnitOfWork]<br/>SQLite en el nodo, PostgreSQL en modo nube"]:::componente
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>EvaluatePermission para ajustes"]:::modulo
    D_TRF["<b>Transfer</b><br/>[Agregado]<br/>Dos mitades con un solo ID;<br/>TransferDispatched, TransferReceived"]:::componente
    PRN["<b>Printer</b><br/>[Puerto, shared/printing]<br/>M4 dispara el comprobante de traslado con QR"]:::componente
  end

  WHK --> HTTP
  WHK --> QRT

  HTTP --> UC_PUR
  HTTP --> UC_PRD
  HTTP --> UC_CNT
  HTTP --> UC_TRF
  QRT --> UC_TRF

  UC_PUR --> D_LED
  UC_PRD --> D_LED
  UC_CNT --> D_LED
  UC_TRF --> D_LED
  UC_PRD --> REPO
  UC_CNT -- "autorizar ajuste" --> M0
  UC_TRF --> D_TRF
  UC_TRF --> PRN

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Inputs fill:none,stroke:#888,stroke-dasharray: 3 3
  style Application fill:none,stroke:#888,stroke-dasharray: 3 3
  style Outputs fill:none,stroke:#888,stroke-dasharray: 3 3
```

Todos los casos de uso guardan el movimiento y el saldo en la misma transacción, con su evento (`StockMoved`) en la outbox; el diagrama solo dibuja una de esas flechas. Un traslado se despacha en el nodo origen (`TransferDispatched`) y se recibe en el destino con el mismo ID (`TransferReceived`).

### Consumo de ventas, alertas y disponibilidad

```mermaid
flowchart LR
  M1I["<b>M1 Pedidos y M5 Domicilios</b><br/>Consumo, devolución, merma"]:::modulo
  PRG["<b>Programador</b><br/>[Cada 15 minutos]"]:::modulo

  subgraph Inputs["Entradas"]
    CONS["<b>Consumo de ventas</b><br/>[entry-port.ts]"]:::componente
    COV["<b>Cobertura</b><br/>[Worker periódico]"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_MOV["<b>Movimientos</b><br/>RegisterSaleConsumption, ReturnStock, RecordWaste"]:::componente
    UC_ALR["<b>Alertas y disponibilidad</b><br/>EvaluateLevels, EvaluateCoverage,<br/>CalculatePossibleUnits,<br/>ConfirmNoRestockToday"]:::componente
  end

  subgraph Outputs["Dominio y salidas"]
    RCP["<b>RecipeCatalog</b><br/>[Adaptador]<br/>Copia sincronizada, con versión"]:::componente
    D_RCP["<b>RecipeExplosion</b><br/>[Regla pura]<br/>Variante, modificadores, sub-recetas,<br/>rendimiento, conversiones"]:::componente
    D_LED["<b>StockLedger</b><br/>[Agregado]"]:::componente
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnitOfWork]"]:::componente
    D_UNI["<b>PossibleUnits</b><br/>[Regla pura]<br/>Ingrediente limitante"]:::componente
    D_ALR["<b>ShortageAlert</b><br/>[Agregado]<br/>Niveles con histéresis"]:::componente
    NOT["<b>Notifier</b><br/>[Adaptador]<br/>WebSocket a caja y cocina"]:::componente
    AVL["<b>Disponibilidad</b><br/>[Evento AvailabilityChanged]<br/>A M1 y, por la outbox, al hub de M5"]:::modulo
  end

  M1I --> CONS
  PRG --> COV

  CONS --> UC_MOV
  COV --> UC_ALR

  UC_MOV --> RCP
  UC_MOV --> D_RCP
  UC_MOV --> D_LED
  UC_MOV --> REPO
  UC_ALR --> D_UNI
  UC_ALR --> D_ALR
  UC_ALR --> NOT
  UC_ALR -- "disponible, pocas, agotado" --> AVL

  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Inputs fill:none,stroke:#888,stroke-dasharray: 3 3
  style Application fill:none,stroke:#888,stroke-dasharray: 3 3
  style Outputs fill:none,stroke:#888,stroke-dasharray: 3 3
```

Cada saldo nuevo también dispara la evaluación de alertas, y una alerta puede proponer una orden de compra al bodeguero.

## En la nube

```mermaid
flowchart LR
  ADM["<b>Administrador</b><br/>[Persona]"]:::persona
  INB["<b>Inbox de lotes</b><br/>[M0]<br/>Movimientos de cada nodo"]:::modulo
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo

  subgraph Inputs["Entradas"]
    RCPC["<b>Insumos y recetas</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
    WEB["<b>Inventario consolidado</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
    LVL["<b>Niveles sugeridos</b><br/>[Worker]"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_RCP["<b>Catálogo de insumos y recetas</b><br/>UpdateRecipeCatalog, ImportRecipesFromExcel<br/>Unidades y conversiones, recetas por variante,<br/>sub-recetas, versionado"]:::componente
    UC_LOC["<b>Bodega sin nodo</b><br/>Los mismos casos de uso del nodo.<br/>Abierto para clientes pequeños (PA-44),<br/>fuera del piloto"]:::componente
    UC_LVL["<b>ProposeLevels</b><br/>Consumo y tiempo de reposición"]:::componente
  end

  subgraph Outputs["Salidas"]
    CHN["<b>Canal de la sede</b><br/>[M0]<br/>Copia versionada de recetas"]:::modulo
    PG[("<b>PostgreSQL</b><br/>Insumos, recetas, niveles y<br/>movimientos de todas las ubicaciones")]:::contenedor
  end

  ADM --> RCPC
  ADM --> WEB
  INB --> PG
  PRG --> LVL

  RCPC --> UC_RCP
  WEB -. "solo si se decide PA-44" .-> UC_LOC
  LVL --> UC_LVL

  UC_RCP -. "copia versionada" .-> CHN
  UC_RCP --> PG
  UC_LOC --> PG
  UC_LVL -- "propuestos al administrador" --> PG

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Inputs fill:none,stroke:#888,stroke-dasharray: 3 3
  style Application fill:none,stroke:#888,stroke-dasharray: 3 3
  style Outputs fill:none,stroke:#888,stroke-dasharray: 3 3
```

## Puertos y adaptadores

| Puerto | Nube | Nodo de sede o de bodega |
|--------|------|--------------------------|
| `StockMovementRepository`, `StockBalanceRepository` | `adapters/postgres`; vista consolidada (y bodegas sin nodo si se decide PA-44) | `adapters/sqlite`; saldo en la misma transacción |
| `RecipeRepository` | `adapters/postgres`; dueña de insumos, recetas y niveles | — |
| `RecipeCatalog` | Lectura directa | Copia sincronizada, con versión |
| `ShortageAlertRepository` | Vista consolidada | Alertas de sus ubicaciones |
| `Notifier` | Web Push al gerente; WhatsApp o correo en una fase posterior | WebSocket a caja y cocina |
| `Printer` (`shared/printing`) | — | Comprobante de traslado con QR |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M1 y M5 → M4 | Llamada en proceso a `RegisterSaleConsumption`, `ReturnStock` o `RecordWaste` | Consumo por receta, devolución o merma |
| M4 → M1 | Evento `AvailabilityChanged` | Estado del plato y no se repone hoy |
| M4 → M5 | Mismo evento, por la outbox hacia el hub | Agotado o disponible en cada plataforma |
| Nodo origen → nodo destino | `TransferDispatched` y `TransferReceived` por la nube | Salida en el origen, entrada en el destino, reconciliadas por ID |
| M0 | Llamada en proceso a `EvaluatePermission` y `RecordAuditEvent` | Permiso y auditoría de ajustes y diferencias |
| M6 | Eventos (`StockMoved`) | Teórico contra real, mermas, margen, quiebres |
