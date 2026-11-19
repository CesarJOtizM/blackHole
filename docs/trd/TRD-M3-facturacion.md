# TRD-M3 · Facturación electrónica e impresión

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.6 |
| Fecha | 2026-11-19 |
| Fase | 1 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M3](../prd/PRD-M3-facturacion.md) |
| Diagramas | [C4 M3](../arquitectura/componentes/c4-m3-facturacion.md) |
| Nombres | [Glosario de código](../glosario-codigo.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Proveedor | Factus detrás de `InvoicingProvider` (ADR-002). Token OAuth2 por contribuyente, solo en la nube |
| Documento | Lo arma el dueño de la operación con `CreateSalesDocument`. Lo emite un worker en la nube, en orden de venta, con un solo envío en vuelo por rango (D-19) |
| Impuestos | Los calcula M3. M2 envía los ítems con su `TaxClassification`; no envía impuestos. Función pura con `decimal.js`. Precios con impuesto incluido. Redondeo al peso. `TaxRule` con vigencia (ADR-009) |
| Sin internet | Estado `pending_issuance` y comprobante. No hay talonario |
| Envío cortado | Estado `uncertain`. Se consulta por `reference_code` antes de reenviar |
| Ritmo | 80 solicitudes por minuto por NIT, compartidas por todas las instancias. La emisión va antes que la consulta de adquirente |
| Bolsa | Cada documento aceptado emite `DocumentConsumed` a M7. Sin saldo, queda `pending_issuance` con ese motivo |
| Impresión | M3 dispara la factura y el comprobante por el puerto `Printer`. Las plantillas, la cola y el controlador ESC/POS (TCP 9100 o USB) viven en `shared/printing` y no son de M3. En híbrido, cola del nodo. En nube, el puente. La comanda y la precuenta las dispara M1; el cierre, las propinas y el cajón, M2 |
| Archivos | XML y PDF en el almacén de objetos de la nube. El nodo guarda el resultado que necesita imprimir |
| Código | `contexts/invoicing/domain`, `contexts/invoicing/application`, `contexts/invoicing/adapters/factus` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Agregado | `SalesDocument` | Estados: `generated`, `sending`, `accepted`, `rejected`, `pending_issuance`, `uncertain`. Una venta, un `reference_code`. No se edita un aceptado. Guarda la fecha de la venta y `validated_at`; la oficial es la de la validación (D-17) |
| Objeto de valor | `GenericBuyer` | Cinco campos fijos: tipo de documento `13`, número `222222222222`, nombre "Consumidor final", responsabilidad `R-99-PN` y el correo interno configurado por contribuyente. No es un registro editable |
| Entidad | `TaxCustomer` | Por empresa. Dígito de verificación válido si es NIT. Correo con formato válido |
| Función | Motor de impuestos | `TaxProfile` + `TaxClassification` + fecha → base e impuesto, con la `TaxRule` vigente. La propina no entra en la base. La bolsa plástica es línea. En un domicilio solo si la sede la tiene activa (D-29) |
| Entidad | `DianResolution` | Rango del contribuyente, partido por sede o por caja. No se reutiliza un número |
| Entidad | `Reinvoicing` | Nota crédito aceptada antes de la factura nueva. Quedan enlazadas. Consume dos documentos |

`CreditNote` es un documento con su propia referencia, que apunta al original. No modifica el original.

El trabajo de impresión (`PrintJob`: plantilla, ancho 80 o 58, reintentos, impresora de respaldo) es de `shared/printing`. M3 solo elige la plantilla de factura o de comprobante.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Documento de venta y su numeración local | Nodo en híbrido; nube en modo nube | `DocumentGenerated`, sube con prioridad máxima |
| Emisión, CUFE, XML, PDF | Nube | `IssuanceResolved` hacia el nodo |
| Clientes fiscales | Nube, por empresa | Copia de los frecuentes de la sede, y los de la cuenta abierta al instante |
| Perfiles, reglas, resoluciones | Nube | Bajan con la configuración |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `CreateSalesDocument` | Venta de M2: ítems con su `TaxClassification`, pagos, propina, anticipos, adquirente | Calcula impuestos. Asigna referencia. Si no hay canal, `pending_issuance` y dispara `PrintReceipt` | `DocumentGenerated` | Dueño de la operación |
| `IssueDocument` | Documento generado | Pasa por el limitador y por Factus. Orden de venta | `IssuanceResolved` o rechazo | Nube |
| `VerifyUncertain` | Referencia de un documento `uncertain` | No reenvía si Factus ya la tiene | `IssuanceResolved` | Nube |
| `IssuePendingDocuments` | Cola de `pending_issuance`, o recarga de bolsa | Mismo orden. Motivo "sin saldo" espera a M7 | `DocumentConsumed` | Nube |
| `RecordIssuanceResult` | Número, CUFE, QR o rechazo | Dispara `PrintInvoice` si el cliente sigue; si no, queda para reimprimir | — | Dueño de la operación |
| `LookUpBuyer` | Documento | Caché. Solo nombre y correo, enmascarados en el portal | — | Nube |
| `RecordBillingData`, `ValidateOtp` | Token de cuenta, consentimiento | Datos por empresa. El OTP no revela datos a quien solo sabe el documento | `BillingDataReceived` hacia el nodo | Nube |
| `Reinvoice` | Factura aceptada a consumidor final | Dentro del plazo. Nota primero. Aprobación si la empresa la pide | `Reinvoiced` | Nube |
| `PrintInvoice`, `PrintReceipt`, `Reprint` | Plantilla de factura o comprobante | Tope de reimpresión. Respaldo si la principal falla (lo resuelve `shared/printing`) | Auditoría de reimpresión | Nodo o puente |

La compra de M4 no llama a Factus. El documento soporte y el XML del proveedor no se emiten (D-14). El cierre de la fase 2 dejó esa compra como orden y recepción.

## 5. Contratos

**Puerto de entrada** (`entry-port.ts`): `CreateSalesDocument`. La respuesta inmediata es el comprobante o, si la emisión alcanzó a volver, número, CUFE y QR. En los dos casos M3 dispara la impresión.

**Portal:** `/d/{token}` para datos de una cuenta. `/f/{reference_code}` para consultar. El token vence y no lista otras cuentas.

**Factus:** el adaptador encapsula OAuth2, el envío, la consulta por referencia y `GET` del adquirente. El dominio no conoce la URL.

**Hacia M7:** `DocumentConsumed` con empresa, NIT, sede y tipo.

**Hacia M2 y el nodo:** `IssuanceResolved`.

**Impresión:** factura y comprobante por `Printer`, con las plantillas de `shared/printing`. El cajón no sale en un trabajo de M3: es un comando de la caja (M2).

Los esquemas Zod del documento interno viven en `shared/contracts`. El XML de la DIAN lo arma el adaptador, no el dominio.

## 6. Persistencia

`sales_documents`, `credit_notes`, `reinvoicings`, `tax_customers`, `consents`, `tax_rules`, `tax_profiles`, `dian_resolutions`. La tabla `print_jobs` es de `shared/printing`.

- `reference_code` único por venta.
- Un número de resolución no se asigna dos veces.
- PostgreSQL con `tenant_id` y Row Level Security. El nodo solo tiene los documentos de su sede.
- Credenciales de Factus en `Secrets`, el gestor de secretos. No hay copia en SQLite ni en la PWA.
- XML y PDF en el almacén de objetos (`FileStorage`: S3, Cloud Storage o Blob), según la nube de TRD-01.

## 7. Operación sin internet

El nodo crea el documento y lo deja `pending_issuance`. Imprime el comprobante. Al reconectar, el worker emite en orden de venta, con un solo envío en vuelo por rango (D-19), después de verificar los `uncertain`.

Si la bolsa está en cero, el estado `pending_issuance` lleva motivo "sin saldo" y no se reintenta hasta la recarga.

La consulta del portal no necesita el nodo: el cliente usa sus datos móviles. Los datos esperan en la nube y se aplican al emitir si llegaron antes. Si llegaron después de una factura a consumidor final, el camino es `Reinvoice`.

En modo nube, si el puente está apagado, el trabajo de impresión espera en la nube y la pantalla avisa que no se imprimió.

## 8. Seguridad y auditoría

- El token de Factus no sale de la nube.
- El portal enmascara nombre y correo. Los datos guardados solo reaparecen con el código enviado al titular.
- Límite de consultas por enlace, para frenar la enumeración de cédulas.
- Permisos: reimprimir (tope), nota crédito y aprobar refacturación (PRD-01).
- Consentimiento, emisión, rechazo, reimpresión y refacturación quedan en la auditoría (`RecordAuditEvent`).
- Eliminar datos del titular borra el uso futuro. No borra el XML ya emitido: ese documento es fiscal.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Precio con impuesto incluido | Dominio | Base más impuesto igualan el precio, al peso |
| Propina fuera de la base | Dominio | No cambia el impuesto |
| `GenericBuyer` | Dominio | Los cinco campos (tipo, número, nombre, responsabilidad y correo interno del contribuyente), para cualquier valor |
| Dos números para la misma venta | Dominio | Se rechaza |
| `CreateSalesDocument` con ítems sin impuestos | Aplicación | M3 calcula base e impuesto desde la clasificación |
| `VerifyUncertain` si Factus ya validó | Aplicación | No reenvía |
| `IssueDocument` repetido | Aplicación | La segunda vez no crea otro documento |
| Sin saldo de bolsa | Aplicación | Queda `pending_issuance` y la venta no se bloquea |
| `Reinvoice` fuera de plazo | Aplicación | No llama a Factus |
| `InvoicingProvider` | Contrato (`invoicing-provider.contract.ts`), simulado y sandbox | Aceptado, rechazado e incierto |
| Plantillas de factura y comprobante | Contrato de `Printer` (`shared/printing`) | Salen en 80 y en 58; el respaldo se usa si la principal falla |

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
| ADR-002 Factus | Decidido (D-16 a D-20). El tarifario 2026 está en TRD-00 §8.2 |
| ADR-009 Motor de impuestos | Decidido (D-09). El perfil se selecciona. La tabla de casos se compara con el sandbox |
| Límite de 80 por minuto | Cola por NIT. Un solo envío en vuelo por rango (D-19). Emisión antes que consultas |
| Refacturación cara en documentos | Mismo día por defecto y mismo mes como máximo, con aprobación opcional (D-11) |
| Token en el nodo | Prohibido. El puerto no existe en el nodo |
