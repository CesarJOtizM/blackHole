# Flujos · M1 Pedidos y salón

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [PRD-00 §6.1 y M1](../prd/PRD-00-vision-producto.md), [TRD-00 §6](../trd/TRD-00-arquitectura-base.md) |

El mesero toma el pedido en el celular, o el cliente lo envía desde el QR de su mesa. El nodo lo guarda, lo reparte por estación de cocina, lo muestra en la caja y descuenta la receta. El pedido del mesero ocurre dentro del local. El del QR nace en la nube y el nodo lo aplica al instante, o al reconectar si hay un corte.

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M0 | El nodo valida el permiso antes de abrir mesa, anular, descontar o transferir. |
| M4 | Al enviar a cocina descuenta la receta. M4 le devuelve si el plato está agotado. |
| M2 | La cuenta se ve en la caja desde que existe. Pedir la cuenta abre el cobro. |
| M3 | La precuenta lleva el QR del portal de facturación. |
| Portal | El QR fijo de la mesa crea o amplía la cuenta. El canal es QR mesa. |
| M5 | Un domicilio o un pedido de plataforma, una vez aceptado, entra como pedido de esta sección. |
| M8 | Sin entrada marcada no se opera, si la sede lo exige. |
| M9 | La reserva bloquea la mesa y, al llegar el cliente, se asocia a la cuenta. |
| M6 | Cada cambio de estado guarda su hora. |

## Pedido en mesa

```mermaid
sequenceDiagram
  actor Mesero
  participant Nodo
  participant Cocina as Cocina
  participant Caja
  participant Inv as Inventario M4

  Mesero->>Nodo: Abrir mesa y comensales
  Mesero->>Nodo: Productos, modificadores y notas
  Mesero->>Nodo: Enviar a cocina
  Nodo->>Nodo: Permiso, pedido y evento
  Nodo->>Inv: Consumo según receta en el punto
  Nodo-->>Cocina: Comanda en la estación, por pantalla, impresora o ambas
  Nodo-->>Caja: Cuenta actualizada
  Cocina->>Nodo: En preparación
  Cocina->>Nodo: Listo
  Nodo-->>Mesero: Aviso de listo
  Mesero->>Nodo: Entregado en la mesa
```

Si la impresora de comandas falla, la comanda sigue en la pantalla y se avisa a la caja. Un pedido puede enviarse por tiempos: primero entradas, después fuertes. Reenviar un producto vuelve a enrutar solo ese producto.

## Pedido desde el QR de la mesa

```mermaid
sequenceDiagram
  actor Cliente
  participant Portal as Portal
  participant Nodo
  participant Cocina as Cocina
  participant Caja

  Cliente->>Portal: Escanea el QR fijo de su mesa
  Portal-->>Cliente: Carta de esa sede
  Cliente->>Portal: Productos, modificadores y notas
  Portal->>Portal: Intención de pedido, una sola vez
  alt La sede tiene enlace
    Portal-->>Nodo: Aplicar ahora
  else Hay un corte
    Portal-->>Nodo: Aplicar al reconectar
  end
  Nodo->>Nodo: Abre la mesa o suma a la cuenta
  Nodo-->>Cocina: Comanda, canal QR mesa
  Nodo-->>Caja: Cuenta actualizada
```

El cliente no anula, no descuenta y no cambia precios. Por defecto la comanda sale directo. Si la sede configuró aceptación en caja, la cocina la ve después de que la caja acepta. Al aplicar un pedido que esperó durante un corte, el nodo usa la disponibilidad de ese momento: si el plato ya no se puede enviar, no entra a cocina.

## A dónde va cada producto

```mermaid
flowchart TD
  P["Producto del pedido"] --> E["Estación configurada<br/>parrilla, fríos, bar"]
  E --> S{"Salida de la estación"}
  S --> K["Pantalla de cocina"]
  S --> I["Impresora de comandas"]
  P --> C["Caja, siempre"]
  P --> R["Inventario del punto<br/>la estación no tiene stock"]
```

El menú y las recetas son de la marca. La sede ajusta precio, disponibilidad y horario. La disponibilidad automática (agotado o pocas unidades) usa solo el inventario del punto. Si no alcanza, el plato se muestra agotado. La cuenta igual se puede cobrar: un faltante de conteo no detiene el servicio. Si alguien confirma que **hoy no se repone**, ese plato deja de enviarse y las mesas que ya lo pidieron reciben el aviso de abajo.

## Estados de la mesa

```mermaid
stateDiagram-v2
  [*] --> Libre
  Libre --> Ocupada: Abrir mesa
  Ocupada --> Ocupada: Enviar productos
  Ocupada --> CuentaPedida: Pedir la cuenta
  CuentaPedida --> Ocupada: Seguir consumiendo
  CuentaPedida --> PorLimpiar: Cuenta pagada
  PorLimpiar --> Libre: Mesa lista
```

Mover una mesa, unir mesas o pasar productos entre cuentas ocurre mientras la mesa sigue ocupada. Esas acciones pasan por el permiso de M0.

## Estados de un producto en cocina

```mermaid
stateDiagram-v2
  [*] --> Enviado: Sale hacia la estación
  Enviado --> EnPreparacion: Cocina lo toma
  EnPreparacion --> Listo: Cocina lo termina
  Listo --> Entregado: El mesero lo entrega
  Enviado --> Anulado: Anulación antes de empezar
  Enviado --> NoSeEntrega: Hoy no se repone y no hay para esta línea
  EnPreparacion --> Anulado: Anulación con autorización
  EnPreparacion --> NoSeEntrega: Cocina marca que no se puede terminar
  Listo --> Anulado: Anulación con autorización
```

Cada flecha guarda la hora. Con esas horas se arman los tiempos de toma, espera, preparación, entrega y duración de la mesa.

## Anulación de un producto

```mermaid
flowchart TD
  A["Anular un producto"] --> B{"¿La cocina ya lo empezó?"}
  B -->|No| C{"¿El mesero sigue dentro de su tope del turno?"}
  C -->|Sí| D["Se anula"]
  C -->|No| E["Autorización de M0"]
  B -->|Sí| E
  E --> R{"¿La autorización se aprueba?"}
  R -->|No| X["El producto sigue en la cuenta"]
  R -->|Sí| D
  D --> F{"¿La cocina ya había empezado?"}
  F -->|No| G["M4 devuelve el inventario"]
  F -->|Sí| H["M4 registra merma con motivo"]
  D --> I["La cuenta y la auditoría se actualizan"]
```

Anular la cuenta completa, una cortesía, un descuento sobre el tope o un cambio de precio siguen la misma autorización. La matriz está en [PRD-01](../prd/PRD-01-roles-y-permisos.md).

## No se repone hoy

El plato no va a salir en este servicio. El aviso le llega al mesero de la mesa, no solo a la cocina, para que el cliente no se quede esperando.

```mermaid
flowchart TD
  A["Punto sin stock para el plato"] --> B{"¿Alguien confirma que hoy no se repone?"}
  B -->|"Todavía no"| C["Sigue agotado en el menú y la alerta de escasez"]
  B -->|"Jefe de cocina o administrador"| D["Agotado hasta el fin del servicio"]
  D --> E["El mesero no puede enviarlo"]
  D --> F{"¿Hay líneas ya enviadas que cocina no ha empezado y ya no hay ingredientes?"}
  F -->|Sí| G["Salen de la cola y no se cobran"]
  F -->|No| H["Lo que ya se está preparando sigue"]
  G --> I["Aviso al mesero de esa mesa"]
  H --> J{"¿Cocina marca una línea que no puede terminar?"}
  J -->|Sí| I
  J -->|No| K["Esas líneas siguen hasta listo"]
  I --> L["El mesero avisa al cliente y lo confirma"]
```

El sistema propone la marca cuando el punto no alcanza, las bodegas que abastecen tampoco y no hay un traslado en camino. Hasta esa confirmación no se retiran platos de las mesas. Lo ya entregado, listo o en preparación no se toca, salvo que cocina marque esa línea. Si no habían empezado, [M4](m4-inventario.md) devuelve el inventario. Si ya habían empezado, queda como merma. En un pedido de plataforma, la caja avisa al canal.

## Pedir la cuenta

```mermaid
sequenceDiagram
  actor Mesero
  participant Nodo
  participant Imp as Impresora
  actor Cliente
  participant Portal as Portal M3
  participant Caja

  Mesero->>Nodo: Pedir la cuenta
  Nodo->>Imp: Precuenta, con opción de dividir
  Note over Imp: La precuenta lleva un QR
  Cliente->>Portal: Escanea el QR y deja sus datos
  Portal-->>Nodo: Datos recibidos, cuando hay canal con la nube
  Nodo-->>Caja: La cuenta queda marcada
  Caja->>Caja: Sigue en M2
```

Dividir la cuenta (por comensal, por productos o en partes iguales) ocurre aquí y se cobra en [M2](m2-caja.md). El QR se genera en el nodo, así la precuenta se imprime aunque la sede esté sin internet. El cliente llena el portal con sus propios datos móviles.
