# TRD-XX · <Nombre del módulo>

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fase | <0-4> |
| Hereda de | [TRD-00](../trd/TRD-00-arquitectura-base.md) |
| PRD asociado | PRD-XX |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|

## 2. Modelo de dominio

<Agregados, entidades, objetos de valor y sus invariantes. Diagrama si ayuda.>

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|

## 5. Contratos

<Endpoints, mensajes WebSocket y esquemas Zod. Solo los nuevos.>

## 6. Persistencia

<Tablas nuevas, índices y migraciones. Recordar `tenant_id` y Row Level Security en la nube.>

## 7. Operación sin internet

<Qué hace el módulo sin conexión y cómo se reconcilia al volver.>

## 8. Seguridad y auditoría

<Permisos nuevos y eventos de auditoría.>

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](../trd/TRD-00-arquitectura-base.md). Cada fila entra al código en vertical: una prueba en rojo, el mínimo para ponerla en verde, y la siguiente. No se listan aquí pasos de implementación.

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| <invariante del agregado> | Dominio | |
| <caso de uso> | Aplicación, con adaptadores en memoria | |
| <puerto de salida> | Contrato, en memoria, SQLite y PostgreSQL | |
| <comando que se puede reintentar> | Aplicación o adaptador | La segunda vez no duplica |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización, si el módulo emite eventos: duplicado, desorden y corte
- [ ] Un recorrido Playwright del flujo que esta entrega cierra

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
