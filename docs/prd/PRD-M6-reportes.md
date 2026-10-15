# PRD-M6 · Reportes y analítica

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 1 a 4 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M6](../trd/TRD-M6-reportes.md) |
| Diagramas | [Flujo M6](../flujos/m6-reportes.md) · [C4 M6](../arquitectura/componentes/c4-m6-reportes.md) |

## 1. Resumen

M6 lee lo que los demás módulos ya registraron. No crea ventas ni corrige caja. El día se consulta en la sede, también sin internet. El histórico, el consolidado y las alertas de comportamiento viven en la nube. Las horas y los tiempos se capturan desde la Fase 1, aunque el reporte consolidado salga después.

## 2. Alcance

**Incluye**, por fase:

- Fase 1: ventas, medios de pago, tiempos de mesa, caja, horas trabajadas y control del día. En el nodo, el día; en la nube, el histórico de la sede.
- Fase 2: costos, teórico contra real, mermas, inventario y alertas de escasez.
- Fase 3: domicilios, plataformas y reservas.
- Fase 4: las 6 sedes consolidadas, ingeniería de menú, percentiles y exportaciones para el contador.

**No incluye**

- Escribir la operación. Una diferencia de arqueo se corrige en M2, no aquí.
- Contabilidad completa ni nómina. Hay exportación a Excel.
- Una base analítica aparte, salvo que el volumen lo exija (TRD-00, 11).
- Tableros de infraestructura: eso es Grafana, en TRD-01. Aquí son los reportes del negocio.

## 3. Usuarios y permisos

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Cajero | Cierre y turno actual | No ve el histórico de otros turno si el permiso es el del supervisor |
| Supervisor | El turno actual | No |
| Administrador de sede | Su sede, también costos | No |
| Gerente general | Su marca o la empresa, consolidado | No |
| Contador | Fiscal y exportaciones de su contribuyente | No modifica |
| Auditor | Control y auditoría, solo lectura | No |
| Propietario | Todo, incluida la exportación de datos personales | Exportar datos personales exige autorización (PRD-01) |

El mesero no ve costos ni el arqueo de otros.

## 4. Historias de usuario

### HU-M6-01 · Ver el día durante un corte

**Como** administrador, **quiero** ver ventas, caja y tiempos de hoy en la sede, **para** cerrar el servicio aunque no haya internet.

Criterios de aceptación:

- [ ] Dado un turno en curso, cuando abre el reporte del día, entonces ve ventas, medios, anulaciones y tiempos ya capturados.
- [ ] Durante un corte: en híbrido responde el nodo. En modo nube el reporte espera, igual que el salón.
- [ ] Queda auditado: no hay evento de negocio nuevo. Exportar datos personales sí queda auditado.

### HU-M6-02 · Ver el histórico y el consolidado

**Como** gerente, **quiero** ver las sedes juntas por periodo, **para** comparar ticket, tiempos y margen.

Criterios de aceptación:

- [ ] Dado eventos ya sincronizados, cuando filtra por sede, marca, producto, estación, persona, franja o día de la semana, entonces ve promedio, p50 y p90 donde la métrica es un tiempo.
- [ ] Una sede híbrida que estuvo 2 horas sin internet aparece completa después de sincronizar, sin duplicar.
- [ ] La ingeniería de menú cruza popularidad y margen, desde la Fase 4, con los costos de M4.

### HU-M6-03 · Enterarse de un comportamiento inusual

**Como** propietario, **quiero** una alerta si un turno acumula anulaciones o descuentos, **para** revisarlo sin leer la auditoría línea por línea.

Criterios de aceptación:

- [ ] Dado los umbrales de PRD-01, sección 11, cuando se repite el patrón, entonces avisa a quien corresponde.
- [ ] La alerta señala los eventos. No absuelve ni castiga sola.
- [ ] Durante un corte: el detector corre en la nube con lo ya recibido. Lo del corte entra al reconectar.

### HU-M6-04 · Entregarle el mes al contador

**Como** contador, **quiero** el resumen de facturas y los impuestos por NIT, **para** cerrar el mes en el software contable.

Criterios de aceptación:

- [ ] Dado un mes y un contribuyente, cuando exporta, entonces ve cantidad y valor, consumidor final separado de clientes identificados, impuestos y refacturaciones.
- [ ] El resumen no es una factura. El sistema no ofrece agruparlo en un documento DIAN.
- [ ] La exportación de horas para nómina lista trabajadores, sede y periodo, sin calcular salario.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | La métrica sale del evento con hora, no de una fila que se pisa | No |
| 2 | La hora de los tiempos es la del nodo | No |
| 3 | El día operativo se consulta en el dueño de la operación | No |
| 4 | El consolidado espera a que el evento haya subido. No inventa lo que falta: muestra la sede como atrasada | No |
| 5 | Ventas netas son después de descuentos, sin impuestos ni propinas | No |
| 6 | El pago QR va separado del efectivo | No |
| 7 | El costo de alimentos usa el costo teórico de lo vendido | No |
| 8 | Un detector señala. No modifica la operación | Los umbrales de PRD-01 |

Definiciones de cada métrica: [PRD-00, sección 8](PRD-00-vision-producto.md). Este documento no las vuelve a redactar.

## 6. Pantallas y flujos

En la sede: cierre, turno, tiempos en vivo, stock y alertas del día.

Web de administración: histórico, consolidado, control, fiscal, horas y exportaciones.

La familia que alimenta cada pantalla está en [Flujo M6](../flujos/m6-reportes.md).

## 7. Reportes y métricas que alimenta

Este módulo es el destino. Familias:

| Familia | Desde | Cuándo se muestra |
|---------|-------|-------------------|
| Tiempos 8.1 | M1 y M5 | Día en Fase 1; domicilio en Fase 3 |
| Ventas 8.2 | M2 y M3 | Día e histórico en Fase 1; canal en Fase 3; resumen del contador en Fase 4 |
| Costos 8.3 | M4 | Fase 2; ingeniería de menú en Fase 4 |
| Control 8.4 | M0, M1, M2, M4 | Día en Fase 1; detectores en la nube |
| Personal y propinas 8.5 | M8 y M2 | Fase 1 |
| Reservas 8.6 | M9 | Fase 3 |

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Día en el nodo | El administrador lo consulta durante un corte |
| Histórico | Lo consulta desde la web |
| Consolidado | El gerente ve las 6 sedes |
| Cierre de un mes | El contador del piloto usa las exportaciones |
| Duplicados tras un corte | Cero en los totales |

## 9. Preguntas abiertas

| # | Pregunta | Responsable |
|---|----------|-------------|
| 1 | Umbrales de comportamiento del piloto | [PRD-01, sección 13](PRD-01-roles-y-permisos.md) |
| 2 | Formato de exportación que ya usa el contador | Contador, en la Fase 4 |
