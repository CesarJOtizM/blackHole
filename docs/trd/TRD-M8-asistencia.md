# TRD-M8 · Asistencia del personal

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.2 |
| Fecha | 2026-10-17 |
| Fase | 1 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M8](../prd/PRD-M8-asistencia.md) |
| Diagramas | [C4 M8](../arquitectura/componentes/c4-m8-asistencia.md) |

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Registro | `ClockEntry` solo se agrega. La corrección es otra fila que apunta a la original |
| Hora | Puerto `Clock`. En híbrido, la del nodo. En modo nube, la del servidor. El cliente no la envía |
| Presencia | Puerto `VenuePresence`. En híbrido la petición entra por la red del nodo. En nube, la PWA llega al puente antes de marcar. Sin presencia comprobada no hay marcación, sin excepciones (PRD-M8, regla 3) |
| Horas | Proyección. No hay una columna de horas que alguien edite |
| Regla operativa | M0 llama `HasOpenClockIn` si la sede activó la regla |
| Propinas | M2 llama `ParticipantsForPeriod` |
| Cierre | Un worker del nodo, a la hora configurada, agrega la salida y deja el turno por revisar |
| Foto | No está. El puerto de archivos de esta fase solo guarda exportaciones |
| Código | `contexts/attendance/domain`, `contexts/attendance/application` |

La excepción de [TRD-00, 10.1.1](TRD-00-arquitectura-base.md), que deja operar desde cualquier lugar a una sede en modo nube sin ningún equipo local, vale para operar, no para marcar. Esa sede no puede comprobar presencia, así que no marca hasta tener un puente en el local.

## 2. Modelo de dominio

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Entidad | `ClockEntry` | Tipos `clock_in`, `clock_out`, `break_start`, `break_end`. Lleva usuario, sede, dispositivo y hora del reloj del servidor. No se actualiza |
| Entidad | `ClockEntryCorrection` | Apunta a una marcación, con motivo. No la sustituye en el almacenamiento; la proyección la aplica |
| Entidad | `ScheduledShift` | Opcional por trabajador y día. Sin él, solo hay horas |
| Regla | Proyección de horas | Entrada a salida, menos pausas. Con horario: tardanza, ausencia, salida anticipada y tiempo fuera, con tolerancia |
| Regla | Turno abierto | Como máximo una entrada sin salida por persona y sede. Otra entrada se rechaza |
| Regla | Estado del turno | `off_shift`, `on_shift`, `on_break` y `pending_review`, este último tras el cierre automático. Se deriva de las marcaciones; no se guarda aparte |

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
| `RecordClockEntry` | PIN, tipo, dispositivo | Hora del reloj del servidor. Presencia en el local. No abre una segunda entrada | `ClockEntryRecorded` | Dueño de la operación |
| `CorrectClockEntry` | Marcación, motivo, administrador | Agrega corrección. Llama a M0 para auditar | `ClockEntryCorrected` | Dueño de la operación |
| `CloseOpenShifts` | Hora de cierre | Agrega salida y marca por revisar | `ClockEntryRecorded` de salida automática | Nodo, o nube en modo nube |
| `HasOpenClockIn` | Usuario y sede | La consulta M0. Los roles administrativos no pasan por aquí | — | Dueño de la operación |
| `ParticipantsForPeriod` | Periodo | Personas y horas ya proyectadas. La consulta M2 | — | Dueño de la operación |
| `ExportHours` | Sede y periodo | Excel. Sin salario | — | Nube |

## 5. Contratos

**HTTP:** marcar, corregir, quién está ahora.

**Puerto de entrada** (`entry-port.ts`): `HasOpenClockIn`, `ParticipantsForPeriod`.

**`Clock`:** el comando de marcar no trae timestamp del cliente. Si viene, se ignora.

Los esquemas Zod viven en `shared/contracts`. El cuerpo de marcación es usuario, sede, dispositivo y tipo.

## 6. Persistencia

`clock_entries`, `clock_entry_corrections`, `scheduled_shifts`.

- `clock_entries` solo acepta inserción.
- PostgreSQL con `tenant_id` y Row Level Security. SQLite en el nodo, solo su sede.
- Índice por usuario, sede y hora para la proyección del periodo.
- La exportación vive en el almacén de objetos de la nube.

## 7. Operación sin internet

En híbrido se marca, se corrige y se consulta la entrada abierta en el nodo. Las horas del día salen en el reporte local de M6.

En modo nube, un corte impide marcar. No se guarda una marcación en el celular para subirla después: la hora tiene que ser del servidor, y sin servidor no hay hora de confianza.

Al reconectar, las marcaciones suben en orden. Una corrección hecha en el nodo llega después y la proyección de la nube la aplica sin borrar la original.

## 8. Seguridad y auditoría

Marcar exige PIN, dispositivo registrado y presencia en el local. Corregir exige el permiso `attendance.correct_entry`, que por defecto tiene el administrador de esa sede ([PRD-01, 6.4](../prd/PRD-01-roles-y-permisos.md)).

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
| `RecordClockEntry` con reloj fijo | Aplicación | Ignora una hora enviada por el cliente |
| Sin presencia en el local | Aplicación | No hay marcación |
| Sede en modo nube sin puente | Aplicación | No hay marcación, aunque el dispositivo esté registrado y tenga PIN |
| `HasOpenClockIn` | Aplicación | Falso si la última es una salida |
| Cierre automático | Aplicación | Agrega salida y deja por revisar |
| `ClockEntryRepository` | Contrato, memoria, SQLite y PostgreSQL | La proyección del periodo coincide |
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
| Sede en modo nube sin equipo local | No marca hasta tener puente en el local |
