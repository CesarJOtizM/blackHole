# PRD-M3 · Facturación electrónica e impresión

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 1 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M3](../trd/TRD-M3-facturacion.md) |
| Diagramas | [Flujo M3](../flujos/m3-facturacion.md) · [C4 M3](../arquitectura/componentes/c4-m3-facturacion.md) |

## 1. Resumen

Cada venta tiene su factura electrónica de venta, emitida por Factus desde la nube. El salón arma el documento, calcula los impuestos y lo imprime. Sin internet el cliente se lleva un comprobante con QR, que no es factura, y la factura sale sola al reconectar. No hay factura de papel ni factura que agrupe varias ventas.

## 2. Alcance

**Incluye**

- Factura electrónica de venta para toda venta, en todas las sedes. Sin documento equivalente POS.
- Adquirente genérico de consumidor final, o datos del cliente capturados en el portal o en caja.
- Motor de impuestos con los regímenes de [PRD-00, 7.1](PRD-00-vision-producto.md): perfiles, vigencias, INC, IVA, exentos, excluidos, bolsas, ultraprocesados y retenciones en el pago.
- Numeración por contribuyente, con rango por sede y, si se quiere, por caja.
- Emisión diferida, verificación de envíos inciertos y notas crédito.
- Portal de datos y consulta de facturas, con Ley 1581.
- Refacturación: nota crédito y factura nueva, dentro del plazo de la empresa.
- Impresión térmica de comanda, precuenta, factura, comprobante, cierre, traslado y propinas. Cajón monedero.
- Documento soporte y recepción de facturas de proveedores, en la Fase 2, por el mismo puerto.

**No incluye**

- Ser proveedor tecnológico ante la DIAN.
- Acumular ventas en una factura global, diaria o mensual.
- Contingencia con talonario de papel.
- El precio de la bolsa de documentos: [PRD-M7](PRD-M7-saas.md). Aquí solo se consume y, si no hay saldo, la factura queda pendiente.
- Envío de la factura por WhatsApp (Fase 5). Factus envía el correo cuando hay correo del cliente.

## 3. Usuarios y permisos

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Cajero | Cobrar y con eso emitir. Ver datos recibidos. Consultar adquirente por documento | Reimprimir factura o precuenta por encima del tope |
| Administrador | Aprobar refacturación si la empresa lo exige. Elegir el plazo | Emitir nota crédito |
| Cliente | Dejar sus datos en el portal, recordarlos con un código, consultar su factura | No ve datos de otra persona |
| Contador | Reportes de impuestos y el resumen mensual. No emite | No |
| Soporte | Ver pendientes y rechazos de la sede autorizada | No ve el token de Factus |

## 4. Historias de usuario

### HU-M3-01 · Factura al cobrar

**Como** cajero, **quiero** que al cerrar la venta salga la factura con número, CUFE y QR, **para** entregarla en segundos sin digitar el adquirente si el cliente ya lo dejó.

Criterios de aceptación:

- [ ] Dado una venta cerrada con internet, cuando M2 pide el documento, entonces Factus lo valida y se imprime con CUFE y QR.
- [ ] Sin datos del cliente, el adquirente es consumidor final (`13`, `222222222222`). Con datos, sale a su nombre.
- [ ] Durante un corte: se imprime un comprobante que dice que no es factura, con QR. Al reconectar se emite en orden de venta, una sola vez.
- [ ] Queda auditado: la emisión, el rechazo y la reimpresión.

### HU-M3-02 · El cliente deja sus datos

**Como** cliente, **quiero** escanear el QR de la precuenta y confirmar mi nombre y correo, **para** que la factura salga a mi nombre sin dictar los datos en caja.

Criterios de aceptación:

- [ ] Dado el enlace de una cuenta, cuando escribe su documento, entonces ve el nombre y el correo enmascarados, completa lo opcional y acepta la política.
- [ ] Nadie obtiene el nombre completo de otra persona escribiendo solo la cédula.
- [ ] Durante un corte de la sede: los datos quedan en la nube, atados al enlace. La caja los ve al reconectar. Si la factura ya salió a consumidor final, aplica la refacturación dentro del plazo.
- [ ] Queda auditado: el consentimiento de la Ley 1581 y, si recuerda los datos, el uso del código de un solo uso.

### HU-M3-03 · Un envío que se cortó

**Como** sistema, **quiero** revisar en Factus si la factura quedó emitida antes de reenviar, **para** que una venta no tenga dos facturas.

Criterios de aceptación:

- [ ] Dado un documento incierto, cuando se consulta por su referencia, entonces se toma la ya validada, se reemplaza la tentativa pendiente, o se reenvía con la misma referencia si no existe.
- [ ] Si la consulta también falla, sigue incierto. No se reenvía a ciegas.
- [ ] Queda auditado: cada consulta y el resultado.

### HU-M3-04 · Refacturar a nombre del cliente

**Como** cliente, **quiero** pedir la factura a mi nombre el mismo día si salió a consumidor final, **para** tener el documento correcto sin que editen el original.

Criterios de aceptación:

- [ ] Dado una factura aceptada a consumidor final y dentro del plazo, cuando se aprueba, entonces sale primero la nota crédito y después la factura nueva, enlazadas.
- [ ] El par consume 2 documentos de la bolsa.
- [ ] Fuera del plazo, o sin la aprobación si la empresa la exige, no se emite.
- [ ] Queda auditado: quién aprobó, plazo vigente al momento y las dos referencias.

### HU-M3-05 · Impuestos según el perfil

**Como** contador, **quiero** que el mismo plato calcule el impuesto según el NIT, el producto y la fecha, **para** no depender de un cambio de código cuando cambie la tarifa.

Criterios de aceptación:

- [ ] Dado un perfil y una clasificación, cuando se factura, entonces la base y el impuesto se desglosan y se redondean al peso, con el precio del menú ya incluido.
- [ ] La propina queda fuera de la base. El anticipo se descuenta en la factura. La bolsa plástica va como línea, no como impuesto.
- [ ] Una tarifa nueva es un registro con vigencia, no un despliegue.
- [ ] Queda auditado: el perfil y la regla usados en el documento.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | Toda venta es factura electrónica. Una venta, un documento, en el momento de la venta | No |
| 2 | Sin datos del cliente se usa el adquirente genérico, para cualquier valor | No |
| 3 | El domicilio a consumidor final lleva la dirección de entrega | No |
| 4 | La propina va como recargo, separada de la venta | No |
| 5 | Sin internet no hay factura de papel: hay comprobante con QR | No |
| 6 | Una referencia única por venta. El reintento no crea otra | No |
| 7 | Refacturar es nota crédito y factura nueva. Plazo por defecto: el mismo día. Máximo recomendado: el mismo mes | El plazo y si exige aprobación, por empresa |
| 8 | Si no hay saldo en la bolsa, se sigue vendiendo y la factura queda pendiente | No |
| 9 | Los datos fiscales se guardan por empresa y no se comparten con otra | No |
| 10 | El impuesto de la línea combina perfil, clasificación y fecha | Las reglas y sus vigencias |
| 11 | Reimprimir factura o precuenta tiene tope y queda auditado | El tope, en PRD-01 |

## 6. Pantallas y flujos

Portal, mobile first, sin instalación:

- Datos de facturación desde la precuenta, el comprobante o el enlace de domicilio o reserva.
- Estado: en proceso o emitida, con PDF y enlace de Factus.
- "Recordar mis datos" con código de un solo uso.

Caja: marca "datos recibidos", consulta por documento y reimpresión.

Web de administración: perfiles fiscales, resoluciones, plazos de refacturación y pendientes.

Cola de impresión en el nodo o en el puente: plantillas 80 mm y 58 mm.

Recorrido: [Flujo M3](../flujos/m3-facturacion.md).

## 7. Reportes y métricas que alimenta

M6 arma el resumen mensual por contribuyente y sede, el porcentaje de facturas con datos del cliente, cuántas llegaron por el portal y las refacturaciones ([PRD-00, 8.2](PRD-00-vision-producto.md)). También pendientes, rechazos y el reporte de impuestos por tipo ([8.2](PRD-00-vision-producto.md) y [7.1](PRD-00-vision-producto.md)).

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Documentos rechazados sin reprocesar | 0 en el piloto |
| Sandbox y producción | Facturas aceptadas, incluido un corte a mitad de un envío sin duplicar |
| Impresoras del piloto | Todas las plantillas en 80 mm y 58 mm |
| Portal | Factura a nombre del cliente sin digitar en caja |
| Privacidad | Con solo la cédula no se ven datos completos de otra persona |
| Casos de régimen | La tabla validada por el contador coincide con Factus en el sandbox |

## 9. Preguntas abiertas

| # | Pregunta | Responsable |
|---|----------|-------------|
| 1 | Procedimiento y plazo de refacturación, y perfiles de impuestos | Contador, antes de la Fase 1 (TRD-00, 8.4) |
| 2 | Si una bolsa de Factus la consumen varios NIT y si la API muestra el saldo | Factus, vía [PRD-00, sección 14](PRD-00-vision-producto.md). No bloquea el arranque |
| 3 | Proveedor de correo y SMS del código de un solo uso | Antes del portal en producción |
