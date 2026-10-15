# Documentación del producto

Software SaaS para restaurantes: punto de venta mobile first, cocina, caja, inventario con recetas, facturación electrónica DIAN, domicilios y plataformas, reservas, asistencia del personal, roles y auditoría. Se vende por suscripción mensual. El primer cliente piloto es un grupo de 6 restaurantes.

> Nombre de trabajo: **blackHole**. El nombre comercial está por definir.

## Cómo está organizada

Usamos un enfoque **híbrido**: dos documentos maestros que fijan las reglas comunes y un PRD + TRD por módulo que heredan de ellos.

| Nivel | Documento | Qué responde |
|-------|-----------|--------------|
| 0 | [PRD-00 Visión de producto](prd/PRD-00-vision-producto.md) | Qué construimos, para quién, en qué orden y cómo sabemos que funcionó |
| 0 | [TRD-00 Arquitectura base](trd/TRD-00-arquitectura-base.md) | Cómo se construye: arquitectura, offline, sincronización, seguridad, stack |
| 0 | [Roadmap](roadmap.md) | En qué entregas pequeñas se parte cada fase y cuándo se da por cerrada cada una |
| 1 | [TRD-01 Infraestructura y operación](trd/TRD-01-infraestructura-y-operacion.md) | Terraform en AWS, GCP y Azure, despliegue continuo, escalado, monitoreo y errores |
| 1 | PRD-XX / TRD-XX por módulo | Detalle funcional y técnico de cada módulo, limitado al alcance de la entrega (se escriben al iniciar cada entrega) |

Plantillas para los documentos de módulo: [PRD de módulo](plantillas/PRD-modulo.md) y [TRD de módulo](plantillas/TRD-modulo.md).

Los flujos de cada funcionalidad, y cómo se pasan el trabajo entre sí, están diagramados en [Flujos](flujos/README.md).

## Mapa de módulos

| ID | Módulo | Fase | PRD | TRD |
|----|--------|------|-----|-----|
| M0 | Plataforma: organización, identidad, roles, auditoría, nodo local | 0 | [PRD-01 Roles y permisos](prd/PRD-01-roles-y-permisos.md) (resto pendiente) | Roles en TRD-00, 10.2 (resto pendiente) |
| M1 | Pedidos y salón: mesas, pedidos, comandas, pantalla de cocina | 1 | Pendiente | Pendiente |
| M2 | Caja: turnos, pagos, arqueos, propinas | 1 | Pendiente | Pendiente |
| M3 | Facturación electrónica DIAN (Factus) e impresión | 1 | Pendiente | Pendiente |
| M4 | Inventario, bodegas y recetas | 2 | Pendiente | Pendiente |
| M5 | Domicilios propios y plataformas (Rappi, DiDi Food, otras) | 3 | Pendiente | Pendiente |
| M6 | Reportes y analítica | 1 a 4 (incremental) | Pendiente | Pendiente |
| M7 | SaaS comercial: planes, suscripciones, onboarding | 4 | Pendiente | Pendiente |
| M8 | Asistencia del personal (entrada, salida, horas trabajadas) | 1 | Pendiente | Pendiente |
| M9 | Reservas con cobro | 3 | Pendiente | Pendiente |

## Reglas de los documentos

- Un documento de módulo **no puede contradecir** a PRD-00 o TRD-00. Si necesita hacerlo, primero se cambia el maestro.
- Las decisiones técnicas relevantes se registran como ADR (Architecture Decision Record) en `docs/adr/`.
- Cada documento lleva estado: `Borrador` → `En revisión` → `Aprobado`.
