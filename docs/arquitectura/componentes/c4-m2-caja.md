# C4 · Componentes de M2 Caja

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [Flujos M2](../../flujos/m2-caja.md), [TRD-00 §6.3 y §6.4](../../trd/TRD-00-arquitectura-base.md) |

La caja corre donde corre el salón: en el nodo si la sede es híbrida, o en la API central en modo nube. El pago QR siempre empieza en la nube, porque lo confirma la pasarela con un webhook; el nodo lo aplica al turno abierto.

## En la sede

```mermaid
flowchart LR
  CAJ["<b>Cajero</b><br/>[Persona]"]:::persona
  SUP["<b>Supervisor</b><br/>[Persona]"]:::persona
  CAN["<b>Canal de la sede</b><br/>[Nube, M0]<br/>Pago QR confirmado"]:::modulo
  M5I["<b>M5 Domicilios</b><br/>Contra entrega y<br/>saldo por cobrar"]:::modulo

  subgraph Entradas["Entradas"]
    HTTP["<b>Caja</b><br/>[Controlador HTTP]<br/>Turno, cobro, arqueo, propinas"]:::componente
    EVT["<b>Pago QR recibido</b><br/>[Manejador de evento]"]:::componente
    PIE["<b>Puerto de entrada de M2</b><br/>[Interfaz en proceso]<br/>RegistrarCobroDomicilio,<br/>RegistrarPorCobrar"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_TUR["<b>Turno</b><br/>AbrirTurno, RegistrarIngresoEgreso,<br/>Retirar, AbrirCajonSinVenta"]:::componente
    UC_COB["<b>Cobro</b><br/>CobrarCuenta, AplicarPagoQr,<br/>CambiarMedioPago, ReabrirCuenta"]:::componente
    UC_ARQ["<b>Arqueo</b><br/>ArqueoCiego, CierreParcial, CerrarTurno"]:::componente
    UC_PRO["<b>Propinas</b><br/>LiquidarPropinas, LiquidacionDeAjuste"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_TUR["<b>TurnoCaja</b><br/>[Agregado]<br/>Abierto, en arqueo, cerrado e inmutable"]:::componente
    D_PAG["<b>Pago y medios</b><br/>[Entidades]<br/>Efectivo, tarjeta, transferencia,<br/>QR, anticipo, crédito, plataforma"]:::componente
    D_ARQ["<b>Arqueo</b><br/>[Regla pura]<br/>Contado contra esperado por medio"]:::componente
    D_REP["<b>Reparto de propinas</b><br/>[Regla pura]<br/>Equitativo, porcentaje, por horas;<br/>redondeo determinista"]:::componente
  end

  subgraph Salida["Salidas"]
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnidadDeTrabajo]"]:::componente
    RT["<b>Cuentas en vivo</b><br/>[Gateway WebSocket]"]:::componente
    DAT["<b>Datafono</b><br/>[Adaptador manual en Fase 1]<br/>ADR-007"]:::componente
    IMPR["<b>Impresora</b><br/>[packages/impresion]<br/>Factura, cierre, liquidación, cajón"]:::componente
    M1["<b>M1 Pedidos</b><br/>[Puerto de entrada]<br/>Cuenta y precuenta"]:::modulo
    M3["<b>M3 Facturación</b><br/>[Puerto de entrada]<br/>Documento de venta"]:::modulo
    M8["<b>M8 Asistencia</b><br/>[Puerto de entrada]<br/>Quién trabajó"]:::modulo
    M9["<b>M9 Reservas</b><br/>[Puerto de entrada]<br/>Anticipo de reserva"]:::modulo
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Permiso y autorización"]:::modulo
  end

  IMP["<b>Impresora de caja y cajón</b><br/>[Dispositivo ESC/POS]"]:::externo

  CAJ --> HTTP
  SUP -- "PIN de autorización" --> HTTP
  CAN -.-> EVT
  M5I --> PIE

  HTTP --> UC_TUR
  HTTP --> UC_COB
  HTTP --> UC_ARQ
  HTTP --> UC_PRO
  EVT --> UC_COB
  PIE --> UC_COB

  UC_TUR --> D_TUR
  UC_COB --> D_PAG
  UC_ARQ --> D_ARQ
  UC_ARQ --> D_TUR
  UC_PRO --> D_REP

  UC_TUR --> REPO
  UC_COB --> REPO
  UC_COB --> RT
  UC_COB --> DAT
  UC_COB -- "lee la cuenta" --> M1
  UC_COB -- "venta cerrada" --> M3
  UC_COB -- "aplicar anticipo" --> M9
  UC_PRO -- "participantes del periodo" --> M8
  UC_TUR -- "permiso" --> M0
  UC_ARQ -- "autorizar diferencia" --> M0
  UC_COB -- "factura o comprobante" --> IMPR
  UC_ARQ -- "reporte de cierre" --> IMPR
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

M3 devuelve el número, el CUFE y el QR (o el comprobante si no hay internet) como respuesta de la misma llamada, y el cobro lo manda a imprimir.

## En la nube: pago QR en la mesa

```mermaid
flowchart LR
  CLI["<b>Cliente</b><br/>[Persona]"]:::persona
  PASW["<b>Pasarela de pagos</b><br/>[Sistema externo, ADR-016]<br/>Avisa por webhook"]:::externo

  subgraph Entradas["Entradas"]
    PPAG["<b>Pago de la mesa</b><br/>[Controlador HTTP, portal]<br/>Saldo y propina"]:::componente
    WH["<b>Webhook de la pasarela</b><br/>[Controlador HTTP]<br/>Verifica la firma"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_INI["<b>IniciarCobroQr</b><br/>Cobro por el saldo que fija la cuenta"]:::componente
    UC_CON["<b>ConfirmarPagoQr</b><br/>Idempotente por referencia"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_PQR["<b>PagoQrConfirmado</b><br/>[Agregado]<br/>Sin webhook no hay pago"]:::componente
  end

  subgraph Salida["Salidas"]
    PASA["<b>PasarelaPagos</b><br/>[Adaptador del proveedor]"]:::componente
    REPO["<b>RepositorioPagosQr</b><br/>[Drizzle]<br/>PostgreSQL"]:::componente
    CAN["<b>Canal de la sede</b><br/>[M0]<br/>Al instante o al reconectar"]:::modulo
  end

  PAS["<b>Pasarela de pagos</b><br/>[Sistema externo]<br/>API de cobro"]:::externo

  CLI --> PPAG --> UC_INI
  PASW -. "webhook firmado" .-> WH --> UC_CON
  UC_INI --> D_PQR
  UC_CON --> D_PQR
  UC_INI -- "saldo + propina, referencia única" --> PASA
  UC_CON --> REPO
  UC_CON -- "pago por aplicar al turno" --> CAN
  PASA -- "HTTPS" --> PAS

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

La pasarela aparece dos veces porque cumple dos papeles: la API recibe sus avisos (izquierda) y también la llama para crear el cobro (derecha). En modo nube el pago lo aplica la misma API central, sin canal hacia un nodo.

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `RepositorioCaja` | `persistencia-postgres` | `persistencia-sqlite` |
| `PasarelaPagos` | Adaptador del proveedor elegido en ADR-016 | — (el nodo no habla con la pasarela) |
| `Datafono` | Manual (registro de aprobación, franquicia, últimos 4) | Manual; integración directa por proveedor en ADR-007 |
| `Impresora` | Trabajo hacia el puente | Cola local; comando de cajón solo a la impresora de caja |
| `Reloj` | Hora del servidor | Hora del nodo |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M1 → M2 | Lectura por puerto de entrada y WebSocket | Cuenta abierta, precuenta, división |
| M3 | Llamada en proceso a `CrearDocumentoVenta` | Ítems, impuestos, propina, pagos, anticipos y adquirente |
| M8 | Llamada en proceso a `ParticipantesDelPeriodo` | Personas con marcación en el periodo |
| M9 | Llamada en proceso a `AplicarAnticipo` | Valor del anticipo; no entra al efectivo |
| M5 → M2 | Llamada en proceso | Cobro contra entrega del domiciliario; saldo por cobrar a plataformas |
| M6 | Eventos de la outbox | Cierres, diferencias, medios de pago, propinas |
