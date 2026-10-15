# Flujos · M5 Domicilios

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-14 |
| Fuentes | [PRD-00 §6.2 y M5](../prd/PRD-00-vision-producto.md), [TRD-00 §6.1](../trd/TRD-00-arquitectura-base.md) |

Un domicilio propio lo crea la sede. Un pedido de Rappi, DiDi Food u otra plataforma llega solo al hub y, al aceptarlo, se vuelve un pedido interno igual que uno de mesa. La captura manual cubre el hueco cuando no hay conector o no hay internet.

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M1 | El pedido aceptado entra a cocina por estación, con los mismos estados. |
| M4 | Descuenta receta al enviar a cocina. Si el plato se agota, se publica en las plataformas. |
| M2 | Contra entrega se concilia con el domiciliario. El pago de plataforma queda por cobrar. |
| M3 | La factura de un domicilio a consumidor final lleva la dirección de entrega. El enlace del portal puede ir por WhatsApp. |
| M0 | Aceptar, rechazar o pausar una plataforma tiene permiso. |
| M6 | Tiempos por etapa, comisión y diferencias de liquidación. |

## Domicilio propio

Teléfono, WhatsApp o mostrador.

```mermaid
sequenceDiagram
  actor Caja as Caja o mostrador
  participant Nodo
  participant Cocina
  actor Dom as Domiciliario
  participant Nube

  Caja->>Nodo: Pedido, cliente, dirección y notas
  Nodo->>Cocina: Comanda, igual que una mesa
  Cocina->>Nodo: Listo
  Caja->>Nodo: Asigna domiciliario y despacha
  alt Hay internet en el celular del domiciliario
    Nodo--)Nube: Pedido asignado
    Nube-->>Dom: Lo ve en su celular
  else La sede no tiene internet
    Note over Dom: Al volver al Wi-Fi de la sede sincroniza entrega y cobro
  end
  Dom->>Nodo: Entrega y cobro, si es contra entrega
  Nodo->>Nodo: El cobro entra al turno de caja
```

## Pedido de plataforma

```mermaid
sequenceDiagram
  participant Plat as Plataforma
  participant Hub as Hub en la nube
  participant Nodo
  participant Caja
  participant Cocina

  Plat->>Hub: Pedido nuevo
  Hub->>Hub: Firma, sin duplicados, formato interno
  Hub->>Hub: Sede y productos
  Hub-->>Nodo: Pedido externo
  Nodo-->>Caja: Alerta para aceptar o rechazar
  alt Producto sin mapear
    Caja->>Nodo: Lo asocia a un producto interno
  end
  Caja->>Nodo: Aceptar, o el nodo acepta solo si está configurado
  Nodo->>Nodo: Crea el pedido interno y pasa a ser su dueño
  Nodo->>Cocina: Comanda con el canal y el código
  Nodo--)Hub: Aceptado, en preparación, listo
  Hub->>Plat: Actualiza el estado
  Caja->>Nodo: Entrega al repartidor, verificando el código
```

El pago no entra a la caja física. Queda como saldo por cobrar a la plataforma.

Si la sede pierde conexión, el hub pausa la tienda en las plataformas que lo permiten, para no recibir pedidos que nadie ve. Al volver el nodo, la reanuda.

## Captura manual

Cuando no hay conector, el conector falla o la sede está sin internet, la caja copia el pedido desde la tablet de la plataforma. Indica el canal y el código. A partir de ahí el flujo es el mismo: cocina, tiempos y pago por cobrar. La clave para no duplicar es la plataforma más el código externo.

## Menú y disponibilidad por canal

```mermaid
flowchart LR
  Menu["Menú de la marca"] --> Canal["Menú del canal, con su precio"]
  Canal --> Hub["El hub lo publica si la plataforma lo permite"]
  Stock["Stock del punto"] --> Disp["Agotado o disponible"]
  Disp --> Hub
  Sat["Saturación de la sede"] --> Pausa["Pausar una plataforma"]
```

Si la plataforma no deja publicar el menú por API, se publica en su portal y aquí solo se mapean los productos.

## Cancelación que viene de la plataforma

```mermaid
flowchart TD
  A["La plataforma cancela"] --> B{"¿La cocina ya empezó?"}
  B -->|No| C["Se anula el pedido y se devuelve el inventario"]
  B -->|Sí| D["Merma con motivo, en M4"]
```

## Conciliación

```mermaid
flowchart LR
  A["Pedidos cobrados por la plataforma"] --> B["Esperado: venta menos comisión y cargos"]
  C["Liquidación de la plataforma"] --> D["Comparación"]
  B --> D
  D --> E{"¿Hay diferencia?"}
  E -->|Sí| F["Alerta"]
  E -->|No| G["Conciliado"]
```

La rentabilidad del canal es la venta neta, después de comisión, contra el costo de los platos.
