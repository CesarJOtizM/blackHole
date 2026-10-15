# TRD-M3 · Facturación electrónica e impresión

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 1 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M3](../prd/PRD-M3-facturacion.md) |
| Diagramas | [C4 M3](../arquitectura/componentes/c4-m3-facturacion.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Proveedor | Factus detrás de `ProveedorFacturacion` (ADR-002). Token OAuth2 por contribuyente, solo en la nube |
| Documento | Lo arma el dueño de la operación. Lo emite un worker en la nube, en orden de venta |
| Impuestos | Función pura con `decimal.js`. Precios con impuesto incluido. Redondeo al peso. Reglas con vigencia (ADR-009) |
| Sin internet | Estado `pendiente_emision` y comprobante. No hay talonario |
| Envío cortado | Estado `incierto`. Se consulta por `reference_code` antes de reenviar |
| Ritmo | 80 solicitudes por minuto por NIT, compartidas por todas las instancias. La emisión va antes que la consulta de adquirente |
| Bolsa | Cada documento aceptado emite `DocumentoConsumido` a M7. Sin saldo, queda pendiente con ese motivo |
| Impresión | `packages/impresion`. En híbrido, cola del nodo. En nube, el puente. ESC/POS por TCP 9100 o USB |
| Archivos | XML y PDF en el almacén de objetos de la nube. El nodo guarda el resultado que necesita imprimir |
| Código | `packages/dominio/facturacion`, `packages/aplicacion/facturacion`, `packages/facturacion`, `packages/impresion` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `DocumentoVenta` | Estados: generado, enviando, aceptado, rechazado, pendiente de emisión, incierto. Una venta, un `reference_code`. No se edita un aceptado |
| Objeto de valor | `AdquirenteGenerico` | Tipo `13`, número `222222222222`, nombre "Consumidor final", responsabilidad `R-99-PN` |
| Entidad | `ClienteFiscal` | Por empresa. Dígito de verificación válido si es NIT. Correo con formato válido |
| Función | Motor de impuestos | Perfil + clasificación + fecha → base e impuesto. La propina no entra en la base. La bolsa plástica es línea |
| Entidad | `ResolucionDian` | Rango del contribuyente, partido por sede o por caja. No se reutiliza un número |
| Entidad | `Refacturacion` | Nota crédito aceptada antes de la factura nueva. Quedan enlazadas. Consume dos documentos |
| Objeto de valor | `TrabajoImpresion` | Plantilla, ancho 80 o 58, reintentos, impresora de respaldo |

`NotaCredito` es un documento con su propia referencia, que apunta al original. No modifica el original.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Documento de venta y su numeración local | Nodo en híbrido; nube en modo nube | Sube con prioridad máxima |
| Emisión, CUFE, XML, PDF | Nube | `EmisionResuelta` hacia el nodo |
| Clientes fiscales | Nube, por empresa | Copia de los frecuentes de la sede, y los de la cuenta abierta al instante |
| Perfiles, reglas, resoluciones | Nube | Bajan con la configuración |
| Cola de impresión | Nodo, o nube si el puente está apagado | — |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `CrearDocumentoVenta` | Venta de M2: ítems, pagos, propina, anticipos, adquirente | Calcula impuestos. Asigna referencia. Si no hay canal, pendiente | `DocumentoGenerado` | Dueño de la operación |
| `EmitirDocumento` | Documento generado | Pasa por el limitador y por Factus. Orden de venta | `EmisionResuelta` o rechazo | Nube |
| `VerificarIncierto` | Referencia | No reenvía si Factus ya la tiene | `EmisionResuelta` | Nube |
| `EmitirPendientes` | Cola, o recarga de bolsa | Mismo orden. Motivo "sin saldo" espera a M7 | `DocumentoConsumido` | Nube |
| `RegistrarResultado` | Número, CUFE, QR o rechazo | Imprime la factura si el cliente sigue; si no, queda para reimprimir | — | Dueño de la operación |
| `ConsultarAdquirente` | Documento | Caché. Solo nombre y correo, enmascarados en el portal | — | Nube |
| `RegistrarDatosFacturacion`, `ValidarOtp` | Token de cuenta, consentimiento | Datos por empresa. El OTP no revela datos a quien solo sabe el documento | `DatosRecibidos` hacia el nodo | Nube |
| `Refacturar` | Factura aceptada a consumidor final | Dentro del plazo. Nota primero. Aprobación si la empresa la pide | `Refacturacion` | Nube |
| `ImprimirFactura`, `ImprimirComprobante`, `Reimprimir` | Plantilla | Tope de reimpresión. Respaldo si la principal falla | Auditoría de reimpresión | Nodo o puente |
| Documento soporte y XML de proveedor | Compra de M4 | Fase 2. Mismo puerto de Factus | `DocumentoConsumido` | Nube |

## 5. Contratos

**Puerto de entrada:** `CrearDocumentoVenta`. La respuesta inmediata es el comprobante o, si la emisión alcanzó a volver, número, CUFE y QR.

**Portal:** `/d/{token}` para datos de una cuenta. `/f/{reference_code}` para consultar. El token vence y no lista otras cuentas.

**Factus:** el adaptador encapsula OAuth2, el envío, la consulta por referencia y `GET` del adquirente. El dominio no conoce la URL.

**Hacia M7:** `DocumentoConsumido` con empresa, NIT, sede y tipo.

**Hacia M2 y el nodo:** `EmisionResuelta`.

**Impresión:** comandos ESC/POS. El cajón solo sale en un trabajo de la caja.

Los esquemas Zod del documento interno viven en `packages/contratos`. El XML de la DIAN lo arma el adaptador, no el dominio.

## 6. Persistencia

`documentos_venta`, `notas_credito`, `refacturaciones`, `clientes_fiscales`, `consentimientos`, `reglas_impuesto`, `perfiles_fiscales`, `resoluciones_dian`, `trabajos_impresion`.

- `reference_code` único por venta.
- Un número de resolución no se asigna dos veces.
- PostgreSQL con `tenant_id` y Row Level Security. El nodo solo tiene los documentos de su sede.
- Credenciales de Factus en el gestor de secretos. No hay copia en SQLite ni en la PWA.
- XML y PDF en el almacén de objetos (S3, Cloud Storage o Blob), según la nube de TRD-01.

## 7. Operación sin internet

El nodo crea el documento y lo deja `pendiente_emision`. Imprime el comprobante. Al reconectar, el worker emite en orden de venta, después de verificar los inciertos.

Si la bolsa está en cero, el estado pendiente lleva motivo "sin saldo" y no se reintenta hasta la recarga.

La consulta del portal no necesita el nodo: el cliente usa sus datos móviles. Los datos esperan en la nube y se aplican al emitir si llegaron antes. Si llegaron después de una factura a consumidor final, el camino es la refacturación.

En modo nube, si el puente está apagado, el trabajo de impresión espera en la nube y la pantalla avisa que no se imprimió.

## 8. Seguridad y auditoría

- El token de Factus no sale de la nube.
- El portal enmascara nombre y correo. Los datos guardados solo reaparecen con el código enviado al titular.
- Límite de consultas por enlace, para frenar la enumeración de cédulas.
- Permisos: reimprimir (tope), nota crédito y aprobar refacturación (PRD-01).
- Consentimiento, emisión, rechazo, reimpresión y refacturación quedan en la auditoría.
- Eliminar datos del titular borra el uso futuro. No borra el XML ya emitido: ese documento es fiscal.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Precio con impuesto incluido | Dominio | Base más impuesto igualan el precio, al peso |
| Propina fuera de la base | Dominio | No cambia el impuesto |
| Adquirente genérico | Dominio | Esos cinco campos, para cualquier valor |
| Dos números para la misma venta | Dominio | Se rechaza |
| `VerificarIncierto` si Factus ya validó | Aplicación | No reenvía |
| `EmitirDocumento` repetido | Aplicación | La segunda vez no crea otro documento |
| Sin saldo de bolsa | Aplicación | Queda pendiente y la venta no se bloquea |
| Refacturación fuera de plazo | Aplicación | No llama a Factus |
| `ProveedorFacturacion` | Contrato, simulado y sandbox | Aceptado, rechazado e incierto |
| `Impresora` | Contrato | La plantilla sale en 80 y en 58; el respaldo se usa si la principal falla |

La tabla de casos por régimen, validada por el contador, es prueba de dominio del motor y se compara con el sandbox.

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización: duplicado de referencia, desorden de emisión y corte a mitad del envío
- [ ] Un recorrido Playwright del portal: documento, datos enmascarados y factura consultable

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-002 Factus | Decidido. Falta precio por volumen y si la bolsa es compartida entre NIT |
| ADR-009 Motor de impuestos | El contador valida la tabla antes de la Fase 1 |
| Límite de 80 por minuto | Cola única por NIT. Emisión antes que consultas |
| Refacturación cara en documentos | Plazo corto y aprobación opcional |
| Token en el nodo | Prohibido. El puerto no existe en el nodo |
