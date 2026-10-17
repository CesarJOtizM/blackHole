# Flujos · M8 Asistencia del personal

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-17 |
| Fuentes | [PRD-00 §6.4 y M8](../prd/PRD-00-vision-producto.md), [PRD-M8](../prd/PRD-M8-asistencia.md), [TRD-M8](../trd/TRD-M8-asistencia.md), [TRD-00 §10.4](../trd/TRD-00-arquitectura-base.md) |

Registra entrada, salida y pausas. No liquida nómina. La hora la pone el nodo (en modo nube, el servidor), así el reloj del celular no adelanta la marcación. Solo se puede marcar dentro del local: en modo nube, la PWA comprueba antes que llega al puente de la sede. Una sede en modo nube sin ningún equipo local no marca hasta tener puente.

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M0 | El PIN es el de la plataforma. Una corrección queda auditada. Si la sede lo activa, sin entrada no hay acciones operativas. |
| M1 y M2 | Esas acciones operativas son las que la regla puede bloquear. |
| M2 | Al liquidar propinas, los participantes salen de las marcaciones del periodo. |
| M6 | Horas, tardanzas, ausencias y ventas por hora trabajada. |

## Marcación

```mermaid
sequenceDiagram
  actor Persona
  participant App as Dispositivo de la sede o celular en el Wi-Fi
  participant Nodo

  Persona->>App: PIN
  App->>Nodo: Entrada, pausa o salida
  Nodo->>Nodo: Hora del nodo, dispositivo registrado
  Nodo->>Nodo: Agrega la marcación, no edita las anteriores
  Nodo--)Nube: Sube cuando hay internet
```

Dos modos conviven, por trabajador:

- **Solo horas.** Se cuentan desde la entrada hasta la salida, menos las pausas.
- **Con horario.** Además se calculan tardanza, ausencia, salida anticipada y horas por fuera del turno.

```mermaid
stateDiagram-v2
  state "Fuera" as off_shift
  state "En turno" as on_shift
  state "En pausa" as on_break
  state "Por revisar" as pending_review
  [*] --> off_shift
  off_shift --> on_shift: Entrada
  on_shift --> on_break: Inicio de pausa
  on_break --> on_shift: Fin de pausa
  on_shift --> off_shift: Salida
  on_shift --> pending_review: Cierre automático al final del día
```

El cierre automático no borra la marcación abierta: agrega el cierre y lo deja para que el administrador lo revise.

## Corrección

```mermaid
sequenceDiagram
  actor Admin as Administrador
  participant Nodo

  Admin->>Nodo: Corrección, con motivo
  Nodo->>Nodo: Apunta a la marcación original
  Note over Nodo: La original sigue igual
  Nodo->>Nodo: La proyección de horas usa las dos
```

## Efecto en el resto del sistema

```mermaid
flowchart TD
  A["Marcaciones del periodo"] --> B{"¿La sede exige entrada para operar?"}
  B -->|Sí| C["M0 rechaza pedidos, caja y cocina sin entrada abierta"]
  B -->|No| D["Se puede operar igual"]
  A --> E["Lista de quienes trabajaron"]
  E --> F["M2 reparte el fondo de propinas"]
  A --> G["Horas, tardanzas y productividad en M6"]
```

Las horas son una proyección. No hay un campo de horas que alguien edite a mano. La exportación a Excel es para quien liquida la nómina fuera de este sistema.
