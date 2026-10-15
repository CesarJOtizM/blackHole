# Flujos · M0 Plataforma

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-14 |
| Fuentes | [PRD-01](../prd/PRD-01-roles-y-permisos.md), [TRD-00 §5 y §10](../trd/TRD-00-arquitectura-base.md) |

M0 es la base que los demás módulos usan: quién entra, en qué dispositivo, qué puede hacer y qué queda registrado. También define el modo de cada sede y quién es el dueño de cada dato.

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| Todos | Cada acción pasa por el permiso. Las sensibles dejan auditoría. |
| M8 | Si la sede lo configura, sin entrada marcada no hay acciones operativas. |
| Nube | En modo nube, la nube es la operación. En híbrido, la configuración (empresa, roles, menú) baja al nodo y la operación sube. |

## Modo de la sede

Cada sede nace en **nube**. Un administrador puede **activar el híbrido** para esa sede. El detalle del emparejamiento, la vuelta a nube y el puente de impresión está en [TRD-00, sección 5.0](../trd/TRD-00-arquitectura-base.md).

| Modo | La PWA del salón habla con | Un corte de internet |
|------|----------------------------|----------------------|
| Nube | La API central | Detiene el salón |
| Híbrido | El nodo, dentro de la red del local | El salón sigue. Al reconectar se sincroniza |

Solo hay un dueño de la operación a la vez. Activar o apagar el híbrido cambia ese dueño y sube un número de generación. El sitio anterior deja de aceptar escrituras nuevas.

## Dueños de los datos

Solo el dueño crea o modifica el dato. El otro lado recibe una copia. El diagrama de abajo es el **modo híbrido**. En modo nube, lo que aquí es del nodo es de la nube y no hay copia.

```mermaid
flowchart LR
  subgraph Nube["Dueño: nube"]
    CFG["Empresa, marcas, sedes, roles"]
    MENU["Menú, recetas, precios"]
    PORTAL["Datos de facturación, pedido QR y pago QR"]
    EXT["Pedido externo de plataforma"]
    RES["Reserva y su cobro"]
  end

  subgraph Nodo["Dueño: nodo de la sede"]
    PED["Pedidos, cocina, cuentas"]
    CAJA["Pagos, turnos, propinas"]
    DOC["Documento de venta"]
    INV["Movimientos del punto y de la bodega de la sede"]
    MAR["Marcaciones de asistencia"]
    AUD["Auditoría generada en la sede"]
    ATE["Llegada y mesa de una reserva"]
  end

  CFG -->|"copia"| Nodo
  MENU -->|"copia"| Nodo
  PORTAL -->|"datos de la cuenta abierta"| Nodo
  RES -->|"reservas del día"| Nodo
  EXT -->|"pedido por aceptar"| Nodo
  Nodo -->|"eventos, cuando hay internet"| Nube
```

La bodega general tiene su propio nodo y es dueña de sus movimientos. Un traslado entre dos nodos se parte en dos mitades: salida en el origen y entrada en el destino. El detalle está en [M4](m4-inventario.md).

## Ingreso en un dispositivo de la sede

```mermaid
sequenceDiagram
  actor Persona
  participant App as PWA de la sede
  participant Nodo

  Persona->>App: PIN personal
  App->>Nodo: Validar PIN
  Nodo->>Nodo: Dispositivo registrado y usuario activo
  alt La sede exige entrada y no hay marcación abierta
    Nodo-->>App: No puede operar
  else Sesión válida
    Nodo-->>App: Sesión corta, con el nombre en pantalla
    App->>Nodo: Acción operativa
    Nodo->>Nodo: Evalúa el permiso
    Nodo-->>App: Permitida, pide autorización, o denegada
  end
```

La administración web entra con correo y contraseña en la nube. El celular del mesero solo habla con el nodo, dentro de la red del local, y no guarda datos del negocio.

## Registro y revocación de un celular

```mermaid
sequenceDiagram
  actor Admin as Administrador
  actor Mesero
  participant Nodo
  participant PWA as Celular del mesero

  Admin->>Nodo: Genera QR de un solo uso
  Mesero->>PWA: Escanea el QR dentro del local
  PWA->>Nodo: Registro del dispositivo
  Nodo-->>PWA: Credencial de ese celular y esa sede
  Note over Admin,Nodo: Más tarde, si el mesero se va o pierde el celular
  Admin->>Nodo: Revocar dispositivo o usuario
  Nodo-->>PWA: La sesión deja de servir
  Nodo--)Nube: El cambio sube cuando hay internet
```

Un celular en la misma red, sin registro y sin PIN, no opera. El nodo no responde nada útil a un dispositivo sin registrar, salvo la pantalla de registro con un QR vigente.

## Autorización en el momento

La usan M1, M2, M4 y M9 cuando la matriz de [PRD-01](../prd/PRD-01-roles-y-permisos.md) marca la acción con tope o con autorización.

```mermaid
flowchart TD
  A["Alguien intenta una acción sensible"] --> B{"¿El rol puede y está dentro del tope?"}
  B -->|Sí| C["El nodo ejecuta"]
  B -->|No puede| D["Denegada"]
  B -->|"Supera el tope o exige autorización"| E["Pide motivo"]
  E --> F{"¿Dónde está el supervisor?"}
  F -->|"En el mismo dispositivo"| G["Escribe su PIN"]
  F -->|"En otro lado"| H["Le llega la solicitud"]
  G --> I{"¿Es otra persona?"}
  H --> I
  I -->|Sí| J["Aprueba o rechaza"]
  I -->|"Es la misma persona"| K{"¿Autoautorización activa en este turno?"}
  K -->|Sí| L["Se ejecuta y queda marcada"]
  K -->|No| D
  J -->|Aprueba| C
  J -->|Rechaza o vence| D
  C --> M["Auditoría: quién pidió, quién autorizó, motivo, valor, dispositivo"]
  L --> M
```

Nadie autoriza su propia acción, salvo que el administrador haya activado la autoautorización para ese turno. Cada uso de esa excepción genera una alerta.

## Sincronización

```mermaid
flowchart LR
  A["Cambio en el nodo"] --> B["Se guarda con un evento en la outbox"]
  B --> C{"¿Hay internet?"}
  C -->|No| D["La sede sigue operando"]
  D --> C
  C -->|Sí| E["Lote hacia la nube"]
  E --> F["Primero facturas pendientes"]
  F --> G["Luego auditoría, ventas, inventario y telemetría"]
  H["Cambios de configuración en la nube"] --> I["El nodo los baja desde su último cursor"]
```

En modo híbrido, la operación del local no espera a la nube. Lo que sí espera conexión: emitir ante la DIAN, ver la sede desde afuera, reportes consolidados, cambios de menú hechos en la web, pedidos de plataformas y reservas hechas en el enlace público. En modo nube, todo el salón espera conexión.
