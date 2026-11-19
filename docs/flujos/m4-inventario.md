# Flujos · M4 Inventario, bodegas y recetas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.4 |
| Fecha | 2026-11-19 |
| Fuentes | [PRD-00 §6.6 y M4](../prd/PRD-00-vision-producto.md), [PRD-M4](../prd/PRD-M4-inventario.md), [TRD-M4](../trd/TRD-M4-inventario.md), [TRD-00 §9](../trd/TRD-00-arquitectura-base.md) |

Cada sede tiene un inventario de punto. Las bodegas lo reabastecen. Las ventas descuentan ingredientes al enviar a cocina, según la receta. El stock puede quedar negativo: la venta no se detiene. Los nombres de casos de uso y eventos son los de [TRD-M4](../trd/TRD-M4-inventario.md).

Desde el 2026-11-19 estos recorridos están cerrados en la nube: compras, producción, traslado, recepción, conteo, merma, consumo de la venta, unidades posibles y alertas. El documento soporte del proveedor no forma parte (D-14). El despacho de un traslado lo deja en tránsito; no hay un estado guardado distinto llamado despachado. Recibir sin internet y el nodo de la bodega general siguen en la fase híbrida.

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M1 | Envía el consumo al mandar un producto a cocina (`RegisterSaleConsumption`), la devolución o la merma al anular (`ReturnStock`, `RecordWaste`), y recibe si el plato se puede vender (`AvailabilityChanged`). |
| M5 | El mismo agotado se publica en las plataformas. Una cancelación ya empezada se registra como merma. |
| M0 | Ajustes, conteos y traslados con diferencia piden permiso. |
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
  G --> H["RegisterSaleConsumption: movimiento de consumo en el punto"]
  H --> I["Saldo nuevo"]
  I --> J["Cuántos platos alcanzan"]
  J --> K["Menú del mesero: disponible, pocas unidades o agotado"]
  J --> L["Hub de plataformas, si la sede las tiene"]
```

La estación de cocina no tiene inventario. Cocina y barra descuentan del mismo punto. El movimiento guarda la versión de la receta. Si se anula antes de que cocina empiece, entra un movimiento de devolución (`ReturnStock`). Si se anula después, entra una merma con motivo (`RecordWaste`).

## Tipos de movimiento

```mermaid
flowchart LR
  PUR["Compra"] --> BAL["Saldo del insumo en esa ubicación"]
  RET["Devolución de venta"] --> BAL
  PROD_OUT["Salida de producción"] --> BAL
  TIN["Entrada de traslado"] --> BAL
  CON["Consumo de venta"] --> BAL
  WST["Merma"] --> BAL
  PROD_IN["Consumo de producción"] --> BAL
  TOUT["Salida de traslado"] --> BAL
  ADJ["Ajuste de conteo"] --> BAL
```

Ningún movimiento se edita ni se borra. El saldo es la suma, actualizada en la misma operación. El costo es el promedio de esa ubicación.

## Reabastecimiento y traslados

```mermaid
flowchart TD
  A["Alerta o pedido del punto"] --> B{"¿La bodega es de la misma sede?"}
  B -->|Sí| C["Mismo nodo: despacho y recepción locales"]
  B -->|"Bodega general u otra sede"| D["El origen registra la salida (TransferDispatched)"]
  D --> E["En tránsito"]
  E --> F["El destino registra la entrada (TransferReceived)"]
  C --> G{"¿Llegó lo despachado?"}
  F --> G
  G -->|Sí| H["Recibido"]
  G -->|No| I["Recibido con diferencias, con permiso"]
```

La bodega general del piloto opera con su propio nodo en modo bodega (D-04), así que un traslado desde ella siempre tiene dos dueños. Operarla desde la web, sin nodo, sigue abierto para clientes pequeños (PA-44).

Si el destino todavía no tiene internet, el comprobante impreso del despacho lleva un QR. El punto lo escanea y registra la recepción sin esperar la sincronización. M4 dispara ese comprobante; la plantilla y el controlador viven en `shared/printing`.

Estados guardados del traslado: solicitado, en tránsito, recibido, recibido con diferencias. El despacho lo deja en tránsito. El costo que viaja es el del origen en el despacho, sin sumarle nada (D-27).

## Producción

```mermaid
flowchart LR
  A["Ingredientes del punto o de la bodega"] --> B["RecordProduction"]
  B --> C["Preparación intermedia con stock"]
  C --> D["La venta descuenta la preparación, no la receta completa"]
```

El costo de lo producido lo elige la empresa: promedio de los insumos consumidos, o costo estándar (D-26).

## Conteo

```mermaid
sequenceDiagram
  actor Bodeguero as Bodeguero o cocina
  participant Nodo
  actor Admin as Administrador

  Bodeguero->>Nodo: RecordStockCount, total o por categoría
  Nodo->>Nodo: Compara contra el teórico
  alt Dentro del tope
    Nodo->>Nodo: Ajuste de conteo, con motivo
  else Por encima del tope
    Admin->>Nodo: ApproveAdjustment
    Nodo->>Nodo: Ajuste de conteo, con motivo
  end
```

El conteo es a ciegas, como el arqueo (D-49): quien cuenta ve los insumos y la unidad, y la diferencia aparece al enviar y al aprobar. Un ajuste por encima del tope pide aprobación. El tope es configurable y, por defecto, $1.000 (D-28).

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
  Cocina->>Nodo: ConfirmNoRestockToday
  Nodo->>Nodo: El plato queda agotado para este servicio (AvailabilityChanged)
  Nodo-->>Mesero: Aviso de las mesas con ese plato aún sin empezar
  Mesero->>Nodo: Cliente avisado
```

El detalle de qué líneas se retiran y cuáles siguen en cocina está en [M1](m1-pedidos-y-salon.md).
