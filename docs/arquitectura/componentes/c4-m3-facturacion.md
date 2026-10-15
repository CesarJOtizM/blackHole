# C4 · Componentes de M3 Facturación e impresión

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [Flujos M3](../../flujos/m3-facturacion.md), [TRD-00 §7 y §8](../../trd/TRD-00-arquitectura-base.md) |

M3 se parte en dos lados. En la sede (el nodo, o la nube en modo nube) se crea el documento, se calculan los impuestos y se imprime. En la nube se emite ante Factus, se atiende el portal del cliente y se refactura. El token de Factus nunca sale de la nube.

## En la sede: documento e impresión

```mermaid
flowchart LR
  M2I["<b>M2 Caja</b><br/>Venta cerrada"]:::modulo
  CAN["<b>Canal de la sede</b><br/>[Nube, M0]<br/>Resultado de la emisión"]:::modulo
  CAJ["<b>Cajero</b><br/>[Persona]"]:::persona

  subgraph Entradas["Entradas"]
    PIE["<b>Puerto de entrada de M3</b><br/>[Interfaz en proceso]<br/>CrearDocumentoVenta"]:::componente
    EVR["<b>Resultado de emisión</b><br/>[Manejador]<br/>Número, CUFE, QR o rechazo"]:::componente
    REI["<b>Reimpresión</b><br/>[Controlador HTTP]"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_DOC["<b>Documento de venta</b><br/>CrearDocumentoVenta con reference_code,<br/>RegistrarResultado"]:::componente
    UC_PRN["<b>Impresión</b><br/>ImprimirFactura, ImprimirComprobante,<br/>Reimprimir con tope"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_IMP["<b>Motor de impuestos</b><br/>[Función pura, decimal.js]<br/>PerfilFiscal + Clasificación + Regla vigente"]:::componente
    D_DOC["<b>DocumentoVenta</b><br/>[Agregado]<br/>generado, enviando, aceptado, rechazado,<br/>pendiente_emision, incierto"]:::componente
  end

  subgraph Salida["Salidas"]
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnidadDeTrabajo]<br/>El documento sube con prioridad máxima"]:::componente
    COLA["<b>Cola de impresión</b><br/>[compartido/impresion]<br/>Plantillas, reintentos, respaldo"]:::componente
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Auditoría de reimpresiones"]:::modulo
  end

  IMP["<b>Impresoras</b><br/>[Dispositivo ESC/POS]"]:::externo

  M2I --> PIE
  CAN -.-> EVR
  CAJ --> REI

  PIE --> UC_DOC
  EVR --> UC_DOC
  REI --> UC_PRN

  UC_DOC --> D_IMP
  UC_DOC --> D_DOC
  UC_PRN --> D_DOC

  UC_DOC --> REPO
  UC_PRN --> COLA
  UC_PRN --> M0
  COLA -- "TCP 9100 o USB" --> IMP

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

Sin enlace con la nube, M2 imprime el comprobante con QR, que no es factura, y el documento queda `pendiente_emision`. Cuando llega el resultado, se imprime la factura si el cliente sigue en el local, o queda lista para reimprimir.

## En la nube: emisión, portal y refacturación

```mermaid
flowchart LR
  INB["<b>Inbox de lotes</b><br/>[M0]<br/>Documentos que suben del nodo"]:::modulo
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo
  CLI["<b>Cliente</b><br/>[Persona]"]:::persona

  subgraph Entradas["Entradas"]
    WEM["<b>Emisor</b><br/>[Worker pg-boss]<br/>En orden de venta, primero en la cola"]:::componente
    PDAT["<b>Portal de datos</b><br/>[Controlador HTTP]<br/>/d/token y /f/reference_code"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_EM["<b>Emisión</b><br/>EmitirDocumento, VerificarIncierto,<br/>EmitirPendientes"]:::componente
    UC_CLI["<b>Datos del cliente</b><br/>ConsultarAdquirente con caché,<br/>RegistrarDatosFacturacion, ValidarOtp"]:::componente
    UC_REF["<b>Refacturación</b><br/>Nota crédito y factura nueva"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_DOC["<b>DocumentoVenta</b><br/>[Agregado]<br/>Estados y reference_code"]:::componente
    D_CLI["<b>ClienteFiscal y AdquirenteGenerico</b><br/>[Entidad y objeto de valor]<br/>Dígito de verificación, municipio"]:::componente
  end

  subgraph Salida["Salidas"]
    RIT["<b>Limitador por NIT</b><br/>[Adaptador PostgreSQL]<br/>80 por minuto, compartido"]:::componente
    PROV["<b>ProveedorFacturacion</b><br/>[contextos/facturacion/adaptadores/factus]<br/>Adaptador Factus o simulado;<br/>token OAuth2 por contribuyente"]:::componente
    REPO["<b>Repositorios y archivos</b><br/>[Drizzle + almacenamiento de objetos]<br/>Documentos, XML, PDF, clientes"]:::componente
    MSG["<b>Mensajería</b><br/>[Adaptador]<br/>Código de un solo uso"]:::componente
    CAN["<b>Canal de la sede</b><br/>[M0]<br/>Resultado de la emisión,<br/>datos recibidos"]:::modulo
    M7["<b>M7 SaaS</b><br/>[Evento]<br/>Documento consumido"]:::modulo
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Aprobación con permiso y auditoría"]:::modulo
  end

  FAC["<b>Factus API v2</b><br/>[Sistema externo]"]:::externo
  CORREO["<b>Correo y SMS</b><br/>[Sistema externo, por definir]"]:::externo
  SEC[("<b>Secretos</b><br/>Credenciales de Factus")]:::contenedor

  INB --> WEM
  PRG --> WEM
  CLI --> PDAT

  WEM --> UC_EM
  PDAT --> UC_CLI
  PDAT --> UC_REF

  UC_EM --> D_DOC
  UC_REF --> D_DOC
  UC_CLI --> D_CLI

  UC_EM --> RIT
  UC_EM --> PROV
  UC_EM --> REPO
  UC_EM --> CAN
  UC_EM --> M7
  UC_CLI -- "GET /v2/dian/acquirer" --> PROV
  UC_CLI --> REPO
  UC_CLI --> MSG
  UC_CLI -- "datos recibidos" --> CAN
  UC_REF --> PROV
  UC_REF -- "si la empresa exige aprobación" --> M0

  PROV -- "HTTPS, OAuth2" --> FAC
  PROV --> SEC
  MSG --> CORREO

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

La cola de emisión siempre va antes que las consultas de adquirente: las dos comparten el límite de 80 solicitudes por minuto del NIT. La refacturación también pasa por el limitador.

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `ProveedorFacturacion` | Factus (sandbox o producción) y simulado para pruebas | — |
| `LimitadorRitmo` | Contador por NIT en PostgreSQL, compartido por todas las instancias | — |
| `RepositorioDocumentos` | `adaptadores/postgres` | `adaptadores/sqlite` |
| `RepositorioClientesFiscales` | PostgreSQL, por empresa | Copia de lectura de los clientes frecuentes de la sede |
| `AlmacenamientoArchivos` | S3, Cloud Storage o Blob Storage | Disco local |
| `Secretos` | Gestor de secretos de la nube | — (sin credenciales de Factus en la sede) |
| `Impresora` | Trabajo hacia el puente | Cola local ESC/POS |
| `Mensajeria` | Proveedor de correo y SMS, por definir | — |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M2 → M3 | Llamada en proceso a `CrearDocumentoVenta` | Venta cerrada con pagos, propina y anticipos |
| M3 → M2 | Respuesta, o evento al emitir un pendiente | Número, CUFE y QR, o comprobante |
| M7 | Evento `DocumentoConsumido` | Consumo de la bolsa por empresa, NIT y sede |
| M4 | Llamada en proceso (Fase 2) | Documento soporte de compras |
| M6 | Eventos | Emisiones, rechazos, pendientes y refacturaciones |
