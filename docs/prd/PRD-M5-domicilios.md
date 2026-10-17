# PRD-M5 · Domicilios y plataformas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.4 |
| Fecha | 2026-10-17 |
| Fase | 3 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M5](../trd/TRD-M5-domicilios.md) |
| Diagramas | [Flujo M5](../flujos/m5-domicilios.md) · [C4 M5](../arquitectura/componentes/c4-m5-domicilios.md) |

## 1. Resumen

M5 mete en la misma cocina el domicilio propio y los pedidos de Rappi, DiDi Food y las demás plataformas. El personal los ve en una sola pantalla. Si un conector falla, o todavía no existe, la caja copia el pedido a mano. El pago de la plataforma queda por cobrar y se concilia contra su liquidación.

## 2. Alcance

**Incluye**

- Domicilio propio por teléfono, WhatsApp o mostrador: cliente, dirección, asignación, despacho, entrega y cobro contra entrega.
- PWA del domiciliario.
- Hub de plataformas: recibir, aceptar o rechazar, estados, menú y precio por canal, disponibilidad, pausa de tienda y cancelaciones.
- Conectores de Rappi y DiDi Food, un integrador si hace falta, y el adaptador manual desde el primer día de esta fase.
- Comisiones, importación de liquidaciones, diferencias y rentabilidad por canal.
- Impuesto de bolsas cuando el pedido sale del local, si la sede lo tiene encendido (D-29).
- Tiempos por etapa, canal y domiciliario.

**No incluye**

- La cocina y la cuenta: al aceptar, el pedido entra a [PRD-M1](PRD-M1-pedidos-y-salon.md).
- El turno de caja: el contra entrega y el por cobrar entran a [PRD-M2](PRD-M2-caja.md).
- Elegir entre conector directo e integrador: ADR-011. El manual no espera esa decisión.
- Notificación al cliente por WhatsApp (Fase 5). El canal "WhatsApp" de esta fase es el pedido que el personal registra, no un bot.

## 3. Usuarios y permisos

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Cajero | Aceptar o rechazar, captura manual, despachar | No, según PRD-01, 6.4 |
| Supervisor | Lo mismo que el cajero, y pausar una plataforma | No, según PRD-01, 6.4 |
| Administrador | Pausar una plataforma, precios por canal, comisiones | No |
| Domiciliario | Ver sus pedidos, confirmar entrega y el cobro contra entrega | No ve otras sedes ni costos |
| Jefe de cocina | Ver el pedido ya aceptado en su estación | No acepta plataformas |

## 4. Historias de usuario

### HU-M5-01 · Domicilio propio

**Como** cajero, **quiero** crear un domicilio con dirección y seguirlo hasta la entrega, **para** medirlo igual que una mesa.

Criterios de aceptación:

- [ ] Dado un cliente y una dirección, cuando se crea, entonces va a cocina como pedido interno y, al quedar listo, se asigna un domiciliario.
- [ ] El domiciliario confirma la entrega y, si es contra entrega, el cobro. Ese cobro se concilia en el turno.
- [ ] La factura lleva la dirección de entrega aunque el cliente no dé sus datos fiscales.
- [ ] Durante un corte: el domicilio creado en la sede sigue. El domiciliario en la calle, fuera del Wi-Fi, espera a tener datos.
- [ ] Queda auditado: el cobro contra entrega y una cancelación.

### HU-M5-02 · Ver todas las plataformas en una pantalla

**Como** cajero, **quiero** recibir Rappi y DiDi sin sus tablets, **para** aceptar a tiempo y no digitar dos veces.

Criterios de aceptación:

- [ ] Dado un pedido de plataforma, cuando llega, entonces suena en la caja, con el canal y el código, y se acepta o se rechaza dentro del tiempo de la plataforma.
- [ ] La sede puede dejar la aceptación automática por horario.
- [ ] Al aceptarlo, entra a cocina con el logo y el código. Al quedar listo se avisa a la plataforma y se entrega al repartidor verificando el código.
- [ ] Durante un corte: el pedido espera en la nube. Si el nodo no responde, el vigía puede pausar la tienda. Al reconectar no se duplica.
- [ ] Queda auditado: aceptación, rechazo y pausa.

### HU-M5-03 · Copiar un pedido a mano

**Como** cajero, **quiero** copiar un pedido desde la tablet de la plataforma, **para** no parar cuando el conector no está o se cae.

Criterios de aceptación:

- [ ] Dado un canal y un código, cuando la caja copia los productos, entonces el pedido sigue el mismo camino que uno automático.
- [ ] Los estados hacia la plataforma, si el conector no los soporta, se actualizan en la tablet. El sistema lo deja dicho.
- [ ] Queda auditado: que entró por captura manual.

### HU-M5-04 · Conciliar la liquidación

**Como** administrador, **quiero** comparar lo que la plataforma debía pagar con lo que pagó, **para** ver la diferencia y la rentabilidad del canal.

Criterios de aceptación:

- [ ] Dado un periodo, cuando se importa la liquidación, entonces se ven comisión, cargos fijos y diferencias.
- [ ] La venta neta del canal es la venta menos esos cargos, comparable con el costo de los platos.
- [ ] Una cancelación con cocina ya empezada queda como merma en M4.
- [ ] Queda auditado: el archivo importado y el cierre de la conciliación.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | Un pedido externo se identifica por plataforma más identificador externo. No entra dos veces | No |
| 2 | Aceptar crea el pedido interno. Rechazar no lo crea | Aceptación automática, por sede y horario |
| 3 | El menú publicado puede tener otro precio que el del salón | Sí, por canal |
| 4 | Si el punto agota un plato, se agota en los canales. Si la sede se satura, se puede pausar una plataforma | La pausa es manual, además del vigía |
| 5 | El pago de plataforma es saldo por cobrar, no efectivo | La comisión, porcentaje y cargos fijos |
| 6 | Cancelar después de que cocina empezó es merma | No |
| 7 | El domicilio a consumidor final lleva dirección de entrega. La bolsa plástica va como línea solo si la sede tiene el impuesto encendido (D-29) | El impuesto de bolsas, por sede |
| 8 | Lo que el conector no sepa hacer se hace en el portal de la plataforma | Lo declara cada adaptador |
| 9 | La factura de la comida la emite el restaurante, al cliente o a consumidor final. La comisión de la plataforma no se carga. La conciliación muestra venta bruta, comisión, retenciones y neto (D-13) | La comisión, porcentaje y cargos fijos |

## 6. Pantallas y flujos

Caja: cola única de canales, aceptar, rechazar, captura manual, despacho.

PWA del domiciliario, mobile first y con datos móviles: pedidos asignados, ruta, entrega y cobro.

Web de administración: menú por canal, mapeo de productos, comisiones, pausa y conciliación.

Recorrido: [Flujo M5](../flujos/m5-domicilios.md).

## 7. Reportes y métricas que alimenta

Cada etapa guarda la hora. M6 calcula los tiempos de plataforma y de domicilio de [PRD-00, 8.1](PRD-00-vision-producto.md), las ventas por canal, la venta neta, los rechazos y las diferencias de liquidación ([8.2](PRD-00-vision-producto.md)).

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Domicilios propios de una sede | Una semana real, con tiempos por etapa |
| Plataformas | Los pedidos entran por una sola pantalla, aunque al principio sea a mano |
| Rappi y DiDi | Pedidos reales sin digitarlos, cuando el acceso esté |
| Liquidación | Una real conciliada, con diferencias alertadas |
| Corte | Un pedido que llegó durante el corte entra al reconectar, sin duplicarse |

## 9. Preguntas abiertas

- PA-28: acceso a las API de Rappi y DiDi Food, o integrador (ADR-011). Ver [registro](../preguntas-abiertas.md).
- Al inicio no hay plataformas ni comisiones del piloto. Se construye con adaptadores y datos de prueba (D-35).
