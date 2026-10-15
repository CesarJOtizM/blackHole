# C4 · Componentes de M7 SaaS comercial

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [Flujos M7](../../flujos/m7-saas.md), [TRD-00 §8.2 y §8.4](../../trd/TRD-00-arquitectura-base.md) |

M7 vive solo en la nube: alta de empresas, configuración guiada, bolsa de documentos de Factus, suscripción y acceso de soporte. El alta y los planes los maneja el administrador de la plataforma; el soporte solo entra a una empresa con el acceso que concede su propietario (PRD-01, sección 4). El cobro de la suscripción y el efecto de una suspensión se definen en el PRD de M7 (Fase 4).

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
    UC_ALTA["<b>Alta</b><br/>CrearEmpresa, RegistrarContribuyente,<br/>SeguirRequisitosNit"]:::componente
    UC_ACC["<b>Soporte</b><br/>ConcederAcceso, RevocarAcceso"]:::componente
    UC_CARGA["<b>Carga inicial</b><br/>Importar menú, insumos y recetas"]:::componente
  end

  subgraph Salida["Dominio y salidas"]
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Organización y propietario;<br/>token de soporte"]:::modulo
    D_ACC["<b>AccesoSoporte</b><br/>[Entidad]<br/>Con vencimiento"]:::componente
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

El soporte no tiene entrada propia en M7: entra a la empresa por M0 con el token vigente que concedió el propietario.

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
    UC_BOL["<b>Bolsa de documentos</b><br/>RegistrarConsumo, EvaluarCobertura,<br/>ConciliarSaldo, RegistrarRecarga"]:::componente
    UC_SUS["<b>Suscripción</b><br/>Activar, PasarAGracia, Suspender, Reactivar"]:::componente
  end

  subgraph Salida["Dominio y salidas"]
    M3["<b>M3 Facturación</b><br/>[Puerto de entrada]<br/>Emitir pendientes sin saldo"]:::modulo
    M6["<b>M6 Reportes</b><br/>[Eventos]<br/>Panel de soporte"]:::modulo
    D_BOL["<b>BolsaDocumentos</b><br/>[Agregado]<br/>Saldo por empresa; consumo por NIT y sede"]:::componente
    SAL["<b>SaldoProveedor</b><br/>[Adaptador Factus]"]:::componente
    PG[("<b>PostgreSQL</b><br/>Planes, bolsas, suscripciones")]:::contenedor
    D_SUS["<b>Suscripcion</b><br/>[Agregado]<br/>Activa, en gracia, suspendida"]:::componente
    PCO["<b>PasarelaSuscripcion</b><br/>[Adaptador, por definir]"]:::componente
  end

  FAC["<b>Factus</b><br/>[Sistema externo]<br/>Saldo, si la API lo expone"]:::externo
  COB["<b>Cobro de la suscripción</b><br/>[Sistema externo, por definir]"]:::externo

  APL --> BO
  M3I -. "DocumentoConsumido" .-> EDOC
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
| M3 → M7 | Evento `DocumentoConsumido` | Empresa, NIT, sede y tipo de documento |
| M7 → M3 | Llamada en proceso al recargar | Emitir los pendientes con motivo "sin saldo" |
| M7 → M0 | Llamada en proceso | Alta de la organización; acceso de soporte |
| M7 → M6 | Eventos | Consumo y señales para renegociar con Factus |
