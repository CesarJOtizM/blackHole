# C4 · Componentes de M5 Domicilios y plataformas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [Flujos M5](../../flujos/m5-domicilios.md), [TRD-00 §5.5 y §6.1](../../trd/TRD-00-arquitectura-base.md) |

El hub de integraciones vive en la nube: recibe pedidos de las plataformas, publica menú y disponibilidad, y concilia liquidaciones. Al aceptar, el nodo crea el pedido interno y pasa a ser su dueño. El domicilio propio y la captura manual nacen en la sede.

## En la nube: hub de integraciones

```mermaid
flowchart LR
  PLATW["<b>Plataformas</b><br/>[Sistema externo]<br/>Avisan por webhook"]:::externo
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo
  INB["<b>Eventos de la sede</b><br/>[M0, por la outbox]<br/>Estados del pedido, disponibilidad de M4"]:::modulo
  DOM["<b>Domiciliario</b><br/>[Persona]"]:::persona

  subgraph Entradas["Entradas"]
    WH["<b>Webhooks</b><br/>[Controlador HTTP]<br/>Verifica la firma"]:::componente
    POLL["<b>Consulta periódica</b><br/>[Worker]<br/>Plataformas sin webhook"]:::componente
    LIQ["<b>Liquidaciones</b><br/>[Worker]"]:::componente
    VIG["<b>Vigía de sedes</b><br/>[Worker]<br/>Pausa si el nodo no responde"]:::componente
    EVS["<b>Estados y disponibilidad</b><br/>[Manejador]"]:::componente
    DAPI["<b>App del domiciliario</b><br/>[Controlador HTTP + WebSocket]"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_EXT["<b>Pedido externo</b><br/>RecibirPedidoExterno: normalizar,<br/>sin duplicar, sede y productos"]:::componente
    UC_LIQ["<b>Conciliación</b><br/>Importar liquidación, comparar"]:::componente
    UC_PUB["<b>Canal</b><br/>PublicarMenuCanal, PropagarDisponibilidad,<br/>PausarTienda, ReanudarTienda"]:::componente
    UC_ENT["<b>Entregas</b><br/>Pedido asignado, etapas"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_EXT["<b>PedidoExterno, ProductoCanal</b><br/>[Entidades]<br/>Clave plataforma + id externo"]:::componente
  end

  subgraph Salida["Salidas"]
    CON["<b>ConectorPlataforma</b><br/>[packages/plataformas]<br/>Rappi, DiDi, Integrador, Manual"]:::componente
    REPO["<b>Repositorios</b><br/>[Drizzle, PostgreSQL]<br/>Pedidos externos, mapeos,<br/>credenciales cifradas"]:::componente
    CAN["<b>Canal de la sede</b><br/>[M0, WSS]<br/>Pedido nuevo, cancelación"]:::modulo
  end

  PLAT["<b>Plataformas</b><br/>[Sistema externo]<br/>API de cada plataforma"]:::externo

  PLATW -. "webhook" .-> WH
  PRG --> POLL
  PRG --> LIQ
  PRG --> VIG
  INB --> EVS
  DOM --> DAPI

  WH --> UC_EXT
  POLL --> UC_EXT
  LIQ --> UC_LIQ
  VIG --> UC_PUB
  EVS --> UC_PUB
  DAPI --> UC_ENT

  UC_EXT --> D_EXT
  UC_PUB --> D_EXT

  POLL -. "trae pedidos" .-> CON
  UC_EXT --> REPO
  UC_EXT --> CAN
  UC_PUB --> CON
  UC_LIQ --> CON
  UC_ENT --> REPO
  CON -- "HTTPS" --> PLAT

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

Las plataformas aparecen dos veces porque cumplen dos papeles: avisan por webhook (izquierda) y el conector llama a su API (derecha). Los estados aceptado, en preparación y listo suben desde la sede y el hub los propaga a la plataforma.

## En la sede

En modo nube, esta parte corre en la API central.

```mermaid
flowchart LR
  CAN["<b>Canal de la sede</b><br/>[Nube, M0]<br/>Pedido nuevo, cancelación"]:::modulo
  CAJ["<b>Caja o mostrador</b><br/>[Persona]"]:::persona
  DOM["<b>Domiciliario</b><br/>[Persona]<br/>Durante un corte, por el Wi-Fi de la sede"]:::persona

  subgraph Entradas["Entradas"]
    EVT["<b>Eventos del hub</b><br/>[Manejador]<br/>Alerta en caja"]:::componente
    HTTP["<b>Domicilios</b><br/>[Controlador HTTP]<br/>Propio, manual, aceptar, despachar,<br/>entregar"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_ACE["<b>Aceptación</b><br/>Aceptar, Rechazar, MapearProducto,<br/>AceptarAutomatico"]:::componente
    UC_CAN["<b>Cancelación de plataforma</b>"]:::componente
    UC_DOM["<b>Domicilio propio</b><br/>CrearDomicilio, AsignarDomiciliario,<br/>ConfirmarEntrega"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_DOM["<b>Domicilio</b><br/>[Agregado]<br/>Dirección, etapas con hora"]:::componente
  end

  subgraph Salida["Salidas"]
    M1["<b>M1 Pedidos</b><br/>[Puerto de entrada]<br/>CrearPedidoInterno"]:::modulo
    M2["<b>M2 Caja</b><br/>[Puerto de entrada]<br/>Por cobrar y contra entrega"]:::modulo
    M4["<b>M4 Inventario</b><br/>[Puerto de entrada]<br/>Merma si ya empezó"]:::modulo
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Permiso para aceptar o pausar"]:::modulo
    OUT["<b>Persistencia y outbox</b><br/>[Drizzle + UnidadDeTrabajo]<br/>Estados hacia el hub"]:::componente
  end

  CAN -.-> EVT
  CAJ --> HTTP
  DOM --> HTTP

  EVT --> UC_ACE
  EVT --> UC_CAN
  HTTP --> UC_ACE
  HTTP --> UC_DOM

  UC_DOM --> D_DOM

  UC_ACE -- "crea el pedido interno" --> M1
  UC_DOM -- "crea el pedido interno" --> M1
  UC_ACE -- "saldo por cobrar" --> M2
  UC_DOM -- "cobro contra entrega" --> M2
  UC_CAN --> M4
  UC_ACE -- "permiso" --> M0
  UC_ACE -- "aceptado, en preparación, listo" --> OUT
  UC_DOM --> OUT

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

## Puerto `ConectorPlataforma`

Cada adaptador declara qué operaciones soporta (TRD-00, 6.1). Lo que no soporta se hace a mano.

| Adaptador | Pedidos | Estados | Menú | Disponibilidad | Pausa | Liquidación |
|-----------|---------|---------|------|----------------|-------|-------------|
| Rappi | Según acuerdo (ADR-011) | Según acuerdo | Según acuerdo | Según acuerdo | Según acuerdo | API o archivo |
| DiDi Food | Según acuerdo (ADR-011) | Según acuerdo | Según acuerdo | Según acuerdo | Según acuerdo | API o archivo |
| Integrador | Según el tercero | Según el tercero | Según el tercero | Según el tercero | Según el tercero | Según el tercero |
| Manual | La caja copia el pedido desde la tablet | La caja lo cambia en la tablet | En el portal de la plataforma | En el portal | En el portal | Archivo |

## Otros puertos

| Puerto | Nube | Nodo |
|--------|------|------|
| `RepositorioPedidosExternos` | `persistencia-postgres` | Copia del pedido por aceptar |
| `RepositorioDomicilios` | `persistencia-postgres` | `persistencia-sqlite` |
| `Secretos` | Credenciales de cada tienda, cifradas | — |
| `CanalSede` | Gateway WebSocket hacia el nodo | Cliente WebSocket saliente |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M5 → M1 | Llamada en proceso a `CrearPedidoInterno` | Pedido con canal y código externo |
| M4 → M5 | Evento por la outbox hasta el hub | Agotado o disponible |
| M5 → M2 | Llamada en proceso | Saldo por cobrar a la plataforma; cobro contra entrega |
| M5 → M4 | Llamada en proceso | Devolución o merma por cancelación |
| M6 | Eventos | Tiempos por etapa, comisión, diferencias de liquidación |
