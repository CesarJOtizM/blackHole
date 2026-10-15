# Flujos · M4 Inventario, bodegas y recetas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-14 |
| Fuentes | [PRD-00 §6.6 y M4](../prd/PRD-00-vision-producto.md), [TRD-00 §9](../trd/TRD-00-arquitectura-base.md) |

Cada sede tiene un inventario de punto. Las bodegas lo reabastecen. Las ventas descuentan ingredientes al enviar a cocina, según la receta. El stock puede quedar negativo: la venta no se detiene.

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M1 | Envía el consumo al mandar un producto a cocina, y recibe si el plato se puede vender. |
| M5 | El mismo agotado se publica en las plataformas. Una cancelación ya empezada se registra como merma. |
| M0 | Ajustes, conteos y traslados con diferencia piden permiso. |
| M3 | Compras a quien no factura pueden generar documento soporte. La recepción de facturas de proveedores se evalúa en la Fase 2. |
| M6 | Teórico contra real, mermas, margen y quiebres de stock. |

## De la venta al stock

```mermaid
flowchart TD
  A["M1 envía un producto a cocina"] --> B["Receta de la variante, versión vigente"]
  B --> C["Modificadores suman o restan"]
  C --> D{"¿La sub-receta tiene stock propio?"}
  D -->|Sí| E["Se descuenta la preparación"]
  D -->|No| F["Se expanden sus ingredientes"]
  E --> G["Cantidad bruta según rendimiento"]
  F --> G
  G --> H["Movimiento de consumo en el punto"]
  H --> I["Saldo nuevo"]
  I --> J["Cuántos platos alcanzan"]
  J --> K["Menú del mesero: disponible, pocas unidades o agotado"]
  J --> L["Hub de plataformas, si la sede las tiene"]
```

La estación de cocina no tiene inventario. Cocina y barra descuentan del mismo punto. El movimiento guarda la versión de la receta. Si se anula antes de que cocina empiece, entra un movimiento de devolución. Si se anula después, entra una merma con motivo.

## Tipos de movimiento

```mermaid
flowchart LR
  COMPRA["Compra"] --> SALDO["Saldo del insumo en esa ubicación"]
  DEV["Devolución de venta"] --> SALDO
  PROD_OUT["Salida de producción"] --> SALDO
  TIN["Entrada de traslado"] --> SALDO
  CON["Consumo de venta"] --> SALDO
  MER["Merma"] --> SALDO
  PROD_IN["Consumo de producción"] --> SALDO
  TOUT["Salida de traslado"] --> SALDO
  AJ["Ajuste de conteo"] --> SALDO
```

Ningún movimiento se edita ni se borra. El saldo es la suma, actualizada en la misma operación. El costo es el promedio de esa ubicación.

## Reabastecimiento y traslados

```mermaid
flowchart TD
  A["Alerta o pedido del punto"] --> B{"¿La bodega es de la misma sede?"}
  B -->|Sí| C["Mismo nodo: despacho y recepción locales"]
  B -->|"Bodega general u otra sede"| D["El origen registra la salida"]
  D --> E["En tránsito"]
  E --> F["El destino registra la entrada"]
  C --> G{"¿Llegó lo despachado?"}
  F --> G
  G -->|Sí| H["Recibido"]
  G -->|No| I["Recibido con diferencias, con permiso"]
```

Si el destino todavía no tiene internet, el comprobante impreso del despacho lleva un QR. El punto lo escanea y registra la recepción sin esperar la sincronización.

Estados del traslado: solicitado, despachado, en tránsito, recibido, recibido con diferencias.

## Producción

```mermaid
flowchart LR
  A["Ingredientes del punto o de la bodega"] --> B["Producción"]
  B --> C["Preparación intermedia con stock"]
  C --> D["La venta descuenta la preparación, no la receta completa"]
```

## Conteo

```mermaid
sequenceDiagram
  actor Bodeguero as Bodeguero o cocina
  participant Nodo
  actor Admin as Administrador

  Bodeguero->>Nodo: Conteo físico, total o por categoría
  Nodo->>Nodo: Compara contra el teórico
  Admin->>Nodo: Aprueba el resultado, dentro del tope
  Nodo->>Nodo: Ajuste de conteo, con motivo
```

## Alerta de escasez

Se evalúa en el nodo, también sin internet.

```mermaid
flowchart TD
  A["Cambia el saldo"] --> B{"¿Cruzó un nivel o la cobertura del día?"}
  B -->|No| C["Nada que avisar"]
  B -->|"Punto de reposición"| D["Alerta amarilla"]
  B -->|Mínimo| E["Alerta roja"]
  B -->|Agotado| F["Alerta crítica y platos agotados"]
  D --> G["Abierta"]
  E --> G
  F --> G
  G --> H["Vista por alguien"]
  H --> I{"Acción"}
  I -->|"El bajo es el punto"| J["Solicitud a la bodega"]
  I -->|"El bajo es la bodega"| K["Orden de compra"]
  J --> L["Se resuelve cuando el stock supera el punto de reposición"]
  K --> L
  G -->|"Nadie atiende a tiempo"| M["Escala al siguiente rol"]
```

Los niveles son máximo, punto de reposición, mínimo y agotado, por insumo y por ubicación. Además, la cobertura avisa si al ritmo de ese día de la semana el stock no alcanza el resto del servicio, aunque todavía esté sobre el mínimo.

## Cuánto se puede producir

Para cada plato, el límite es el ingrediente que menos alcanza.

- Con el punto: eso es lo que ve el mesero.
- Con el punto más las bodegas que lo abastecen: eso alimenta la sugerencia de reabastecimiento.
- El stock de la bodega general se conoce hasta la última sincronización, y el reporte muestra esa fecha.

## No se repone hoy

Un plato agotado en el menú evita pedirlo de nuevas. La marca **no se repone hoy** evita que una mesa se quede esperando algo que ya no va a salir. La confirma el jefe de cocina o el administrador. El sistema la propone cuando el punto no alcanza para una porción, las bodegas que abastecen la sede tampoco y no hay un traslado en camino.

```mermaid
sequenceDiagram
  participant Nodo
  actor Cocina as Jefe de cocina
  actor Mesero

  Nodo-->>Cocina: No alcanza en el punto ni en las bodegas
  Cocina->>Nodo: Hoy no se repone
  Nodo->>Nodo: El plato queda agotado para este servicio
  Nodo-->>Mesero: Aviso de las mesas con ese plato aún sin empezar
  Mesero->>Nodo: Cliente avisado
```

El detalle de qué líneas se retiran y cuáles siguen en cocina está en [M1](m1-pedidos-y-salon.md).
