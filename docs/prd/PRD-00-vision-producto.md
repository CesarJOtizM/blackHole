# PRD-00 · Visión de producto

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.15 |
| Fecha | 2026-11-19 |
| Documento técnico asociado | [TRD-00 Arquitectura base](../trd/TRD-00-arquitectura-base.md) |
| Preguntas abiertas | [Registro](../preguntas-abiertas.md) |

## 1. Resumen

Construimos un software para restaurantes que se vende por suscripción mensual. Cubre toda la operación de un local: el mesero toma el pedido en su celular, el pedido llega a la cocina y a la caja, la venta descuenta ingredientes del inventario según la receta, se emite el documento electrónico ante la DIAN y se imprime en impresora térmica. Todo queda auditado para evitar robos en caja e inventario.

Cada sede tiene internet y **nace operando 100 % en la nube**: el mesero, la cocina y la caja hablan con el servidor central. Si esa sede necesita seguir el servicio durante un corte, se **activa el modo híbrido** y aparece un equipo en el local. Durante el corte, el mesero toma el pedido, la cocina lo prepara, la caja cobra y se imprime. Al volver la conexión se emiten las facturas pendientes y entran los pedidos y pagos que el cliente hizo desde el QR de la mesa. Una sede que nunca tiene internet queda fuera de este producto. El primer cliente es un grupo familiar con 6 restaurantes que mezcla sedes de la misma marca y de marcas distintas. Con ese piloto validamos el producto en operación real y conseguimos referidos para vender a otros restaurantes.

**Orden de construcción (D-37).** El MVP es esa operación en la nube, de punta a punta, incluida la bodega del piloto. El híbrido no se diseña ni se construye hasta que esa nube esté operando. Hasta entonces un corte detiene la sede: no hay cola de pedidos o pagos QR, ni emisión diferida, ni comprobante de corte. Esas reglas siguen en el producto y se construyen en la fase híbrida.

## 2. Problema

| Dolor | Consecuencia hoy |
|-------|------------------|
| Pedidos en papel o de palabra | Errores en cocina, platos que no se cobran, tiempos largos |
| Caja sin controles | Anulaciones y descuentos sin autorización, faltantes que no se explican |
| Inventario desconectado de las ventas | No se sabe cuánto debería haber, robos y mermas invisibles, compras a ciegas |
| Varias sedes y bodegas | Traslados sin registro, no hay una vista consolidada del grupo |
| Obligación de facturación electrónica | Doble digitación o multas si no se emite el documento |
| Internet inestable | Si el sistema depende de la nube en cada acción, un corte a mitad del servicio detiene el salón |

## 3. Objetivos

### Objetivos de producto

1. Que **toda venta pase por el sistema**: del pedido a la cocina, de ahí a la caja y al documento DIAN, sin pasos en papel.
2. Que **robar sea difícil y quede registrado**: toda acción sensible queda auditada y requiere permiso.
3. Saber **cuánto debería haber en inventario** (teórico) y compararlo con lo real.
4. Saber **qué se puede producir hoy** con el inventario existente.
5. Dar a la administración **métricas operativas** (tiempos, ticket promedio, márgenes) por sede y consolidadas.
6. **Poder activar, por sede, seguir el servicio durante un corte de internet** y, al reconectar, emitir lo pendiente y aplicar los pedidos y pagos QR que quedaron en la nube. En modo nube (el predeterminado) un corte detiene el salón. No se diseña una sede sin conexión permanente.

### Objetivos de negocio

1. Tener el piloto operando en 1 sede, después en las 6.
2. Tener un producto que se pueda replicar con otros clientes **sin desarrollo a la medida**.
3. Generar ingresos recurrentes por suscripción por sede.

### Fuera de alcance (por ahora)

- Nómina y liquidación laboral. **Sí** registramos las horas de entrada y salida de cada trabajador (M8), pero no calculamos salarios ni emitimos nómina electrónica.
- Contabilidad completa. Exportamos información para el software contable; no lo reemplazamos.
- Programas de fidelización (se evalúan después de la Fase 4).
- Ser proveedor tecnológico habilitado ante la DIAN. Nos integramos con **Factus**, que ya lo es.
- Una sede que no tiene internet y no va a tenerlo. El modo nube necesita enlace. El modo híbrido cubre los cortes durante el servicio, no una sede siempre desconectada.

## 4. Usuarios

| Rol | Dónde trabaja | Dispositivo principal | Lo que necesita |
|-----|---------------|-----------------------|-----------------|
| Dueño / gerente general | Empresa (todas las sedes) | Celular, PC | Ver ventas, márgenes y alertas de todo el grupo |
| Administrador de sede | Sede | Celular, PC | Controlar caja, personal, inventario y tiempos de su sede |
| Cajero | Caja de la sede | PC o tablet con impresora | Cobrar rápido, emitir el documento DIAN, cerrar caja |
| Mesero | Salón | **Celular** (o un punto de pedido fijo) | Tomar pedidos rápido, enviarlos a cocina, pedir la cuenta |
| Cocina (jefe y estaciones) | Cocina de la sede | Pantalla de cocina (tablet o TV) e impresora de comandas | Ver qué preparar, en qué orden, y marcar lo que está listo |
| Bodeguero | Bodega o sede | Celular, PC | Recibir compras, despachar traslados, hacer conteos |
| Domiciliario | Calle | Celular | Ver pedidos asignados, la ruta y confirmar la entrega |
| Anfitrión (puede ser el cajero o el administrador) | Entrada del local | Tablet, celular o caja | Registrar reservas, recibir a los clientes y asignarles mesa |
| Todo el personal | Sede | Dispositivo fijo de la sede o su celular en la red del local | Marcar entrada y salida de su turno |
| Contador | Externo | PC | Reportes fiscales y exportaciones |
| Cliente en la mesa | Salón | Su celular, con sus datos o el Wi-Fi de invitados | Ver la carta, pedir y pagar desde el QR de su mesa, y dejar sus datos de facturación |
| Soporte del SaaS (nosotros) | Plataforma | PC | Configurar clientes y diagnosticar problemas |

## 5. Modelo de la organización del cliente

Así se organiza un cliente dentro del sistema:

```
Empresa (cliente que paga la suscripción)
├── Contribuyentes (razones sociales con NIT y régimen tributario propio)
├── Marca A
│   ├── Sede 1 ── Inventario del punto ── Cocina (estaciones) ── Cajas ── Puntos de pedido
│   │        └── Bodega de la sede (opcional, p. ej. en el segundo piso)
│   └── Sede 2 ── Inventario del punto ── Cocina ── Cajas
├── Marca B
│   └── Sede 3 ── Inventario del punto ── Cocina ── Cajas
└── Bodega general de la empresa (opcional, abastece a varias sedes)
```

Reglas:

- Una empresa puede tener **varias marcas**, y una marca **varias sedes**.
- Una empresa puede tener **varios contribuyentes** (razones sociales con NIT distintos). Cada sede factura a nombre de **un** contribuyente, con su régimen tributario y su resolución DIAN.
- **El menú y las recetas pertenecen a la marca**. Las sedes de una misma marca los comparten, y cada sede puede ajustar precios, disponibilidad y horarios.
- **Cada sede tiene su propia cocina**, con una o varias estaciones de preparación (parrilla, fríos, bar…). Las estaciones sirven para enrutar los pedidos. **No tienen inventario propio.**
- **Cada sede tiene un solo inventario operativo: el del punto.** De él se descuentan todas las ventas de la sede, sean de cocina o de barra. No hay traslados internos entre cocina y barra.
- **Las bodegas son el almacenamiento desde el que se reabastece el punto.** Pueden ser:
  - **Bodega de la sede**: en el mismo local, por ejemplo en el segundo piso. Solo abastece a esa sede.
  - **Bodega general**: de la empresa, en otro sitio. Abastece a varias sedes.
- Los productos se mueven con **traslados**: de bodega a punto (reabastecimiento), de punto a bodega (devolución), entre bodegas y entre sedes.
- La empresa tiene una vista consolidada de todas sus marcas, sedes y bodegas.

## 6. Recorridos principales

### 6.1 Pedido en mesa (camino principal)

El mesero puede tomar el pedido, y el cliente también puede pedirlo y pagarlo desde el QR de su mesa (6.1.2 y 6.1.3). Los dos caminos terminan en la misma cuenta, la misma cocina y la misma factura.

1. El mesero abre la mesa en su celular e indica el número de comensales.
2. Agrega los productos con sus modificadores (por ejemplo "sin cebolla", "término medio") y notas.
3. Envía el pedido. **Cada producto llega a la estación de cocina que le corresponde** (pantalla, impresora o ambas), y el pedido queda visible en la caja.
4. La cocina marca cada producto como "en preparación" y luego "listo". El mesero recibe un aviso.
5. El mesero marca el pedido como entregado en la mesa.
6. El cliente pide la cuenta. Se imprime la precuenta, con la opción de dividirla. **La precuenta trae un QR** para que el cliente registre sus datos de facturación desde su celular, si quiere factura a su nombre (ver 6.1.1).
7. La caja cobra con uno o varios medios de pago y registra la propina.
8. Se emite la factura electrónica, con los datos del cliente si los registró o a consumidor final si no, y se imprime en la impresora térmica.
9. La mesa queda libre.

### 6.1.1 Datos de facturación desde el celular del cliente

1. El cliente escanea el QR de la precuenta y se abre el **portal de facturación** en su celular. No tiene que instalar nada.
2. Escribe su tipo y número de documento. El sistema **trae de la DIAN su nombre y su correo** (por Factus) y se los muestra parcialmente ocultos para que confirme, por ejemplo "J*** P***, j***@gmail.com". Si quiere otro correo, lo escribe.
3. Indica si es persona natural o empresa y, si quiere, completa dirección, teléfono y municipio (son opcionales). Acepta la política de tratamiento de datos.
4. Puede marcar **"recordar mis datos"** para la próxima vez, en cualquier sede de la empresa.
5. En la caja aparece la cuenta marcada con **"datos de facturación recibidos"**. El cajero los ve, cobra y la factura sale a nombre del cliente. **Nadie digita nada.**
6. Factus le envía la factura al correo que registró.

Otros momentos en que el cliente puede dar sus datos:

- **Después de pagar, si la factura quedó pendiente** porque no había internet: el QR del comprobante lleva al mismo portal, y la factura se emite con sus datos cuando vuelva la conexión.
- **Después de pagar, si la factura ya salió a consumidor final**: puede pedir la factura a su nombre dentro del plazo de la empresa (regla 10, D-11). El sistema anula la anterior con una nota crédito y emite la nueva.
- **Domicilios y reservas**: el enlace al portal se envía por WhatsApp con el pedido o la reserva.
- **Cliente frecuente en la caja**: el cajero escribe la cédula o el NIT y el sistema trae los datos guardados, o los consulta en la DIAN.

### 6.1.2 Pedido desde el QR de la mesa

1. Cada mesa tiene un QR fijo. El cliente lo escanea y se abre el portal de esa mesa en su celular. No instala nada y no crea cuenta. Su celular usa sus datos móviles o el Wi-Fi de invitados: no entra a la red del personal.
2. Ve el menú de esa sede, con precios, modificadores y lo que está agotado.
3. Arma el pedido y lo envía. Si la mesa está libre, se abre. Si ya está ocupada, los productos se suman a la cuenta abierta.
4. El pedido llega a la estación de cocina que corresponde y queda visible en la caja, marcado como canal **QR mesa**.
5. El cliente no anula, no descuenta y no cambia precios. Eso lo hace el personal, con los mismos permisos.
6. Por defecto el pedido sale directo a cocina. La sede puede exigir que la caja lo acepte antes.
7. Con internet llega a cocina en el mismo tiempo que un pedido del mesero. Durante un corte queda en la nube y entra a cocina al reconectar. El mesero sigue tomando pedidos en el local mientras tanto.

### 6.1.3 Pago desde el QR de la mesa

1. Desde el mismo QR de la mesa, o desde el QR de la precuenta, el cliente ve el saldo de su cuenta.
2. Puede dejar sus datos de facturación (6.1.1) y una propina. La propina sigue siendo voluntaria y va separada de la venta.
3. Paga ese saldo con un QR o un enlace de cobro por el **valor exacto**: Nequi, Daviplata, Bre-B o tarjeta, según lo que ofrezca la pasarela. El cliente no escribe el monto. Si el cajero ya dividió la cuenta, cada parte se cobra por separado en el mismo portal.
4. El pago se registra solo cuando la pasarela confirma que el dinero entró. Entonces se emite la factura y la mesa pasa a por limpiar.
5. El efectivo y el datáfono se siguen cobrando en la caja. Un pago QR y un pago en caja pueden convivir en la misma cuenta.
6. Si el internet de la sede está caído, el cliente igual puede pagar, porque su celular habla con la pasarela. La sede aplica el pago, imprime la factura y libera la mesa al reconectar.
7. Ese dinero no entra al efectivo del arqueo. En el cierre, el total cobrado por QR se compara con el reporte de la pasarela.

### 6.2 Domicilio

**Domicilio propio** (teléfono, WhatsApp, mostrador):

1. Se crea el pedido con los datos del cliente y la dirección. El pedido va a cocina igual que uno de mesa.
2. Al quedar listo, se asigna un domiciliario propio y se despacha.
3. El domiciliario confirma la entrega y el cobro, si es contra entrega.

**Pedido de plataforma** (Rappi, DiDi Food o cualquier otra):

1. El pedido llega solo desde la plataforma a la sede, sin volver a digitarlo, y suena una alerta en la caja.
2. La caja lo acepta o lo rechaza dentro del tiempo que da la plataforma. Se puede configurar la aceptación automática.
3. Al aceptarlo, va a cocina como cualquier pedido, marcado con el logo y el código de la plataforma.
4. Al quedar listo, se avisa a la plataforma y se entrega al repartidor de la plataforma, verificando el código del pedido.
5. El pago queda como saldo por cobrar a la plataforma, y se concilia contra su liquidación.

En los dos casos se mide el tiempo de cada etapa.

### 6.3 Reserva con cobro

1. El cliente reserva por teléfono o WhatsApp (lo registra el personal) o, más adelante, en un enlace público de la sede.
2. Se elige fecha, hora, número de personas y, si se quiere, zona o mesa.
3. Si la sede exige cobro para esa franja, se le envían al cliente los **datos para transferir** (Nequi, Daviplata o llave Bre-B, con QR si existe) y el valor. El cliente envía el comprobante, el personal **verifica que el dinero llegó** a la cuenta y confirma la reserva. Si el cliente reserva en persona en la sede, también puede pagar en efectivo (M9).
4. El día de la reserva, la mesa aparece bloqueada en el plano un tiempo antes de la hora.
5. Cuando el cliente llega, se le asigna la mesa. Si pagó un **anticipo**, se abona a su cuenta al cobrar.
6. Si no llega o cancela tarde, se aplica la política de cancelación de la sede: se retiene el cobro, o se devuelve todo o una parte.

### 6.4 Marcación de entrada y salida

1. El trabajador marca su **entrada** con su PIN al llegar, en un dispositivo de la sede o en su celular conectado a la red del local.
2. Si la sede lo configura, debe tener la entrada marcada para poder operar (tomar pedidos, abrir caja).
3. Puede marcar pausas (almuerzo, descanso).
4. Al irse marca su **salida**. Si se le olvida, el administrador lo corrige con un motivo, y la corrección queda auditada.

### 6.5 Turno de caja

1. **Apertura**: el cajero registra la base inicial, contada por denominación.
2. Durante el turno: ventas, ingresos y egresos de caja (cada uno con motivo), retiros parciales.
3. **Arqueo a ciegas**: el cajero cuenta sin ver cuánto debería haber.
4. El sistema compara lo contado con lo esperado, por cada medio de pago.
5. Si hay diferencias, se exige justificación y la aprobación de un supervisor.
6. **Cierre**: se imprime el reporte de cierre y queda inmutable.

### 6.6 Inventario

1. Compra: se recibe la mercancía en una bodega o directamente en el punto, a cantidad y costo reales.
2. Reabastecimiento: el punto pide a su bodega, la bodega despacha y el punto confirma lo recibido. Las diferencias quedan registradas.
3. Venta: al enviar un producto a cocina se descuentan sus ingredientes del inventario del punto, según la receta.
4. Producción: las preparaciones intermedias (salsas, masas, porciones) se registran como producción. Consumen ingredientes y generan un producto intermedio.
5. Conteo físico: se compara con el inventario teórico y la diferencia queda como ajuste con motivo.

## 7. Requisitos funcionales por módulo

Este es el alcance de alto nivel. El detalle va en el PRD de cada módulo.

### M0 · Plataforma

- Estructura de empresa, contribuyentes, marcas, sedes, estaciones, cajas y bodegas (sección 5).
- Perfil de conectividad por sede (sección 9.1).
- Usuarios con roles por alcance: un usuario puede ser cajero en la sede 1 y administrador en la sede 2.
- Ingreso rápido con **PIN personal** en dispositivos compartidos, y sesión completa para la administración.
- Registro de dispositivos autorizados por sede. Un dispositivo no registrado no puede operar.
- **Celulares personales** de los meseros (Android y iPhone): se registran con un QR, solo funcionan dentro de la red del local, no guardan datos del negocio y se pueden revocar al instante.
- **Permisos granulares**. Las acciones sensibles exigen la autorización de un supervisor en el momento (con PIN), por ejemplo: anular, descontar, cortesía, reabrir una cuenta, abrir el cajón sin venta, cambiar un precio o ajustar inventario. Roles predefinidos, matriz de permisos, topes y reglas en [PRD-01](PRD-01-roles-y-permisos.md).
- **Auditoría inmutable**: quién hizo qué, cuándo, en qué dispositivo, quién lo autorizó y por qué motivo.

### M1 · Pedidos y salón (mobile first)

- Plano de mesas por zona, con su estado: libre, ocupada, cuenta pedida o por limpiar.
- Toma de pedidos desde el **celular del mesero**, desde un punto de pedido fijo, o desde el **QR de la mesa** (6.1.2).
- El QR de la mesa es fijo, abre el portal en el celular del cliente y no pide instalación ni cuenta.
- Un pedido QR abre la mesa si está libre, o se suma a la cuenta si ya está ocupada. Llega a la misma cocina y a la misma caja, con canal **QR mesa**.
- El cliente no anula, no descuenta y no cambia precios. La sede puede pedir aceptación en caja antes de cocina; por defecto el pedido sale directo.
- Productos con variantes (tamaño), modificadores (con o sin costo), combos y notas.
- Envío del pedido por tiempos (entradas primero, fuertes después) y reenvío de productos.
- **Enrutamiento a cocina**: cada producto va a su estación (parrilla, fríos, bar…), en pantalla de cocina, impresora de comandas o ambas.
- Pantalla de cocina: cola por estación, tiempos con semáforo, marcar en preparación y listo.
- Avisos al mesero cuando su pedido está listo.
- El pedido se ve en la caja en tiempo real.
- Mover una mesa, unir mesas y transferir productos entre cuentas.
- **Disponibilidad automática**: si no alcanza el inventario para un plato, se muestra como agotado en el menú del mesero (ver M4).
- **No se repone hoy**: si ese plato no va a salir en este servicio, el mesero no puede enviarlo y, si ya está pedido y todavía no se entrega, recibe un aviso al momento para decírselo al cliente. El resto de la cuenta sigue.

### M2 · Caja

- Turnos por cajero, con apertura, cierre parcial y cierre final.
- **Todos los medios de pago**: efectivo, tarjeta débito y crédito (datáfono), transferencias y billeteras (Nequi, Daviplata, Bre-B / QR), bonos o vales, y crédito a cliente o cuenta corporativa.
- **Pago con QR en la mesa** (6.1.3): el cliente paga el saldo desde su celular. El monto lo fija la cuenta. El pago entra solo cuando la pasarela confirma el dinero. Hay varias pasarelas; Bold es una, y la sede activa la que contrató (D-46). En el arqueo, ese total se compara con el reporte de la pasarela y no se mezcla con el efectivo. La comisión es la del contrato. Con el cobro activo se puede pagar aunque el turno de caja esté cerrado; ese pago no modifica el turno cerrado (D-44).
- **Datáfonos del piloto: Credibanco, Bold y Redeban.** Cada pago con tarjeta registra el datáfono, el número de aprobación, la franquicia y los últimos 4 dígitos.
  - En la Fase 1 el pago se **registra** en el sistema. La integración directa (que el monto viaje solo al datáfono) se evalúa después (TRD-00, ADR-007; PA-43).
  - En el arqueo, el total de tarjetas de cada datáfono se compara con su reporte de cierre.
- Pagos mixtos (varios medios en una cuenta) y división de la cuenta por comensal, por productos o en partes iguales.
- Cambio en efectivo, ingresos y egresos de caja con motivo, retiros parciales.
- Arqueo a ciegas por denominación y por medio de pago.
- **Propinas**: se preguntan siempre al cliente (son voluntarias) y se registran por venta y medio de pago.
  - **Fondo común**: se suman todas las propinas del periodo (turno, día o semana, configurable por sede).
  - **Reparto equitativo por defecto** entre quienes trabajaron en el periodo. Los participantes salen de la asistencia (M8).
  - **Porcentaje ajustable por persona o por rol**, por ejemplo más para meseros y menos para cocina. El sistema valida que la suma sea 100 %.
  - Opción de repartir en proporción a las horas trabajadas.
  - Liquidación imprimible por periodo, con el detalle de cada persona y la firma de recibido. Los cambios a la regla de reparto quedan auditados.
- Reporte de cierre impreso y digital.

### M3 · Facturación electrónica DIAN e impresión

- Integración con **[Factus](https://www.factus.com.co/)** como proveedor tecnológico habilitado por la DIAN, a través de su API.
- **Toda venta se emite como factura electrónica de venta, en todas las sedes.** No usamos el documento equivalente POS.
  - **Si el cliente no da datos**, va al adquirente genérico de la DIAN: cédula (código `13`), número `222222222222`, nombre "Consumidor final", responsabilidad `R-99-PN` y un correo interno de la empresa. Sirve **para cualquier valor**.
  - **Si el cliente pide factura a su nombre**, él mismo registra sus datos en el portal, o se digita su cédula o NIT en la caja y el sistema **autocompleta su nombre y su correo** desde la DIAN (por Factus).
  - La factura electrónica no tiene tope de valor.
- **No existe la opción de acumular ventas en una factura global** (diaria, semanal ni mensual), ni siquiera para consumidor final. La norma exige **un documento por cada venta, en el momento de la venta** (artículo 5 de la Resolución 000165 de 2023, compilada en la Resolución 000227 de 2025). El sistema no permite configurarlo. Para el contador existe en cambio un **resumen mensual de ventas a consumidor final** (sección 8.2), que es un reporte y no una factura.
- **Domicilios a consumidor final**: si la venta se entrega fuera del local, el documento debe llevar la **dirección de entrega**, aunque el cliente no dé sus datos.
- La factura sale en unos 2 a 3 segundos con internet y se imprime en la térmica con su número, CUFE y código QR.
- Si el cliente da un correo, Factus le envía el PDF, el XML y un enlace de consulta.
- La propina voluntaria va en la factura como recargo, separada de la venta y fuera de la base gravable (D-08). El anticipo de una reserva que se abona a la cuenta viaja en la factura del servicio. El monto retenido por cancelación o no llegada, si se factura, usa su propia clasificación tributaria (D-12, M9).
- Numeración **por contribuyente**, con un rango por sede (y opcionalmente por caja). Cada factura lleva los datos de la sede que la emite.
- **Sin internet no hay factura de papel.** El cliente recibe un **comprobante de venta** (que dice "no es factura") con un **QR**. Cuando vuelve la conexión, el sistema emite la factura electrónica solo y en orden; el QR pasa a mostrar la factura, y si el cliente dejó correo o celular, se la envía.
- **Si el internet se corta mientras se envía una factura**, el sistema primero revisa en Factus si quedó emitida. Solo si no se emitió, la vuelve a enviar. Una venta nunca queda con dos facturas.
- Notas crédito para anulaciones o devoluciones posteriores a la emisión.
- **Portal de datos de facturación** (autoservicio del cliente, ver 6.1.1):
  - Página web pública, mobile first, que se abre desde un QR o un enlace. Sin instalar nada y sin crear cuenta.
  - Puntos de entrada: QR de la precuenta, QR del comprobante o de la factura, y enlace por WhatsApp en domicilios y reservas.
  - Campos alineados con lo que exige la factura electrónica: tipo y número de documento (con dígito de verificación si es NIT), persona natural o jurídica, nombre o razón social, nombre comercial, responsabilidad tributaria, correo, teléfono, dirección y municipio.
  - **Autocompletado desde la DIAN por Factus: solo nombre o razón social y correo.** La DIAN no entrega dirección, teléfono ni municipio; esos datos los escribe el cliente si quiere, porque son opcionales.
  - Como la DIAN devuelve el nombre y el correo de cualquier documento, el portal **los muestra parcialmente ocultos**. Así nadie averigua datos de otra persona escribiendo su cédula.
  - Validación del dígito de verificación del NIT y del formato del correo, y selector de municipio.
  - **"Recordar mis datos"** (opcional): la próxima vez, el cliente escribe su documento y confirma con un código que le llega al correo o al celular registrado. Nunca se muestran sus datos a quien solo conoce el número de documento.
  - Los datos se guardan **por empresa** y sirven en todas sus sedes. Nunca se comparten con otra empresa cliente del SaaS.
  - Cumple la Ley 1581: autorización explícita, finalidad (facturación), consulta y eliminación a solicitud del titular.
  - El mismo portal muestra el estado de la factura: "en proceso" o emitida, con el PDF y el enlace de Factus.
- **Soporte para todos los regímenes tributarios de Colombia** con un motor de impuestos configurable (sección 7.1).
- Impresión en **impresoras térmicas** (80 mm y 58 mm) de: comandas, precuenta, documento DIAN con su código QR, cierre de caja y comprobantes de traslado. Cada módulo imprime lo suyo: M1 las comandas y la precuenta, M3 el documento DIAN, M2 el cierre de caja y la liquidación de propinas, M4 los comprobantes de traslado. Las plantillas y el manejo de la impresora son comunes (TRD-00, sección 7).
- Apertura del cajón monedero desde la impresora. Si se abre sin una venta, requiere permiso y queda auditado.

### M4 · Inventario, bodegas y recetas

- Catálogo de insumos con unidad de compra, unidad de inventario y unidad de receta (por ejemplo bulto de 50 kg, kilo y gramo).
- **Recetas** por producto y variante, con sub-recetas (preparaciones intermedias) y porcentaje de rendimiento o merma de limpieza.
- Los modificadores ajustan el consumo (por ejemplo, "extra queso" suma y "sin cebolla" resta).
- Ubicaciones de inventario: el **inventario del punto** (uno por sede) y las **bodegas** (de la sede o generales). Cada una lleva su propio stock.
- Compras y recepción contra pedido, con proveedor y costo real. El costo se guarda al valor registrado, sin separar el IVA de la compra (D-15). El costo promedio sale de esas recepciones.
- Factus no recibe facturas de proveedores ni emite documento soporte. La compra queda registrada en el local; el documento del proveedor lo lleva el contador por fuera (D-14).
- **Reabastecimiento** de bodega a punto, con solicitud del punto o sugerencia automática por stock mínimo.
- Traslados con estados guardados: solicitado, en tránsito, recibido y recibido con diferencias. El despacho deja el traslado en tránsito; no queda un estado aparte llamado despachado. El traslado mueve el costo del origen tal cual, sin sumarle nada (D-27).
- Producción de preparaciones intermedias. El costo de lo producido es configurable por empresa: promedio de los insumos consumidos, o costo estándar (D-26).
- Mermas y bajas con motivo (vencido, dañado, error de preparación…).
- Conteos físicos totales o por categoría, y ajuste contra el inventario teórico. Un ajuste por encima del tope pide aprobación. El tope es configurable y, por defecto, $1.000 (D-28).
- **Control de lo que se puede producir**:
  - Cuántas unidades de cada plato se pueden preparar **con el inventario del punto**.
  - Cuántas más se podrían preparar **si se reabastece desde la bodega** de la sede o la bodega general.
  - Qué ingrediente limita cada plato.
  - Disponibilidad automática en el menú (agotado o pocas unidades), calculada solo con el inventario del punto.
  - Alertas de escasez y sugerencia de reabastecimiento desde bodega o de compra (ver abajo).
- Costo teórico de cada plato y margen.

**Alerta temprana de escasez**

Avisa **antes** de que falte un producto, para reponerlo a tiempo.

- **Niveles configurables por insumo y por ubicación** (punto, bodega de la sede, bodega general):

  | Nivel | Qué significa | Qué pasa |
  |-------|---------------|----------|
  | **Máximo** (stock objetivo) | Hasta dónde se repone | Define la cantidad sugerida: máximo − stock actual |
  | **Punto de reposición** | Hay que pedir ya | Alerta amarilla y sugerencia de reabastecimiento o compra |
  | **Mínimo** | Riesgo de quedarse sin producto | Alerta roja a los responsables |
  | **Agotado** | Stock en cero o negativo | Alerta crítica; los platos que lo usan se marcan agotados en el menú |

- **Alerta por cobertura**: además de los niveles fijos, el sistema calcula **para cuánto tiempo alcanza** el stock según el consumo promedio de ese día de la semana. Por ejemplo: "Al ritmo de los viernes, la carne alcanza para 3 horas". Así avisa aunque el stock esté todavía sobre el mínimo, si viene un día de mucha venta.
- **Alerta de platos**: se puede configurar un mínimo de unidades posibles por plato. Por ejemplo, avisar cuando quedan menos de 10 porciones de un plato estrella.
- **Niveles sugeridos**: el sistema puede proponer los niveles a partir del consumo histórico, y el administrador los ajusta.
- **A quién y por dónde avisa**: se configura por sede y por tipo de alerta (administrador, jefe de cocina, bodeguero). Avisa en la pantalla de la caja y la cocina, con notificación en el celular y, desde la entrega 5.1, por WhatsApp, SMS o correo (D-03).
- **Acción con un toque**: desde la alerta se crea la **solicitud de reabastecimiento** a la bodega, o la **orden de compra** al proveedor si el que está bajo es la bodega, con la cantidad sugerida.
- **Ciclo de la alerta**: abierta, vista (por quién y cuándo) y resuelta. Se resuelve sola cuando el stock vuelve a subir del punto de reposición.
- **Escalamiento**: si nadie atiende una alerta roja en un tiempo configurable, se avisa al siguiente nivel (del jefe de cocina al administrador, y de ahí al gerente).
- Funciona **sin internet** dentro del local, porque se evalúa en el nodo de la sede.

**No se repone hoy**

Sirve para que un cliente no se quede esperando un plato que no va a salir. Es distinto de un faltante de conteo: aquí alguien confirma que en este servicio no hay reposición.

- Lo marca el **jefe de cocina** o el **administrador**. El sistema lo propone cuando el punto no alcanza para una porción más, las bodegas que abastecen la sede tampoco, y no hay un traslado en camino. Hasta que alguien confirma "hoy no", no se les quitan platos a las mesas: un conteo mal hecho no cancela pedidos.
- Mientras la marca está activa, el plato queda **agotado** en el menú del mesero y en las plataformas. No se puede enviar a cocina.
- Los platos **ya enviados y que cocina todavía no empieza**, para los que ya no hay ingredientes, salen de la cola. El mesero de esa mesa recibe el aviso en el acto, por el mismo canal que "pedido listo" (sonido y pantalla). La línea no se cobra. Si cocina no empezó, el inventario se devuelve.
- Lo que ya está **en preparación, listo o entregado** sigue su curso. Si cocina descubre en la estación que esa línea tampoco se puede terminar, la marca ahí y el aviso al mesero sale igual. Eso queda como merma.
- El mesero confirma **cliente avisado**. Queda auditado quién marcó que no se repone, en qué mesas cayó y quién avisó.
- La marca vale hasta el final del servicio o hasta que la quiten. Los demás platos de la cuenta no se tocan.

### M5 · Domicilios

**Domicilio propio**

- Pedido de domicilio con cliente, dirección, teléfono y notas.
- Canales propios: teléfono o WhatsApp y mostrador.
- Asignación de domiciliario, despacho y confirmación de entrega desde el celular.
- Cobro contra entrega con conciliación del domiciliario al final del turno.

**Plataformas de domicilio (Rappi, DiDi Food y cualquier otra)**

- **Recepción automática** de los pedidos de cada plataforma en la sede que corresponde. Una sola pantalla para todos los canales, sin tener la tablet de cada plataforma.
- **Arquitectura abierta a nuevas plataformas**: cada plataforma es un conector. Agregar una nueva no cambia el resto del sistema.
- **Captura manual rápida** para plataformas sin conector o cuando el conector falla. Se copia el pedido desde la tablet de la plataforma, indicando el canal y el código.
- Aceptar o rechazar, con aceptación automática configurable por sede y horario.
- **Menú por canal**: qué productos se publican en cada plataforma, con un precio distinto por canal si se quiere (por ejemplo, para cubrir la comisión).
- **Disponibilidad sincronizada**: si un plato se agota en la sede (M4), se marca como agotado en todas las plataformas. Si la sede se satura, se puede pausar una plataforma.
- Estados enviados a la plataforma: aceptado, en preparación, listo para recoger.
- Entrega al repartidor de la plataforma con verificación del código del pedido.
- Cancelaciones de la plataforma: si la cocina ya empezó, se registra como merma con motivo (regla 2 de la sección 10).
- **Factura del pedido**: la emite el restaurante, al cliente o a consumidor final, con la dirección de entrega. La comisión la factura la plataforma al restaurante y no se carga aquí (D-13).
- **Comisiones y conciliación**: se registra la comisión de cada plataforma (porcentaje y cargos fijos). Se compara lo que la plataforma debería pagar con su liquidación real y se alertan las diferencias. La conciliación muestra venta bruta, comisión, retenciones y neto.
- **Rentabilidad por canal**: venta neta después de comisión, comparada con el costo de los platos.

**Para todos los domicilios**

- Tiempos por etapa, por canal y por domiciliario.
- Impuesto de bolsas plásticas cuando aplique (sección 7.1).

### M6 · Reportes y analítica

Ver la sección 8.

### M7 · SaaS comercial

- Planes y precio por sede.
- Alta de clientes, configuración guiada y carga inicial de menú, recetas e insumos.
- Cobro de la suscripción, suspensión por falta de pago y periodo de gracia.
- Panel de soporte para nuestro equipo, como una vista de la web de administración con permisos de soporte (D-05).
- **Bolsa de documentos de Factus por empresa**:
  - Se activa en el alta del cliente, junto con los requisitos de cada NIT (Cámara de Comercio, RUT, rango DIAN, certificado digital).
  - Saldo visible para el administrador de la empresa: la suma de los cupos, con el consumo por NIT y por sede.
  - **Alerta temprana de saldo** por días de cobertura de cada cupo (amarilla por defecto a 15 días, roja a 5), al administrador y a nuestro soporte.
  - Si el cupo de un NIT se agota, se sigue vendiendo: las facturas de ese NIT quedan pendientes y se emiten solas al recargar. Los demás NIT siguen emitiendo.
  - Cada NIT recibe un cupo dentro de esa bolsa. El saldo de la empresa es la suma de los cupos (D-16).
  - Cómo se cobra la bolsa al cliente (incluida en la suscripción o aparte) se define con el precio, en la Fase 4. Pendiente: PA-39 ([registro](../preguntas-abiertas.md)).

### M8 · Asistencia del personal

No es un sistema de nómina. Es el registro de las horas de trabajo, para saber quién estuvo activo y cuánto tiempo.

- **Marcación de entrada, salida y pausas** con el PIN personal.
- Solo se puede marcar **dentro del local**: en un dispositivo de la sede, o en el celular del trabajador conectado a la red Wi-Fi de la sede. Funciona sin internet.
- **Dos modos que conviven**, configurables por trabajador:
  - **Solo horas**: se cuentan las horas desde que marca la entrada hasta que marca la salida, sin horario fijo.
  - **Con horario programado**: turnos por trabajador y día, para detectar tardanzas, ausencias, salidas anticipadas y horas por fuera del horario.
- **Regla opcional por sede**: sin entrada marcada no se puede operar el sistema (tomar pedidos, abrir caja, cocina). Así nadie opera con el usuario de otro fuera de su turno.
- Cierre automático de turnos abiertos al final del día, marcados para revisión.
- Correcciones de marcación solo por el administrador, con motivo y auditoría.
- Reportes:
  - Horas trabajadas por trabajador, sede y periodo.
  - Tardanzas, ausencias y marcaciones corregidas.
  - Quién está activo ahora en cada sede.
  - Ventas por hora trabajada (productividad).
- Exportación a Excel para quien liquida la nómina.

### M9 · Reservas

- Registro de reservas con cliente, teléfono, fecha, hora, número de personas, zona o mesa preferida, ocasión y notas.
- Canales: el personal las registra (teléfono, WhatsApp, en persona) y, más adelante, un **enlace público de reservas** por sede.
- **Disponibilidad**: capacidad por franja horaria, duración estimada de la reserva y mesas que se pueden reservar.
- Las reservas del día se ven en el **plano de mesas**, y la mesa se bloquea un tiempo configurable antes de la hora.
- Estados: pendiente de pago, confirmada, cliente llegó, no llegó y cancelada.
- **Cobro de reservas totalmente configurable**, por sede, por franja (por ejemplo, viernes en la noche) o por tamaño del grupo:
  - **Desde $0** (reserva gratis) **hasta un cobro** por reservar.
  - **Anticipo**: se abona a la cuenta del cliente cuando consume.
  - **Tarifa de reserva**: un cobro que no se abona al consumo.
  - Valor fijo, valor por persona o porcentaje de un consumo mínimo.
- **Medios de cobro** (D-01): si la reserva entra por enlace, llamada o chat, solo **transferencia directa verificada** a las cuentas de la sede en **Nequi, Daviplata o Bre-B** (llave o QR). Si el cliente reserva en persona en la sede, transferencia o efectivo. No se necesita pasarela de pagos.
  - Cada sede configura sus cuentas de recaudo, y el sistema arma el mensaje para el cliente con el valor, los datos y una referencia de la reserva.
  - Estados del cobro: pendiente, **comprobante recibido**, **verificado** y rechazado. La reserva solo se confirma cuando alguien con permiso **verifica en la cuenta** que el dinero llegó; el pantallazo solo no basta.
  - Quién verificó y cuándo queda auditado. El comprobante se adjunta a la reserva.
  - Las devoluciones se hacen por transferencia y se registran con su comprobante.
  - Una pasarela de pagos con confirmación automática queda como mejora futura (TRD-00, ADR-012). Pendiente: PA-45 ([registro](../preguntas-abiertas.md)).
- **Política de devolución configurable**, desde devolución total hasta ninguna devolución, pasando por cualquier porcentaje. Se define por tramos de anticipación a la cancelación. Por ejemplo:

  | Cancela con… | Devolución |
  |--------------|------------|
  | Más de 24 horas de anticipación | 100 % |
  | Entre 12 y 24 horas | 50 % |
  | Menos de 12 horas, o no llega | 0 % |

  Cada sede define sus tramos y porcentajes. La política vigente se muestra al cliente al reservar y queda guardada en la reserva, así un cambio posterior de la política no la afecta.
- Devoluciones registradas y auditadas.
- Confirmación y recordatorio al cliente por WhatsApp, SMS o correo en la entrega 5.1 (D-03).
- Reportes: reservas por día y franja, tasa de clientes que no llegan, ocupación, anticipos retenidos e ingresos por reservas.

### 7.1 Impuestos y regímenes tributarios

El producto soporta **todos los regímenes tributarios de Colombia** que aplican a restaurantes. Se logra con configuración, no con código a la medida: cada combinación se resuelve con datos.

**Perfil fiscal de cada contribuyente**

| Dato | Valores posibles |
|------|------------------|
| Tipo de persona | Natural o jurídica |
| Régimen | Ordinario o Régimen Simple de Tributación (SIMPLE) |
| Responsabilidad frente al IVA | Responsable o no responsable |
| Impuesto nacional al consumo de restaurantes y bares | Responsable o no responsable |
| Responsabilidades del RUT | Gran contribuyente, autorretenedor, agente de retención de IVA, entre otras. Van en el documento electrónico. |
| Operación bajo franquicia | Sí o no. Cambia el impuesto que aplica al servicio de restaurante. |
| Municipio de cada sede | Para el ICA y sus reportes |

**Catálogo inicial de impuestos por producto**

- Impuesto nacional al consumo (INC) del 8 %.
- IVA del 19 % y del 5 %.
- Exento (0 %), excluido y no gravado.
- Impuesto al consumo de bolsas plásticas, con valor fijo por bolsa (aplica en pedidos para llevar). En los domicilios cada sede lo enciende o lo apaga (D-29). En la factura va como una línea más, no como impuesto.
- Impuesto a productos ultraprocesados, si algún producto lo tiene.
- Cualquier impuesto nuevo que defina la ley se agrega como un registro más del catálogo.

**Reglas**

1. El impuesto de cada línea se decide combinando el perfil del contribuyente, la clasificación tributaria del producto y la fecha.
2. Los precios del menú incluyen impuestos. El sistema desglosa la base y el impuesto y redondea al peso.
3. Las tarifas tienen fecha de vigencia. Si cambia la ley, se crea un registro nuevo sin desplegar código.
4. La propina queda fuera de la base gravable.
5. Las retenciones que aplica un cliente corporativo (retención en la fuente, reteIVA, reteICA) se registran en el pago para conciliar la cartera.
6. Hay reportes de impuestos por contribuyente, periodo y tipo, y exportación para el contador.
7. El sistema trae **perfiles predefinidos** para las combinaciones más comunes, así configurar un restaurante nuevo es rápido.

> El perfil se elige al configurar cada contribuyente (D-09). El catálogo trae restaurante independiente, con impuesto nacional al consumo del 8 %, y franquicia, con IVA del 19 %. Las tarifas se revisan cada vez que cambia la norma: se crea un registro nuevo, sin desplegar código.

## 8. Reportes y métricas

Las métricas de tiempo **se capturan desde la Fase 1**, aunque algunos reportes salgan después. Si no registramos los eventos desde el principio, perdemos la historia.

### 8.1 Tiempos

| Métrica | Definición |
|---------|------------|
| Tiempo de toma del pedido | Desde que se abre la mesa hasta el primer envío a cocina |
| Tiempo de espera en cocina | Desde que se envía a cocina hasta que pasa a "en preparación" |
| Tiempo de preparación | Desde "en preparación" hasta "listo", por producto y estación |
| Tiempo total en cocina | Desde que se envía a cocina hasta "listo" |
| Tiempo de entrega en mesa | Desde "listo" hasta "entregado" |
| Tiempo de servicio total | Desde que se envía a cocina hasta "entregado" |
| Duración de la mesa | Desde que se abre hasta que se paga y se libera |
| Tiempo de cobro | Desde que se pide la cuenta hasta que se paga |
| Plataforma: aceptación | Desde que llega el pedido de la plataforma hasta que se acepta |
| Plataforma: espera del repartidor | Desde "listo" hasta que el repartidor de la plataforma lo recoge |
| Domicilio: preparación | Desde que se crea el pedido hasta "listo" |
| Domicilio: despacho | Desde "listo" hasta que sale con el domiciliario |
| Domicilio: en ruta | Desde que sale hasta que se entrega |
| Domicilio: total | Desde que se crea el pedido hasta que se entrega |

Todos estos tiempos se pueden ver por sede, estación, producto, mesero, domiciliario, franja horaria y día de la semana, con promedio y percentiles (p50 y p90).

### 8.2 Ventas

| Métrica | Definición |
|---------|------------|
| Ventas brutas y netas | Antes y después de descuentos, sin impuestos ni propinas |
| Ticket promedio | Ventas netas ÷ número de cuentas pagadas |
| Ticket por comensal | Ventas netas ÷ comensales |
| Ventas por hora | Ventas por franja horaria, para planear el personal |
| Ventas por canal | Mesa atendida por mesero, mesa pedida por QR, mostrador, domicilio propio y cada plataforma (Rappi, DiDi Food…) |
| Venta neta por plataforma | Venta menos comisiones y cargos de la plataforma |
| Pedidos rechazados o cancelados por plataforma | Cantidad, motivo y valor |
| Diferencias de liquidación | Lo que la plataforma debía pagar comparado con lo que pagó |
| Ventas por mesero | Cuentas, ticket promedio y propinas |
| Productos más y menos vendidos | En unidades y en valor |
| Rotación de mesas | Cuentas por mesa por turno |
| Medios de pago | Participación de cada medio de pago, con el pago QR de la mesa separado del efectivo |
| Facturas a nombre del cliente | Porcentaje de facturas con datos del cliente, y cuántas se capturaron por el portal frente a la caja |
| Refacturaciones | Facturas de consumidor final cambiadas a nombre del cliente (nota crédito + factura nueva), por sede |
| Resumen mensual de facturas | Por contribuyente y sede: cantidad y valor de facturas, separando consumidor final de clientes identificados, con sus impuestos. Es un reporte para el contador, **no un documento fiscal** |

### 8.3 Costos e inventario

| Métrica | Definición |
|---------|------------|
| Costo de alimentos (%) | Costo teórico de lo vendido ÷ ventas netas |
| Diferencia entre teórico y real | Consumo teórico (recetas) contra consumo real (conteos) |
| Ingeniería de menú | Cruce de popularidad y margen por plato |
| Mermas | Por motivo, insumo, ubicación y responsable |
| Valor del inventario | Por ubicación, a costo promedio |
| Rotación y días de inventario | Por insumo |
| Platos que se pueden producir | Unidades posibles hoy e ingrediente que limita |
| Alertas de escasez | Abiertas por sede y nivel; tiempo promedio de atención; quiebres de stock (veces que un insumo llegó a cero) |
| Cobertura de inventario | Horas o días que alcanza cada insumo al ritmo de consumo actual |

### 8.4 Control y auditoría (contra robos)

| Métrica | Definición |
|---------|------------|
| Anulaciones | Por usuario, por quién autorizó, por motivo y por momento (antes o después de cocina) |
| Descuentos y cortesías | Por usuario, por quién autorizó y por valor |
| Diferencias de arqueo | Por cajero y turno |
| Aperturas de cajón sin venta | Por usuario |
| Cuentas reabiertas o modificadas después de la precuenta | Por usuario |
| Traslados con diferencias | Por ubicación y responsable |
| Ajustes de inventario | Por usuario y valor |
| Alertas de comportamiento inusual | Por ejemplo: muchas anulaciones en un turno o muchos descuentos de un mismo usuario |

### 8.5 Personal y propinas

| Métrica | Definición |
|---------|------------|
| Horas trabajadas | Suma de entrada a salida, menos pausas, por trabajador, sede y periodo |
| Tardanzas y ausencias | Contra el horario programado, si existe |
| Marcaciones corregidas | Por trabajador y por quién las corrigió |
| Ventas por hora trabajada | Ventas netas ÷ horas trabajadas del personal de la sede |
| Propinas | Por periodo, por medio de pago y su reparto |
| Productividad | Por mesero y por estación de cocina |

### 8.6 Reservas

| Métrica | Definición |
|---------|------------|
| Reservas | Por día, franja horaria y canal |
| Tasa de clientes que no llegan | Reservas sin llegada ÷ reservas confirmadas |
| Ocupación por reservas | Personas con reserva ÷ capacidad de la franja |
| Ingresos por reservas | Anticipos abonados, tarifas cobradas y montos retenidos por cancelación o no llegada |
| Ticket de mesas con reserva | Comparado con el de mesas sin reserva |

## 9. Requisitos no funcionales (vistos desde el producto)

| Atributo | Requisito |
|----------|-----------|
| Corte de internet | En modo nube el salón se detiene hasta que vuelva el enlace. En modo híbrido, el mesero, la cocina, la caja y la impresión siguen en el local; al reconectar se emiten las facturas y se aplican los pedidos y pagos QR que quedaron en la nube (sección 9.1) |
| Velocidad | El pedido llega a la cocina en menos de 2 segundos dentro del local |
| Mobile first | Las pantallas del mesero y del domiciliario se diseñan primero para un celular de gama media, Android o iPhone |
| Rapidez de uso | Tomar un pedido de 4 productos debe tomar menos de 30 segundos a un mesero entrenado |
| Datos | Ninguna venta se pierde. En modo nube la venta ya está en la nube. En modo híbrido, lo que se registró en la sede llega a la nube cuando vuelve la conexión |
| Seguridad | Los datos de un cliente nunca son visibles para otro |
| Legal | Cumplimiento DIAN y Ley 1581 de protección de datos (datos de clientes de domicilio) |

### 9.1 Modo de la sede y conexión

Toda sede tiene internet y nace en **modo nube**. El **híbrido** se activa sede por sede. Una sede que no va a tener conexión queda fuera. El mecanismo está en [TRD-00, sección 5.0](../trd/TRD-00-arquitectura-base.md).

**Construcción (D-37).** El MVP solo implementa la fila Nube. Un corte detiene la sede. La cola del QR, el comprobante de corte y las filas híbridas se implementan en la fase híbrida. No se borran de este documento.

| Modo | Situación | Cómo opera |
|------|-----------|------------|
| **Nube** | Predeterminado. Hay internet, o se acepta parar si se corta | El salón trabaja contra la nube. La factura sale en el momento si el proveedor responde. La impresión, si hay impresora, pasa por un puente en el local. |
| **Híbrido, conectada** | Se activó el híbrido y el internet es estable | El salón trabaja contra el nodo y la nube recibe cada evento al instante. El pedido y el pago desde el QR de la mesa llegan a cocina y a caja en ese momento. |
| **Híbrido, intermitente** | Se activó el híbrido y el internet se corta a ratos | El mesero, la cocina, la caja, la impresión, el inventario del punto y los reportes del día siguen en el nodo. Al reconectar se vacía lo pendiente, en orden. |

Reglas:

- **En modo nube, un corte detiene el salón.** No hay pedidos, cocina, caja ni impresión hasta que vuelva el enlace. Lo que el cliente alcanzó a dejar en el QR espera en la nube y entra al volver.
- **En modo híbrido, durante un corte sigue el salón**: pedidos del mesero, cocina, caja, impresión, inventario del punto, asistencia y reservas registradas en la sede.
- **En modo híbrido, durante un corte espera en la nube**, y se aplica al reconectar: la factura electrónica, los pedidos y pagos hechos desde el QR de la mesa, los pedidos de plataformas, las reservas del enlace público, los cambios de menú hechos en la administración web y la vista de la sede desde fuera.
- El celular del cliente usa sus propios datos. Por eso puede armar el pedido y pagar aunque la sede esté cortada. Cocina y caja lo ven cuando el nodo vuelve a hablar con la nube.
- **La factura electrónica necesita internet.** En un corte, el cliente recibe un comprobante de venta con un QR (no es factura). La factura se emite sola al reconectar. No usamos factura de papel.
- Se recomienda un módem 4G de respaldo en todas las sedes, para acortar los cortes: en el nodo si la sede es híbrida, o en el router en modo nube.
- El sistema alerta cuando hay facturas, pedidos QR o pagos QR pendientes por más de un tiempo configurable.
- La administración ve, para cada sede, la última sincronización y cuántos documentos y eventos están pendientes.

## 10. Reglas de negocio iniciales (a validar con el piloto)

1. **Una venta nunca se bloquea por inventario**. Si el stock no alcanza, la venta se registra igual, el inventario queda negativo y se genera una alerta. El sistema avisa, pero no frena la operación.
   - Si el plato **no se repone hoy** (M4), ese plato no se envía y los que ya estaban en cola sin empezar se le avisan al mesero para que el cliente no espere. El resto de la cuenta y del servicio sigue.
2. **El consumo se descuenta al enviar a cocina**, no al cobrar.
   - Si se anula antes de que la cocina empiece, se devuelve el inventario.
   - Si se anula después, se registra como merma con motivo.
3. Una anulación después de enviar a cocina **siempre exige autorización** de un supervisor.
4. Los descuentos por encima de un tope configurable exigen autorización.
5. La propina es voluntaria, se pregunta siempre, va separada de la venta y no es ingreso del restaurante.
6. Un turno de caja cerrado no se puede modificar. Las correcciones se hacen con movimientos nuevos que quedan auditados.
7. Ningún registro de venta, pago, inventario o auditoría se borra. Las correcciones son registros nuevos.
8. **Cada venta tiene su propia factura electrónica.** No se agrupan ventas de varios clientes en una sola factura, aunque todos sean consumidor final.
9. Si el cliente pide factura a su nombre, se emite con sus datos en el momento. Lo ideal es que él mismo los registre en el portal desde la precuenta.
10. **Cambiar una factura ya emitida a consumidor final** por una a nombre del cliente se hace con una **nota crédito de anulación y una factura nueva**, nunca editando la original (D-11).
    - El plazo lo configura la empresa. **Por defecto: el mismo día. Máximo: dentro del mismo mes**, para no afectar declaraciones de IVA o INC ya presentadas ni cierres contables.
    - La nota crédito lleva la observación «Anulación para expedir la factura al adquirente identificado». La factura nueva cita el número anulado.
    - Se puede automatizar desde el portal o dejarlo para aprobación del administrador. Queda auditado.
    - **Cada refacturación consume 2 documentos** del paquete de Factus (la nota y la factura nueva).
11. Si llegan datos de facturación por el portal y por la caja para la misma cuenta, **decide el cajero** antes de cobrar. Después de emitida la factura, los datos de la cuenta no se pueden cambiar (ver regla 10).

## 11. Fases y entregables

**No hay fecha fija.** Cada fase empieza cuando la anterior cumple su criterio de salida. Las duraciones son estimaciones para un equipo pequeño y se ajustan al terminar cada fase.

Todo lo que describe este documento es el **alcance mínimo**: nada se recorta. Cada fase se parte en **entregas pequeñas**, con su propio alcance y criterio de salida, en el [Roadmap](../roadmap.md).

| Fase | Duración estimada | Entregable | Criterio de salida |
|------|-------------------|------------|--------------------|
| **0 · Fundación** | 5 a 7 semanas | Organización, contribuyentes, usuarios, roles, PIN, dispositivos, auditoría y operación en la nube, con impresión por el puente. Infraestructura como código con despliegue continuo, y monitoreo y errores de la nube y las PWA ([TRD-01](../trd/TRD-01-infraestructura-y-operacion.md)). El nodo y la sincronización quedan en la fase híbrida (D-37) | Una sede en modo nube opera sin nodo. Un cambio en la rama principal llega a staging sin pasos a mano, y las alarmas básicas (facturas pendientes, error en una PWA) avisan |
| **1 · Operación de salón (piloto en 1 sede)** | 10 a 13 semanas | M1, M2, M3 con Factus, el motor de impuestos, el portal del cliente (datos de facturación, **pedido por QR en la mesa** y **pago por QR en la mesa**), impresión térmica, M8 asistencia, reportes de ventas, caja, tiempos y horas trabajadas | Una sede opera 2 semanas seguidas solo con el sistema, con documentos DIAN aceptados, pedidos y pagos QR de mesa en un servicio real, y el personal marcando asistencia |
| **2 · Inventario (6 sedes)** | 7 a 9 semanas. El software en la nube se cerró el 2026-11-19 | M4 en la nube: recetas, consumo al enviar a cocina, compras sin documento soporte (D-14), producción, bodegas y traslados en la nube, mermas, conteos, unidades posibles, alertas y costo de alimentos. Sin visita ni kit de seis sedes | El software está archivado. La medición de un mes en tres sedes no aplica: el piloto se canceló. El nodo de la bodega y la operación sin internet siguen en la fase híbrida |
| **3 · Domicilios y reservas** | 9 a 12 semanas, más el tiempo de aprobación de cada plataforma | M5: domicilio propio, captura manual de plataformas, conectores de Rappi y DiDi Food, menú por canal, conciliación. M9: reservas con cobro por transferencia (Nequi, Daviplata, Bre-B) verificado, efectivo solo si se reserva en persona (D-01), y política de cancelación | Los domicilios propios y de plataformas de al menos 1 sede entran al sistema sin digitarlos dos veces, con tiempos y comisiones medidos. Las reservas con anticipo se cobran y se abonan a la cuenta. |
| **4 · Comercial** | 5 a 7 semanas | M6 avanzado (consolidado, ingeniería de menú, alertas), M7 | Un restaurante que no es del piloto se configura sin desarrollo a la medida |
| **5 · Integraciones y canales** | Por estimar | Notificaciones por WhatsApp, SMS y correo (D-03), integración directa con datáfonos (ADR-007), pasarela de pagos para reservas (ADR-012), foto al marcar asistencia | Cada integración opera en al menos 1 sede |
| **Híbrida** | Después de que la nube opere | Nodo, sincronización, HTTPS local, avisos sin internet, resiliencia, emisión diferida, cola de QR al reconectar y bodega con nodo (D-37). El detalle está en el [roadmap, fase híbrida](../roadmap.md) | Un corte de 2 horas no pierde los pedidos del salón. Al reconectar salen las facturas pendientes y entran los pedidos y pagos QR |

## 12. Métricas de éxito del piloto

| Métrica | Meta |
|---------|------|
| Ventas registradas en el sistema contra ventas reales | 100 % |
| Documentos DIAN rechazados sin reprocesar | 0 |
| Diferencia promedio de arqueo | Reducción medible frente a la línea base actual |
| Diferencia entre inventario teórico y real | Medida y en descenso mes a mes |
| Tiempo del pedido en llegar a cocina | Menos de 2 segundos (p90) |
| Horas de operación perdidas por caída de internet | 0 en las sedes con híbrido activo. En modo nube el corte detiene el salón y no cuenta contra esta meta |
| Satisfacción del personal (encuesta) | 8/10 o más |

## 13. Riesgos de producto

| Riesgo | Mitigación |
|--------|------------|
| Que el piloto (un familiar) empuje desarrollos a la medida | Cada pedido se clasifica como **producto** (sirve a todos), **configuración** o **fuera de alcance**. Solo entra lo que es producto. |
| Que el personal no adopte el sistema | Flujos de pocos toques, capacitación en la sede, despliegue gradual (1 sede antes de 6) |
| Cargar recetas e insumos al inicio cuesta mucho | Importación desde Excel y acompañamiento en la configuración |
| Cambios en la norma DIAN | El proveedor tecnológico absorbe los cambios del formato; nosotros mantenemos las reglas de negocio |
| Alcance demasiado grande para un equipo pequeño | Fases cortas con criterio de salida; nada de la Fase N+1 entra en la Fase N |
| Errores en impuestos por la variedad de regímenes | Motor de impuestos configurable, perfiles predefinidos validados por un contador y pruebas con casos reales de cada régimen |
| Ventas hechas durante un corte que se facturan con retraso, porque no usamos factura de papel | Emisión automática al reconectar, alertas de pendientes y QR de consulta en el comprobante. Módem 4G de respaldo recomendado en todas las sedes |
| Alguien fotografía el QR de la mesa y pide desde fuera del local | El pedido queda en esa mesa y el personal lo ve al instante. La sede puede exigir aceptación en caja antes de cocina. Anular sigue pidiendo permiso |
| Un pago QR se confirma dos veces o el cliente paga un monto distinto | El monto lo fija la cuenta. La pasarela confirma una sola vez, con un identificador único. Sin esa confirmación el pago no existe |
| Las plataformas tardan en dar acceso a su API, o no lo dan | Pedir el acceso desde la Fase 0; usar la captura manual mientras tanto; evaluar un integrador que ya esté conectado a las plataformas |
| Celulares personales: un mesero que se va sigue con acceso, o un celular viejo funciona mal | Revocación inmediata, uso solo dentro del local, y un punto de pedido fijo de la empresa como respaldo en cada sede |
| Factus no emite documento equivalente POS | No lo necesitamos: toda venta es factura electrónica, que Factus confirma válida para POS y consumidor final. Si algún cliente futuro lo exige, el puerto de facturación permite agregar otro proveedor (TRD-00, sección 8) |
| Que alguien pida "una factura global a fin de mes" para ahorrar documentos | El sistema no lo permite (regla 8). Si el motivo es el costo por documento, se negocia el precio de las bolsas con el proveedor |
| Cada venta consume un documento del paquete de Factus | **Una bolsa de documentos por empresa**, repartida en un cupo por NIT (D-16). El tarifario 2026 está en D-18. El precio al restaurante se cierra en la Fase 4 (PA-39) |
| El cupo de un NIT se agota | Alerta temprana de saldo (días de cobertura de ese cupo). Se sigue vendiendo y las facturas de ese NIT quedan pendientes hasta la recarga. Los demás NIT siguen emitiendo |
| El portal de facturación se usa para averiguar datos de otras personas | El portal solo funciona con un enlace atado a una cuenta, que vence; nunca muestra datos guardados sin un código enviado al titular; límite de consultas |
| Muchas refacturaciones elevan el consumo de documentos de Factus | Plazo corto por defecto, aprobación del administrador opcional, y reporte de refacturaciones por sede. Lo mejor es que el cliente registre sus datos antes de pagar, desde el QR de la precuenta |
| Clientes que llenan mal sus datos y la factura sale con errores | Autocompletado desde la DIAN, validación del dígito de verificación y del correo; el cajero ve los datos antes de cobrar |
| Trabajadores que marcan por otro | La marcación usa el PIN personal y solo funciona dentro del local; opcionalmente, foto al marcar en una fase posterior |
| La red Wi-Fi es la misma para clientes y personal | Ningún servicio responde sin un dispositivo registrado; impresoras fuera del alcance de los clientes; se recomienda un router dedicado del sistema en cada sede (TRD-00, sección 10.1.2) |
| Comprobantes de transferencia falsos en las reservas | La reserva solo se confirma cuando alguien verifica en la cuenta que el dinero llegó; queda auditado quién verificó |

## 14. Preguntas abiertas

Las preguntas abiertas viven en un solo lugar: el [registro de preguntas abiertas](../preguntas-abiertas.md). Aquí solo se listan las que nacen de este documento o lo afectan:

- **Contador**: PA-10 (formato de exportación que ya usa su software). El enfoque de factura, la propina, los perfiles, la emisión diferida y la refacturación quedaron decididos (D-07 a D-11). Las preguntas de Factus quedaron decididas (D-16 a D-21).
- **Plataformas de domicilio**: PA-28 (acceso a las API o integrador). Al inicio se construye con adaptadores y datos de prueba (D-35).
- **Pagos**: el QR admite varias pasarelas y Bold es una (D-46). Pagar con el turno cerrado quedó decidido (D-44). PA-43 (datáfonos), PA-45 (pasarela de reservas).
- **Comercial**: PA-39 (precio por sede y bolsa), PA-46 (nombre comercial).

**Datos para la configuración del piloto** (no cambian el diseño; se recogen antes de salir a producción)

- Lista de NIT, con su régimen y las sedes que factura cada uno.
- Por cada NIT, para activarlo en Factus: Cámara de Comercio (menos de 30 días), cédula del representante legal, RUT, y acceso al usuario DIAN de la empresa para solicitar los rangos.
- Rangos de numeración DIAN de cada NIT: uno electrónico por sede (sin rangos de papel).
- Internet de cada sede: conectada o intermitente. El módem 4G y el router dedicado se recomiendan y los compra el dueño (D-36).
- Datáfonos por sede (Credibanco, Bold o Redeban).
- Cuentas de recaudo de reservas por sede: Nequi, Daviplata, llave Bre-B. El cobro ya está decidido (D-34).
- Cobertura de la red en salón y cocina, en la visita técnica.

**Resueltas**

| Pregunta | Respuesta |
|----------|-----------|
| Fecha objetivo del piloto | No hay fecha fija. Se avanza por criterio de salida de cada fase. |
| Régimen tributario | Se soportan todos los regímenes de Colombia (sección 7.1). |
| Inventario por sede | Un solo inventario por punto, más bodegas de la sede o generales para reabastecer (sección 5). |
| Internet en las sedes | Toda sede tiene internet y nace en modo nube. El híbrido se activa por sede para seguir durante un corte. Una sede sin conexión permanente queda fuera (sección 9.1). |
| NIT del piloto | Puede haber más de 2 NIT. Algunas sedes comparten NIT y otras no. El modelo soporta cualquier cantidad de contribuyentes por empresa (sección 5). |
| Propinas | Cada sede elige partes iguales para quien trabajó, o un porcentaje por empleado. Los porcentajes son datos de la sede (D-24) |
| Internet de la sede | Lo contrata cada sede. Si no tiene proveedor, se le recomienda uno. El producto no incluye ese contrato (D-25) |
| Datáfonos | Credibanco, Bold y Redeban. Registro del pago en la Fase 1; integración directa evaluada después (M2, ADR-007, PA-43). |
| Política de reservas | Cada sede elige $0, anticipo que se abona y retiene un porcentaje si cancelan, o tarifa no reembolsable. Las cuentas de recaudo son datos de la sede (D-34) |
| Horarios del personal | Conviven los dos modos: contar horas desde la entrada y horarios programados (M8). |
| Alertas de escasez | Niveles por insumo y ubicación, alerta por cobertura y reposición con un toque (M4). |
| Celulares de los meseros | Usan su celular personal, y algunos tienen iPhone. La app del mesero es una PWA que funciona en Android y en iPhone (TRD-00, sección 5.4). |
| Plataformas de domicilio | Se integran Rappi, DiDi Food y cualquier otra plataforma con conectores, más captura manual como respaldo (M5). Al inicio se usan adaptadores y datos de prueba (D-35). Los accesos reales siguen en PA-28 |
| Router y módem 4G | Se recomiendan. Los compra el dueño de la sede. El producto es solo software (D-36) |
| Bodega general | Tiene internet y personal propio. En el piloto opera con su propio nodo en modo bodega (D-04; TRD-00, sección 5.5). Operarla desde la web para clientes pequeños sigue abierto: PA-44. |
| Proveedor DIAN | Factus (sección 7, M3). Revisada su documentación: factura electrónica para todas las ventas, propina como recargo, anticipos, una cuenta por NIT (TRD-00, sección 8.2). |
| Documento de cada venta | Factura electrónica de venta para todo el mundo, en todas las sedes, con Factus. Sin datos del cliente, consumidor final `222222222222`. No se usa el documento equivalente POS (D-07, M3). |
| Factura global a fin de mes | **No se permite.** La norma exige un documento por venta, en el momento de la venta (M3, regla 8). |
| Envío cortado a mitad de camino | Se consulta en Factus si se emitió; solo si no, se reintenta (TRD-00, sección 8.3). |
| Contingencia con factura de papel | No se usa. Sin internet, comprobante que dice que no es factura, con QR de consulta, y emisión diferida al reconectar (D-10; TRD-00, sección 8.3). |
| Nómina | No se hace nómina. Solo se registran las horas de entrada y salida (M8). |
| Reservas | Entran al alcance, con cobro opcional (M9). |
| Validación de impuestos | La hace el equipo: un tecnólogo en contabilidad (socio del proyecto) y un contador (sección 7.1). |
| Precio de la suscripción | Se define al final, en la Fase 4 (M7), con los costos reales (Factus, infraestructura, soporte). |
| Bolsa de documentos de Factus | Una bolsa por empresa, con un cupo asignado a cada NIT. El saldo de cada cuenta se consulta en la API y la empresa ve la suma (D-16, M7). |
| Precio de Factus 2026 | Bolsa multifacturador o paquete de un NIT, anual. Tablas en TRD-00 §8.2 (D-18). Lo que cobramos al restaurante sigue abierto (PA-39). |
| Fecha de la factura | La oficial es la de la validación. La de la venta se guarda aparte (D-17). |
| Consulta del adquirente | `GET /v2/dian/acquirer` no consume documentos de la bolsa (D-21). |
| Propina en la factura | Recargo, fuera de la base gravable (D-08). |
| Perfil fiscal | Se elige por contribuyente. Catálogo inicial: INC 8 % o IVA 19 % si es franquicia (D-09). |
| Refacturación | Nota crédito de anulación y factura nueva. Mismo día por defecto; mismo mes como máximo (D-11). |
| Anticipo y monto retenido | El anticipo abonable va en la factura del servicio. El monto retenido usa su propia clasificación (D-12). |
| Pedido de plataforma | La factura de la comida la emite el restaurante. La comisión no se carga (D-13). |
| Compras y Factus | Sin recepción de facturas de proveedores ni documento soporte. El costo es el valor registrado (D-14, D-15). |
| Red Wi-Fi del personal | Probablemente las sedes **no** tienen red separada. El diseño asume que el personal y los clientes comparten la red (TRD-00, sección 10.1.2). |
| Cobro de reservas | Por enlace, llamada o chat, solo transferencia directa a Nequi, Daviplata o Bre-B con verificación manual. En persona en la sede, transferencia o efectivo (D-01). Sin pasarela por ahora (M9, PA-45). |
| Pedido y pago en la mesa por QR | El cliente pide y paga desde el QR de su mesa (6.1.2 y 6.1.3). El pago lo confirma la pasarela que la sede activó. Bold es una de ellas (D-46). |
