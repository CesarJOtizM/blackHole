# Infraestructura y comunicación

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-15 |
| Fuentes | [TRD-00 §5, §7, §10.1.2 y §13](../trd/TRD-00-arquitectura-base.md), [TRD-01](../trd/TRD-01-infraestructura-y-operacion.md) |

Vista de despliegue de C4: en qué máquinas y redes corre cada contenedor, por qué protocolo se habla cada par y **quién abre la conexión**. Esa última pregunta importa porque ninguna sede abre puertos en su router: todo lo que baja de la nube a la sede viaja por una conexión que la sede abrió.

## 1. Despliegue general

La nube de producción sale de ADR-005. Los nombres de servicio de cada proveedor están en TRD-01, sección 3.1; aquí se usan los genéricos.

```mermaid
flowchart LR
  subgraph SedeH["Sede en modo híbrido"]
    DEVH["<b>Dispositivos del personal</b><br/>[PWA de la sede]"]:::contenedor
    NODO["<b>Nodo local</b><br/>[Docker en mini PC, con UPS]"]:::contenedor
    IMPH["<b>Impresoras y cajón</b>"]:::externo
  end

  subgraph SedeN["Sede en modo nube"]
    DEVN["<b>Dispositivos del personal</b><br/>[PWA de la sede]"]:::contenedor
    PUE["<b>Puente de impresión</b><br/>[Docker en el PC de la caja]"]:::contenedor
    IMPN["<b>Impresoras y cajón</b>"]:::externo
  end

  subgraph Movil["Datos móviles e internet"]
    CLI["<b>Celular del cliente</b><br/>[Portal]"]:::contenedor
    DOM["<b>Celular del domiciliario</b><br/>[PWA]"]:::contenedor
    ADMW["<b>Navegador del administrador</b><br/>[Web de administración]"]:::contenedor
  end

  subgraph Prod["Nube de producción · cuenta de producción"]
    subgraph VPC["Red privada"]
      LB["<b>Balanceador con TLS</b><br/>[ALB, Cloud Run o Container Apps ingress]"]:::infra
      API["<b>API central</b><br/>[Contenedor gestionado]<br/>2 a N instancias"]:::contenedor
      WRK["<b>Workers</b><br/>[Contenedor gestionado]<br/>1 a N, escala por la cola"]:::contenedor
      OTC["<b>Colector OpenTelemetry</b><br/>[Contenedor gestionado]"]:::contenedor
      PG[("<b>PostgreSQL</b><br/>[Gestionado, alta disponibilidad]")]:::contenedor
    end
    OBJ[("<b>Almacenamiento de objetos</b>")]:::contenedor
    SEC[("<b>Gestor de secretos</b>")]:::contenedor
    REG[("<b>Registro de imágenes</b>")]:::contenedor
  end

  BKP[("<b>Respaldo cifrado</b><br/>[Otra nube, TRD-01 3.4]")]:::contenedor

  subgraph Externos["Servicios externos"]
    CF["<b>Cloudflare</b><br/>[DNS]<br/>Dominios y DNS-01 de las sedes"]:::externo
    FAC["<b>Factus</b><br/>[API v2]"]:::externo
    PAS["<b>Pasarela de pagos</b><br/>[ADR-016]"]:::externo
    PLAT["<b>Plataformas</b><br/>[Rappi, DiDi, integrador]"]:::externo
    PUSH["<b>Web Push</b><br/>[FCM, APNs]"]:::externo
    MSG["<b>Correo y SMS</b><br/>[Por definir]"]:::externo
  end

  subgraph Obs["Observabilidad como servicio"]
    GRA["<b>Grafana Cloud</b><br/>[Mimir, Loki, Tempo]"]:::externo
    SEN["<b>Sentry</b><br/>[Errores]"]:::externo
  end

  DEVH -- "HTTPS + WSS, red local" --> NODO
  NODO --> IMPH
  NODO -- "HTTPS + WSS saliente" --> LB
  DEVN -- "HTTPS + WSS" --> LB
  PUE -- "WSS saliente" --> LB
  PUE --> IMPN
  CLI --> LB
  DOM --> LB
  ADMW --> LB

  LB --> API
  API -- "encola trabajos" --> WRK
  API --> PG
  WRK --> PG
  API --> OBJ
  WRK --> OBJ
  API -.-> SEC
  WRK -.-> SEC
  WRK -- "OAuth2" --> FAC
  PAS -. "webhook" .-> LB
  PLAT -. "webhook" .-> LB
  WRK --> PLAT
  WRK --> PUSH
  API --> MSG
  WRK -- "DNS-01" --> CF
  API -- "crea el cobro" --> PAS
  CLI -- "paga" --> PAS

  API --> OTC
  WRK --> OTC
  OTC -- "OTLP" --> GRA
  API -.-> SEN
  NODO -. "errores, envío diferido" .-> SEN
  DEVH -.-> SEN
  NODO -. "jala imagen por etapas" .-> REG
  PG -. "exportación diaria cifrada" .-> BKP

  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  classDef infra fill:#5a6b7c,stroke:#3d4a57,color:#fff
  style Externos fill:none,stroke:#666,stroke-dasharray: 5 5
  style Obs fill:none,stroke:#666,stroke-dasharray: 5 5
  style Prod fill:none,stroke:#333,stroke-dasharray: 5 5
  style VPC fill:none,stroke:#888,stroke-dasharray: 3 3
  style SedeH fill:none,stroke:#333,stroke-dasharray: 5 5
  style SedeN fill:none,stroke:#333,stroke-dasharray: 5 5
  style Movil fill:none,stroke:#666,stroke-dasharray: 5 5
```

## 2. Red de la nube

```mermaid
flowchart LR
  INT(("Internet"))

  subgraph Cuenta["Cuenta o proyecto de producción"]
    subgraph Publica["Subred pública"]
      LB["<b>Balanceador</b><br/>TLS 443"]:::infra
      NAT["<b>Salida a internet</b><br/>NAT o egreso gestionado"]:::infra
    end
    subgraph Privada["Subred privada"]
      API["<b>API central</b>"]:::contenedor
      WRK["<b>Workers</b>"]:::contenedor
      OTC["<b>Colector OTel</b><br/>OTLP 4317 y 4318"]:::contenedor
      PG[("<b>PostgreSQL</b><br/>5432 con TLS")]:::contenedor
    end
    subgraph Gestionados["Servicios gestionados con acceso privado"]
      OBJ[("Objetos")]:::contenedor
      SEC[("Secretos")]:::contenedor
    end
  end

  EXT["<b>Factus, plataformas, Web Push,<br/>correo, Grafana Cloud, Sentry</b>"]:::externo

  INT -- "443" --> LB
  LB -- "puerto interno" --> API
  API -- "encola trabajos" --> WRK
  API -- "5432" --> PG
  WRK -- "5432" --> PG
  API -- "OTLP" --> OTC
  WRK -- "OTLP" --> OTC
  API -- "identidad de la nube" --> OBJ
  WRK -- "identidad de la nube" --> OBJ
  API -- "identidad de la nube" --> SEC
  WRK -- "identidad de la nube" --> SEC
  WRK --> NAT
  API --> NAT
  OTC --> NAT
  NAT -- "443" --> EXT

  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  classDef infra fill:#5a6b7c,stroke:#3d4a57,color:#fff
  style Cuenta fill:none,stroke:#333,stroke-dasharray: 5 5
  style Publica fill:none,stroke:#888,stroke-dasharray: 3 3
  style Privada fill:none,stroke:#888,stroke-dasharray: 3 3
  style Gestionados fill:none,stroke:#888,stroke-dasharray: 3 3
```

Reglas (TRD-01, sección 9):

- Solo el balanceador recibe tráfico de internet. PostgreSQL y los archivos solo se alcanzan desde la red privada.
- Los servicios usan identidades de la nube con permisos mínimos. No hay llaves en las imágenes ni en el repositorio.
- Staging vive en otra cuenta o proyecto, sin red ni credenciales compartidas con producción.
- El tiempo real entre instancias de la API se reparte con `LISTEN/NOTIFY` de PostgreSQL: un mensaje que llega a una instancia alcanza a los WebSocket abiertos en las demás.

## 3. Red de la sede híbrida

El diseño asume que cualquier cliente puede estar en la misma red que el nodo (TRD-00, 10.1.2). Por eso el kit recomienda un router dedicado del sistema (ADR-006).

```mermaid
flowchart TB
  ISP(("Internet del local"))

  subgraph Local["Local"]
    M4G["<b>Módem 4G de respaldo</b><br/>[Recomendado, TRD-00 8.3]"]:::infra
    RACT["<b>Router actual</b><br/>Wi-Fi de clientes"]:::infra
    CEL["<b>Celulares de clientes</b><br/>Portal por internet"]:::externo

    subgraph Sistema["Red del sistema · router dedicado"]
      RDED["<b>Router dedicado</b><br/>Wi-Fi del personal<br/>DNS local en el router o en el nodo:<br/>sede-xxx.local.dominio → IP del nodo"]:::infra
      NODO["<b>Nodo local</b><br/>Solo 443: HTTPS y WSS<br/>Sin SSH ni paneles expuestos"]:::contenedor
      DEV["<b>Celulares, tablets, PC de caja, TV de cocina</b><br/>Dispositivos registrados"]:::contenedor
      IMPR["<b>Impresora de red</b><br/>TCP 9100, solo desde la IP del nodo"]:::externo
      IMPU["<b>Impresora USB o por cable</b><br/>Conectada al nodo"]:::externo
      CAJ["<b>Cajón monedero</b><br/>Conectado a la impresora de caja"]:::externo
    end
  end

  ISP --- RACT
  RACT --- CEL
  RACT -- "uplink" --- RDED
  RDED -- "cable; 443 saliente del nodo hacia la nube" --- NODO
  RDED --- DEV
  RDED --- IMPR
  IMPR --- CAJ
  M4G -- "respaldo del enlace del nodo" --- NODO

  DEV -- "HTTPS + WSS 443" --> NODO
  NODO -- "ESC/POS, TCP 9100" --> IMPR
  NODO -- "ESC/POS, USB" --> IMPU

  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  classDef infra fill:#5a6b7c,stroke:#3d4a57,color:#fff
  style Local fill:none,stroke:#333,stroke-dasharray: 5 5
  style Sistema fill:none,stroke:#1168bd,stroke-dasharray: 5 5
```

| Protección | Cómo |
|------------|------|
| HTTPS dentro del local | Certificado real de `sede-xxx.local.dominio`, emitido en la nube por DNS-01 en Cloudflare, instalado y renovado en el nodo en cada conexión (ADR-003, opción A) |
| Dispositivo sin registrar | El nodo solo responde la pantalla de registro, y solo con un QR vigente de un solo uso |
| Peticiones | Firmadas con la llave ECDSA no exportable de cada dispositivo, más PIN y sesión corta |
| Impresoras | En la red del sistema, con reglas que solo dejan llegar al nodo, o por USB o cable |
| Aislamiento de clientes | Si el router actual lo tiene activo en la red del personal, los celulares no llegan al nodo. Se revisa en la visita técnica |
| Si no hay router dedicado | Aislamiento de clientes y reglas en el router actual, validado sede por sede (TRD-00, 10.1.2, opción 3) |

## 4. Sede en modo nube

No hay nodo. Los dispositivos van por internet a la API central. El puente, si existe, es el único programa en el local.

```mermaid
flowchart LR
  subgraph Local["Local en modo nube"]
    DEV["<b>Dispositivos del personal</b>"]:::contenedor
    PUE["<b>Puente</b><br/>[nodo-local, perfil puente]<br/>Sin puertos de entrada"]:::contenedor
    IMP["<b>Impresoras y cajón</b>"]:::externo
    R["<b>Router</b>"]:::infra
  end
  API["<b>API central</b>"]:::contenedor

  DEV -- "HTTPS + WSS 443 por internet" --> R --> API
  PUE -- "WSS 443 saliente: recibe trabajos" --> R
  DEV -. "comprueba que llega al puente:<br/>presencia en el local" .-> PUE
  PUE -- "TCP 9100 o USB" --> IMP

  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  classDef infra fill:#5a6b7c,stroke:#3d4a57,color:#fff
  style Local fill:none,stroke:#333,stroke-dasharray: 5 5
```

Si el puente está apagado, el trabajo espera en la nube y la pantalla avisa que no se imprimió. Una sede sin ningún equipo local acepta que un dispositivo registrado y con PIN opere desde donde tenga internet, hasta que se revoque (TRD-00, 5.0).

## 5. Matriz de comunicación

"Inicia" es quien abre la conexión. Todas las conexiones van cifradas con TLS, salvo ESC/POS hacia la impresora, que no lo soporta y se protege con la red.

| # | Origen | Destino | Protocolo y puerto | Inicia | Autenticación | Modo |
|---|--------|---------|--------------------|--------|---------------|------|
| 1 | App de la sede | Nodo | HTTPS + WSS 443, red local | Dispositivo | Certificado de la sede; firma ECDSA del dispositivo; PIN | Híbrido |
| 2 | App de la sede | API central | HTTPS + WSS 443 | Dispositivo | Firma ECDSA del dispositivo; PIN; presencia por el puente | Nube |
| 3 | Nodo | API central | HTTPS 443: lotes de la outbox, comprimidos y reanudables | Nodo | Credencial del nodo, limitada a su sede | Híbrido y bodega |
| 4 | Nodo | API central | WSS 443: configuración, pedidos QR, pagos QR, pedidos externos, reservas | Nodo (la nube empuja por esa conexión) | Credencial del nodo | Híbrido y bodega |
| 5 | Puente | API central | WSS 443: trabajos de impresión | Puente | Credencial del puente | Nube |
| 6 | Nodo o puente | Impresora | ESC/POS por TCP 9100, o USB | Nodo o puente | Ninguna en la impresora: aislamiento de red | Ambos |
| 7 | Dispositivo de la sede | DNS local (router o nodo) | DNS 53, red local | Dispositivo | — | Híbrido |
| 8 | Web de administración | API central | HTTPS 443 | Navegador | Better Auth, segundo factor opcional | Ambos |
| 9 | Portal de clientes | API central | HTTPS 443 | Celular del cliente | Token firmado de un solo propósito; límite por token e IP; captcha; código de un solo uso para datos guardados | Ambos |
| 10 | API central → pasarela, y celular del cliente → pasarela | Pasarela | HTTPS 443 | La API crea el cobro por el saldo; el celular paga en la pasarela | Credencial del comercio en el gestor de secretos; la del proveedor para el cliente | Ambos |
| 11 | Pasarela | API central | HTTPS 443, webhook | Pasarela | Firma del webhook; idempotente por referencia | Ambos |
| 12 | App del domiciliario | API central | HTTPS + WSS 443 | Celular | Dispositivo registrado | Ambos |
| 13 | App del domiciliario | Nodo | HTTPS 443, Wi-Fi de la sede | Celular | Dispositivo registrado | Híbrido, durante un corte |
| 14 | Plataformas | API central | HTTPS 443, webhook | Plataforma | Firma del webhook; clave `(plataforma, id_externo)` | Ambos |
| 15 | Workers | Plataformas | HTTPS 443 | Worker | Credenciales cifradas por tienda | Ambos |
| 16 | Workers | Factus | HTTPS 443 | Worker | OAuth2 por contribuyente, token de 60 minutos; 80 solicitudes por minuto por NIT | Ambos |
| 17 | Balanceador | API central | HTTP, puerto interno, red privada | Balanceador | Red privada | — |
| 18 | API y workers | PostgreSQL | TCP 5432 con TLS | Servicio | Credencial en el gestor de secretos; `tenant_id` fijado por transacción para RLS | — |
| 19 | API y workers | Objetos y secretos | HTTPS, API del proveedor | Servicio | Identidad de la nube; enlaces firmados con vencimiento para descargar | — |
| 20 | Workers | Web Push | HTTPS 443 | Worker | VAPID | Ambos |
| 21 | API | Correo y SMS | HTTPS 443 | API | Llave en el gestor de secretos | Ambos |
| 22 | Workers | Cloudflare | HTTPS 443, API de DNS | Worker | Token de API con alcance a la zona | Híbrido (certificados de sede) |
| 23 | API, workers | Colector OTel | OTLP gRPC 4317 o HTTP 4318 | Servicio | Red privada | — |
| 24 | Colector OTel | Grafana Cloud | OTLP sobre HTTPS 443 | Colector | Token de Grafana Cloud | — |
| 25 | API, workers, nodo, PWA | Sentry | HTTPS 443 | SDK | DSN del proyecto; envío diferido sin internet | Ambos |
| 26 | Nodo | Registro de imágenes | HTTPS 443 | Nodo | Credencial de solo lectura | Actualización por etapas, fuera de horario |
| 27 | Pipeline | Nube | HTTPS, API del proveedor | Pipeline | OIDC de corta duración | — |
| 28 | Respaldo | Otra nube | HTTPS 443 | Tarea programada | Identidad de la otra nube; copia cifrada | — |

El nodo no habla con Grafana: sus métricas y logs viajan como lotes de prioridad baja dentro del canal 3, y la nube los entrega al colector (TRD-01, 7.2).

## 6. Canales críticos

### 6.1 Conexión del nodo con la nube

El nodo abre las dos conexiones. Así la nube puede empujar pedidos QR, pagos y pedidos de plataformas sin abrir puertos en el router del local.

```mermaid
sequenceDiagram
  participant Nodo
  participant API as API central
  participant PG as PostgreSQL
  participant W as Workers

  Nodo->>API: Abre WSS con la credencial del nodo
  API->>PG: Sede, generación vigente y cursor
  API-->>Nodo: Cambios de configuración desde el último cursor
  API-->>Nodo: Pendientes de la nube: pedidos QR, pagos QR, datos de factura, reservas del día
  loop Mientras hay enlace
    Nodo->>API: POST lote de la outbox, por prioridad
    API->>PG: Inbox, sin duplicar por dispositivo y secuencia
    API-->>Nodo: Última secuencia recibida
    API-->>Nodo: Lo nuevo que nace en la nube, al instante
    Nodo->>API: Señal de vida y telemetría, prioridad baja
  end
  W->>W: Si la sede deja de reportar, alerta y pausa en plataformas
  Note over Nodo,API: Al reconectar, todo sigue desde la última secuencia confirmada
```

Cada escritura lleva la generación de la sede. Si la generación cambió (por ejemplo, la sede volvió a nube), la nube rechaza los lotes del dueño anterior y el administrador concilia (TRD-00, 5.0).

### 6.2 Orden del enlace de la sede

Cuando el internet de la sede es débil o vuelve después de un corte, lo que sube sale en este orden (TRD-00, 5.5; TRD-01, 2):

1. Documentos DIAN y pagos QR confirmados.
2. Pedidos QR.
3. Auditoría.
4. Ventas y caja.
5. Inventario.
6. Telemetría (métricas y logs). Si se llena su espacio en el nodo, se descartan los más viejos de menor severidad.

Los errores para Sentry van por su propio SDK, con tamaño máximo y envío diferido.

### 6.3 Impresión en modo nube

```mermaid
sequenceDiagram
  participant App as App de la sede
  participant API as API central
  participant PG as PostgreSQL
  participant Pue as Puente
  participant Imp as Impresora

  App->>API: Enviar a cocina o cobrar
  API->>PG: Guarda la operación y el trabajo de impresión
  alt El puente está conectado
    API-->>Pue: Trabajo por su WSS
    Pue->>Imp: ESC/POS
    Pue-->>API: Impreso
  else El puente está apagado
    API-->>App: Aviso: no se imprimió
    Note over PG: El trabajo espera hasta que el puente vuelva
  end
```

### 6.4 Emisión ante Factus

```mermaid
sequenceDiagram
  participant Nodo
  participant API as API central
  participant W as Worker de emisión
  participant Lim as Limitador por NIT (PostgreSQL)
  participant Sec as Secretos
  participant F as Factus

  Nodo->>API: Documento de venta, primero en el lote
  API->>W: Trabajo en pg-boss, en orden de venta
  W->>Lim: ¿Hay cupo en este minuto para el NIT?
  Lim-->>W: Sí, o espera
  W->>Sec: Token OAuth2 vigente del contribuyente
  W->>F: POST /v2/bills/validate con reference_code
  alt Respuesta
    F-->>W: Número, CUFE, QR
    W-->>Nodo: Resultado por el canal de la sede, para imprimir
  else 429
    F-->>W: Retry-After
    W->>W: Reprograma sin perder el orden
  else Sin respuesta
    W->>W: Documento incierto: consulta por reference_code antes de reenviar
  end
```

El límite por NIT vive en PostgreSQL y lo comparten todas las instancias de workers. Más workers no facturan más rápido (TRD-01, 6).

### 6.5 Pedido de plataforma hasta la cocina

```mermaid
sequenceDiagram
  participant P as Plataforma
  participant LB as Balanceador
  participant API as API central (hub)
  participant PG as PostgreSQL
  participant Nodo
  participant Caja

  P->>LB: Webhook HTTPS
  LB->>API: Petición
  API->>API: Verifica la firma y la clave (plataforma, id_externo)
  API->>PG: PedidoExterno normalizado
  API-->>P: 200 recibido
  API-->>Nodo: Pedido por el WSS que abrió el nodo
  Nodo-->>Caja: Alerta para aceptar
  Caja->>Nodo: Aceptar
  Nodo->>API: Estado aceptado, por la outbox
  API->>P: Actualiza el estado
```

## 7. Despliegue continuo e infraestructura como código

```mermaid
flowchart LR
  DEVS["<b>Equipo</b>"]:::persona
  REPO["<b>Repositorio</b><br/>código + infra/"]:::contenedor

  subgraph CI["Pipeline · ADR-015"]
    T["Lint, tipos, pruebas,<br/>dependency-cruiser"]:::infra
    B["Construir imágenes<br/>una sola vez"]:::infra
    S["Escaneo de vulnerabilidades"]:::infra
    TP["terraform plan<br/>AWS, GCP y Azure"]:::infra
    TA["terraform apply<br/>solo el pipeline"]:::infra
  end

  REG[("<b>Registro de imágenes</b>")]:::contenedor
  STG["<b>Staging</b><br/>migraciones, despliegue,<br/>humo y E2E"]:::contenedor
  APR{"Aprobación"}
  PRD["<b>Producción</b><br/>despliegue gradual,<br/>vuelta atrás automática"]:::contenedor
  COM["<b>Cloudflare, Grafana, Sentry</b><br/>DNS, tableros, alarmas, proyectos"]:::externo
  NOD["<b>Nodos de las sedes</b><br/>actualización por etapas,<br/>fuera de horario"]:::contenedor
  SEN["<b>Sentry</b><br/>versión y source maps"]:::externo

  DEVS --> REPO --> T --> B --> S --> REG
  REPO --> TP --> TA
  TA -- "OIDC" --> STG
  TA -- "OIDC" --> PRD
  TA --> COM
  REG --> STG --> APR --> PRD
  REG -. "imagen del nodo" .-> NOD
  B -.-> SEN

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  classDef infra fill:#5a6b7c,stroke:#3d4a57,color:#fff
  style CI fill:none,stroke:#333,stroke-dasharray: 5 5
```

- La misma imagen pasa por staging y producción.
- La API de la nube acepta el contrato de sincronización de la versión actual y la anterior, porque los nodos se actualizan después (TRD-01, 5.3).
- Una vez al mes, staging se levanta desde cero en las dos nubes que no son de producción, con un respaldo restaurado (TRD-01, 5.4).

## 8. Observabilidad

```mermaid
flowchart LR
  subgraph Nube["Nube"]
    API["API central"]:::contenedor
    WRK["Workers"]:::contenedor
    OTC["Colector OTel<br/>limpia datos personales"]:::contenedor
  end
  NODO["Nodo de la sede"]:::contenedor
  PWA["PWA y web"]:::contenedor

  subgraph Grafana["Grafana Cloud"]
    MIM["Mimir<br/>métricas"]:::externo
    LOK["Loki<br/>logs"]:::externo
    TEM["Tempo<br/>trazas"]:::externo
    ALR["Tableros y alarmas<br/>definidos en Terraform"]:::externo
  end
  SEN["Sentry<br/>excepciones"]:::externo
  EQ["Equipo y panel de soporte"]:::persona

  API -- "OTLP" --> OTC
  WRK -- "OTLP" --> OTC
  NODO -- "telemetría en lotes de prioridad baja" --> API
  OTC --> MIM
  OTC --> LOK
  OTC --> TEM
  MIM --> ALR
  ALR --> EQ
  API -.-> SEN
  WRK -.-> SEN
  NODO -. "envío diferido" .-> SEN
  PWA -. "envío diferido" .-> SEN
  SEN --> EQ

  classDef persona fill:#08427b,stroke:#052e56,color:#fff
  classDef contenedor fill:#438dd5,stroke:#2e6295,color:#fff
  classDef externo fill:#999999,stroke:#6b6b6b,color:#fff
  style Nube fill:none,stroke:#333,stroke-dasharray: 5 5
  style Grafana fill:none,stroke:#666,stroke-dasharray: 5 5
```

Las métricas, tableros y alarmas están en TRD-01, sección 7. Las trazas siguen una petición de la PWA al nodo, a la nube y a Factus con el mismo identificador.

## 9. Pendientes que cambian estos diagramas

| Pendiente | Qué cambia |
|-----------|------------|
| ADR-003 | Si el spike de HTTPS local no valida la opción A, cambia el canal 1 y la red de la sede |
| ADR-005 | Nombres concretos de los servicios en la nube de producción |
| ADR-006 | Si el kit incluye o no el router dedicado en cada sede |
| ADR-015 | Servicio del pipeline |
| ADR-016 | Pasarela del pago QR: canales 10 y 11 |
| Por definir | Proveedor de correo y SMS (canal 21); cómo se sirven las PWA estáticas desde la nube |
