# Roadmap · Entregas por fase

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.4 |
| Fecha | 2026-10-15 |
| Hereda de | [PRD-00](prd/PRD-00-vision-producto.md), sección 11 · [TRD-00](trd/TRD-00-arquitectura-base.md) |

## 1. Cómo se usa

PRD-00 y TRD-00 son el **requerimiento general** y definen el **alcance mínimo** del producto: todo lo que describen se construye. Este documento no recorta nada; lo reparte en **entregas pequeñas**, cada una con un alcance cerrado y un criterio de salida que se puede comprobar.

- No hay tiempo límite. Una entrega empieza cuando la anterior cumple su criterio de salida, y se hace completa antes de pasar a la siguiente.
- Todas las fases están partidas desde ahora. Con lo que se aprenda en cada entrega se puede **reordenar o dividir** las que siguen, pero no quitarles alcance.
- Lo que PRD-00 deja **fuera de alcance** (nómina, contabilidad completa, ser proveedor tecnológico DIAN, fidelización) no está en este roadmap.

### Ciclo de cada entrega

1. **Definir**: un PRD con la [plantilla de módulo](plantillas/PRD-modulo.md), limitado al alcance de la entrega, y un TRD si hay decisiones técnicas nuevas.
2. **Construir** lo que dice ese PRD.
3. **Validar** contra el criterio de salida, en la sede o con datos reales.
4. **Ajustar**: lo aprendido se lleva a PRD-00 y TRD-00 (primero se cambia el maestro) y se revisan las entregas que siguen.

### Estados de una entrega

`Pendiente` → `En definición` → `En construcción` → `En validación` → `Cerrada`

## 2. Fase 0 · Fundación

| Entrega | Alcance | Criterio de salida | Estado |
|---------|---------|--------------------|--------|
| **0.1 Spikes de riesgo** | HTTPS local para la PWA en Android y iPhone (ADR-003). Avisos al mesero con el celular bloqueado y sin internet. Impresión ESC/POS en las impresoras del piloto, con apertura del cajón monedero. Carga de SQLite en hora pico | Informe con las decisiones de ADR-003 y ADR-006, y la solución para los avisos con el celular bloqueado | Pendiente |
| **0.2 Esqueleto y sincronización** | Monorepo y una sola API. En modo nube corre en el centro. Si la sede activa el híbrido, el mismo servicio corre en el nodo con outbox, inbox, cursores, lotes comprimidos y reanudables, prioridad de envío y reloj del nodo como referencia | Una sede en nube opera sin nodo. Al activar híbrido, un evento creado sin internet llega a la nube después de 2 h desconectado, sin duplicarse y en orden | Pendiente |
| **0.3 Organización** | Empresa, contribuyentes con perfil fiscal, marcas, sedes, estaciones de cocina, cajas, bodegas y modo de cada sede (nube o híbrido) | La estructura completa del piloto (6 sedes, sus NIT y bodegas) queda cargada. Cada sede opera en nube; al activar híbrido, esa estructura llega a su nodo | Pendiente |
| **0.4 Identidad y dispositivos** | Sesión de administración con segundo factor, PIN personal, registro de dispositivos con QR, celulares personales, revocación inmediata, protección del nodo en una red Wi-Fi compartida | Un celular no registrado en la red de la sede no puede usar el nodo ni imprimir; uno revocado deja de operar al instante | Pendiente |
| **0.5 Roles y permisos** | Todo [PRD-01](prd/PRD-01-roles-y-permisos.md): roles predefinidos y personalizados, matriz de permisos, topes, ajustes por sede, autorización de supervisor con PIN, acceso de soporte con vencimiento | Cada permiso de la matriz se prueba con un caso automático, y nadie puede darse más privilegios de los que tiene | Pendiente |
| **0.6 Auditoría** | Eventos que solo se agregan, cadena de hash, detección de alteraciones en la nube | Alterar o borrar un evento en un nodo se detecta en la nube | Pendiente |
| **0.7 Resiliencia del híbrido** | Solo para sedes con híbrido activo: UPS y reinicio automático, restauración con equipo de repuesto, relevo a la nube si el nodo falla (ADR-004), reintentos de sincronización y módem 4G de respaldo, recomendado en todas las sedes (ADR-008), actualización de nodos por etapas con vuelta atrás | Restauración en menos de 30 minutos. Un corte de 2 horas no pierde pedidos del salón; al reconectar salen las facturas pendientes y entran los pedidos y pagos QR que quedaron en la nube. Volver a modo nube exige que no quede nada sin subir | Pendiente |
| **0.8 Infraestructura y despliegue continuo** | Todo [TRD-01](trd/TRD-01-infraestructura-y-operacion.md), secciones 3 a 6: Terraform con módulos para AWS, GCP y Azure, puertos de archivos y secretos, ambientes local, staging y producción, pipeline con vuelta atrás automática, compatibilidad con nodos de la versión anterior, escalado de la API y de los workers, respaldo en otra nube | Staging se levanta desde cero con Terraform en las tres nubes y pasa las pruebas de humo. Un cambio en la rama principal llega a staging sin pasos manuales, y uno con un error provocado vuelve solo a la versión anterior | Pendiente |
| **0.9 Monitoreo y errores** | TRD-01, secciones 7 y 8: OpenTelemetry hacia Grafana Cloud, catálogo de métricas (sede, facturas, nube, despliegue), telemetría del nodo con prioridad baja, tableros y alarmas de Grafana como código, Sentry en la nube, el nodo y las PWA con envío diferido y sin datos personales (ADR-013, ADR-014) | Un nodo desconectado aparece en Grafana y dispara su alarma; una factura pendiente de más de 30 minutos también; un error en una PWA sin internet llega a Sentry al reconectar, sin datos personales; en una prueba de carga los workers suben y bajan sin pasar el límite de Factus por NIT | Pendiente |

Tareas sin desarrollo que arrancan en esta fase porque tardan:

- Credenciales del sandbox de Factus y respuesta a las preguntas de TRD-00, sección 8.4.
- Trámite de acceso a las API de Rappi y DiDi Food, y cotización de un integrador (ADR-011).
- Validación con el contador del enfoque de facturación, la emisión diferida sin contingencia, la refacturación y los perfiles de impuestos (TRD-00, 8.4).
- Estimación del costo por sede (documentos de Factus, certificado por NIT, kit de hardware) contra las ventas del piloto.

## 3. Fase 1 · Salón en 1 sede

| Entrega | Alcance | Criterio de salida | Estado |
|---------|---------|--------------------|--------|
| **1.1 Menú y catálogo** | Menú por marca, productos, variantes, modificadores con y sin costo, combos, clasificación tributaria, precios, disponibilidad y horarios por sede | El menú completo de la sede piloto queda cargado y se ve en el celular del mesero | Pendiente |
| **1.2 Salón y cocina** | Plano de mesas y sus estados, toma de pedido en el celular o punto fijo, envío por tiempos, reenvío, enrutamiento por estación, pantalla de cocina con semáforo, impresora de comandas, avisos de "listo", mover y unir mesas, transferir productos. Captura de todos los tiempos de la sección 8.1 | En un servicio de prueba, los pedidos llegan a cocina en menos de 2 s (p90) y un pedido de 4 productos se toma en menos de 30 s | Pendiente |
| **1.3 Caja** | Turnos con apertura, cierre parcial y cierre final. Todos los medios de pago: efectivo, tarjeta registrada por datáfono, transferencias y billeteras, bonos y vales, crédito a cliente o cuenta corporativa. Pagos mixtos, división de cuenta, ingresos, egresos, retiros, arqueo a ciegas por denominación y medio, comparación con el cierre de cada datáfono, cierre inmutable | Un turno de ensayo con todos los medios de pago cuadra contra lo contado | Pendiente |
| **1.4 Motor de impuestos** | Todos los regímenes de PRD-00, sección 7.1: perfiles fiscales, reglas con vigencia, INC, IVA, exentos y excluidos, bolsas plásticas, ultraprocesados, retenciones de clientes corporativos, perfiles predefinidos | La tabla de casos por régimen, validada por el contador, pasa como pruebas automáticas y coincide con Factus en el sandbox | Pendiente |
| **1.5 Factura electrónica** | Factus, factura a consumidor final y a cédula o NIT con autocompletado desde la DIAN, numeración por sede o caja, propina como recargo, emisión diferida sin internet, verificación de envíos inciertos, notas crédito, contador de consumo de la bolsa con alerta de saldo | Facturas aceptadas en el sandbox y en producción, incluido un corte de internet a mitad de un envío sin facturas duplicadas | Pendiente |
| **1.6 Impresión** | Todas las plantillas (comanda, precuenta, factura con QR y CUFE, comprobante sin internet, cierre de caja, traslado, propinas), cola con reintentos, impresora de respaldo, reimpresión auditada, cajón monedero | Todas las plantillas impresas correctamente en las impresoras reales del piloto, en 80 y 58 mm | Pendiente |
| **1.7 Controles antirrobo** | Autorización con PIN en todas las acciones sensibles (anular, descontar, cortesía, reabrir cuenta, abrir el cajón sin venta, cambiar precio), reportes de control de la sección 8.4 y alertas de comportamiento inusual | Cada acción sensible sin autorización queda bloqueada, y las autorizadas aparecen en los reportes de control | Pendiente |
| **1.8 Portal de facturación** | QR en la precuenta y en el comprobante, autocompletado con datos enmascarados, "recordar mis datos" con código de un solo uso, Ley 1581, consulta de facturas, refacturación con nota crédito | Facturas a nombre del cliente emitidas sin digitar datos en la caja, y nadie ve datos de otra persona con solo escribir su cédula | Pendiente |
| **1.9 Asistencia** | Marcación de entrada, salida y pausas con PIN, solo dentro del local. Modo solo horas y modo con horario programado. Regla "sin entrada no opera", cierre automático, correcciones auditadas, reportes y exportación a Excel | Una semana real de marcaciones del personal de la sede, con sus reportes de horas, tardanzas y ausencias | Pendiente |
| **1.10 Propinas** | Fondo común por turno, día o semana, reparto equitativo, porcentaje por persona o rol, reparto por horas trabajadas, liquidación imprimible e inmutable | Liquidación de propinas de una semana real, firmada por el personal | Pendiente |
| **1.11 Reportes de la sede** | Reportes de ventas (8.2), tiempos (8.1), caja y horas trabajadas (8.5), en el nodo para el día y en la nube para el histórico | El administrador revisa la operación del día en el nodo durante un corte, y la histórica desde la web | Pendiente |
| **1.12 Pedido por QR en la mesa** | QR fijo por mesa, carta en el celular del cliente, alta o suma a la cuenta, enrutamiento a cocina con canal QR mesa, aceptación en caja opcional, cola en la nube durante un corte | En un servicio de prueba, un cliente pide desde su celular y el plato llega a la estación correcta. Un pedido enviado durante un corte entra a cocina al reconectar, sin duplicarse | Pendiente |
| **1.13 Pago por QR en la mesa** | Saldo y propina en el mismo portal, cobro por el monto exacto vía pasarela (ADR-016), confirmación por webhook, factura al confirmar, conciliación contra el reporte de la pasarela. El pago hecho durante un corte se aplica al reconectar | Un cliente paga la cuenta desde el QR, la pasarela confirma una sola vez, sale la factura y la mesa queda por limpiar. El arqueo separa ese dinero del efectivo | Pendiente |
| **1.14 Salida a producción** | Visita técnica, kit de hardware, ensayo de un servicio con un corte de internet a mitad, capacitación del personal | La sede opera 2 semanas seguidas solo con el sistema, con documentos DIAN aceptados, al menos un servicio con pedidos y pagos QR, y el personal marcando asistencia | Pendiente |

## 4. Fase 2 · Inventario (6 sedes)

| Entrega | Alcance | Criterio de salida | Estado |
|---------|---------|--------------------|--------|
| **2.1 Insumos y recetas** | Insumos con unidades de compra, inventario y receta. Recetas por producto y variante, sub-recetas, rendimiento, ajuste por modificadores, versionado, importación desde Excel | Las recetas de la sede piloto cargadas, con su costo teórico y margen por plato | Pendiente |
| **2.2 Descuento por venta** | Consumo al enviar a cocina, devolución si se anula antes de empezar, merma si se anula después, inventario negativo con alerta | El consumo teórico de un servicio coincide con las recetas de lo vendido | Pendiente |
| **2.3 Compras** | Proveedores, órdenes de compra, recepción a costo real, costo promedio, documento soporte por Factus, recepción de facturas electrónicas de proveedores | Una semana de compras reales registradas, incluidas las de proveedores que no facturan | Pendiente |
| **2.4 Producción** | Preparaciones intermedias que consumen ingredientes y generan stock propio | Las preparaciones de la sede piloto se registran y descuentan bien | Pendiente |
| **2.5 Bodegas y traslados** | Bodega de la sede, bodega general con nodo en modo bodega (ADR-010), traslados con todos sus estados, QR en el comprobante de despacho, traslados entre sedes, reabastecimiento con sugerencia por stock mínimo | Un ciclo completo de reabastecimiento desde la bodega general, con una sede sin internet en el momento de recibir | Pendiente |
| **2.6 Mermas y conteos** | Mermas y bajas con motivo, conteos totales o por categoría, ajuste contra el inventario teórico | Un conteo físico completo con su diferencia contra el teórico | Pendiente |
| **2.7 Cuánto se puede producir** | Unidades posibles con el punto y con reabastecimiento, ingrediente limitante, disponibilidad automática en el menú del mesero | El menú del mesero marca agotado y pocas unidades en tiempo real | Pendiente |
| **2.8 Alerta temprana de escasez** | Niveles por insumo y ubicación, alerta por cobertura, alerta de platos, niveles sugeridos, notificación por rol, escalamiento, reabastecimiento u orden de compra con un toque | Las alertas se disparan antes de quedarse sin producto en al menos un caso real | Pendiente |
| **2.9 No se repone hoy** | Propuesta del sistema, confirmación de cocina o administración, aviso al mesero, salida de la cola, confirmación de cliente avisado | Un plato marcado sale del menú y los meseros afectados reciben el aviso al instante | Pendiente |
| **2.10 Reportes de inventario** | Reportes de costos e inventario de la sección 8.3 | El administrador ve el costo de alimentos y la diferencia entre teórico y real por sede | Pendiente |
| **2.11 Despliegue en 6 sedes** | Visita técnica, hardware, carga de datos y capacitación en las 5 sedes restantes | Diferencia entre inventario teórico y real medida en al menos 3 sedes durante 1 mes | Pendiente |

## 5. Fase 3 · Domicilios y reservas

| Entrega | Alcance | Criterio de salida | Estado |
|---------|---------|--------------------|--------|
| **3.1 Domicilio propio** | Pedido con cliente y dirección, canales teléfono, WhatsApp y mostrador, PWA del domiciliario, despacho, entrega, cobro contra entrega, conciliación del domiciliario, dirección en la factura, impuesto de bolsas | Una semana de domicilios propios de una sede, con tiempos por etapa | Pendiente |
| **3.2 Hub de plataformas y captura manual** | Hub de integraciones, adaptador manual, menú y precio por canal, mapeo de productos, aceptación automática configurable | Los pedidos de todas las plataformas de una sede entran por una sola pantalla, aunque sea a mano | Pendiente |
| **3.3 Conector Rappi** | Recepción automática, estados, menú, disponibilidad, pausa de tienda, cancelaciones | Pedidos reales de Rappi entran sin digitarlos | Pendiente |
| **3.4 Conector DiDi Food** | Igual que Rappi, o por medio del integrador (ADR-011) | Pedidos reales de DiDi Food entran sin digitarlos | Pendiente |
| **3.5 Conciliación de plataformas** | Comisiones, importación de liquidaciones, diferencias, rentabilidad por canal | Una liquidación real conciliada, con sus diferencias alertadas | Pendiente |
| **3.6 Reservas** | Registro por el personal, disponibilidad por franja, mesas reservables, reservas en el plano, estados, reservas provisionales sin internet | Una semana de reservas de una sede manejadas en el sistema | Pendiente |
| **3.7 Cobro de reservas** | Políticas por sede, franja y grupo, anticipo y tarifa, transferencia con verificación, número de transacción único, anticipo en la factura, devoluciones por tramos | Reservas con anticipo cobradas y abonadas a la cuenta, y una cancelación con devolución parcial | Pendiente |
| **3.8 Enlace público de reservas** | Reserva desde un enlace por sede, con la política visible | Reservas reales creadas por clientes desde el enlace | Pendiente |
| **3.9 Reportes de domicilios y reservas** | Tiempos de domicilio y plataformas, ventas por canal (8.2) y reportes de reservas (8.6) | Tiempos y comisiones medidos en al menos 1 sede | Pendiente |

## 6. Fase 4 · Comercial

| Entrega | Alcance | Criterio de salida | Estado |
|---------|---------|--------------------|--------|
| **4.1 Reportes consolidados** | Vista de toda la empresa, ingeniería de menú, percentiles por dimensión, alertas en la nube | El gerente general ve las 6 sedes consolidadas | Pendiente |
| **4.2 Información para el contador** | Resumen mensual de facturas, reportes de impuestos por contribuyente, exportaciones contables | El contador del piloto cierra un mes con las exportaciones del sistema | Pendiente |
| **4.3 Planes y suscripción** | Planes y precio por sede, cobro de la suscripción, suspensión, periodo de gracia, cobro de la bolsa de documentos | Una suscripción de prueba pasa por cobro, falta de pago, gracia y suspensión | Pendiente |
| **4.4 Alta de clientes** | Configuración guiada, activación de cada NIT en Factus, carga inicial de menú, recetas e insumos, perfiles fiscales predefinidos | Una empresa de prueba queda lista para facturar siguiendo solo la configuración guiada | Pendiente |
| **4.5 Panel de soporte** | Estado de los nodos, sincronización, facturas pendientes, señales para negociar con Factus, acceso de soporte | Soporte diagnostica una sede sin pedir acceso remoto al equipo | Pendiente |
| **4.6 Primer cliente nuevo** | Un restaurante que no es del piloto | Se configura sin desarrollo a la medida | Pendiente |

## 7. Fase 5 · Integraciones y canales

Lo que PRD-00 y TRD-00 marcan como "fase posterior" o "mejora futura".

| Entrega | Alcance | Criterio de salida | Estado |
|---------|---------|--------------------|--------|
| **5.1 Notificaciones por WhatsApp y correo** | Alertas de escasez y de saldo, confirmación y recordatorio de reservas, envío de la factura por WhatsApp | Los avisos llegan por el canal configurado en cada sede | Pendiente |
| **5.2 Integración con datáfonos** | Monto enviado al datáfono y aprobación de vuelta, para Credibanco, Bold y Redeban según lo que ofrezca cada uno (ADR-007) | Pagos con tarjeta sin digitar el monto ni la aprobación | Pendiente |
| **5.3 Pasarela de pagos para reservas** | Cobro en línea con confirmación automática (ADR-012) | Reservas confirmadas sin verificación manual | Pendiente |
| **5.4 Foto al marcar asistencia** | Foto en la marcación para evitar que alguien marque por otro | Las marcaciones de una sede llevan su foto | Pendiente |
