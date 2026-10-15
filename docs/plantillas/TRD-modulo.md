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

- [ ] Unitarias del dominio
- [ ] Sincronización: duplicados, desorden, corte de internet
- [ ] E2E del flujo principal

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
