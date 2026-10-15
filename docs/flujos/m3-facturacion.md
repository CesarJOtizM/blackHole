# Flujos · M3 Facturación e impresión

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-14 |
| Fuentes | [PRD-00 §6.1.1 y M3](../prd/PRD-00-vision-producto.md), [TRD-00 §7 y §8](../trd/TRD-00-arquitectura-base.md) |

Cada venta tiene su factura electrónica, emitida por Factus desde la nube. El nodo arma el documento e imprime. Sin internet, el cliente se lleva un comprobante con QR y la factura sale sola al volver la conexión.

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M2 | Entrega la venta cerrada: ítems, impuestos, propina, pagos y anticipos. |
| Portal | Entrega los datos del cliente, atados a esa cuenta. |
| M7 | Si la bolsa de documentos se agota, la venta sigue y la factura queda pendiente. |
| M9 | El anticipo viaja en la factura como anticipo. |
| M4 | El documento soporte de una compra a quien no factura sale por el mismo proveedor, en la Fase 2. |
| M6 | Emisiones, rechazos y refacturaciones alimentan el reporte fiscal. |
| Impresoras | Comandas, precuenta, factura, cierre, traslado y propinas salen del nodo. |

## Emisión de la factura

```mermaid
flowchart TD
  A["M2 cierra la venta"] --> B["El nodo crea el documento con su referencia"]
  B --> C["El motor de impuestos desglosa base e impuesto"]
  C --> D{"¿Hay datos del cliente para esta cuenta?"}
  D -->|Sí| E["Adquirente con esos datos"]
  D -->|No| F["Consumidor final"]
  E --> G{"¿La nube puede llamar a Factus ahora?"}
  F --> G
  G -->|Sí| H["Factus valida ante la DIAN"]
  H --> I{"Respuesta"}
  I -->|Aceptada| J["El nodo imprime factura, CUFE y QR"]
  I -->|Rechazada| K["Alerta, se corrige y se reenvía"]
  I -->|"Sin respuesta"| L["Queda incierta: se consulta antes de reenviar"]
  G -->|No| M["El nodo imprime un comprobante que no es factura"]
  M --> N["Pendiente de emisión"]
  N --> O["Al reconectar, se emite en orden de venta"]
  O --> H
```

La llamada a Factus sale solo de la nube. El token no se guarda en la sede. La propina va como recargo, separada de la venta. Un domicilio a consumidor final lleva la dirección de entrega. No existe una factura que agrupe varias ventas.

## Envío cortado a mitad de camino

```mermaid
flowchart TD
  A["La llamada salió y no volvió la respuesta"] --> B["Documento incierto"]
  B --> C["Consultar en Factus por la referencia"]
  C --> D{"¿Qué hay?"}
  D -->|Ya validada| E["Se toma esa factura y no se reenvía"]
  D -->|"Pendiente de validar"| F["Se elimina esa tentativa y se vuelve a enviar"]
  D -->|No existe| G["Se envía de nuevo con la misma referencia"]
  D -->|"No se pudo consultar"| B
```

La referencia es única. Una venta no queda con dos facturas.

## Portal de datos del cliente

El portal vive en la nube. Se abre desde el QR de la precuenta, el QR del comprobante o un enlace de domicilio o reserva. El cliente no crea cuenta.

```mermaid
sequenceDiagram
  actor Cliente
  participant Portal as Portal
  participant Factus
  participant Nodo
  participant Caja

  Cliente->>Portal: Abre el enlace y escribe su documento
  Portal->>Factus: Consulta nombre y correo
  Factus-->>Portal: Datos, que el portal muestra ocultos
  Cliente->>Portal: Confirma, completa lo opcional y acepta la política
  Portal->>Portal: Guarda los datos de esta cuenta
  alt La sede está en línea con la nube
    Portal-->>Nodo: Datos recibidos
    Nodo-->>Caja: La cuenta queda marcada
    Caja->>Nodo: Cobra con esos datos
  else La sede está sin internet
    Portal->>Portal: Los datos quedan en la nube, atados al enlace
    Note over Caja: Cobra sin verlos y deja la factura pendiente
    Note over Portal: Al emitir, se usan si llegaron antes
  end
```

Si el cliente pide recordar sus datos, la próxima vez confirma con un código enviado a su correo o celular. Los datos son de esa empresa y sirven en todas sus sedes.

En la caja, el cajero también puede escribir el documento y traer los datos guardados, o consultar el nombre y el correo. Si portal y caja traen datos distintos para la misma cuenta, elige el cajero antes de cobrar.

## Refacturación

Aplica cuando la factura ya salió a consumidor final y el cliente pide una a su nombre, dentro del plazo de la empresa.

```mermaid
sequenceDiagram
  actor Cliente
  participant Portal
  participant Nube
  participant Factus

  Cliente->>Portal: Abre la factura ya emitida y deja sus datos
  alt La empresa exige aprobación
    Portal->>Nube: Solicitud al administrador
    Nube->>Nube: Alguien con permiso la aprueba
  end
  Nube->>Factus: Nota crédito de anulación de la factura original
  Factus-->>Nube: Nota validada
  Nube->>Factus: Factura nueva con los datos del cliente
  Factus-->>Nube: Factura nueva
  Nube->>Nube: Las dos quedan enlazadas y auditadas
```

La nota se emite primero. La factura nueva reutiliza su referencia si hay que reintentarla. El par consume dos documentos de la bolsa.

## Impresión

```mermaid
flowchart LR
  App["PWA de la sede (caja, cocina o salón)"] --> Nodo
  Nodo --> Cola["Cola de impresión"]
  Cola --> T["Térmica 80 mm o 58 mm"]
  T --> Cajon["Cajón, solo con el comando de la caja"]
```

El navegador no habla con la impresora. Si una impresora de red tiene respaldo, la cola lo usa cuando la principal falla. Reimprimir queda auditado y, para factura y precuenta, tiene tope.
