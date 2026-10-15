# C4 · Componentes de M0 Plataforma

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [Flujos M0](../../flujos/m0-plataforma.md), [PRD-01](../../prd/PRD-01-roles-y-permisos.md), [TRD-00 §5, §10 y §12](../../trd/TRD-00-arquitectura-base.md) |

M0 es la base que usan los demás módulos: organización, identidad, dispositivos, permisos, auditoría, modo de la sede y sincronización. Corre en la API central y en el nodo con los mismos casos de uso; cada app enlaza sus adaptadores de persistencia.

## Organización, identidad, autorización y auditoría

Los controladores marcados "nube" solo existen en la API central. El resto corre en los dos lados.

```mermaid
flowchart LR
  ADM["<b>Administrador y propietario</b><br/>[Persona]"]:::persona
  PER["<b>Personal de la sede</b><br/>[Persona]"]:::persona
  SUP["<b>Supervisor</b><br/>[Persona]"]:::persona
  PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo
  OTROS["<b>M1, M2, M4, M5, M9</b><br/>Piden permiso y<br/>registran auditoría"]:::modulo
  M7["<b>M7 SaaS</b><br/>Alta de la organización"]:::modulo

  subgraph Entradas["Entradas"]
    ORGC["<b>Organización</b><br/>[Controlador HTTP, nube]"]:::componente
    ROLES["<b>Roles y asignaciones</b><br/>[Controlador HTTP, nube]"]:::componente
    AUTH["<b>Sesión de administración</b><br/>[Controlador HTTP, nube]<br/>Correo, contraseña, segundo factor"]:::componente
    PIN["<b>Sesión de dispositivo</b><br/>[Controlador HTTP]<br/>PIN personal, sesión corta"]:::componente
    DISP["<b>Dispositivos</b><br/>[Controlador HTTP]<br/>Registro con QR, revocación"]:::componente
    AUTZ["<b>Autorizaciones</b><br/>[Gateway WebSocket]<br/>Solicitudes al supervisor"]:::componente
    VER["<b>Verificador de cadena</b><br/>[Worker, nube]"]:::componente
    PIE["<b>Puerto de entrada de M0</b><br/>[Interfaz en proceso]<br/>EvaluarPermiso, RegistrarEvento,<br/>CrearOrganizacion"]:::componente
  end

  subgraph Aplicacion["Casos de uso"]
    UC_ORG["<b>Estructura</b><br/>Empresa, contribuyentes, marcas,<br/>sedes, estaciones, cajas, bodegas"]:::componente
    UC_ROL["<b>Gestión de roles</b><br/>CopiarRol, AsignarRol, AjustarTopeSede"]:::componente
    UC_SES["<b>Sesiones</b><br/>IniciarSesionPin, CerrarPorInactividad"]:::componente
    UC_DIS["<b>Gestión de dispositivos</b><br/>GenerarCodigoRegistro, RegistrarDispositivo,<br/>RevocarDispositivo, DesactivarUsuario"]:::componente
    UC_PER["<b>Autorización</b><br/>EvaluarPermiso, SolicitarAutorizacion,<br/>ResolverAutorizacion"]:::componente
    UC_AUD["<b>Auditoría</b><br/>RegistrarEvento, VerificarCadena"]:::componente
  end

  subgraph Dominio["Dominio"]
    D_ORG["<b>Organización</b><br/>[Entidades]<br/>Empresa, Contribuyente, Marca, Sede"]:::componente
    D_IDN["<b>Identidad</b><br/>[Entidades]<br/>Usuario, Rol, AsignacionRol, Dispositivo"]:::componente
    D_PER["<b>Evaluador de permisos</b><br/>[Función pura]<br/>evaluar(usuario, accion, contexto)"]:::componente
    D_AUD["<b>EventoAuditoria</b><br/>[Entidad]<br/>Cadena de hash por dispositivo"]:::componente
  end

  subgraph Salida["Salidas"]
    REPO["<b>Repositorios</b><br/>[Drizzle]<br/>PostgreSQL con RLS en la nube,<br/>SQLite en el nodo"]:::componente
    BA["<b>Better Auth</b><br/>[Adaptador, nube]"]:::componente
    CRY["<b>Criptografía</b><br/>[Adaptador]<br/>Firma ECDSA P-256, argon2id"]:::componente
    NOT["<b>Notificador</b><br/>[Adaptador]<br/>WebSocket local, Web Push"]:::componente
    REL["<b>Reloj</b><br/>[Adaptador]<br/>Hora del nodo como referencia"]:::componente
    M8["<b>M8 Asistencia</b><br/>[Puerto de entrada]<br/>¿Tiene entrada abierta?"]:::modulo
  end

  PUSH["<b>Web Push</b><br/>[Sistema externo]"]:::externo

  ADM --> ORGC
  ADM --> ROLES
  ADM --> AUTH
  PER --> PIN
  PER --> DISP
  SUP --> AUTZ
  PRG --> VER
  OTROS --> PIE
  M7 --> PIE

  ORGC --> UC_ORG
  ROLES --> UC_ROL
  AUTH --> UC_SES
  PIN --> UC_SES
  DISP --> UC_DIS
  AUTZ --> UC_PER
  VER --> UC_AUD
  PIE --> UC_ORG
  PIE --> UC_PER
  PIE --> UC_AUD

  UC_ORG --> D_ORG
  UC_ROL --> D_IDN
  UC_ROL -- "sin escalar privilegios" --> D_PER
  UC_SES --> D_IDN
  UC_DIS --> D_IDN
  UC_PER --> D_PER
  UC_AUD --> D_AUD

  UC_ORG --> REPO
  UC_AUD --> REPO
  UC_SES --> BA
  UC_SES --> CRY
  UC_DIS --> CRY
  UC_SES -- "regla sin entrada no opera" --> M8
  UC_PER -- "solicitud remota" --> NOT
  UC_AUD --> REL
  NOT --> PUSH

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Entradas fill:none,stroke:#888,stroke-dasharray: 3 3
  style Aplicacion fill:none,stroke:#888,stroke-dasharray: 3 3
  style Dominio fill:none,stroke:#888,stroke-dasharray: 3 3
  style Salida fill:none,stroke:#888,stroke-dasharray: 3 3
```

Todos los casos de uso guardan por los repositorios; el diagrama solo dibuja dos de esas flechas.

## Modo de la sede y sincronización

El nodo abre todas las conexiones con la nube. Por eso las flechas van del nodo a la nube, aunque la configuración, los pedidos QR y las reservas bajen por ese mismo canal.

```mermaid
flowchart LR
  ADM["<b>Administrador</b><br/>[Persona]"]:::persona
  UCS["<b>Casos de uso de M1 a M9</b><br/>[En el nodo]"]:::modulo
  PRN["<b>Programador del nodo</b>"]:::modulo

  subgraph Nodo["Nodo local"]
    EMP["<b>Emparejamiento</b><br/>[Instalador del nodo]<br/>Código de un solo uso"]:::componente
    UOW["<b>UnidadDeTrabajo</b><br/>[Puerto]<br/>Cambio y outbox en la<br/>misma transacción"]:::componente
    OUT["<b>Envío de outbox</b><br/>[Worker]<br/>Lotes por prioridad, reanudables"]:::componente
    CUR["<b>Canal con la nube</b><br/>[Cliente WebSocket]<br/>Configuración desde el último cursor"]:::componente
    D_GEN["<b>Generación y dueño</b><br/>[Dominio]<br/>Rechaza escrituras de una<br/>generación vieja"]:::componente
    SQ[("<b>SQLite</b><br/>Outbox, cursores,<br/>copia de configuración")]:::contenedor
  end

  subgraph Nube["API central y workers"]
    PRG["<b>Programador de tareas</b><br/>[pg-boss]"]:::modulo
    MODO["<b>Modo de la sede</b><br/>[Controlador HTTP]<br/>Activar híbrido, volver a nube, relevo"]:::componente
    RX["<b>Recepción de lotes</b><br/>[Controlador HTTP]"]:::componente
    PUB["<b>Canal de la sede</b><br/>[Gateway WebSocket]<br/>Configuración, pedidos QR, pagos QR,<br/>pedidos externos, reservas, certificado"]:::componente
    CERT["<b>Certificados de sede</b><br/>[Worker]<br/>Emite y renueva por DNS-01"]:::componente
    UC_MODO["<b>Cambio de dueño</b><br/>[Casos de uso]<br/>ActivarHibrido, EmparejarNodo,<br/>VolverANube, RelevarNodo"]:::componente
    UC_RX["<b>Inbox</b><br/>[Caso de uso]<br/>AplicarLote sin duplicar por dispositivo<br/>y secuencia; rechaza una generación vieja"]:::componente
    PGN[("<b>PostgreSQL</b><br/>Inbox, flujo por sede, generación")]:::contenedor
  end

  CF["<b>Cloudflare DNS</b><br/>[Sistema externo]"]:::externo

  ADM --> MODO
  ADM -- "código de emparejamiento" --> EMP
  UCS --> UOW
  PRN --> OUT
  PRN --> CUR
  PRG --> CERT

  EMP -- "empareja" --> MODO
  UOW --> SQ
  OUT --> SQ
  OUT -- "HTTPS, lotes comprimidos" --> RX
  CUR -- "abre el WSS" --> PUB
  CUR --> D_GEN
  CUR --> SQ

  MODO --> UC_MODO
  RX --> UC_RX
  PUB --> PGN
  UC_MODO --> PGN
  UC_RX --> PGN
  CERT --> CF

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef componente fill:#85bbf0,stroke:#5d82a8,color:#000
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef modulo fill:#dddddd,stroke:#999999,color:#000
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Nodo fill:none,stroke:#333,stroke-dasharray: 5 5
  style Nube fill:none,stroke:#333,stroke-dasharray: 5 5
```

Orden de envío de la outbox: documentos DIAN y pagos QR confirmados, pedidos QR, auditoría, ventas y caja, inventario y telemetría (TRD-00, 5.5). El certificado de `sede-xxx` que emite el worker baja al nodo por el canal de la sede.

## Puertos y adaptadores

| Puerto | Nube | Nodo |
|--------|------|------|
| `RepositorioOrganizacion`, `RepositorioIdentidad`, `RepositorioDispositivos` | `adaptadores/postgres` con Row Level Security | `adaptadores/sqlite`, copia de su sede |
| `RepositorioAuditoria` | PostgreSQL, solo inserción | SQLite, solo inserción |
| `UnidadDeTrabajo` | Transacción que fija el `tenant_id` | Transacción con escritura en la outbox |
| `Outbox` / `Inbox` | Inbox con clave `(dispositivo_id, secuencia)` | Outbox y cursor de configuración |
| `VerificadorFirma` | WebCrypto ECDSA P-256 | WebCrypto ECDSA P-256 |
| `HashPin` | argon2id | argon2id, hashes de su sede |
| `Notificador` | Web Push (VAPID) | WebSocket local |
| `Reloj` | Hora del servidor | Hora del nodo, referencia de la sede |
| `Secretos` | Gestor de secretos de la nube | Archivo cifrado |

## Cómo lo usan los demás módulos

| Módulo | Mecanismo | Qué pide |
|--------|-----------|----------|
| M1, M2, M4, M5, M9 | Llamada en proceso a `EvaluarPermiso` | Permitido, pide autorización o denegado |
| M1, M2, M4, M5, M9 | Llamada en proceso a `RegistrarEvento` | Evento de auditoría encadenado |
| M8 | M0 consulta el puerto de entrada de M8 | Si la persona tiene entrada abierta |
| M6 | Eventos de auditoría | Métricas de control y detectores |
| M7 | Llamada en proceso al alta | Crear empresa, contribuyentes, sedes y propietario |
