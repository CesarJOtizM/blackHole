# C4 · Componentes de M8 Asistencia del personal

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fuentes | [Flujos M8](../../flujos/m8-asistencia.md), [TRD-00 §10.4](../../trd/TRD-00-arquitectura-base.md) |

La marcación corre en el nodo con la hora del nodo, y solo funciona dentro del local. En una sede en modo nube corre en la API central, con la hora del servidor, y se apoya en el puente para comprobar presencia; durante un corte no se marca (TRD-00, 5.0 y 10.4). Sin puente no hay presencia comprobada y no se marca: la excepción de TRD-00, 10.1.1, para sedes sin equipo local vale para operar, no para marcar (PRD-M8, regla 3). Las horas son una proyección: no hay un campo que alguien edite.

## En la sede

```mermaid
flowchart LR
  PER["<b>Trabajador</b><br/>[Persona]"]:::persona
  ADM["<b>Administrador</b><br/>[Persona]"]:::persona
  PRG["<b>Programador</b><br/>[Fin de la jornada]"]:::modulo
  M0I["<b>M0 Plataforma</b><br/>¿Tiene entrada abierta?"]:::modulo
  M2I["<b>M2 Caja</b><br/>¿Quién trabajó?"]:::modulo

  subgraph Entradas["Entradas"]
    HTTP["<b>Marcación</b><br/>[Controlador HTTP]<br/>Entrada, pausa, salida"]:::componente
    CORR["<b>Correcciones</b><br/>[Controlador HTTP]"]:::componente
    WCIE["<b>Cierre automático</b><br/>[Worker programado]"]:::componente
    PIE["<b>Puerto de entrada de M8</b><br/>[entry-port.ts, en proceso]"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_MAR["<b>RecordClockEntry</b><br/>Hora del nodo, dispositivo registrado,<br/>presencia en el local"]:::componente
    UC_COR["<b>CorrectClockEntry</b><br/>Apunta a la original, con motivo"]:::componente
    UC_CIE["<b>CloseOpenShifts</b><br/>Agrega cierre, deja por revisar"]:::componente
    UC_Q["<b>Consultas</b><br/>HasOpenClockIn,<br/>ParticipantsForPeriod"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_MAR["<b>ClockEntry y ClockEntryCorrection</b><br/>[Entidades]<br/>Solo se agregan"]:::componente
    D_HOR["<b>Proyección de horas</b><br/>[Regla pura]<br/>Horas, tardanza, ausencia, extra"]:::componente
  end

  subgraph Salida["Salidas"]
    REL["<b>Clock</b><br/>[Adaptador]<br/>Hora del nodo"]:::componente
    REPO["<b>Persistencia y outbox</b><br/>[Drizzle + UnitOfWork]<br/>Marcaciones hacia la nube y M6"]:::componente
    M0["<b>M0 Plataforma</b><br/>[Puerto de entrada]<br/>Auditoría de correcciones"]:::modulo
  end

  PER -- "PIN" --> HTTP
  ADM --> CORR
  PRG --> WCIE
  M0I --> PIE
  M2I --> PIE

  HTTP --> UC_MAR
  CORR --> UC_COR
  WCIE --> UC_CIE
  PIE --> UC_Q

  UC_MAR --> D_MAR
  UC_COR --> D_MAR
  UC_CIE --> D_MAR
  UC_Q --> D_HOR

  UC_MAR --> REL
  UC_MAR --> REPO
  UC_COR --> REPO
  UC_CIE --> REPO
  UC_COR -- "auditoría" --> M0

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

La proyección de horas se calcula sobre las marcaciones y sus correcciones.

## En la nube

```mermaid
flowchart LR
  ADM["<b>Administrador</b><br/>[Persona]"]:::persona
  INB["<b>Inbox de lotes</b><br/>[M0]<br/>Marcaciones de cada sede"]:::modulo
  RH["<b>Horas consolidadas</b><br/>[Controlador HTTP]<br/>Web de administración"]:::componente
  EXP["<b>ExportHours</b><br/>[Caso de uso]<br/>Excel"]:::componente
  PG[("<b>PostgreSQL</b><br/>Marcaciones de todas las sedes")]:::contenedor
  OBJ[("<b>Archivos</b><br/>Exportaciones")]:::contenedor

  ADM --> RH
  INB --> PG
  RH --> EXP
  RH --> PG
  EXP --> OBJ

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
```

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `ClockEntryRepository` | `adapters/postgres` | `adapters/sqlite` |
| `Clock` | Hora del servidor | Hora del nodo; el celular no la pone |
| `VenuePresence` | Comprueba que el dispositivo llega al puente; sin puente, no hay marcación | La petición entra por la red del local |
| `FileStorage` | Exportaciones | — |

## Contratos con otros módulos

| Con | Mecanismo | Qué viaja |
|-----|-----------|-----------|
| M0 → M8 | Llamada en proceso a `HasOpenClockIn` | Sí o no, antes de cada acción operativa si la sede lo exige |
| M2 → M8 | Llamada en proceso a `ParticipantsForPeriod` | Personas y horas del periodo |
| M8 → M0 | Llamada en proceso | Auditoría de correcciones |
| M8 → M6 | Eventos | Horas, tardanzas, ausencias |
