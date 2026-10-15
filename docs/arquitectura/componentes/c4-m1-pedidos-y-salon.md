# C4 · Componentes de M1 Pedidos y salón

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [Flujos M1](../../flujos/m1-pedidos-y-salon.md), [TRD-00 §6 y §6.4](../../trd/TRD-00-arquitectura-base.md) |

El salón corre en el nodo si la sede está en híbrido, o en la API central si está en modo nube. Los casos de uso son los mismos. Dos piezas viven siempre en la nube: el menú y catálogo, que es de la marca y se administra en la web (PRD-00, M1), y la intención de pedido QR, porque el celular del cliente no entra a la red del personal.

## En la sede

Corre en el nodo, o en la API central si la sede está en modo nube.

```mermaid
flowchart LR
  MES["<b>Mesero</b><br/>[Persona]"]:::persona
  COC["<b>Cocina y jefe de cocina</b><br/>[Persona]"]:::persona
  CAN["<b>Canal de la sede</b><br/>[Nube, M0]<br/>Pedido QR, copia del menú,<br/>reservas del día, disponibilidad"]:::modulo
  M5I["<b>M5 Domicilios</b><br/>Pedido aceptado"]:::modulo
  M9I["<b>M9 Reservas</b><br/>Llegada del cliente"]:::modulo
  M2I["<b>M2 Caja</b><br/>Lee la cuenta"]:::modulo

  subgraph Entradas["Entradas"]
    HTTP["<b>Salón</b><br/>[Controlador HTTP]<br/>Mesas, pedidos, anulaciones, cuenta"]:::componente
    WSK["<b>Cola de cocina</b><br/>[Gateway WebSocket]<br/>Estados por estación"]:::componente
    EVT["<b>Eventos entrantes</b><br/>[Manejador]"]:::componente
    PIE["<b>Puerto de entrada de M1</b><br/>[Interfaz en proceso]<br/>CrearPedidoInterno, AsociarReserva,<br/>ConsultarCuenta"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_MESA["<b>Mesas</b><br/>AbrirMesa, MoverMesa, UnirMesas,<br/>TransferirProductos"]:::componente
    UC_PED["<b>Pedido</b><br/>AgregarProductos, EnviarACocina,<br/>AplicarPedidoQr, CrearPedidoInterno"]:::componente
    UC_COC["<b>Cocina</b><br/>CambiarEstadoLinea, MarcarNoSeEntrega,<br/>RetirarLineasNoSeRepone"]:::componente
    UC_ANU["<b>Anulación</b><br/>AnularLinea, AnularCuenta"]:::componente
    UC_CTA["<b>Cuenta</b><br/>PedirCuenta, DividirCuenta"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_MESA["<b>Mesa</b><br/>[Agregado]<br/>Libre, ocupada, cuenta pedida, por limpiar"]:::componente
    D_PED["<b>Pedido y LineaPedido</b><br/>[Agregado]<br/>Estados con hora, canal"]:::componente
    D_ENR["<b>Enrutador</b><br/>[Regla pura]<br/>Producto → estación → salida"]:::componente
    D_TOK["<b>TokenPortal</b><br/>[Objeto de valor]<br/>Firmado, de un solo propósito"]:::componente
  end

  subgraph Salida["Salidas"]
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnidadDeTrabajo]<br/>SQLite en el nodo, PostgreSQL en modo nube"]:::componente
    MENU["<b>CatalogoMenu</b><br/>[Adaptador]<br/>Copia del menú y precios de la sede"]:::componente
    RT["<b>Tiempo real</b><br/>[Gateway WebSocket]<br/>Comandas, avisos de listo, cuenta en caja"]:::componente
    IMPR["<b>Impresora</b><br/>[packages/impresion]<br/>Comanda y precuenta"]:::componente
    M4["<b>M4 Inventario</b><br/>[Puerto de entrada]<br/>Consumo, devolución, merma"]:::modulo
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Permiso, autorización, auditoría"]:::modulo
  end

  IMP["<b>Impresoras de comandas</b><br/>[Dispositivo ESC/POS]"]:::externo

  MES -- "HTTPS + WSS" --> HTTP
  COC --> WSK
  CAN -.-> EVT
  M5I --> PIE
  M9I --> PIE
  M2I --> PIE

  HTTP --> UC_MESA
  HTTP --> UC_PED
  HTTP --> UC_ANU
  HTTP --> UC_CTA
  WSK --> UC_COC
  EVT -- "pedido QR" --> UC_PED
  EVT -- "no se repone hoy" --> UC_COC
  PIE --> UC_PED
  PIE --> UC_MESA
  PIE --> UC_CTA

  UC_MESA --> D_MESA
  UC_PED --> D_PED
  UC_PED --> D_ENR
  UC_COC --> D_PED
  UC_ANU --> D_PED
  UC_CTA --> D_TOK

  UC_MESA --> REPO
  UC_PED --> REPO
  UC_PED --> MENU
  UC_PED -- "comanda" --> RT
  UC_PED -- "comanda" --> IMPR
  UC_PED -- "consumo según receta" --> M4
  UC_COC -- "aviso de listo" --> RT
  UC_ANU -- "devolución o merma" --> M4
  UC_ANU -- "autorización" --> M0
  UC_MESA -- "permiso" --> M0
  UC_CTA -- "precuenta con QR" --> IMPR
  IMPR -- "TCP 9100 o USB" --> IMP

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

Todos los casos de uso guardan con la persistencia y dejan su evento en la outbox; el diagrama solo dibuja dos de esas flechas. M6 recibe los eventos por la outbox.

## En la nube: menú y pedido QR

```mermaid
flowchart LR
  ADM["<b>Administrador</b><br/>[Persona]"]:::persona
  CLI["<b>Cliente</b><br/>[Persona]"]:::persona

  subgraph Entradas["Entradas"]
    MENC["<b>Menú y catálogo</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
    PQR["<b>Pedido de la mesa</b><br/>[Controlador HTTP, portal]<br/>/m/token-mesa"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_MEN["<b>Catálogo</b><br/>Productos, variantes, modificadores,<br/>combos, estaciones; precio,<br/>disponibilidad y horario por sede"]:::componente
    UC_QR["<b>Pedido QR</b><br/>VerCartaDeLaSede,<br/>RegistrarIntencionPedidoQr"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_MEN["<b>Menú</b><br/>[Agregado]<br/>Producto, Variante, Modificador,<br/>PrecioSede, ClasificacionTributaria"]:::componente
    D_INT["<b>IntencionPedidoQr</b><br/>[Agregado]<br/>UUID idempotente; sin anular,<br/>descontar ni cambiar precios"]:::componente
  end

  subgraph Salida["Salidas"]
    REPO["<b>RepositorioMenu, RepositorioIntencionesQr</b><br/>[Drizzle]<br/>PostgreSQL"]:::componente
    CAN["<b>Canal de la sede</b><br/>[M0]<br/>Copia del menú y pedido QR,<br/>al instante o al reconectar"]:::modulo
  end

  ADM --> MENC --> UC_MEN
  CLI --> PQR --> UC_QR
  UC_MEN --> D_MEN
  UC_QR --> D_MEN
  UC_QR --> D_INT
  UC_MEN --> REPO
  UC_QR --> REPO
  UC_MEN -- "publica la copia" --> CAN
  UC_QR -- "intención por aplicar" --> CAN

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

En modo nube no hay canal hacia un nodo: el pedido QR lo aplica la misma API central.

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `RepositorioPedidos`, `RepositorioMesas` | `persistencia-postgres` | `persistencia-sqlite` |
| `RepositorioIntencionesQr` | PostgreSQL | — (el nodo recibe la intención por el canal de la sede) |
| `RepositorioMenu` | `persistencia-postgres`; dueña del menú, precios y horarios | — |
| `CatalogoMenu` | Lectura directa del menú | Copia sincronizada desde la nube |
| `Impresora` | Trabajo hacia el puente de la sede | Cola local ESC/POS |
| `NotificadorTiempoReal` | Gateway WebSocket con `LISTEN/NOTIFY` entre instancias | Gateway WebSocket del nodo |
| `FirmadorTokens` | Llave de la nube | Llave de la sede, así la precuenta sale sin internet |
| `Reloj` | Hora del servidor | Hora del nodo |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M4 | Llamada en proceso a su puerto de entrada | Consumo según receta al enviar; devolución o merma al anular |
| M4 → M1 | Evento `DisponibilidadCambiada` | Disponible, pocas unidades, agotado, no se repone hoy |
| M1 → M2 | M2 lee la cuenta por el puerto de entrada de M1 y por WebSocket | Cuenta en tiempo real y precuenta |
| M5 → M1 | Llamada en proceso a `CrearPedidoInterno` | Pedido aceptado de plataforma o domicilio propio |
| M9 → M1 | Evento `ReservasDelDia` y llamada en la llegada | Mesa bloqueada; mesa y cuenta asociadas |
| M0 | Llamada en proceso | Permiso, autorización y auditoría |
| M6 | Eventos de la outbox | Cada cambio de estado con la hora del nodo |
