# PRD-M7 · SaaS comercial

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fase | 4 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M7](../trd/TRD-M7-saas.md) |
| Diagramas | [Flujo M7](../flujos/m7-saas.md) · [C4 M7](../arquitectura/componentes/c4-m7-saas.md) |

## 1. Resumen

M7 es cómo se vende blackHole: alta de una empresa, sus NIT en Factus, la bolsa de documentos, la suscripción y el acceso de soporte. El administrador de la plataforma no ve la operación del cliente. El soporte entra solo cuando el propietario se lo permite, por un tiempo, y todo queda en la auditoría de esa empresa.

## 2. Alcance

**Incluye**

- Planes y precio por sede. El precio se cierra en esta fase, con los costos reales.
- Alta guiada: empresa, contribuyentes, sedes, propietario, requisitos de cada NIT y carga inicial de menú, recetas e insumos.
- Cobro de la suscripción, falta de pago, periodo de gracia y suspensión.
- Bolsa de documentos por empresa: un cupo por NIT, saldo consultado en Factus, consumo por NIT y por sede, alerta por días de cobertura y recarga (D-16).
- Si el cupo de un NIT se agota, se sigue vendiendo y las facturas de ese NIT quedan pendientes hasta recargar. Los demás NIT siguen emitiendo.
- Panel de soporte: nodos, sincronización, facturas pendientes y señales para negociar con Factus. Es una vista de la web de administración, visible solo con permisos de soporte, no una aplicación aparte (D-05).
- Acceso de soporte con vencimiento.

**No incluye**

- La operación del salón. Crearla es de M0 a M4; este módulo solo abre la organización y carga archivos.
- Elegir la nube de producción (ADR-005) ni el pipeline (TRD-01).
- Un desarrollo a la medida para el primer cliente que no es del piloto. Si hace falta, no entra (PRD-00, riesgo del piloto).
- Cómo se cobra la bolsa, incluida o aparte: se decide con el precio, en esta fase. Hasta entonces el saldo y la alerta ya existen.

## 3. Usuarios y permisos

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Administrador de la plataforma | Crear empresas, planes, recargas y ver señales de Factus. No ve pedidos ni caja | No |
| Propietario | Ver saldo, conceder y revocar soporte, seguir la configuración guiada | Concede el acceso él mismo |
| Administrador de la empresa | Ver el consumo por NIT y por sede, y la alerta de saldo | No cambia el plan |
| Soporte | Dentro del acceso vigente, diagnosticar nodos, sincronización y facturas pendientes | El acceso lo concede el propietario |

## 4. Historias de usuario

### HU-M7-01 · Dar de alta una empresa

**Como** administrador de la plataforma, **quiero** crear la empresa, sus NIT y su propietario, **para** que la configuración guiada la deje lista para facturar.

Criterios de aceptación:

- [ ] Dado los datos del cliente, cuando se crea, entonces existen la empresa, los contribuyentes, las sedes y un propietario, vía M0.
- [ ] Cada NIT muestra los requisitos: Cámara de Comercio, cédula del representante, RUT, rango DIAN y certificado.
- [ ] La carga inicial acepta menú, insumos y recetas, y aplica perfiles fiscales predefinidos.
- [ ] Queda auditado: el alta y quién la hizo. El administrador de la plataforma no queda con una sesión dentro de la operación.

### HU-M7-02 · No parar la venta si se acaba la bolsa

**Como** administrador de la empresa, **quiero** ver para cuántos días alcanza la bolsa, **para** recargar antes de que las facturas queden pendientes.

Criterios de aceptación:

- [ ] Dado el ritmo de un NIT, cuando su cupo cubre 15 días o menos, entonces alerta amarilla; a 5 días, roja; en cero, crítica.
- [ ] En cero se sigue vendiendo. Las facturas de ese NIT quedan pendientes y se emiten al recargar. Los demás NIT siguen emitiendo.
- [ ] El consumo se ve por NIT y por sede.
- [ ] Queda auditado: la recarga y cada alerta enviada a soporte.

### HU-M7-03 · Cobrar, dar gracia y suspender

**Como** administrador de la plataforma, **quiero** que una suscripción pase por cobro, falta de pago, gracia y suspensión, **para** no cortar el servicio el mismo día del fallo.

Criterios de aceptación:

- [ ] Dado un plan por sede, cuando el cobro falla, entonces entra en gracia y, al vencer, se suspende.
- [ ] Suspendida, los datos y los documentos ya emitidos siguen. Qué puede hacer todavía la sede (cerrar el día, o solo consultar) se fija en la entrega 4.3 (PA-40).
- [ ] Al reactivar, vuelve el acceso y se retoman las facturas pendientes si hay saldo.
- [ ] Queda auditado: cada cambio de estado de la suscripción.

### HU-M7-04 · Entrar a soporte con permiso

**Como** propietario, **quiero** dejar entrar a soporte por un rato y poder echarlo, **para** que diagnostiquen sin una cuenta permanente.

Criterios de aceptación:

- [ ] Dado un acceso concedido, cuando soporte entra, entonces ve nodos, sincronización y facturas pendientes de esa empresa, hasta la hora de vencimiento.
- [ ] Revocar o llegar al vencimiento corta el acceso.
- [ ] Sin concesión, el administrador de la plataforma no abre la operación.
- [ ] Queda auditado, en la auditoría del cliente: quién entró, qué consultó y cuándo venció.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | Una bolsa por empresa. El consumo se atribuye a NIT y sede | Si Factus confirma que varios NIT comparten bolsa |
| 2 | Alerta amarilla a 15 días y roja a 5, al administrador y a soporte | Los días, por empresa |
| 3 | Saldo en cero no bloquea la venta | No |
| 4 | La suscripción pasa por activa, en gracia y suspendida. No salta la gracia | La duración de la gracia |
| 5 | El precio es por sede | El plan |
| 6 | El soporte no entra sin acceso vigente del propietario | La duración máxima del acceso |
| 7 | El administrador de la plataforma no tiene un rol dentro del cliente | No |
| 8 | Una suspensión no borra datos ni documentos ya emitidos | No |

## 6. Pantallas y flujos

Backoffice, solo para el equipo de blackHole: empresas, planes, bolsas, recargas, señales de Factus.

Web de administración del cliente: configuración guiada, saldo, requisitos del NIT, conceder soporte.

Panel de soporte, como vista de la misma web de administración con permisos de soporte: estado de nodos, cola de sincronización, facturas pendientes. Los datos de una empresa solo aparecen con el acceso vigente que concedió su propietario. Sin escritorio remoto.

Recorrido: [Flujo M7](../flujos/m7-saas.md).

## 7. Reportes y métricas que alimenta

M6 recibe consumo de documentos y señales para negociar el precio por volumen con Factus. No es un reporte del restaurante: es del panel de soporte. El cliente ve su saldo y el consumo por NIT y sede.

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Suscripción de prueba | Pasa por cobro, falta de pago, gracia y suspensión |
| Alta guiada | Una empresa de prueba queda lista para facturar sin desarrollo a la medida |
| Soporte | Diagnostica una sede sin acceso remoto al equipo |
| Primer cliente fuera del piloto | Se configura sin un desarrollo exclusivo |
| Bolsa en cero | La venta sigue y la factura queda pendiente |

## 9. Preguntas abiertas

- PA-38: pasarela de cobro de la suscripción, distinta de la del QR de la mesa. Ver [registro](../preguntas-abiertas.md).
- PA-39: precio por sede, y si la bolsa va incluida o aparte. Ver [registro](../preguntas-abiertas.md).
- PA-40: con la sede suspendida, si se puede cerrar el servicio del día o solo consultar. Ver [registro](../preguntas-abiertas.md).
