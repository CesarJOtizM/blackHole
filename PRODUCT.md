# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

No hay un usuario principal único. Todas las audiencias de PRD-00 §4 forman parte del producto. La situación común es un grupo de restaurantes en Colombia, con una o varias marcas y sedes, durante el servicio y en la administración.

| Rol | Situación | Trabajo |
|-----|-----------|---------|
| Dueño / gerente general | Empresa, todas las sedes; celular o PC | Ver ventas, márgenes y alertas del grupo |
| Administrador de sede | Sede; celular o PC | Controlar caja, personal, inventario y tiempos de su sede |
| Cajero | Caja; PC o tablet con impresora | Cobrar rápido, emitir el documento DIAN y cerrar caja |
| Mesero | Salón; celular o punto de pedido fijo | Tomar pedidos, enviarlos a cocina y pedir la cuenta |
| Cocina | Cocina; pantalla (tablet o TV) e impresora de comandas | Ver qué preparar, en qué orden, y marcar lo listo |
| Bodeguero | Bodega o sede; celular o PC | Recibir compras, despachar traslados y hacer conteos |
| Domiciliario | Calle; celular | Ver pedidos asignados, la ruta y confirmar la entrega |
| Anfitrión | Entrada; tablet, celular o caja | Registrar reservas, recibir clientes y asignar mesa |
| Personal | Sede; dispositivo fijo o celular en la red del local | Marcar entrada y salida del turno |
| Contador | Externo; PC | Recibir reportes fiscales y exportaciones |
| Cliente en la mesa | Salón; su celular, datos propios o Wi-Fi de invitados | Ver la carta, pedir y pagar por el QR, y dejar datos de facturación |
| Soporte del SaaS | Plataforma; PC | Configurar clientes y diagnosticar problemas |

## Product Purpose

Software de operación para restaurantes, vendido por suscripción mensual por sede. Cubre el servicio completo: el pedido sale de la mesa, llega a cocina y a caja, la venta descuenta ingredientes según la receta, se emite el documento electrónico ante la DIAN y se imprime. Las acciones sensibles quedan auditadas.

Existe para que la venta no viva en papel, para que los faltantes de caja e inventario se puedan explicar, y para que un grupo con varias sedes y marcas vea la operación consolidada.

El éxito es que toda venta pase por el sistema, que el piloto opere primero en 1 sede y después en 6, y que el mismo producto se replique en otros restaurantes sin desarrollo a medida. El precio de la suscripción no está decidido (PA-39).

## Positioning

Cada venta de un restaurante en Colombia recorre el mismo camino: mesa (mesero o QR), cocina, caja, inventario por receta y factura electrónica de la DIAN vía Factus, con permiso y auditoría en lo sensible. La sede nace operando en la nube. El modo híbrido, activado por sede para seguir el servicio durante un corte, es parte del producto y se construye solo después de que esa nube opere (D-37). Una sede que nunca tiene internet queda fuera.

El primer cliente previsto es un grupo familiar con 6 restaurantes que mezcla sedes de la misma marca y de marcas distintas. Sirve para validar la operación real y conseguir referidos. No es un caso publicado ni un testimonio.

## Operating Context

- Servicio en sede: el mesero usa una PWA en su celular (Android o iPhone), dentro de la red del local. La cocina usa pantalla e impresora de comandas. La caja usa PC o tablet, impresora térmica y datáfono.
- El cliente no instala nada. El QR de la mesa abre el portal en su celular, con sus datos o el Wi-Fi de invitados. No entra a la red del personal como operador.
- El diseño asume que personal y clientes pueden compartir la red del local.
- Organización del cliente: empresa que paga, uno o varios contribuyentes (NIT), marcas, sedes, un inventario operativo por punto, y bodegas de sede o generales que reabastecen.
- Datáfonos del piloto: Credibanco, Bold y Redeban. En la fase actual el pago con tarjeta se registra; la integración directa sigue abierta (PA-43).
- El producto es solo software. El módem 4G y el router los compra el dueño de la sede (D-36).
- Las pantallas están dibujadas en `docs/design`. El código de las apps todavía es un marcador. `shared/ui` tiene un tema aparte, llamado Servicio, que no copia esas variables.

## Capabilities and Constraints

Confirmado en PRD-00 v0.14 y en las decisiones vigentes, incluida D-37, el 2026-11-10:

- Toda venta es factura electrónica de venta, emitida por Factus. Sin datos del cliente va a consumidor final. No se usa el documento equivalente POS ni una factura global.
- Menú y recetas pertenecen a la marca. Cada sede puede ajustar precios, disponibilidad y horarios. Hay un solo inventario operativo por punto.
- Acciones sensibles (anular, descontar, cortesía, reabrir, abrir el cajón sin venta, cambiar precio, ajustar inventario) exigen autorización y quedan en una auditoría inmutable.
- Ingreso del personal con PIN en dispositivos compartidos. Los celulares de los meseros se registran, no guardan datos del negocio y se pueden revocar.
- El cliente puede pedir y pagar desde el QR. No anula, no descuenta y no cambia precios. El pago QR entra cuando la pasarela confirma el dinero.
- Nómina y contabilidad completa están fuera. Se registran horas de entrada y salida. La contabilidad recibe exportaciones; el formato que ya usa el contador sigue abierto (PA-10).
- No somos proveedor tecnológico ante la DIAN. La integración es con Factus.
- El MVP es la operación en la nube, de punta a punta, incluida la bodega del piloto. El híbrido no se diseña ni se construye hasta que esa nube opere. Hasta entonces un corte detiene la sede.
- Código e identificadores en inglés. Documentos de producto en español (D-06).

Decisiones de producto que siguen abiertas y no se deben inventar:

- Nombre comercial (PA-46). El nombre de trabajo del repositorio es blackHole.
- Precio por sede y si la bolsa de documentos va incluida (PA-39).
- Pasarela de la suscripción (PA-38).
- Con la sede suspendida, si se puede cerrar el servicio del día o solo consultar (PA-40).
- Si el backoffice de alta de clientes y suscripciones es otra vista de `apps/admin-web` o un contenedor aparte (PA-47). El panel de soporte sí es una vista de la web de administración (D-05).
- Acceso real a las API de Rappi y DiDi Food, o un integrador (PA-28). Al inicio hay adaptadores y datos de prueba (D-35).
- Costo por sede del piloto: aún no hay cifras (PA-27).

## Brand Commitments

- Nombre de trabajo: blackHole.
- Nombre comercial: sin decidir (PA-46). No hay logo de marca comercial.
- Los cuatro archivos de `docs/design` son el diseño de interfaz vigente. Comparten las mismas variables: `ink`, `paper`, `sheet`, `stamp`, `go`, `hold`, `carbon` y `board`, con Atkinson Hyperlegible Next e IBM Plex Mono. No sustituyen el nombre comercial.

## Evidence on Hand

- Verdad de producto confirmada por el usuario a partir de [docs/prd/PRD-00-vision-producto.md](docs/prd/PRD-00-vision-producto.md) (v0.14) y de [docs/preguntas-abiertas.md](docs/preguntas-abiertas.md).
- Mapa documental en [docs/README.md](docs/README.md): PRD y TRD por módulo (M0–M9), roadmap, flujos y glosario de código.
Los dibujos de interfaz están en `docs/design`. Cada archivo corresponde a una superficie del producto. Las cuatro piezas usan el mismo juego de variables.

| Archivo | Superficie | Quién la usa | Qué cubre |
|---------|------------|--------------|-----------|
| [docs/design/venue-app.pen](docs/design/venue-app.pen) | `apps/venue-app` | Mesero, cocina, caja, bodega y anfitrión en la sede | Ingreso y salida del turno, mesa hasta la precuenta, acciones sensibles, cocina por estación, caja (turno, cobro, movimientos, arqueo, cierre, conciliación y propinas), inventario del punto, traslados y producción, domicilios de la sede, plataformas, reservas en la sede, impresión, y el corte de internet con la vuelta de híbrido a nube |
| [docs/design/admin-web.pen](docs/design/admin-web.pen) | `apps/admin-web` | Dueño, administrador de sede, contador y soporte | Acceso, estructura de la empresa, personas y roles, auditoría, carta y mesas, fiscal, inventario central, traslados, domicilios y canales, reportes, control del día, asistencia, reservas y su política, la empresa en la plataforma, bolsa de documentos, suspensión, y el modo híbrido |
| [docs/design/customer-portal.pen](docs/design/customer-portal.pen) | `apps/customer-portal` | Cliente en su celular, sin instalar nada | Pedir por el QR de la mesa, cuenta y pago, factura a su nombre, reserva pública con anticipo, pedido durante un corte, pagos no aprobados, y cancelar o cambiar la reserva |
| [docs/design/delivery-app.pen](docs/design/delivery-app.pen) | Sin paquete en `apps/` | Domiciliario | Acceso y jornada, entregar un pedido, y cierre de turno sin conexión |

El código no implementa esas pantallas. `apps/venue-app` solo tiene plano (`/`), cocina (`/kitchen`) y caja (`/cash-register`). `apps/admin-web` y `apps/customer-portal` tienen una ruta de inicio. No existe `apps/delivery-app`.

`shared/ui/src/theme.css` define el tema Servicio (superficie, tinta, acción, peligro, listo, estados de mesa y cocina, Atkinson Hyperlegible Next, Atkinson Hyperlegible Mono y Bricolage Grotesque). Esas variables no son las de los archivos de diseño.

No hay, y el trabajo futuro no debe fabricar: nombre comercial, precio, testimonios, casos publicados, prensa, logo de marca comercial, ni cifras del piloto.

## Product Principles

1. Toda venta pasa por el sistema, del pedido al documento de la DIAN, sin un paso en papel.
2. Lo sensible se autoriza y queda auditado. El inventario teórico sale de la receta y se puede contar contra lo real.
3. La sede nace en la nube. El híbrido es posterior y por sede, para un corte durante el servicio. Una sede sin internet permanente no es cliente.
4. El mismo producto sirve a un grupo con varias marcas, sedes y contribuyentes, sin desarrollo a medida.
5. Ningún rol de la operación es el usuario único. El producto tiene que servir el servicio completo.

## Accessibility & Inclusion

WCAG 2.2 AA.

Tiene que poder usarse en el celular del mesero (Android e iPhone, como PWA) y en la pantalla de cocina. El portal del cliente es web móvil, sin instalación. En dispositivos compartidos el ingreso del personal es por PIN. Los datos de facturación que vienen de la DIAN se muestran parcialmente ocultos.
