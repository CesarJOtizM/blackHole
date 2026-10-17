# Flujos · M3 Facturación e impresión

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-17 |
| Fuentes | [PRD-00 §6.1.1 y M3](../prd/PRD-00-vision-producto.md), [PRD-M3](../prd/PRD-M3-facturacion.md), [TRD-M3](../trd/TRD-M3-facturacion.md), [TRD-00 §7 y §8](../trd/TRD-00-arquitectura-base.md) |

Cada venta tiene su factura electrónica, emitida por Factus desde la nube. En la sede, M3 arma el documento, calcula los impuestos e imprime la factura o el comprobante. Sin internet, el cliente se lleva un comprobante con QR y la factura sale sola al volver la conexión. Los nombres de casos de uso y estados son los de [TRD-M3](../trd/TRD-M3-facturacion.md).

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M2 | Entrega la venta cerrada (`CreateSalesDocument`): ítems con su clasificación tributaria, propina, pagos, anticipos y adquirente. No entrega impuestos: los calcula M3. |
| Portal | Entrega los datos del cliente, atados a esa cuenta. |
| M7 | Si la bolsa de documentos se agota, la venta sigue y la factura queda pendiente. Cada documento aceptado emite `DocumentConsumed`. |
| M9 | El anticipo viaja en la factura como anticipo. |
| M6 | Emisiones, rechazos y refacturaciones alimentan el reporte fiscal. |
| Impresoras | M3 dispara la factura y el comprobante. La comanda y la precuenta las dispara M1; el cierre, las propinas y el cajón, M2; el comprobante de traslado, M4. Plantillas, cola y controlador viven en `shared/printing`. |

## Emisión de la factura

```mermaid
flowchart TD
  A["M2 cierra la venta y envía ítems con su clasificación tributaria"] --> B["CreateSalesDocument: el nodo crea el documento con su referencia"]
  B --> C["El motor de impuestos de M3 desglosa base e impuesto"]
  C --> D{"¿Hay datos del cliente para esta cuenta?"}
  D -->|Sí| E["Adquirente con esos datos"]
  D -->|No| F["Consumidor final (GenericBuyer)"]
  E --> G{"¿La nube puede llamar a Factus ahora?"}
  F --> G
  G -->|Sí| H["IssueDocument: Factus valida ante la DIAN"]
  H --> I{"Respuesta"}
  I -->|Aceptada| J["M3 imprime factura, CUFE y QR"]
  I -->|Rechazada| K["Alerta, se corrige y se reenvía"]
  I -->|"Sin respuesta"| L["uncertain: se consulta antes de reenviar"]
  G -->|No| M["M3 imprime un comprobante que no es factura"]
  M --> N["pending_issuance"]
  N --> O["Al reconectar, IssuePendingDocuments emite en orden de venta"]
  O --> H
```

La llamada a Factus sale solo de la nube. El token no se guarda en la sede. La propina va como recargo, separada de la venta. Un domicilio a consumidor final lleva la dirección de entrega. No existe una factura que agrupe varias ventas.

## Envío cortado a mitad de camino

```mermaid
flowchart TD
  A["La llamada salió y no volvió la respuesta"] --> B["Documento uncertain"]
  B --> C["VerifyUncertain: consultar en Factus por la referencia"]
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
  Portal->>Factus: LookUpBuyer, consulta nombre y correo
  Factus-->>Portal: Datos, que el portal muestra ocultos
  Cliente->>Portal: Confirma, completa lo opcional y acepta la política
  Portal->>Portal: RecordBillingData de esta cuenta
  alt La sede está en línea con la nube
    Portal-->>Nodo: BillingDataReceived
    Nodo-->>Caja: La cuenta queda marcada
    Caja->>Nodo: Cobra con esos datos
  else La sede está sin internet
    Portal->>Portal: Los datos quedan en la nube, atados al enlace
    Note over Caja: Cobra sin verlos y deja la factura pendiente
    Note over Portal: Al emitir, se usan si llegaron antes
  end
```

Si el cliente pide recordar sus datos, la próxima vez confirma con un código enviado a su correo o celular (`ValidateOtp`). Los datos son de esa empresa y sirven en todas sus sedes.

En la caja, el cajero también puede escribir el documento y traer los datos guardados, o consultar el nombre y el correo. Si portal y caja traen datos distintos para la misma cuenta, elige el cajero antes de cobrar.

## Refacturación

Aplica cuando la factura ya salió a consumidor final y el cliente pide una a su nombre, dentro del plazo de la empresa (`Reinvoice`).

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
  Nube->>Nube: Las dos quedan enlazadas y auditadas (Reinvoiced)
```

La nota se emite primero. La factura nueva reutiliza su referencia si hay que reintentarla. El par consume dos documentos de la bolsa.

## Impresión

```mermaid
flowchart LR
  M1["M1: comanda y precuenta"] --> Q["Cola de impresión<br/>shared/printing"]
  M2["M2: cierre, propinas y cajón"] --> Q
  M3["M3: factura y comprobante"] --> Q
  M4["M4: comprobante de traslado"] --> Q
  Q --> T["Térmica 80 mm o 58 mm"]
  T --> D["Cajón, solo con el comando de la caja"]
```

El navegador no habla con la impresora: cada módulo dispara su impresión en el nodo (o en el puente, en modo nube) y la cola compartida la entrega. Si una impresora de red tiene respaldo, la cola lo usa cuando la principal falla. Reimprimir la factura queda auditado y tiene tope; la precuenta sigue la misma regla en M1.
