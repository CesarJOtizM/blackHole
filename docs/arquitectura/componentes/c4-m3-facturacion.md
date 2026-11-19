# C4 · Componentes de M3 Facturación e impresión

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.4 |
| Fecha | 2026-11-19 |
| Fuentes | [Flujos M3](../../flujos/m3-facturacion.md), [TRD-M3](../../trd/TRD-M3-facturacion.md), [TRD-00 §7 y §8](../../trd/TRD-00-arquitectura-base.md), [Glosario de código](../../glosario-codigo.md) |

M3 (`contexts/invoicing`) se parte en dos lados. En la sede (el nodo, o la nube en modo nube) se crea el documento, se calculan los impuestos y se dispara la impresión de la factura o del comprobante. En la nube se emite ante Factus, se atiende el portal del cliente y se refactura. El token de Factus nunca sale de la nube. Los nombres son los de [TRD-M3](../../trd/TRD-M3-facturacion.md).

## En la sede: documento e impresión

```mermaid
flowchart LR
  M2I["<b>M2 Caja</b><br/>Venta cerrada: ítems con su<br/>clasificación tributaria"]:::modulo
  CHN["<b>Canal de la sede</b><br/>[Nube, M0]<br/>IssuanceResolved"]:::modulo
  CSH["<b>Cajero</b><br/>[Persona]"]:::persona

  subgraph Inputs["Entradas"]
    EP["<b>Puerto de entrada de M3</b><br/>[entry-port.ts]<br/>CreateSalesDocument"]:::componente
    EVR["<b>Resultado de emisión</b><br/>[Manejador]<br/>Número, CUFE, QR o rechazo"]:::componente
    RPR["<b>Reimpresión</b><br/>[Controlador HTTP]"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_DOC["<b>Documento de venta</b><br/>CreateSalesDocument con reference_code,<br/>RecordIssuanceResult"]:::componente
    UC_PRN["<b>Impresión</b><br/>PrintInvoice, PrintReceipt,<br/>Reprint con tope"]:::componente
  end

  subgraph Domain["Dominio"]
    D_TAX["<b>Motor de impuestos</b><br/>[Función pura, decimal.js]<br/>TaxProfile + TaxClassification + TaxRule vigente"]:::componente
    D_DOC["<b>SalesDocument</b><br/>[Agregado]<br/>generated, sending, accepted, rejected,<br/>pending_issuance, uncertain"]:::componente
  end

  subgraph Outputs["Salidas"]
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnitOfWork]<br/>El documento sube con prioridad máxima"]:::componente
    PRN["<b>Printer</b><br/>[Puerto, shared/printing]<br/>Plantillas, cola, reintentos, respaldo"]:::componente
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>RecordAuditEvent de reimpresiones"]:::modulo
  end

  PRT["<b>Impresoras</b><br/>[Dispositivo ESC/POS]"]:::externo

  M2I --> EP
  CHN -.-> EVR
  CSH --> RPR

  EP --> UC_DOC
  EVR --> UC_DOC
  RPR --> UC_PRN

  UC_DOC --> D_TAX
  UC_DOC --> D_DOC
  UC_DOC -- "factura o comprobante" --> UC_PRN
  UC_PRN --> D_DOC

  UC_DOC --> REPO
  UC_PRN --> PRN
  UC_PRN --> M0
  PRN -- "TCP 9100 o USB" --> PRT

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Inputs fill:none,stroke:#888,stroke-dasharray: 3 3
  style Application fill:none,stroke:#888,stroke-dasharray: 3 3
  style Domain fill:none,stroke:#888,stroke-dasharray: 3 3
  style Outputs fill:none,stroke:#888,stroke-dasharray: 3 3
```

Sin enlace con la nube, M3 imprime el comprobante con QR, que no es factura, y el documento queda `pending_issuance`. Cuando llega el resultado, M3 imprime la factura si el cliente sigue en el local, o queda lista para reimprimir. M3 solo dispara la factura y el comprobante; la comanda y la precuenta son de M1, y el cierre, las propinas y el cajón, de M2. Plantillas, cola y controlador viven en `shared/printing`.

## En la nube: emisión, portal y refacturación

```mermaid
flowchart LR
  INB["<b>Inbox de lotes</b><br/>[M0]<br/>Documentos que suben del nodo"]:::modulo
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo
  CUS["<b>Cliente</b><br/>[Persona]"]:::persona

  subgraph Inputs["Entradas"]
    WIS["<b>Emisor</b><br/>[Worker pg-boss]<br/>En orden de venta, primero en la cola"]:::componente
    PDAT["<b>Portal de datos</b><br/>[Controlador HTTP]<br/>/d/token y /f/reference_code"]:::componente
  end

  subgraph Application["Casos de uso"]
    UC_ISS["<b>Emisión</b><br/>IssueDocument, VerifyUncertain,<br/>IssuePendingDocuments"]:::componente
    UC_CUS["<b>Datos del cliente</b><br/>LookUpBuyer con caché,<br/>RecordBillingData, ValidateOtp"]:::componente
    UC_REI["<b>Refacturación</b><br/>Reinvoice: nota crédito y factura nueva"]:::componente
  end

  subgraph Domain["Dominio"]
    D_DOC["<b>SalesDocument</b><br/>[Agregado]<br/>Estados y reference_code"]:::componente
    D_CUS["<b>TaxCustomer y GenericBuyer</b><br/>[Entidad y objeto de valor]<br/>Dígito de verificación, municipio"]:::componente
  end

  subgraph Outputs["Salidas"]
    RTL["<b>RateLimiter por NIT</b><br/>[Adaptador PostgreSQL]<br/>80 por minuto, compartido"]:::componente
    PROV["<b>InvoicingProvider</b><br/>[contexts/invoicing/adapters/factus]<br/>Adaptador Factus o simulado;<br/>token OAuth2 por contribuyente"]:::componente
    REPO["<b>Repositorios y archivos</b><br/>[Drizzle + FileStorage]<br/>Documentos, XML, PDF, clientes"]:::componente
    MSG["<b>Messaging</b><br/>[Adaptador]<br/>Código de un solo uso"]:::componente
    CHN["<b>Canal de la sede</b><br/>[M0]<br/>IssuanceResolved,<br/>BillingDataReceived"]:::modulo
    M7["<b>M7 SaaS</b><br/>[Evento]<br/>DocumentConsumed"]:::modulo
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Aprobación con permiso y auditoría"]:::modulo
  end

  FAC["<b>Factus API v2</b><br/>[Sistema externo]"]:::externo
  MAIL["<b>Correo y SMS</b><br/>[Twilio, D-48]"]:::externo
  SEC[("<b>Secrets</b><br/>Credenciales de Factus")]:::contenedor

  INB --> WIS
  PRG --> WIS
  CUS --> PDAT

  WIS --> UC_ISS
  PDAT --> UC_CUS
  PDAT --> UC_REI

  UC_ISS --> D_DOC
  UC_REI --> D_DOC
  UC_CUS --> D_CUS

  UC_ISS --> RTL
  UC_ISS --> PROV
  UC_ISS --> REPO
  UC_ISS --> CHN
  UC_ISS --> M7
  UC_CUS -- "GET /v2/dian/acquirer" --> PROV
  UC_CUS --> REPO
  UC_CUS --> MSG
  UC_CUS -- "datos recibidos" --> CHN
  UC_REI --> PROV
  UC_REI -- "si la empresa exige aprobación" --> M0

  PROV -- "HTTPS, OAuth2" --> FAC
  PROV --> SEC
  MSG --> MAIL

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Inputs fill:none,stroke:#888,stroke-dasharray: 3 3
  style Application fill:none,stroke:#888,stroke-dasharray: 3 3
  style Domain fill:none,stroke:#888,stroke-dasharray: 3 3
  style Outputs fill:none,stroke:#888,stroke-dasharray: 3 3
```

La cola de emisión siempre va antes que las consultas de adquirente: las dos comparten el límite de 80 solicitudes por minuto del NIT. La refacturación también pasa por el limitador.

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `InvoicingProvider` | Factus (sandbox o producción) y simulado para pruebas | — |
| `RateLimiter` | Contador por NIT en PostgreSQL, compartido por todas las instancias | — |
| `SalesDocumentRepository` | `adapters/postgres` | `adapters/sqlite` |
| `TaxCustomerRepository` | PostgreSQL, por empresa | Copia de lectura de los clientes frecuentes de la sede |
| `FileStorage` | S3, Cloud Storage o Blob Storage | Disco local |
| `Secrets` | Gestor de secretos de la nube | — (sin credenciales de Factus en la sede) |
| `Printer` (`shared/printing`) | Trabajo hacia el puente | Cola local ESC/POS |
| `Messaging` | Twilio para correo, SMS y WhatsApp (D-48). El sistema genera el código | — |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M2 → M3 | Llamada en proceso a `CreateSalesDocument` | Ítems con su `TaxClassification`, pagos, propina, anticipos y adquirente. M3 calcula los impuestos |
| M3 → M2 | Respuesta, o evento `IssuanceResolved` al emitir un pendiente | Número, CUFE y QR, o comprobante. M3 dispara la impresión |
| M7 | Evento `DocumentConsumed` | Consumo de la bolsa por empresa, NIT y sede |
| M4 | Ninguna | El documento soporte de compras no se emite (D-14). La fase 2 cerró la compra como orden y recepción |
| M6 | Eventos | Emisiones, rechazos, pendientes y refacturaciones |
