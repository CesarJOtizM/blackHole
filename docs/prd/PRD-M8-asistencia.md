# PRD-M8 · Asistencia del personal

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 1 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M8](../trd/TRD-M8-asistencia.md) |
| Diagramas | [Flujo M8](../flujos/m8-asistencia.md) · [C4 M8](../arquitectura/componentes/c4-m8-asistencia.md) |

## 1. Resumen

M8 registra quién entró, quién salió y cuánto tiempo estuvo. No liquida salario ni emite nómina electrónica. Esas horas sirven para la regla "sin entrada no opera", para el reparto de propinas y para exportarlas a quien sí liquida la nómina.

## 2. Alcance

**Incluye**

- Marcación de entrada, salida y pausas con el PIN personal.
- Solo dentro del local, en un dispositivo de la sede o en el celular del trabajador en la red del local.
- Dos modos por trabajador: solo horas, o con horario programado (tardanza, ausencia, salida anticipada, horas por fuera).
- Regla opcional por sede: sin entrada marcada no se opera.
- Cierre automático de turnos abiertos, marcados para revisión.
- Corrección del administrador, con motivo, sin editar la marcación original.
- Reportes de horas, tardanzas, ausencias, correcciones, quién está ahora y ventas por hora trabajada.
- Exportación a Excel.

**No incluye**

- Nómina, salario, prestaciones ni nómina electrónica.
- Foto al marcar (Fase 5).
- Marcar desde la calle o adelantando el reloj del celular.
- En modo nube, marcar durante un corte. Igual que el salón, la marcación espera a que vuelva el enlace.

## 3. Usuarios y permisos

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Todo el personal | Marcar su entrada, pausa y salida con su PIN | No marca por otro |
| Administrador de sede | Corregir una marcación, ver reportes de su sede, definir horarios | La corrección exige motivo. No pide un segundo PIN: el permiso ya es suyo (PRD-01) |
| Gerente | Ver todas las sedes de su alcance y exportar | No |
| Cajero y mesero | Marcar. No corrigen ni ven el reporte de otros | No |

## 4. Historias de usuario

### HU-M8-01 · Marcar entrada y salida

**Como** trabajador, **quiero** marcar con mi PIN al llegar y al irme, **para** que quede mi tiempo sin que alguien use mi usuario después.

Criterios de aceptación:

- [ ] Dado un dispositivo de la sede, cuando marca entrada, entonces queda la hora del nodo, no la del celular.
- [ ] Una segunda entrada sin salida no abre otro turno: se le pide salida o queda para corrección.
- [ ] Durante un corte: en híbrido se marca en el nodo. En modo nube no se marca.
- [ ] Queda auditado: la corrección posterior, no la marcación ordinaria. La marcación en sí es el registro.

### HU-M8-02 · Trabajar con o sin horario

**Como** administrador, **quiero** que unos trabajadores solo sumen horas y otros tengan turno programado, **para** ver tardanzas solo donde hay horario.

Criterios de aceptación:

- [ ] Dado el modo solo horas, cuando hay entrada y salida, entonces las horas son la diferencia menos las pausas.
- [ ] Dado un horario, cuando entra tarde o no entra, entonces aparecen tardanza o ausencia, con la tolerancia de la sede.
- [ ] Durante un corte: el horario ya copiado se usa en el nodo.
- [ ] Queda auditado: el cambio de horario de una persona.

### HU-M8-03 · Sin entrada no opera

**Como** administrador, **quiero** exigir la entrada marcada para tomar pedidos o abrir caja, **para** que nadie opere con el usuario de otro fuera de su turno.

Criterios de aceptación:

- [ ] Dado la regla activa, cuando alguien sin entrada intenta una acción operativa, entonces M0 la rechaza.
- [ ] Los roles administrativos quedan exceptuados.
- [ ] Si la regla está apagada, la marcación sigue disponible y no bloquea.
- [ ] Durante un corte: la regla se evalúa en el nodo con las marcaciones locales.

### HU-M8-04 · Corregir un olvido

**Como** administrador, **quiero** cerrar o corregir una marcación con un motivo, **para** no dejar un turno abierto toda la noche ni editar el original.

Criterios de aceptación:

- [ ] Dado una marcación, cuando corrige, entonces nace una corrección que la apunta, con motivo. La original sigue.
- [ ] Al cierre del día, los turnos aún abiertos se cierran solos y quedan por revisar.
- [ ] La exportación a Excel usa la proyección, con las correcciones ya aplicadas.
- [ ] Queda auditado: quién corrigió, la original, el motivo y la hora.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | No es nómina. No hay salario | No |
| 2 | La hora la pone el nodo, o el servidor en modo nube | No |
| 3 | Solo se marca dentro del local | No |
| 4 | Conviven solo horas y horario programado, por trabajador | Sí, por persona |
| 5 | Sin entrada no opera es opcional y exceptúa roles administrativos | Sí, por sede |
| 6 | La corrección no edita la marcación. La proyección lee las dos | No |
| 7 | El cierre automático deja el turno por revisar | La hora de cierre, por sede |
| 8 | Las pausas se restan de las horas | No |
| 9 | La tolerancia de tardanza es de la sede | Sí |

## 6. Pantallas y flujos

En el dispositivo de la sede o en el celular dentro del local: PIN y botones de entrada, pausa y salida. Mobile first.

Web de administración: horarios, correcciones, quién está ahora, exportación.

La caja no tiene una pantalla de nómina. Al liquidar propinas, M2 pregunta quién trabajó.

Recorrido: [Flujo M8](../flujos/m8-asistencia.md).

## 7. Reportes y métricas que alimenta

[PRD-00, 8.5](PRD-00-vision-producto.md): horas, tardanzas, ausencias, correcciones, ventas por hora trabajada y la lista de participantes que M2 usa para propinas. La productividad por mesero cruza estas horas con las ventas de M1 y M2. La exportación no calcula salario.

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Una semana real de la sede piloto | Marcaciones con reportes de horas, tardanzas y ausencias |
| Reloj del celular | No cambia la hora registrada |
| Regla activa | Sin entrada, no hay pedido ni apertura de caja |
| Corrección | La original permanece y la proyección usa la corrección |

## 9. Preguntas abiertas

| # | Pregunta | Responsable |
|---|----------|-------------|
| 1 | ¿Qué sedes arrancan con "sin entrada no opera"? | Administrador, al configurar |
| 2 | Tolerancia de tardanza del piloto | Administrador de cada sede |
| 3 | Foto al marcar | Fase 5, fuera de este documento |
