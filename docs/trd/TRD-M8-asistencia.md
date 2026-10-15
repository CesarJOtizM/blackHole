# TRD-M8 · Asistencia del personal

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 1 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M8](../prd/PRD-M8-asistencia.md) |
| Diagramas | [C4 M8](../arquitectura/componentes/c4-m8-asistencia.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Registro | `Marcacion` solo se agrega. La corrección es otra fila que apunta a la original |
| Hora | Puerto `Reloj`. En híbrido, la del nodo. En modo nube, la del servidor. El cliente no la envía |
| Presencia | `PresenciaLocal`. En híbrido la petición entra por la red del nodo. En nube, la PWA llega al puente antes de marcar |
| Horas | Proyección. No hay una columna de horas que alguien edite |
| Regla operativa | M0 llama `TieneEntradaAbierta` si la sede activó la regla |
| Propinas | M2 llama `ParticipantesDelPeriodo` |
| Cierre | Un worker del nodo, a la hora configurada, agrega la salida y deja el turno por revisar |
| Foto | No está. El puerto de archivos de esta fase solo guarda exportaciones |
| Código | `packages/dominio/asistencia`, `packages/aplicacion/asistencia` |

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Entidad | `Marcacion` | Tipos: entrada, salida, inicio de pausa, fin de pausa. Lleva usuario, sede, dispositivo y hora del reloj del servidor. No se actualiza |
| Entidad | `CorreccionMarcacion` | Apunta a una marcación, con motivo. No la sustituye en el almacenamiento; la proyección la aplica |
| Entidad | `HorarioProgramado` | Opcional por trabajador y día. Sin él, solo hay horas |
| Regla | Proyección de horas | Entrada a salida, menos pausas. Con horario: tardanza, ausencia, salida anticipada y tiempo fuera, con tolerancia |
| Regla | Turno abierto | Como máximo una entrada sin salida por persona y sede. Otra entrada se rechaza |

La proyección no redondea a gusto del reporte: la hora queda en minutos del reloj del nodo, y el redondeo, si la sede lo define, es una regla explícita.

## 3. Propiedad de datos y sincronización

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Marcaciones y correcciones de la sede | Nodo en híbrido; nube en modo nube | Hacia la nube y hacia M6 |
| Horarios | Nube | Copia hacia el nodo |
| Proyección | Se calcula al leer. Se puede materializar en M6 | No es un evento de origen |
| Exportación | Nube | Archivo |

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `Marcar` | PIN, tipo, dispositivo | Hora del reloj del servidor. Presencia local. No abre una segunda entrada | `Marcacion` | Dueño de la operación |
| `Corregir` | Marcación, motivo, administrador | Agrega corrección. Llama a M0 para auditar | `CorreccionMarcacion` | Dueño de la operación |
| `CerrarTurnosAbiertos` | Hora de cierre | Agrega salida y marca por revisar | `Marcacion` de salida automática | Nodo, o nube en modo nube |
| `TieneEntradaAbierta` | Usuario y sede | La consulta M0. Los roles administrativos no pasan por aquí | — | Dueño de la operación |
| `ParticipantesDelPeriodo` | Periodo | Personas y horas ya proyectadas. La consulta M2 | — | Dueño de la operación |
| `ExportarHoras` | Sede y periodo | Excel. Sin salario | — | Nube |

## 5. Contratos

**HTTP:** marcar, corregir, quién está ahora.

**Puerto de entrada:** `TieneEntradaAbierta`, `ParticipantesDelPeriodo`.

**Reloj:** el comando de marcar no trae timestamp del cliente. Si viene, se ignora.

Los esquemas Zod viven en `packages/contratos`. El cuerpo de marcación es usuario, sede, dispositivo y tipo.

## 6. Persistencia

`marcaciones`, `correcciones_marcacion`, `horarios`.

- `marcaciones` solo acepta inserción.
- PostgreSQL con `tenant_id` y Row Level Security. SQLite en el nodo, solo su sede.
- Índice por usuario, sede y hora para la proyección del periodo.
- La exportación vive en el almacén de objetos de la nube.

## 7. Operación sin internet

En híbrido se marca, se corrige y se consulta la entrada abierta en el nodo. Las horas del día salen en el reporte local de M6.

En modo nube, un corte impide marcar. No se guarda una marcación en el celular para subirla después: la hora tiene que ser del servidor, y sin servidor no hay hora de confianza.

Al reconectar, las marcaciones suben en orden. Una corrección hecha en el nodo llega después y la proyección de la nube la aplica sin borrar la original.

## 8. Seguridad y auditoría

Marcar exige PIN y dispositivo registrado. Corregir exige el permiso de administrador de esa sede.

La marcación ordinaria no llena la auditoría de acciones sensibles: el registro es la propia fila. Sí quedan en la cadena la corrección, el cambio de horario y el cambio de la regla "sin entrada no opera".

Nadie marca por otro porque el PIN es personal. La foto queda para la Fase 5.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Segunda entrada con turno abierto | Dominio | Se rechaza |
| Proyección resta pausas | Dominio | Las horas coinciden con el ejemplo |
| Sin horario no hay tardanza | Dominio | Solo hay horas |
| Con horario y tolerancia | Dominio | Dentro de la tolerancia no es tardanza |
| La corrección no borra la original | Dominio | Las dos filas existen y la proyección usa la corrección |
| `Marcar` con reloj fijo | Aplicación | Ignora una hora enviada por el cliente |
| Sin presencia local | Aplicación | No hay marcación |
| `TieneEntradaAbierta` | Aplicación | Falso si la última es una salida |
| Cierre automático | Aplicación | Agrega salida y deja por revisar |
| `RepositorioMarcaciones` | Contrato, memoria, SQLite y PostgreSQL | La proyección del periodo coincide |
| Marcar repetido por reintento | Aplicación | La segunda llamada con la misma clave no duplica |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización: marcación duplicada y corrección que llega después
- [ ] Un recorrido Playwright: marcar entrada y ver a la persona en "quién está ahora"

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| Alguien marca por otro | PIN personal y presencia en el local. Foto en la Fase 5 |
| Reloj del celular | No se acepta |
| Turno abierto al día siguiente | Cierre automático por revisar |
| Modo nube en corte | No se marca. Es el mismo criterio del salón |
