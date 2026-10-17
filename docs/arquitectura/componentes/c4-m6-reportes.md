# C4 · Componentes de M6 Reportes y analítica

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fuentes | [Flujos M6](../../flujos/m6-reportes.md), [TRD-00 §11](../../trd/TRD-00-arquitectura-base.md) |

M6 no tiene escrituras propias de operación: lee los eventos que los demás módulos ya guardan. El nodo responde el día sin internet. La nube construye las proyecciones consolidadas y corre los detectores de comportamiento inusual.

## En la sede: reportes del día

En modo nube, esta parte corre en la API central y lee PostgreSQL.

```mermaid
flowchart LR
  CAJ["<b>Cajero o administrador en sitio</b><br/>[Persona]"]:::persona
  RD["<b>Reportes del día</b><br/>[Controlador HTTP]<br/>Cierre, turno, tiempos en vivo"]:::componente
  UC_RD["<b>Consultas del día</b><br/>[Casos de uso]"]:::componente
  SQ[("<b>Base de la operación</b><br/>SQLite en el nodo,<br/>PostgreSQL en modo nube")]:::contenedor
  MODS["<b>Otros módulos de la sede</b><br/>Escriben la operación"]:::modulo

  CAJ --> RD --> UC_RD --> SQ
  MODS --> SQ

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
```

## En la nube: proyecciones, detectores y consolidado

```mermaid
flowchart LR
  MODS["<b>M0, M1, M2, M3, M4, M5, M8, M9</b><br/>Eventos con hora del nodo,<br/>por la outbox"]:::modulo
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo
  ADM["<b>Administrador y contador</b><br/>[Persona]"]:::persona

  subgraph Entradas["Entradas"]
    PROY["<b>Proyector</b><br/>[Worker]<br/>Lee el inbox de eventos"]:::componente
    DET["<b>Detectores</b><br/>[Worker]<br/>Anulaciones, descuentos, cajón sin venta"]:::componente
    RC["<b>Reportes consolidados</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_PRY["<b>Proyectar hechos</b><br/>ProjectFacts"]:::componente
    UC_DET["<b>Detectar patrones</b><br/>DetectPatterns: patrón repetido"]:::componente
    UC_CON["<b>Consultar consolidado</b><br/>QueryConsolidatedReport"]:::componente
    EXP["<b>Exportaciones</b><br/>ExportReport: Excel para contador y nómina"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_MET["<b>Definición de métricas</b><br/>[Reglas puras]<br/>Tiempos A→B, márgenes, control"]:::componente
  end

  subgraph Salida["Salidas"]
    INB[("<b>PostgreSQL</b><br/>Eventos sincronizados")]:::contenedor
    HEC[("<b>PostgreSQL</b><br/>Hechos por día, sede, producto,<br/>estación y persona; vistas materializadas")]:::contenedor
    OBJ[("<b>Archivos</b><br/>Exportaciones")]:::contenedor
    NOT["<b>Alertas</b><br/>[Notificador de M0]"]:::modulo
  end

  MODS -. "inbox" .-> INB
  PRG --> PROY
  PRG --> DET
  ADM --> RC

  PROY --> UC_PRY
  DET --> UC_DET
  RC --> UC_CON
  RC --> EXP

  UC_PRY --> D_MET
  UC_DET --> D_MET

  UC_PRY --> INB
  UC_PRY --> HEC
  UC_DET --> INB
  UC_DET --> NOT
  UC_CON --> HEC
  EXP --> HEC
  EXP --> OBJ

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

## Familias de reportes y su fuente

| Familia | Eventos de | Día (nodo) | Consolidado (nube) |
|---------|------------|------------|--------------------|
| Tiempos | M1, M5 | Tiempos en vivo | Por estación, producto y franja |
| Ventas y medios de pago | M2, M3 | Cierre y turno | Por sede, marca y periodo |
| Costos e inventario | M4 y costo de lo vendido en M1 | Stock y alertas | Teórico contra real, margen |
| Control | M0, M1, M2, M4 | Lo del día | Detectores y alertas |
| Personal y propinas | M8, M2 | Turno | Horas, tardanzas, ventas por hora |
| Reservas | M9 | Las del día | Ocupación, no llegadas, anticipos |
| Fiscal | M3 | Pendientes de emisión | Por contribuyente, para el contador |

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `EventSource` | Inbox de PostgreSQL | Tablas de operación en SQLite |
| `ProjectionRepository` | Tablas de hechos y vistas materializadas; réplica de lectura cuando el volumen lo pida (TRD-01, 6) | — |
| `FileStorage` | S3, Cloud Storage o Blob Storage | — |

Una base analítica separada se evalúa solo si el volumen lo exige (TRD-00, 11).
