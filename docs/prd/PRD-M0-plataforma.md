# PRD-M0 · Plataforma

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.3 |
| Fecha | 2026-10-17 |
| Fase | 0 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| TRD asociado | [TRD-M0](../trd/TRD-M0-plataforma.md) |
| Detalle ya escrito | [PRD-01 Roles y permisos](PRD-01-roles-y-permisos.md) |
| Diagramas | [Flujo M0](../flujos/m0-plataforma.md) · [C4 M0](../arquitectura/componentes/c4-m0-plataforma.md) |

## 1. Resumen

M0 es la base que usan los demás módulos: la estructura del cliente, quién entra, en qué dispositivo, qué puede hacer y qué queda registrado. También fija el modo de cada sede (nube o híbrido) y quién es el dueño de cada dato. Sin esto no hay salón, caja ni factura.

La matriz de permisos, los topes y la autorización en el momento viven en [PRD-01](PRD-01-roles-y-permisos.md). Este documento no los repite.

## 2. Alcance

**Incluye**

- Empresa, contribuyentes con perfil fiscal, marcas, sedes, estaciones de cocina, cajas y bodegas ([PRD-00, sección 5](PRD-00-vision-producto.md)).
- Modo de cada sede: nace en nube y puede activar el híbrido ([PRD-00, 9.1](PRD-00-vision-producto.md)).
- Sesión de administración (correo, contraseña y segundo factor). El administrador decide a quién se lo exige; quien no lo tenga exigido puede activarlo (D-38). Sesión corta con PIN en dispositivos compartidos.
- Registro de dispositivos con QR, celulares personales solo dentro del local, y revocación inmediata.
- Auditoría que solo se agrega, con cadena de hash por dispositivo.
- Sincronización: un solo dueño por dato, y un solo dueño de la operación de la sede a la vez.

**No incluye**

- La matriz de acciones, topes y roles personalizados: [PRD-01](PRD-01-roles-y-permisos.md), entrega 0.5.
- Nómina, contabilidad y fidelización ([PRD-00, sección 3](PRD-00-vision-producto.md)).
- Una sede que nunca tiene internet.
- El kit de hardware y el módem 4G: se eligen en ADR-006 y ADR-008; el producto solo exige que existan cuando la sede los necesita.

## 3. Usuarios y permisos

| Rol | Qué puede hacer | Requiere autorización de supervisor |
|-----|-----------------|-------------------------------------|
| Propietario | Toda la estructura, la suscripción y cualquier rol | No |
| Gerente general | Estructura y usuarios de su alcance. No maneja la suscripción | No |
| Administrador de sede | Dispositivos, modo de su sede, usuarios de su sede | No, salvo que el permiso de PRD-01 lo marque |
| Personal de la sede | Entrar con PIN en un dispositivo registrado | Según la acción, en PRD-01 |
| Soporte | Entra solo con acceso concedido y con vencimiento | El propietario concede el acceso |

Nadie asigna un permiso que no tiene, ni fuera de su alcance. Siempre queda al menos un propietario activo.

## 4. Historias de usuario

### HU-M0-01 · Cargar la estructura del piloto

**Como** propietario, **quiero** cargar empresa, NIT, marcas, sedes, estaciones, cajas y bodegas, **para** que cada sede facture por un solo contribuyente y comparta el menú de su marca.

Criterios de aceptación:

- [ ] Dado el piloto, cuando se carga la estructura, entonces quedan 6 sedes, cada una con un contribuyente, un inventario de punto y sus estaciones y cajas.
- [ ] Durante un corte: en modo nube no se edita la estructura. En híbrido la copia ya bajada sigue en el nodo; los cambios hechos en la web esperan y bajan al reconectar.
- [ ] Queda auditado: alta y cambio de sede, contribuyente, caja, estación y bodega.

### HU-M0-02 · Operar con PIN en un dispositivo registrado

**Como** mesero, **quiero** entrar con mi PIN en un celular registrado, **para** tomar pedidos sin compartir una contraseña.

Criterios de aceptación:

- [ ] Dado un dispositivo registrado y un PIN válido, cuando entra, entonces la pantalla muestra su nombre y solo las acciones de su rol.
- [ ] Durante un corte: en híbrido el PIN se valida en el nodo. En modo nube el salón está detenido y no hay sesión operativa.
- [ ] Queda auditado: intentos fallidos repetidos y la revocación del dispositivo o del usuario.

### HU-M0-03 · Revocar un celular al instante

**Como** administrador de sede, **quiero** revocar un celular o desactivar un usuario, **para** que quien se va deje de operar aunque el celular siga en la red.

Criterios de aceptación:

- [ ] Dado un dispositivo o usuario activo, cuando se revoca en el nodo, entonces sus sesiones dejan de servir en menos de 5 segundos, con o sin internet.
- [ ] Durante un corte: la revocación hecha en el nodo vale de inmediato en el local. La copia sube a la nube al reconectar.
- [ ] Queda auditado: quién revocó, qué dispositivo o usuario, y la hora del nodo.

### HU-M0-04 · Activar el híbrido sin dos dueños

**Como** administrador, **quiero** activar el híbrido en una sede, **para** que el salón siga durante un corte, sin que la nube y el nodo creen la misma venta.

Criterios de aceptación:

- [ ] Dado una sede en nube, cuando se empareja el nodo, entonces la operación pasa al nodo, sube la generación y la nube deja de aceptar pedidos y cobros directos de esa sede.
- [ ] Durante un corte posterior: el salón sigue en el nodo.
- [ ] Dado una sede híbrida, cuando el administrador pide volver a nube, entonces la vuelta solo ocurre con la outbox vacía, o si el administrador acepta de forma explícita lo que quede sin subir (D-02). Esa aceptación queda auditada con lo que no subió.
- [ ] Queda auditado: activación, emparejamiento, vuelta a nube y relevo del nodo.

### HU-M0-05 · Detectar una auditoría alterada

**Como** auditor, **quiero** que borrar o cambiar un evento se note, **para** confiar en el registro de anulaciones, descuentos y autorizaciones.

Criterios de aceptación:

- [ ] Dado la cadena de una sede, cuando se altera o se borra un evento en el nodo, entonces la nube lo detecta al recibir el lote.
- [ ] Durante un corte: el nodo sigue agregando eventos. No existe una acción para editarlos o borrarlos.
- [ ] Queda auditado: el propio intento no se puede ocultar; la detección queda como hallazgo en la nube.

## 5. Reglas de negocio

| # | Regla | Configurable |
|---|-------|--------------|
| 1 | Cada sede factura por exactamente un contribuyente | Sí, al asignar la sede |
| 2 | El menú y las recetas son de la marca; la sede ajusta precio, disponibilidad y horario | No |
| 3 | Cada sede tiene un inventario de punto. Las estaciones no tienen inventario | No |
| 4 | La sede nace en modo nube. El híbrido se activa sede por sede | Sí |
| 5 | Solo hay un dueño de la operación a la vez. El cambio sube la generación | No || 6 | Un dispositivo no registrado no opera ni imprime | No |
| 7 | El celular personal solo opera dentro del local y no guarda datos del negocio | No |
| 8 | El servidor decide el permiso. Ocultar un botón no lo reemplaza | No |
| 9 | La auditoría solo se agrega. Nadie, ni el propietario, la edita o la borra | No |
| 10 | Si la sede activa "sin entrada no opera", M0 consulta a M8 antes de la acción operativa | Sí, por sede |
| 11 | Volver de híbrido a nube exige la outbox vacía, o que el administrador acepte de forma explícita lo que quede sin subir (D-02) | No |

El detalle de topes, autoautorización y "nadie se autoriza a sí mismo" está en [PRD-01, secciones 7 a 9](PRD-01-roles-y-permisos.md).

## 6. Pantallas y flujos

Web de administración, en computador:

- Estructura: empresa, contribuyentes, marcas, sedes, estaciones, cajas, bodegas y modo de la sede.
- Usuarios, roles y dispositivos: generar el QR de registro y revocar.
- Estado de sincronización: última vez, eventos pendientes y facturas pendientes.

PWA de la sede, mobile first:

- PIN, cambio rápido de usuario y bloqueo por inactividad.
- Solicitud de autorización al supervisor, en el mismo dispositivo o a distancia.

El recorrido está en [Flujo M0](../flujos/m0-plataforma.md).

## 7. Reportes y métricas que alimenta

Cada acción sensible emite un evento de auditoría (actor, autorizador, dispositivo, sede, acción, antes y después, motivo, hora del nodo). M6 arma con eso el control de [PRD-00, 8.4](PRD-00-vision-producto.md): anulaciones, descuentos, cajón sin venta, ajustes y alertas de comportamiento inusual. Las alertas de PIN y de cambios de roles están en [PRD-01, sección 11](PRD-01-roles-y-permisos.md).

## 8. Métricas de éxito

| Métrica | Meta |
|---------|------|
| Estructura del piloto cargada | 6 sedes, con su NIT y sus bodegas |
| Sede en nube | Opera sin nodo |
| Híbrido | Un evento creado sin internet llega a la nube tras 2 h, sin duplicarse y en orden |
| Dispositivo no registrado | No opera ni imprime |
| Revocación | La sesión deja de servir al instante en el nodo |
| Cadena de auditoría | Alterar o borrar un evento se detecta en la nube |
| Escalada de privilegios | Nadie se asigna un permiso que no tiene |

## 9. Preguntas abiertas

- PA-29: mecanismo de HTTPS local para la PWA. Ver [registro](../preguntas-abiertas.md).
- Los topes y el autorizador quedaron decididos (D-30). El router dedicado y el módem 4G se recomiendan y los compra el dueño (D-36). Ver [registro](../preguntas-abiertas.md).
