# C4 · Componentes de M4 Inventario, bodegas y recetas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [Flujos M4](../../flujos/m4-inventario.md), [TRD-00 §5.1, §5.5 y §9](../../trd/TRD-00-arquitectura-base.md) |

M4 corre con los mismos casos de uso en el nodo de cada sede híbrida (punto y bodegas de la sede), en el nodo de la bodega general (perfil bodega) y en la nube. En la nube vive siempre lo que es de la empresa: insumos, recetas, consolidado, niveles sugeridos y bodegas sin nodo. En una sede en modo nube, la parte local también corre en la API central. Cada movimiento lo registra el dueño de esa ubicación.

## En el nodo de sede o de bodega

En modo nube, esta misma parte corre en la API central. Se divide en dos diagramas: lo que registra el bodeguero, y lo que pasa sola con cada venta.

### Compras, traslados, producción y conteos

```mermaid
flowchart LR
  BOD["<b>Bodeguero o cocina</b><br/>[Persona]"]:::persona

  subgraph Entradas["Entradas"]
    HTTP["<b>Inventario</b><br/>[Controlador HTTP]<br/>Compras, traslados, producción, conteos"]:::componente
    QRT["<b>Recepción por QR</b><br/>[Controlador HTTP]<br/>Comprobante de despacho"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_COM["<b>Compras</b><br/>Proveedores, CrearOrdenCompra,<br/>RecibirCompra a costo real,<br/>CargarFacturaProveedor"]:::componente
    UC_PRO["<b>Producción</b><br/>RegistrarProduccion"]:::componente
    UC_CON["<b>Conteo</b><br/>RegistrarConteo, AprobarAjuste"]:::componente
    UC_TRA["<b>Traslados</b><br/>Solicitar, Despachar, Recibir,<br/>RecibirConDiferencias"]:::componente
  end

  subgraph Salida["Dominio y salidas"]
    M3["<b>M3 Facturación</b><br/>[Puerto de entrada, Fase 2]<br/>Documento soporte y XML de proveedores"]:::modulo
    D_LIB["<b>Libro de movimientos</b><br/>[Agregado]<br/>Solo se agrega; saldo y costo promedio"]:::componente
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnidadDeTrabajo]<br/>SQLite en el nodo, PostgreSQL en modo nube"]:::componente
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Permiso para ajustes"]:::modulo
    D_TRA["<b>Traslado</b><br/>[Agregado]<br/>Dos mitades con un solo ID"]:::componente
    IMPR["<b>Impresora</b><br/>[compartido/impresion]<br/>Comprobante de traslado con QR"]:::componente
  end

  BOD --> HTTP
  BOD --> QRT

  HTTP --> UC_COM
  HTTP --> UC_PRO
  HTTP --> UC_CON
  HTTP --> UC_TRA
  QRT --> UC_TRA

  UC_COM --> M3
  UC_COM --> D_LIB
  UC_PRO --> D_LIB
  UC_CON --> D_LIB
  UC_TRA --> D_LIB
  UC_PRO --> REPO
  UC_CON -- "autorizar ajuste" --> M0
  UC_TRA --> D_TRA
  UC_TRA --> IMPR

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

Todos los casos de uso guardan el movimiento y el saldo en la misma transacción, con su evento en la outbox; el diagrama solo dibuja una de esas flechas. Un traslado se despacha en el nodo origen y se recibe en el destino con el mismo ID.

### Consumo de ventas, alertas y disponibilidad

```mermaid
flowchart LR
  M1I["<b>M1 Pedidos y M5 Domicilios</b><br/>Consumo, devolución, merma"]:::modulo
  PRG["<b>Programador</b><br/>[Cada 15 minutos]"]:::modulo

  subgraph Entradas["Entradas"]
    CONS["<b>Consumo de ventas</b><br/>[Puerto de entrada]"]:::componente
    COB["<b>Cobertura</b><br/>[Worker periódico]"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_MOV["<b>Movimientos</b><br/>RegistrarConsumoVenta, Devolucion, Merma"]:::componente
    UC_ALE["<b>Alertas y disponibilidad</b><br/>EvaluarNiveles, EvaluarCobertura,<br/>CalcularUnidadesPosibles,<br/>ConfirmarNoSeRepone"]:::componente
  end

  subgraph Salida["Dominio y salidas"]
    REC["<b>CatalogoRecetas</b><br/>[Adaptador]<br/>Copia sincronizada, con versión"]:::componente
    D_REC["<b>Receta versionada</b><br/>[Regla pura]<br/>Variante, modificadores, sub-recetas,<br/>rendimiento, conversiones"]:::componente
    D_LIB["<b>Libro de movimientos</b><br/>[Agregado]"]:::componente
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnidadDeTrabajo]"]:::componente
    D_UNI["<b>Unidades posibles</b><br/>[Regla pura]<br/>Ingrediente limitante"]:::componente
    D_ALE["<b>AlertaEscasez</b><br/>[Agregado]<br/>Niveles con histéresis"]:::componente
    NOT["<b>Notificador</b><br/>[Adaptador]<br/>WebSocket a caja y cocina"]:::componente
    DIS["<b>Disponibilidad</b><br/>[Evento DisponibilidadCambiada]<br/>A M1 y, por la outbox, al hub de M5"]:::modulo
  end

  M1I --> CONS
  PRG --> COB

  CONS --> UC_MOV
  COB --> UC_ALE

  UC_MOV --> REC
  UC_MOV --> D_REC
  UC_MOV --> D_LIB
  UC_MOV --> REPO
  UC_ALE --> D_UNI
  UC_ALE --> D_ALE
  UC_ALE --> NOT
  UC_ALE -- "disponible, pocas, agotado" --> DIS

  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

Cada saldo nuevo también dispara la evaluación de alertas, y una alerta puede proponer una orden de compra al bodeguero.

## En la nube

```mermaid
flowchart LR
  ADM["<b>Administrador</b><br/>[Persona]"]:::persona
  INB["<b>Inbox de lotes</b><br/>[M0]<br/>Movimientos de cada nodo"]:::modulo
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo

  subgraph Entradas["Entradas"]
    RECC["<b>Insumos y recetas</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
    WEB["<b>Inventario consolidado</b><br/>[Controlador HTTP]<br/>Web de administración, bodega sin nodo"]:::componente
    NIV["<b>Niveles sugeridos</b><br/>[Worker]"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_REC["<b>Catálogo de insumos y recetas</b><br/>Unidades y conversiones, recetas por variante,<br/>sub-recetas, versionado, importar Excel"]:::componente
    UC_LOC["<b>Movimientos de bodegas sin nodo</b><br/>Los mismos casos de uso del nodo"]:::componente
    UC_NIV["<b>Proponer niveles</b><br/>Consumo y tiempo de reposición"]:::componente
  end

  subgraph Salida["Salidas"]
    CAN["<b>Canal de la sede</b><br/>[M0]<br/>Copia versionada de recetas"]:::modulo
    PG[("<b>PostgreSQL</b><br/>Insumos, recetas, niveles y<br/>movimientos de todas las ubicaciones")]:::contenedor
  end

  ADM --> RECC
  ADM --> WEB
  INB --> PG
  PRG --> NIV

  RECC --> UC_REC
  WEB --> UC_LOC
  NIV --> UC_NIV

  UC_REC -. "copia versionada" .-> CAN
  UC_REC --> PG
  UC_LOC --> PG
  UC_NIV -- "propuestos al administrador" --> PG

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

## Puertos y adaptadores

| Puerto | Nube | Nodo de sede o de bodega |
|--------|------|--------------------------|
| `RepositorioMovimientos`, `RepositorioSaldos` | `adaptadores/postgres`; dueña solo de bodegas sin nodo | `adaptadores/sqlite`; saldo en la misma transacción |
| `RepositorioRecetas` | `adaptadores/postgres`; dueña de insumos, recetas y niveles | — |
| `CatalogoRecetas` | Lectura directa | Copia sincronizada, con versión |
| `RepositorioAlertas` | Vista consolidada | Alertas de sus ubicaciones |
| `Notificador` | Web Push al gerente; WhatsApp o correo en una fase posterior | WebSocket a caja y cocina |
| `Impresora` | — | Comprobante de traslado con QR |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M1 y M5 → M4 | Llamada en proceso al puerto de entrada | Consumo por receta, devolución o merma |
| M4 → M1 | Evento `DisponibilidadCambiada` | Estado del plato y no se repone hoy |
| M4 → M5 | Mismo evento, por la outbox hacia el hub | Agotado o disponible en cada plataforma |
| Nodo origen → nodo destino | Evento del traslado por la nube | Salida en el origen, entrada en el destino, reconciliadas por ID |
| M4 → M3 | Llamada en proceso (Fase 2) | Documento soporte de compras a quien no factura; carga del XML de facturas de proveedores |
| M0 | Llamada en proceso | Permiso y auditoría de ajustes y diferencias |
| M6 | Eventos | Teórico contra real, mermas, margen, quiebres |
