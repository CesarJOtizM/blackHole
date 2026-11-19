# Preguntas abiertas y decisiones

| Campo | Valor |
|-------|-------|
| Estado | Vivo |
| Versión | 0.15 |
| Fecha | 2026-11-19 |
| Relación | [Roadmap](roadmap.md), [PRD-00, sección 14](prd/PRD-00-vision-producto.md), [TRD-00, secciones 8.4 y 18](trd/TRD-00-arquitectura-base.md) |

Este es el único lugar donde vive una pregunta sin respuesta. Cada documento que dependa de una la cita por su código (`PA-10`) y no la repite. Cuando llega la respuesta, se anota aquí, se pasa a la sección 2 y se corrigen primero los maestros y después los módulos (roadmap, sección 1).

Una entrega no empieza su diseño con una pregunta abierta que la bloquee.

Las entregas 2.1 a 2.11 están archivadas. La 2.1 está en `openspec/changes/archive/2026-11-13-p2-01-ingredients-and-recipes/`. El resto está en `openspec/changes/archive/2026-11-19-p2-*`. Las citas `p2-*` de este registro apuntan a esas carpetas.

## 1. Abiertas

### 1.1 Contador

La API v2 de Factus, revisada el 2026-10-17, lista facturas y notas crédito (`GET /v2/bills`, `GET /v2/credit-notes`) y descarga el XML y el PDF de cada una. No publica un reporte ni un archivo de importación para el software del contador. Por eso PA-10 sigue abierta: falta el formato que ese software ya usa.

| Código | Pregunta | Origen | Bloquea |
|--------|----------|--------|---------|
| PA-10 | Formato de exportación que ya usa el software del contador | PRD-M6 §9 | 4.2 |

### 1.3 Piloto

| Código | Pregunta | Origen | Bloquea |
|--------|----------|--------|---------|
| PA-27 | Costo por sede (documentos, certificado por NIT, hardware) contra las ventas. Aún no hay cifras; se responde cuando existan | Roadmap, Fase 0 | 4.3 |

### 1.4 Plataformas de domicilio

| Código | Pregunta | Origen | Bloquea |
|--------|----------|--------|---------|
| PA-28 | Acceso a las API de Rappi y DiDi Food, o cotización de un integrador (ADR-011) | PRD-M5 §9, TRD-M5, roadmap | 3.3, 3.4 |

### 1.5 Equipo y dueño del producto

El MVP es 100 % modo nube (D-37). Hay que responder las que bloquean la fundación o el salón de esa nube. El resto espera a su fase.

#### Hay que responderlas

Ninguna. PA-37 quedó cerrada el 2026-11-05 en D-48.

#### Pueden esperar

No frenan la fundación ni el salón. Se responden cuando arranque la entrega que bloquean.

| Código | Pregunta | Origen | Bloquea |
|--------|----------|--------|---------|
| PA-41 | Retención y archivo de la auditoría a largo plazo | openspec `p0-06` | Ninguna entrega |
| PA-48 | Si una reserva pagada en efectivo termina en conflicto, ¿la devolución se hace en efectivo o por transferencia? | PRD-M9, TRD-M9 | 3.7 |
| PA-38 | Pasarela de la suscripción | PRD-M7 §9, TRD-M7 | 4.3 |
| PA-39 | Precio por sede, y si la bolsa va incluida o aparte | PRD-M7 §9 | 4.3 |
| PA-40 | Con la sede suspendida, ¿se puede cerrar el servicio del día o solo consultar? | PRD-M7 §9 | 4.3 |
| PA-47 | ¿El backoffice de la plataforma (alta de clientes, suscripciones) es otra vista de `apps/admin-web` o un contenedor aparte? | PRD-M7 §6, TRD-M7 §5 | 4.3, 4.4 |
| PA-43 | Integración directa con cada datáfono (ADR-007) | TRD-00 §18, PRD-M2 §9 | 5.2 |
| PA-45 | Pasarela automática para reservas (ADR-012) | PRD-M9 §9 | 5.3 |
| PA-46 | Nombre comercial | README | Ninguna entrega |
| PA-29 | Mecanismo de HTTPS local para la PWA (ADR-003, spike) | TRD-00 §18, PRD-M0 §9 | Fase híbrida |
| PA-30 | Avisos al mesero con el celular bloqueado y sin internet (spike) | Roadmap 0.1, TRD-M1 | Fase híbrida |
| PA-44 | Bodega general operada desde la web para clientes pequeños (ADR-010). En el MVP la bodega del piloto opera en la nube (D-37). El nodo en modo bodega (D-04) espera a la fase híbrida | PRD-M4 §9, ADR-010 | Fase híbrida |
| PA-52 | En un corte de internet con la sede en modo nube, ¿qué pasa con el pedido QR? En el MVP el corte detiene la sede y no se construye la cola al reconectar (D-37) | openspec `p1-12`, TRD-M1 | Fase híbrida |

## 2. Decididas

| Código | Decisión | Fecha | Documentos que se alinearon |
|--------|----------|-------|------------------------------|
| D-01 | Anticipo de reserva: si la reserva entra por enlace, llamada o chat, solo transferencia verificada. Si el cliente la hace en persona en la sede, transferencia o efectivo | 2026-10-17 | PRD-00, PRD-M9, TRD-M9, flujo M9, roadmap 3.7, openspec `p3-07` |
| D-02 | Volver de híbrido a nube exige la outbox vacía, o que el administrador acepte de forma explícita lo que quede sin subir | 2026-10-17 | Roadmap 0.7, PRD-M0, TRD-00, openspec `p0-07` |
| D-03 | El SMS entra en la entrega 5.1, junto con WhatsApp y correo | 2026-10-17 | PRD-00, roadmap 5.1, openspec `p5-01` |
| D-04 | La bodega general del piloto opera con nodo propio en modo bodega. Operarla desde la web sigue abierto para clientes pequeños (PA-44) | 2026-10-17 | PRD-00, PRD-M4, TRD-M4, roadmap 2.5, openspec `p2-05` |
| D-05 | El panel de soporte es una vista de la web de administración, con permisos de soporte | 2026-10-17 | C4 de contenedores, PRD-M7, TRD-M7, openspec `p4-05` |
| D-07 | Sincronización por dueño único, separación de clientes con RLS, impresión por nodo o puente, inventario como libro de movimientos y auditoría encadenada por hash pasan de propuesta a decididos | 2026-10-17 | TRD-00 §1 |
| D-08 | El efectivo de una reserva solo se recibe con un turno de caja abierto. Si una reserva provisional pagada en efectivo termina en conflicto, quien la resuelve decide si se confirma o se devuelve | 2026-10-17 | PRD-M9, TRD-M9, TRD-M2, openspec `p3-07` |
| D-06 | Código y nombres en inglés, según el [glosario](glosario-codigo.md). Los documentos siguen en español | 2026-10-17 | TRD-00 §14 y §16, ADR-017, ADR-018, TRD y C4 de M0 a M9, openspec |
| D-07 | Toda venta es factura electrónica de venta. Sin datos del cliente va a consumidor final (cédula tipo `13`, número `222222222222`). No se usa el documento equivalente POS | 2026-10-17 | PRD-00, TRD-00 §8, roadmap 1.5, openspec `p1-04` y `p1-05` |
| D-08 | La propina voluntaria va en la factura como recargo y queda fuera de la base gravable. El domicilio que cobra el restaurante y cualquier cargo obligatorio sí entran en la base | 2026-10-17 | PRD-00 §7.1, TRD-00 §8.2, roadmap 1.4 |
| D-09 | El perfil fiscal se elige al configurar el contribuyente. El catálogo trae restaurante independiente (INC 8 %) y franquicia (IVA 19 %). La segmentación de la DIAN por tamaño de patrimonio no define el impuesto del plato | 2026-10-17 | PRD-00 §7.1, TRD-00 §8.6 y ADR-009, PRD-M3, openspec `p0-03` y `p1-04` |
| D-10 | Sin internet se imprime un comprobante que dice que no es factura electrónica ni documento equivalente, con un QR de consulta. La factura se emite al reconectar. No se pide rango de contingencia en papel | 2026-10-17 | PRD-00, TRD-00 §8.3, roadmap 1.5 y 1.6, openspec `p1-05` y `p1-06` |
| D-11 | Cambiar una factura de consumidor final se hace con nota crédito de anulación (código `2`) y una factura nueva. Por defecto, el mismo día; como máximo, el mismo mes. La nota explica la anulación y la factura nueva cita el número anulado | 2026-10-17 | PRD-00 regla 10, TRD-00 §8.5, PRD-M3, roadmap 1.8, openspec `p1-08` |
| D-12 | El anticipo que se abona a la cuenta no se factura solo: viaja en la factura del servicio. El monto retenido por cancelación o no llegada es un ingreso distinto y, si se factura, usa la clasificación configurada para ese concepto, no la del menú | 2026-10-17 | PRD-00, TRD-00 §6.2, PRD-M9, TRD-M9, roadmap 3.7, openspec `p3-07` |
| D-13 | En un pedido de plataforma, el restaurante emite la factura de la comida al cliente o a consumidor final, con la dirección de entrega. La comisión la factura la plataforma al restaurante y no entra a este sistema. La conciliación muestra venta bruta, comisión, retenciones y neto | 2026-10-17 | PRD-00, TRD-00 §6.1, PRD-M5, roadmap 3.1 a 3.5, openspec `p3-01`, `p3-02` y `p3-05` |
| D-14 | No se reciben facturas de proveedores ni se emite documento soporte. Factus se usa para las ventas del local. La compra se registra como orden y recepción | 2026-10-17 | PRD-00, TRD-00 §8.2, PRD-M3, PRD-M4, TRD-M4, C4 M4, flujo M3 y M4, roadmap 2.3, openspec `p2-03` |
| D-15 | El costo del insumo se guarda al valor registrado en la recepción, sin separar el IVA de la compra | 2026-10-17 | PRD-M4, TRD-M4, roadmap 2.3, openspec `p2-03` |
| D-16 | La bolsa de Factus se compra para un NIT o para repartir entre varios. Al repartirla, cada NIT recibe un cupo. El saldo de esa cuenta se consulta con `GET /v2/subscriptions`. El sistema muestra la suma de los cupos de la empresa y concilia cada NIT con su saldo. El certificado de la bolsa repartida cuesta $130.000 al año por NIT | 2026-10-17 | PRD-00, TRD-00, PRD-M3, PRD-M7, TRD-M3, TRD-M7, flujo M7, C4 M7, roadmap 1.5, 4.3 y 4.5, openspec `p1-05`, `p4-03` y `p4-05` |
| D-17 | La fecha oficial de la factura es la de la validación (`validated_at`). `POST /v2/bills/validate` no trae la fecha de la venta. `SalesDocument` guarda la de la venta y la de la validación | 2026-10-17 | TRD-00 §8.3, TRD-M3, roadmap 1.5 y 4.2, openspec `p1-05` |
| D-18 | Tarifario Factus 2026, anual y por adelantado. Bolsa multifacturador, repartible entre NIT y sin certificado: de 10.000 documentos a $630.000 hasta 1.000.000 a $21.000.000. Paquete de un NIT: de 150 a $169.000 hasta 120.000 a $2.160.000. El precio que cobramos al restaurante sigue en PA-39. Tablas en TRD-00 §8.2 | 2026-10-17 | PRD-00, TRD-00, TRD-M3, TRD-M7, roadmap 4.3, openspec `p4-03` |
| D-19 | La cola deja un solo `POST /v2/bills/validate` en vuelo por `numbering_range_id`. Rangos distintos del mismo NIT pueden salir en paralelo, dentro de las 80 solicitudes por minuto | 2026-10-17 | TRD-00 §8.3, TRD-M3, openspec `p1-05` |
| D-20 | Las credenciales del sandbox compartido ya están en poder del equipo. No se escriben en el repositorio ni en los documentos | 2026-10-17 | TRD-00 §19, roadmap fase 0, openspec `p1-04` y `p1-05` |
| D-21 | `GET /v2/dian/acquirer` no consume documentos de la bolsa. Sigue contando dentro de las 80 solicitudes por minuto del NIT | 2026-10-17 | TRD-00 §8.2 y §8.5, roadmap 1.8, openspec `p1-08` |
| D-22 | En el piloto ninguna sede cobra en la barra. El bartender puede cobrar si la sede le activa ese permiso, y en el piloto empieza apagado | 2026-10-17 | PRD-01, PRD-M1, openspec `p0-05` |
| D-23 | Ninguna sede del piloto exige aceptación en caja del pedido QR al arrancar. El pedido sale directo a cocina. La opción por sede se construye y empieza apagada | 2026-10-17 | PRD-M1, TRD-M1, openspec `p1-12` |
| D-24 | Cada sede elige el reparto de propinas: la misma parte para cada persona que trabajó, o un porcentaje por empleado. Los porcentajes son datos de la sede. No hay un porcentaje fijo por rol | 2026-10-17 | PRD-00, PRD-M2, openspec `p1-10` |
| D-25 | El internet lo contrata cada sede. La mayoría ya tiene un proveedor. Si una sede no tiene, se le recomienda uno. El producto no incluye ese contrato | 2026-10-17 | PRD-00 |
| D-26 | El costo de lo producido es configurable por empresa: promedio de los insumos consumidos, o costo estándar | 2026-10-17 | PRD-00, TRD-00 §9, PRD-M4, TRD-M4, flujo M4, roadmap 2.4, openspec `p2-04` |
| D-27 | Un traslado mueve el costo del origen tal cual. No le suma flete, margen ni ningún otro valor | 2026-10-17 | PRD-00, TRD-00 §9, PRD-M4, TRD-M4, flujo M4, roadmap 2.5, openspec `p2-05` |
| D-28 | Un ajuste por conteo por encima del tope necesita aprobación. El tope es configurable por empresa, cada sede lo puede bajar, y el predeterminado es $1.000 | 2026-10-17 | PRD-00, PRD-01 §7, TRD-00 §9, PRD-M4, TRD-M4, flujo M4, roadmap 2.6, openspec `p2-06` |
| D-29 | Cada sede enciende o apaga el impuesto a las bolsas en los domicilios | 2026-10-17 | PRD-00 §7.1, TRD-00 §8.6, PRD-M3, TRD-M3, PRD-M5, TRD-M5, flujo M5, roadmap 3.1, openspec `p3-01` |
| D-30 | Los topes predeterminados de PRD-01 §7 se adoptan. En cada sede, quien autoriza es el administrador de la sede. Si en el turno esa persona es la única con permiso de autorizar, aplica la autoautorización: queda marcada y genera alerta | 2026-10-17 | PRD-01, PRD-M0, openspec `p0-05` y `p1-07` |
| D-31 | Los umbrales de ejemplo de PRD-01 §11 son el valor inicial. Cada sede puede cambiarlos | 2026-10-17 | PRD-01, PRD-M6, openspec `p1-07` y `p1-11` |
| D-32 | El sistema calcula métricas de consumo y sugiere mínimo, punto de reposición y máximo. La sede puede aceptar la sugerencia o escribir los valores | 2026-10-17 | PRD-M4, TRD-00 §9.4, openspec `p2-08` |
| D-33 | El servicio no empieza sin al menos un cajero con entrada marcada. El cajero permanece en caja. La tolerancia de tardanza se configura por sede | 2026-10-17 | PRD-M8, openspec `p1-09` |
| D-34 | Cada sede configura el cobro de la reserva: $0, anticipo que se abona a la cuenta y retiene un porcentaje si cancelan, o tarifa no reembolsable. Las cuentas de recaudo son datos de la sede | 2026-10-17 | PRD-00, PRD-M9, openspec `p3-06` y `p3-07` |
| D-35 | Al inicio no hay plataformas, volúmenes, comisiones ni gerentes de cuenta del piloto. Las entregas 3.2 a 3.5 se construyen con adaptadores y datos de prueba. Los accesos reales siguen en PA-28 | 2026-10-17 | PRD-00, PRD-M5, openspec `p3-02`, `p3-03` y `p3-05` |
| D-36 | El router dedicado y el módem 4G se recomiendan. Los compra el dueño de la sede. El producto es solo software | 2026-10-17 | PRD-00, PRD-M0, TRD-00, TRD-M0, roadmap 0.1 y 0.7, openspec `p0-01`, `p0-07` y `p1-14` |
| D-37 | El MVP se construye y opera 100 % en modo nube. No hay nodo de operación, ni sincronización, ni operación durante un corte. El híbrido sigue en el alcance y empieza cuando la nube ya opera: nodo, outbox, HTTPS local (PA-29), avisos sin internet (PA-30), emisión diferida y comprobante de corte (D-10), cola de pedidos y pagos QR al reconectar (PA-52), resiliencia del nodo (0.7) y bodega con nodo (D-04). Hasta entonces un corte detiene la sede. La impresión sí entra: el puente recibe el trabajo de la nube y lo manda a la impresora, sin guardar la operación. La bodega del piloto también opera en la nube | 2026-10-17 | PRD-00, TRD-00, roadmap, openspec índice y `p0-01` |
| D-38 | El segundo factor lo configura el administrador: puede exigirlo a todos o solo a quienes marque. Quien no lo tenga exigido puede activarlo igual | 2026-10-17 | PRD-M0, TRD-00 §10.1, infraestructura, openspec `p0-04` |
| D-39 | Terraform sigue con módulos para AWS, GCP y Azure. El primer ensayo corre en AWS o en GCP. Azure no arranca ese ensayo | 2026-10-17 | TRD-00, TRD-01, roadmap 0.8, openspec `p0-08` |
| D-40 | Las PWA del MVP se publican como archivos estáticos en la nube y el navegador las instala. No hay tienda de aplicaciones. Servirlas desde el nodo queda en la fase híbrida | 2026-10-17 | TRD-01, infraestructura, roadmap 0.8, openspec `p0-08` |
| D-41 | Sentry se usa como servicio, en el plan gratuito, al inicio. No se aloja en nuestra nube | 2026-10-17 | TRD-00, TRD-01, roadmap 0.9 |
| D-42 | La nota crédito de una refacturación la aprueba administración. Aprobada, se emite. No sale sola | 2026-10-17 | TRD-00 §8.5, PRD-M3, PRD-01, openspec `p1-08` |
| D-43 | En una sede en nube sin equipo local, la marcación cuenta si la ubicación del dispositivo coincide con la del local. Si no coincide, queda como sospechosa y no habilita la operación. Con «sin entrada no opera» activa, esa persona no opera hasta que un administrador la corrija | 2026-10-17 | PRD-M8, TRD-00 §10.4 |
| D-44 | Se puede pagar por QR con el turno de caja cerrado si ese cobro está activo. El pago no modifica el turno cerrado: queda contra el reporte de la pasarela. El domicilio puede seguir con su QR activo aunque el salón cierre | 2026-10-17 | PRD-00, PRD-M2, TRD-00, openspec `p1-13` |
| D-45 | El pipeline es GitHub Actions, en el repositorio que ya está en GitHub. Llega a las nubes con identidad de corta duración | 2026-10-17 | TRD-00, TRD-01, roadmap 0.8, openspec `p0-08` |
| D-46 | El pago QR admite varias pasarelas detrás de `PaymentGateway`. Bold es una de ellas. La sede activa la que contrató. La comisión es la de ese contrato y se ve en la conciliación. Los medios son los que ofrezca ese adaptador, dentro de Nequi, Daviplata, Bre-B y tarjeta | 2026-10-17 | PRD-00, PRD-M2, TRD-00, TRD-M2, openspec `p1-13` |
| D-47 | El correo, el SMS y WhatsApp no salen del servicio nativo de AWS, GCP ni Azure. GCP no tiene correo ni SMS propios, y WhatsApp no lo da ninguna de las tres. El proveedor concreto es Twilio (D-48) | 2026-10-17 | TRD-00, PRD-M3, C4 |
| D-48 | El correo, el SMS y WhatsApp salen por Twilio. El correo usa SendGrid. El código de un solo uso lo genera el sistema y Twilio solo lo entrega; no se usa Twilio Verify. Bird queda como alternativa si el registro del remitente SMS en Colombia no sale. No es el servicio nativo de la nube (D-47). El mismo proveedor cubre el portal (1.8) y los avisos (5.1) | 2026-11-05 | PRD-M3, C4, roadmap 1.8 y 5.1, openspec `p1-08` y `p5-01` |
| D-49 | El conteo de inventario es a ciegas, como el arqueo (PA-42). Quien cuenta ve los insumos y la unidad. El saldo teórico no aparece antes de enviar. La diferencia queda en la respuesta del conteo y en la aprobación. Un conteo total usa los insumos movidos en esa ubicación hasta el corte; uno por categoría, la intersección con la clasificación | 2026-11-15 | PRD-M4, roadmap 2.6, openspec `p2-06` |
