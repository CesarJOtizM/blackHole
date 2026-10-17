# Flujos · M9 Reservas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-17 |
| Fuentes | [PRD-00 §6.3 y M9](../prd/PRD-00-vision-producto.md), [TRD-00 §6.2](../trd/TRD-00-arquitectura-base.md), [PRD-M9](../prd/PRD-M9-reservas.md), [TRD-M9](../trd/TRD-M9-reservas.md) |

La reserva y su cobro viven en la nube, porque pueden nacer fuera del local. Lo que ocurre el día de la reserva en el salón vive en el nodo: llegada, mesa y cuenta. El medio de cobro depende de cómo entra la reserva (D-01): por enlace, llamada o chat, solo transferencia a Nequi, Daviplata o Bre-B, que alguien verifica en la cuenta; en persona en la sede, transferencia verificada o efectivo, que la caja registra en el turno abierto.

## Cómo se conecta

| Con | Qué pasa |
|-----|----------|
| M1 | La mesa se bloquea antes de la hora. Al llegar, se abre o se asocia la cuenta. |
| M2 | El anticipo se abona al cobrar. El de transferencia no entra al efectivo del arqueo; el de efectivo se arquea en el turno que lo recibió y no se cuenta otra vez. |
| M3 | El anticipo va en la factura. El enlace del portal puede ir con la reserva. |
| M0 | Verificar el pago y aprobar una devolución tienen permiso, y quedan auditados. |
| M6 | Ocupación, no llegadas, anticipos retenidos e ingresos por reservas. |

## Reserva con cobro

```mermaid
sequenceDiagram
  actor Personal
  participant Nodo
  participant Nube
  participant Caja as Caja M2
  actor Cliente

  Personal->>Nodo: Fecha, hora, personas, zona o mesa y canal
  Nodo->>Nube: Disponibilidad, cuando hay internet
  Nube-->>Personal: Política vigente, copiada en la reserva
  alt Sin cobro
    Nodo->>Nube: Reserva confirmada
  else Por enlace, llamada o chat: solo transferencia
    Nube-->>Personal: Valor, referencia y cuentas de la sede
    Personal->>Cliente: Mensaje por WhatsApp
    Cliente->>Personal: Comprobante
    Personal->>Nodo: Adjunta el comprobante
    Personal->>Nodo: Verifica en el banco que el dinero llegó
    Nodo->>Nube: Cobro verificado, reserva confirmada
  else En persona en la sede: transferencia o efectivo
    alt Paga en efectivo
      Cliente->>Caja: Entrega el efectivo
      Caja->>Caja: Lo registra en el turno abierto
      Caja->>Nodo: Cobro verificado
    else Paga por transferencia
      Personal->>Nodo: Verifica en el banco que el dinero llegó
    end
    Nodo->>Nube: Reserva confirmada
  end
```

Sin turno de caja abierto no se recibe efectivo. El enlace público solo ofrece transferencia.

Sin internet, el nodo crea una reserva provisional. Al sincronizar, la nube la confirma o la marca en conflicto de disponibilidad para que el administrador lo resuelva. Quien verifica una transferencia necesita ver la cuenta del banco, así que esa comprobación usa la conexión de esa persona.

El mismo número de transacción no puede verificar dos reservas de la misma cuenta de recaudo.

## Estados

```mermaid
stateDiagram-v2
  state "Pendiente de pago" as pending_payment
  state "Confirmada" as confirmed
  state "Provisional" as provisional
  state "En conflicto" as conflict
  state "Cliente llegó" as arrived
  state "No llegó" as no_show
  state "Cancelada" as cancelled

  [*] --> pending_payment: La franja exige cobro
  [*] --> confirmed: Reserva sin cobro
  [*] --> provisional: La sede la crea sin internet
  provisional --> confirmed: Hay cupo y no hay cobro pendiente
  provisional --> pending_payment: Hay cupo y falta el pago
  provisional --> conflict: No hay cupo al sincronizar
  conflict --> confirmed: El administrador la mantiene
  conflict --> pending_payment: El administrador la mantiene y falta el pago
  conflict --> cancelled: El administrador la cancela
  pending_payment --> confirmed: Pago verificado
  pending_payment --> cancelled: Vence el plazo o se cancela
  confirmed --> arrived: Llega y se le asigna mesa
  confirmed --> no_show: No se presenta
  confirmed --> cancelled: Cancela
  arrived --> [*]
  no_show --> [*]
  cancelled --> [*]
```

El cobro, por su lado: pendiente, comprobante recibido, verificado, rechazado. La reserva solo pasa a confirmada cuando el cobro está verificado: una transferencia, cuando alguien la ve en la cuenta; el efectivo, cuando la caja lo registra en el turno. El pantallazo no alcanza. Un conflicto nunca se resuelve solo.

## El día de la reserva

```mermaid
sequenceDiagram
  participant Nube
  participant Nodo
  actor Anfitrion as Anfitrión
  participant Plano as Plano de mesas M1
  participant Caja as Caja M2

  Nube-->>Nodo: Reservas del día
  Nodo->>Plano: Bloquea la mesa un tiempo antes de la hora
  Anfitrion->>Nodo: El cliente llegó
  Nodo->>Plano: Asigna la mesa y abre la cuenta
  Note over Caja: Al cobrar, el anticipo se abona
  Caja->>Nodo: Medio de pago: anticipo de reserva
```

Una tarifa de reserva no se abona al consumo. Un anticipo sí.

## Cancelación y no llegada

```mermaid
flowchart TD
  A["Cancela o no llega"] --> B["Se usa la política copiada en la reserva"]
  B --> C{"Tramo según las horas de anticipación"}
  C --> D["Porcentaje de devolución de esa sede"]
  D --> E{"¿El porcentaje es 0?"}
  E -->|Sí| F["Se retiene el cobro"]
  E -->|No| G["Devolución por transferencia, con comprobante"]
  F --> H["Queda auditado"]
  G --> H
```

Un cambio posterior de la política no altera las reservas ya creadas. La devolución la aprueba quien tiene el permiso.
