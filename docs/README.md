# Documentación del producto

Software SaaS para restaurantes: punto de venta mobile first, cocina, caja, inventario con recetas, facturación electrónica DIAN, domicilios y plataformas, reservas, asistencia del personal, roles y auditoría. Se vende por suscripción mensual. El primer cliente piloto era un grupo de 6 restaurantes; ese piloto se canceló. El software de inventario en la nube está cerrado desde el 2026-11-19. El nodo y la bodega híbrida siguen pendientes.

> Nombre de trabajo: **blackHole**. El nombre comercial está por definir (PA-46).

## Cómo está organizada

Usamos un enfoque **híbrido**: dos documentos maestros que fijan las reglas comunes y un PRD + TRD por módulo que heredan de ellos.

| Nivel | Documento | Qué responde |
|-------|-----------|--------------|
| 0 | [PRD-00 Visión de producto](prd/PRD-00-vision-producto.md) | Qué construimos, para quién, en qué orden y cómo sabemos que funcionó |
| 0 | [TRD-00 Arquitectura base](trd/TRD-00-arquitectura-base.md) | Cómo se construye: bounded contexts, screaming architecture, hexagonal, TDD (AAA y GWT), SOLID, DRY, KISS, YAGNI, cortes de internet, sincronización, seguridad, stack |
| 0 | [Roadmap](roadmap.md) | En qué entregas pequeñas se parte cada fase y cuándo se da por cerrada cada una |
| 1 | [TRD-01 Infraestructura y operación](trd/TRD-01-infraestructura-y-operacion.md) | Terraform en AWS, GCP y Azure, despliegue continuo, escalado, monitoreo y errores |
| 1 | PRD y TRD por módulo | Detalle funcional y técnico de cada módulo. El alcance completo ya está escrito; cada entrega del roadmap implementa un corte |

| Transversal | [Registro de preguntas abiertas](preguntas-abiertas.md) | Qué falta por decidir (códigos PA-xx) y qué ya se decidió (códigos D-xx) |
| Transversal | [Glosario de código](glosario-codigo.md) | Cómo se nombra en inglés cada concepto en carpetas, clases, eventos, tablas, permisos y pruebas |

Plantillas para los documentos de módulo: [PRD de módulo](plantillas/PRD-modulo.md) y [TRD de módulo](plantillas/TRD-modulo.md).

### Jerarquía

- **PRD-00 y TRD-00 son los maestros.** Los documentos de módulo heredan de ellos y no los contradicen.
- **El PRD manda en lo de negocio** (qué hace el producto y con qué reglas); **el TRD manda en lo técnico** (cómo se construye).
- **El TRD manda sobre los diagramas.** Si un flujo o un diagrama C4 no coincide con su TRD, se corrige el diagrama.
- **Las preguntas abiertas viven solo en el [registro](preguntas-abiertas.md).** Los demás documentos citan su código, por ejemplo "Pendiente: PA-10", en lugar de repetir la pregunta.
- **Los nombres en código los fija el [glosario](glosario-codigo.md).** Los documentos se escriben en español, y los identificadores que citan van en inglés (D-06).

Los flujos de cada funcionalidad, y cómo se pasan el trabajo entre sí, están diagramados en [Flujos](flujos/README.md).

La estructura del sistema (diagramas C4 de contexto, contenedores y componentes por módulo) y la comunicación de la infraestructura (redes, protocolos, puertos y quién abre cada conexión) están en [Arquitectura](arquitectura/README.md).

## Mapa de módulos

| ID | Módulo | Fase | PRD | TRD |
|----|--------|------|-----|-----|
| M0 | Plataforma: organización, identidad, roles, auditoría, nodo local | 0 | [PRD-M0](prd/PRD-M0-plataforma.md) y [PRD-01 Roles](prd/PRD-01-roles-y-permisos.md) | [TRD-M0](trd/TRD-M0-plataforma.md) |
| M1 | Pedidos y salón: mesas, pedidos del mesero y por QR, comandas, pantalla de cocina | 1 | [PRD-M1](prd/PRD-M1-pedidos-y-salon.md) | [TRD-M1](trd/TRD-M1-pedidos-y-salon.md) |
| M2 | Caja: turnos, pagos, pago QR en la mesa, arqueos, propinas | 1 | [PRD-M2](prd/PRD-M2-caja.md) | [TRD-M2](trd/TRD-M2-caja.md) |
| M3 | Facturación electrónica DIAN (Factus) e impresión | 1 | [PRD-M3](prd/PRD-M3-facturacion.md) | [TRD-M3](trd/TRD-M3-facturacion.md) |
| M4 | Inventario, bodegas y recetas | 2, cerrada en la nube el 2026-11-19. El nodo sigue en la fase híbrida | [PRD-M4](prd/PRD-M4-inventario.md) | [TRD-M4](trd/TRD-M4-inventario.md) |
| M5 | Domicilios propios y plataformas (Rappi, DiDi Food, otras) | 3 | [PRD-M5](prd/PRD-M5-domicilios.md) | [TRD-M5](trd/TRD-M5-domicilios.md) |
| M6 | Reportes y analítica | 1 a 4. El costo de alimentos de la fase 2 ya está en la nube | [PRD-M6](prd/PRD-M6-reportes.md) | [TRD-M6](trd/TRD-M6-reportes.md) |
| M7 | SaaS comercial: planes, suscripciones, onboarding | 4 | [PRD-M7](prd/PRD-M7-saas.md) | [TRD-M7](trd/TRD-M7-saas.md) |
| M8 | Asistencia del personal (entrada, salida, horas trabajadas) | 1 | [PRD-M8](prd/PRD-M8-asistencia.md) | [TRD-M8](trd/TRD-M8-asistencia.md) |
| M9 | Reservas con cobro | 3 | [PRD-M9](prd/PRD-M9-reservas.md) | [TRD-M9](trd/TRD-M9-reservas.md) |

## Reglas de los documentos

- Un documento de módulo **no puede contradecir** a PRD-00 o TRD-00. Si necesita hacerlo, primero se cambia el maestro.
- Las decisiones técnicas relevantes se registran como ADR (Architecture Decision Record) en `docs/adr/`.
- Cada documento lleva estado: `Borrador` → `En revisión` → `Aprobado`.
