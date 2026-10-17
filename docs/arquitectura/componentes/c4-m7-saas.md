# C4 · Componentes de M7 SaaS comercial

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.4 |
| Fecha | 2026-10-17 |
| Fuentes | [Flujos M7](../../flujos/m7-saas.md), [TRD-M7](../../trd/TRD-M7-saas.md), [TRD-00 §8.2 y §8.4](../../trd/TRD-00-arquitectura-base.md) |

M7 vive solo en la nube: alta de empresas, configuración guiada, bolsa de documentos de Factus con un cupo por NIT (D-16), suscripción y acceso de soporte. El alta y los planes los maneja el administrador de la plataforma; el soporte solo entra a una empresa con el acceso que concede su propietario (PRD-01, sección 4). El cobro de la suscripción va detrás de `SubscriptionGateway`, que se elige en la entrega 4.3 (PA-38); qué puede hacer una sede suspendida sigue abierto (PA-40). El panel de soporte es una vista de `apps/admin-web` con permisos de soporte, no una app aparte (D-05).

## Alta, configuración guiada y acceso de soporte

```mermaid
flowchart LR
  APL["<b>Administrador de la plataforma</b><br/>[Persona, equipo blackHole]<br/>No ve la operación del cliente"]:::persona
  PRO["<b>Propietario</b><br/>[Persona]"]:::persona

  subgraph Entradas["Entradas"]
    BO["<b>Backoffice</b><br/>[Controlador HTTP]<br/>Empresas y planes"]:::componente
    ACC["<b>Acceso de soporte</b><br/>[Controlador HTTP]"]:::componente
    ONB["<b>Configuración guiada</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_ALTA["<b>Alta</b><br/>OnboardCompany, RegisterTaxpayer,<br/>TrackTaxIdRequirements"]:::componente
    UC_ACC["<b>Soporte</b><br/>GrantSupportAccess, RevokeSupportAccess"]:::componente
    UC_CARGA["<b>Carga inicial</b><br/>ImportInitialCatalog: menú, insumos y recetas"]:::componente
  end

  subgraph Salida["Dominio y salidas"]
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>CreateOrganization;<br/>token de soporte"]:::modulo
    D_ACC["<b>SupportAccess</b><br/>[Entidad]<br/>Con vencimiento"]:::componente
    OBJ[("<b>Archivos</b><br/>Importaciones")]:::contenedor
  end

  APL --> BO
  PRO -- "concede o revoca" --> ACC
  PRO --> ONB

  BO --> UC_ALTA
  ACC --> UC_ACC
  ONB --> UC_CARGA

  UC_ALTA -- "crea empresa, sedes, propietario" --> M0
  UC_ACC -- "token con tenant_id y vencimiento" --> M0
  UC_ACC --> D_ACC
  UC_CARGA --> OBJ

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

El soporte no tiene entrada propia en M7: entra a la empresa por M0 con el token vigente que concedió el propietario, desde la vista de soporte de `apps/admin-web` (sección siguiente).

## Panel de soporte

El panel es una vista de la web de administración, no un contenedor nuevo (D-05). Solo aparece con el permiso `support.view_panel`, y los datos de una empresa solo llegan con su token vigente.

```mermaid
flowchart LR
  SOP["<b>Soporte</b><br/>[Persona, equipo blackHole]"]:::persona
  WEB["<b>Panel de soporte</b><br/>[Vista de apps/admin-web]<br/>Visible con support.view_panel"]:::contenedor

  subgraph Fuentes["Lo que lee, con el token vigente"]
    M0P["<b>M0 Plataforma</b><br/>Evalúa el token; estado de nodos<br/>y cola de sincronización"]:::modulo
    M3P["<b>M3 Facturación</b><br/>Facturas pendientes"]:::modulo
    M6P["<b>M6 Reportes</b><br/>Consumo y señales de Factus"]:::modulo
  end

  AUD[("<b>Auditoría del cliente</b><br/>[M0]")]:::contenedor

  SOP --> WEB
  WEB -- "token con tenant_id y vencimiento" --> M0P
  WEB --> M3P
  WEB --> M6P
  M0P -- "cada consulta" --> AUD

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Fuentes fill:none,stroke:#888,stroke-dasharray: 3 3
```

Sin escritorio remoto: el panel no abre el mini PC ni entrega la credencial del nodo.

## Bolsa de documentos y suscripción

```mermaid
flowchart LR
  APL["<b>Administrador de la plataforma</b><br/>[Persona]"]:::persona
  M3I["<b>M3 Facturación</b><br/>Documento emitido"]:::modulo
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo

  subgraph Entradas["Entradas"]
    BO["<b>Backoffice</b><br/>[Controlador HTTP]<br/>Bolsa y recargas"]:::componente
    EDOC["<b>Documento consumido</b><br/>[Manejador de evento]"]:::componente
    WCOB["<b>Cobertura de la bolsa</b><br/>[Worker diario]"]:::componente
    WSUS["<b>Suscripciones</b><br/>[Worker]<br/>Gracia y suspensión"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_BOL["<b>Bolsa de documentos</b><br/>RecordDocumentConsumption, EvaluateCoverage,<br/>ReconcileBalance, RecordTopUp"]:::componente
    UC_SUS["<b>Suscripción</b><br/>ActivateSubscription, StartGracePeriod,<br/>SuspendSubscription, ReactivateSubscription"]:::componente
  end

  subgraph Salida["Dominio y salidas"]
    M3["<b>M3 Facturación</b><br/>[Puerto de entrada]<br/>IssuePendingDocuments: sin saldo"]:::modulo
    M6["<b>M6 Reportes</b><br/>[Eventos]<br/>Panel de soporte"]:::modulo
    D_BOL["<b>DocumentWallet</b><br/>[Agregado]<br/>Saldo por empresa; consumo por NIT y sede"]:::componente
    SAL["<b>ProviderBalance</b><br/>[Adaptador Factus]"]:::componente
    PG[("<b>PostgreSQL</b><br/>Planes, bolsas, suscripciones")]:::contenedor
    D_SUS["<b>Subscription</b><br/>[Agregado]<br/>active, in_grace, suspended"]:::componente
    PCO["<b>SubscriptionGateway</b><br/>[Adaptador, por definir: PA-38]"]:::componente
  end

  FAC["<b>Factus</b><br/>[Sistema externo]<br/>Saldo, si la API lo expone"]:::externo
  COB["<b>Cobro de la suscripción</b><br/>[Sistema externo, por definir]"]:::externo

  APL --> BO
  M3I -. "DocumentConsumed" .-> EDOC
  PRG --> WCOB
  PRG --> WSUS

  BO --> UC_BOL
  EDOC --> UC_BOL
  WCOB --> UC_BOL
  WSUS --> UC_SUS

  UC_BOL -- "recarga: emitir pendientes" --> M3
  UC_BOL -. "consumo y señales de Factus" .-> M6
  UC_BOL --> D_BOL
  UC_BOL -- "conciliar saldo" --> SAL
  UC_BOL --> PG
  UC_SUS --> PG
  UC_SUS --> D_SUS
  UC_SUS --> PCO
  SAL -. "HTTPS" .-> FAC
  PCO -.-> COB

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

## Alertas de la bolsa

| Nivel | Condición | A quién |
|-------|-----------|---------|
| Amarilla | Saldo para 15 días o menos al ritmo de la empresa | Administrador de la empresa y soporte |
| Roja | 5 días o menos | Igual |
| Crítica | Saldo en cero: la venta sigue y la factura queda pendiente | Igual |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M3 → M7 | Evento `DocumentConsumed` | Empresa, NIT, sede y tipo de documento |
| M7 → M3 | Llamada en proceso a `IssuePendingDocuments` al recargar | Emitir los pendientes con motivo "sin saldo" |
| M7 → M0 | Llamada en proceso a `CreateOrganization` | Alta de la organización; acceso de soporte |
| M7 → M6 | Eventos | Consumo y señales para renegociar con Factus |
