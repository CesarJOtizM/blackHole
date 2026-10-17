# TRD-M5 · Domicilios y plataformas

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fase | 3 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M5](../prd/PRD-M5-domicilios.md) |
| Diagramas | [C4 M5](../arquitectura/componentes/c4-m5-domicilios.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Hub | Vive en la nube. Credenciales de cada tienda cifradas. El nodo no llama a Rappi ni a DiDi |
| Conectores | Puerto `PlatformConnector` en `contexts/delivery/adapters`. Adaptadores: Rappi, DiDi Food, Integrador y Manual (ADR-011) |
| Pedido externo | Dueña la nube hasta que la sede lo acepta. Después el pedido interno es del dueño de la operación |
| Idempotencia | Clave plataforma + identificador externo |
| Manual | La caja copia. El adaptador declara que no publica estados ni menú |
| Domiciliario | Habla con la nube por datos móviles. En un corte, solo si está en el Wi-Fi de la sede |
| Vigía | Si el nodo no responde, puede pausar la tienda para no aceptar pedidos que no entrarían a cocina |
| Código | `contexts/delivery/domain`, `contexts/delivery/application` |
| Bolsas | Cada sede enciende o apaga el impuesto en los domicilios. Si está apagado, la factura no lleva esa línea (D-29) |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Entidad | `ExternalOrder` | Único por plataforma e id externo. Estados de integración separados de los de cocina |
| Entidad | `ChannelProduct` | Mapea un producto de la marca a un ítem del canal, con precio de canal |
| Agregado | `Delivery` | Dirección obligatoria. Etapas con hora: creado, listo, despachado, entregado. No salta la entrega |
| Objeto de valor | `ChannelCommission` | Porcentaje y cargos fijos. La rentabilidad resta eso del valor |
| Entidad | `Settlement` | Importada una vez por periodo y canal. Las diferencias no se editan: se marcan |
| Regla | Capacidad del conector | Cada adaptador dice si recibe, publica estado, menú, disponibilidad, pausa y liquidación |

Aceptar es el único camino hacia `CreateInternalOrder`. Rechazar cierra el externo sin pedido interno.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Pedido externo, mapeo, credenciales, liquidación | Nube | `ExternalOrderPendingAcceptance`, `ExternalOrderCancelled` hacia el nodo |
| Aceptación y pedido interno | Dueño de la operación | Estados aceptado, en preparación y listo, hacia el hub |
| Domicilio propio creado en la sede | Dueño de la operación | Hacia la nube, para el domiciliario |
| Domicilio creado por el domiciliario en la calle | Nube | Hacia el nodo |
| Disponibilidad | La emite M4 | El hub la publica si el conector sabe |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `ReceiveExternalOrder` | Webhook firmado o sondeo | Normaliza, resuelve sede y productos, no duplica | `ExternalOrderPendingAcceptance` | Nube |
| `AcceptExternalOrder`, `RejectExternalOrder`, `AutoAcceptExternalOrder` | Caja o regla de horario | Aceptar llama a M1 y deja el por cobrar en M2 | Estado hacia el conector | Dueño de la operación, avisado por el canal |
| `MapProduct`, `PublishChannelMenu` | Productos y precios | Solo si el adaptador publica menú | — | Nube |
| `PropagateAvailability` | `AvailabilityChanged` | Agota o reactiva en cada canal que sepa | — | Nube |
| `PauseStore`, `ResumeStore` | Supervisor, administrador o vigía | Permiso de M0 si es persona (PRD-01, 6.4) | — | Nube |
| `ApplyExternalCancellation` | `ExternalOrderCancelled` | Si cocina no empezó, devolución. Si empezó, merma | Hacia M1 y M4 | Dueño de la operación |
| `CreateDelivery`, `AssignCourier`, `ConfirmDelivery` | Cliente, dirección, cobro | Dirección en el documento. La línea de bolsa solo si la sede la tiene activa (D-29). Contra entrega a M2 | Etapas con hora | Sede, o nube si lo crea el domiciliario |
| `ImportSettlement` | Archivo o API | Idempotente por periodo y canal | `SettlementDiscrepancyDetected` | Nube |

## 5. Contratos

**Webhook:** firma por plataforma. Cuerpo traducido por el adaptador al pedido interno del dominio.

**Puerto `PlatformConnector`:** operaciones opcionales. El caso de uso pregunta antes de llamar. Manual responde que ninguna publicación está soportada.

**Puerto de M1:** `CreateInternalOrder` con canal y código externo.

**Puerto de M2:** saldo por cobrar o cobro contra entrega.

**HTTP de la sede:** cola, aceptar, rechazar, captura manual, despacho.

**HTTP del domiciliario:** pedidos asignados y confirmación. WebSocket para el aviso de uno nuevo.

Los esquemas Zod del dominio viven en `shared/contracts`. El JSON de cada plataforma no sale del adaptador.

## 6. Persistencia

`external_orders`, `channel_products`, `deliveries`, `channel_commissions`, `settlements`, `store_credentials`.

- Clave única `(platform, external_id)`.
- Credenciales cifradas en PostgreSQL, con `tenant_id` y Row Level Security. No bajan al nodo.
- El nodo guarda la copia del pedido por aceptar y el domicilio de su sede en SQLite.
- La liquidación guarda el archivo en el almacén de objetos.

## 7. Operación sin internet

El hub sigue recibiendo. El nodo no acepta hasta reconectar. El vigía pausa la tienda si el silencio pasa el umbral, para no acumular pedidos que la plataforma ya daría por vencidos.

El domicilio armado en caja sigue en el nodo. El domiciliario fuera del local no marca la entrega hasta tener ruta a la nube o al Wi-Fi de la sede.

La captura manual sigue en el nodo: no necesita a la plataforma.

Al reconectar, aceptar un pedido ya recibido no lo crea dos veces.

## 8. Seguridad y auditoría

Permisos: `delivery.accept_order` (aceptar o rechazar), `delivery.pause_platform` (pausar, que por defecto tienen supervisor y administrador según PRD-01, 6.4) y `delivery.edit_channel_price`. El domiciliario solo ve lo asignado a él.

El webhook con firma inválida no crea pedido. Las credenciales no aparecen en la PWA ni en los eventos de M6.

Eventos: aceptación, rechazo, pausa, cancelación con merma, cobro contra entrega, cierre de conciliación.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Clave plataforma + id | Dominio | El segundo alta se rechaza |
| Rechazar no crea pedido interno | Dominio | No hay llamada posible a M1 |
| Domicilio sin dirección | Dominio | Se rechaza |
| `ReceiveExternalOrder` repetido | Aplicación | La segunda vez no duplica |
| Cancelación ya empezada | Aplicación | Llama merma, no devolución |
| Adaptador manual | Aplicación | No publica menú ni estados |
| Webhook con firma inválida | Aplicación | No hay pedido |
| `PlatformConnector` | Contrato, por adaptador | Cada uno declara lo que soporta y el manual no llama a una API |
| Vigía | Aplicación | Pausa solo tras el umbral, y no pausa una sede en modo nube que está operando |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización: pedido duplicado, cancelación fuera de orden y corte
- [ ] Un recorrido Playwright: captura manual, aceptar y ver la comanda en cocina

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-011 Acceso a las API (PA-28) | Trámite en la Fase 0. Manual desde el primer día de la Fase 3 |
| Pedido aceptado en la plataforma y no en cocina | El vigía pausa. La aceptación automática se apaga si el nodo está mudo |
| Comisión mal cargada | La rentabilidad usa la comisión vigente guardada en el pedido, no la que cambie después |
