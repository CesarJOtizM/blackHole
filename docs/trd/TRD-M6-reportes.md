# TRD-M6 · Reportes y analítica

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 1 a 4 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M6](../prd/PRD-M6-reportes.md) |
| Diagramas | [C4 M6](../arquitectura/componentes/c4-m6-reportes.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Escritura | Ninguna de operación. Lee eventos y tablas que los otros módulos ya cerraron |
| Día | Consultas sobre SQLite del nodo, o sobre PostgreSQL si la sede está en modo nube |
| Histórico | Proyecciones en PostgreSQL, por workers, a partir del inbox |
| Réplica de lectura | Solo si el volumen lo pide (TRD-01). Al inicio bastan vistas materializadas |
| Hora | La del nodo, ya guardada en el evento. El reporte no resta relojes |
| Detectores | Workers en la nube. Avisan por el notificador de M0. No escriben en M1 ni en M2 |
| Exportación | Archivo en el almacén de objetos. Excel para contador y para quien liquida nómina |
| Código | `contextos/reportes/dominio`, `contextos/reportes/aplicacion` |

## 2. Modelo de dominio

No hay agregados de operación. Hay definiciones puras, para que el mismo número salga en el nodo y en la nube.

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Regla | Tiempo entre dos estados | Resta las horas del nodo. Si falta un extremo, el tiempo no existe; no se inventa |
| Regla | Venta neta | Después de descuentos, sin impuestos ni propina |
| Regla | Costo de alimentos | Costo teórico de lo vendido dividido entre venta neta |
| Regla | Percentiles | p50 y p90 sobre el conjunto filtrado, con la misma definición en los dos lados |
| Regla | Ingeniería de menú | Cruza popularidad y margen. Sin costo de M4 no clasifica el margen |
| Regla | Detector | Cuenta eventos ya persistidos. Un patrón repetido abre una alerta; no crea otro evento de negocio |

Una proyección atrasada se marca atrasada. No rellena ceros como si la sede no hubiera vendido.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Hechos del día | El dueño de la operación, leídos en sitio | Ninguno nuevo |
| Proyecciones e histórico | Nube | Ninguno hacia la operación |
| Alerta de detector | Nube | Aviso por M0 |
| Archivo exportado | Nube | Auditoría si incluye datos personales |

M6 no tiene outbox de negocio. Si un evento llega dos veces al inbox, la proyección cuenta una.

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| Consultas del día | Turno, sede, hoy | Lee la base local. No espera a la nube | — | Nodo, o nube en modo nube |
| `ProyectarHechos` | Inbox | Idempotente por dispositivo y secuencia. Dimensiones: día, sede, producto, estación, persona | — | Nube |
| `DetectarPatrones` | Hechos y umbrales | Anulaciones, descuentos, cajón, pareja que se repite, autoautorización | Aviso | Nube |
| `ConsultarConsolidado` | Filtros y periodo | Marca la sede atrasada si su cursor no está al día | — | Nube |
| `Exportar` | Periodo, contribuyente o sede | Fiscal, impuestos u horas. Sin salario | Auditoría si hay datos personales | Nube |

Familias y fuente: [C4 M6](../arquitectura/componentes/c4-m6-reportes.md).

## 5. Contratos

**HTTP del día:** cierre, turno, tiempos en vivo. Solo lectura.

**HTTP de administración:** consolidado, control, fiscal, exportaciones.

No hay puerto de entrada para que otro módulo "guarde un reporte". Los otros emiten sus eventos; el projector los lee del inbox.

Los esquemas Zod de los filtros viven en `compartido/contratos`. La definición numérica vive en el dominio, no en el SQL de un solo adaptador: el SQL la implementa.

## 6. Persistencia

Tablas de hechos por día, sede, producto, estación y persona. Vistas materializadas para los cortes que el piloto consulta. El inbox lo escribe M0; M6 no lo altera.

- `tenant_id` y Row Level Security en cada tabla de hechos.
- El nodo no replica el histórico de otras sedes.
- Los archivos de exportación salen del almacén de objetos y vencen.
- Una base analítica separada queda fuera hasta que TRD-00, sección 11, lo pida.

## 7. Operación sin internet

El nodo responde el día con lo que ya tiene: ventas, caja, tiempos, horas y alertas de inventario locales.

El consolidado, los detectores y el Excel esperan en la nube. Al reconectar, `ProyectarHechos` alcanza el cursor sin sumar dos veces.

En modo nube no hay copia del día en un nodo. Si no hay enlace, no hay reporte, igual que no hay caja.

## 8. Seguridad y auditoría

Cada consulta filtra por el alcance del rol: sede, marca, empresa o contribuyente. El supervisor no recibe el histórico de otros turnos.

Costos y margen exigen el permiso de ver costos. La auditoría de la sede la ve el administrador solo de su sede; el auditor, la de la empresa.

Exportar datos personales de clientes exige autorización y queda en la cadena.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Tiempo sin estado final | Dominio | No devuelve un número |
| Venta neta | Dominio | Excluye impuesto, propina y descuento |
| Percentil | Dominio | p50 y p90 del conjunto de prueba |
| Sede atrasada | Dominio | No aparece como venta cero |
| `ProyectarHechos` repetido | Aplicación | El total no cambia |
| Detector | Aplicación | Avisa y no escribe en caja ni en pedidos |
| Alcance de sede | Aplicación | El administrador de la sede 1 no lee la sede 2 |
| `FuenteEventos` | Contrato, memoria, SQLite y PostgreSQL | El mismo día da el mismo total |
| Exportación fiscal | Aplicación | Separa consumidor final y no es un documento DIAN |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso. Las de lectura declaran alcance
- [ ] Sincronización: evento duplicado y sede atrasada
- [ ] Un recorrido Playwright: abrir el cierre del día y el histórico de esa sede

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| Eventos de la Fase 1 mal nombrados | Las definiciones de la sección 2 se fijan antes de la entrega 1.11, porque después no se puede reconstruir la historia |
| Volumen | Vistas materializadas primero. Réplica solo con evidencia |
| Reloj del celular | No se usa. La hora ya viene del nodo |
