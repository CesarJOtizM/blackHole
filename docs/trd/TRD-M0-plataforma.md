# TRD-M0 · Plataforma

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.1 |
| Fecha | 2026-10-15 |
| Fase | 0 |
| Hereda de | [TRD-00](TRD-00-arquitectura-base.md) |
| PRD asociado | [PRD-M0](../prd/PRD-M0-plataforma.md) · [PRD-01](../prd/PRD-01-roles-y-permisos.md) |
| Diagramas | [C4 M0](../arquitectura/componentes/c4-m0-plataforma.md) |

Los nombres de casos de uso y puertos de este documento son el contrato. El C4 los dibuja.

## 1. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Dónde corre | Los mismos casos de uso en `api-nube` y en `nodo-local`. El perfil `puente` no carga organización ni operación |
| Organización | Dueña la nube. El nodo guarda la copia de su sede |
| Identidad de administración | Better Auth, correo, contraseña y segundo factor, solo en la nube |
| Identidad operativa | PIN con argon2id. Cada dispositivo firma con ECDSA P-256 no exportable (WebCrypto) |
| Permisos | Función pura `evaluar(usuario, accion, contexto)`. El servidor decide. Detalle en TRD-00, 10.2 |
| Dueño de la operación | `dueno_operacion` (`nube` o `nodo`) más generación. Una escritura de generación vieja se rechaza |
| Sincronización | Outbox e inbox. Clave de idempotencia `(dispositivo_id, secuencia)`. IDs UUIDv7 |
| Auditoría | Solo inserción. Cadena de hash por dispositivo. La nube verifica la cadena |
| Presencia | En híbrido, la PWA habla con el nodo en la red local. En nube, comprueba el puente antes de operar |
| Código | `packages/dominio/plataforma`, `packages/aplicacion/plataforma` |

## 2. Modelo de dominio

Agregados y entidades. Las invariantes se prueban sin Nest ni base de datos.

| Tipo | Nombre | Invariantes |
|------|--------|-------------|
| Entidad | `Empresa` | Tiene al menos un propietario activo |
| Entidad | `Contribuyente` | Un NIT por empresa. Lleva perfil fiscal (TRD-00, 8.6) |
| Entidad | `Marca` | Pertenece a una empresa |
| Entidad | `Sede` | Factura por exactamente un contribuyente. Un punto de inventario. Modo `nube` o `hibrido`. Generación monótona |
| Entidad | `EstacionCocina` | Enruta. No tiene stock |
| Entidad | `Caja` | Pertenece a una sede |
| Entidad | `UbicacionInventario` | `PUNTO` (uno por sede) o `BODEGA` (de sede o general) |
| Entidad | `Usuario` | Activo o revocado. Puede tener varias asignaciones |
| Entidad | `Rol` | Predefinido (no se edita) o copia de la empresa |
| Entidad | `AsignacionRol` | Alcance empresa, marca, sede, bodega o contribuyente. Puede tener vigencia |
| Entidad | `Dispositivo` | Credencial de una sede. Registrado o revocado |
| Función | `evaluar` | Devuelve permitido, pide autorización o denegado. No escala privilegios. Nadie se autoriza a sí mismo, salvo autoautorización del turno |
| Entidad | `EventoAuditoria` | Solo se agrega. Incluye el hash del evento anterior del mismo dispositivo |
| Entidad | `GeneracionSede` | El dueño anterior rechaza escrituras nuevas |

`SolicitudAutorizacion` pide motivo, vence si nadie responde, y exige que quien autoriza sea otra persona.

## 3. Propiedad de datos y sincronización

M0 es dueño del mecanismo. La tabla de dueños de cada módulo está en TRD-00, 5.1, y se repite en el TRD de ese módulo.

| Dato | Dueño (nodo / nube) | Eventos que emite |
|------|---------------------|-------------------|
| Empresa, marcas, sedes, usuarios, roles, dispositivos | Nube | `OrganizacionCambiada`, `RolAsignado`, `DispositivoRevocado` hacia el nodo |
| Generación y dueño de la operación | Nube, al cambiar el modo | `DuenoCambiado` |
| PIN y hashes de la sede | Nube, copia en el nodo | — |
| Auditoría generada en la sede | Nodo en híbrido; nube en modo nube | `EventoAuditoria` hacia la nube |
| Outbox, inbox, cursores | Cada lado el suyo | Lote aplicado, sin reprocesar `(dispositivo_id, secuencia)` |

Orden de la outbox (TRD-00, 5.5): documentos DIAN y pagos QR confirmados, pedidos QR, auditoría, ventas y caja, inventario, telemetría.

Prioridad de este módulo al enviar: la auditoría va después de facturas y pagos QR, y antes de la telemetría.

## 4. Casos de uso

| Caso de uso | Entrada | Reglas | Eventos | Corre en |
|-------------|---------|--------|---------|----------|
| `Estructura` | Alta o cambio de empresa, NIT, marca, sede, estación, caja, bodega | Una sede, un contribuyente, un punto | `OrganizacionCambiada` | Nube |
| `CopiarRol`, `AsignarRol`, `AjustarTopeSede` | Actor y asignación | Sin escalar. Tope de sede solo hacia abajo. Queda un propietario | `RolAsignado` | Nube |
| `IniciarSesionAdmin` | Correo, contraseña, segundo factor | Solo administración | Sesión | Nube |
| `IniciarSesionPin`, `CerrarPorInactividad` | PIN, dispositivo | Dispositivo registrado y usuario activo. Si la sede lo exige, M8 confirma entrada abierta | Sesión corta | Nodo o nube, según el modo |
| `GenerarCodigoRegistro`, `RegistrarDispositivo`, `RevocarDispositivo` | QR de un solo uso | El QR se usa dentro del local. Revocar corta la sesión | `DispositivoRevocado` | Nodo o nube |
| `EvaluarPermiso`, `SolicitarAutorizacion`, `ResolverAutorizacion` | Acción, contexto, PIN del supervisor | PRD-01 | `EventoAuditoria` | Donde corre la acción |
| `RegistrarEvento`, `VerificarCadena` | Evento del dispositivo | Solo inserción. La nube detecta un corte de cadena | Hallazgo si la cadena no cierra | Registrar en el dueño; verificar en la nube |
| `ActivarHibrido`, `EmparejarNodo`, `VolverANube`, `RelevarNodo` | Código de un solo uso, confirmación | Foto de la sede al emparejar. Volver a nube con outbox en cero o aceptación explícita. Relevo solo con outbox vacía o confirmación (ADR-004) | `DuenoCambiado` | Nube, con el instalador del nodo |
| `AplicarLote` | Lote de la outbox | Idempotente por dispositivo y secuencia. Rechaza generación vieja | Cursor avanzado | Nube |

Puerto de entrada que usan M1, M2, M4, M5 y M9: `EvaluarPermiso`, `RegistrarEvento`. M7 llama `CrearOrganizacion` al dar de alta. M0 llama a M8 `TieneEntradaAbierta` si la regla está activa.

## 5. Contratos

Los esquemas Zod entran en `packages/contratos` con la primera entrega que los use. Aquí quedan los nombres.

**HTTP, nube**

- Organización, roles y sesión de administración.
- `POST` activar híbrido, volver a nube, relevar nodo.
- `POST` recepción de lotes comprimidos y reanudables.

**HTTP, nodo y nube**

- `POST` sesión por PIN.
- Registro de dispositivo con el código de un solo uso. Un dispositivo no registrado solo ve esa pantalla.
- Revocación.

**WebSocket**

- Canal de la sede, abierto por el nodo: bajan configuración, pedidos QR, pagos QR, pedidos externos, reservas y el certificado de `sede-xxx`.
- Autorizaciones: solicitud al supervisor y respuesta.
- En la nube, el aviso al supervisor también puede salir por Web Push.

**Eventos de lote**

`tenant_id`, `sede_id`, `dispositivo_id`, `secuencia`, `ocurrido_en` (reloj del dispositivo), `recibido_en` (reloj del nodo).

## 6. Persistencia

Tablas de organización, identidad, dispositivos, asignaciones, eventos de auditoría, generación de sede, outbox, inbox y cursores.

- En PostgreSQL cada tabla de cliente lleva `tenant_id` y Row Level Security.
- La auditoría y la outbox solo aceptan inserción.
- El nodo guarda en SQLite la copia de su sede, no la de otras.
- `UnidadDeTrabajo` escribe el cambio y la outbox en la misma transacción. En la nube fija el `tenant_id` al empezar.
- Secretos: gestor de la nube, o archivo cifrado en el nodo. El certificado de la sede lo emite un worker por DNS-01 y baja por el canal.

## 7. Operación sin internet

| Modo | Qué sigue | Qué espera |
|------|-----------|------------|
| Nube | Nada del salón. El puente, si está apagado, deja los trabajos de impresión en la nube | Toda la operación, hasta que vuelva el enlace |
| Híbrido | PIN, permisos, dispositivos y auditoría en el nodo. La copia de configuración ya bajada se usa | Cambios de la web, y la subida de la outbox |

Activar el híbrido no se hace durante un corte: el emparejamiento necesita la nube. Volver a nube tampoco, salvo el caso de relevo ya definido.

## 8. Seguridad y auditoría

Permisos nuevos: ninguno fuera de [PRD-01](../prd/PRD-01-roles-y-permisos.md). Este módulo los evalúa.

- La credencial del nodo solo sincroniza su sede.
- El PIN no viaja en claro en los eventos. Se guarda el hash argon2id.
- La llave del dispositivo no se exporta.
- Intentos fallidos de PIN, revocaciones, cambios de rol y cambios de modo quedan en la cadena.
- Soporte entra con un token de M7 que lleva `tenant_id` y vencimiento. Sin ese token no ve la operación.

## 9. Pruebas

Hereda el ciclo de [TRD-00, sección 16](TRD-00-arquitectura-base.md).

| Comportamiento | Capa | Qué afirma la prueba |
|----------------|------|----------------------|
| Una sede no tiene dos contribuyentes de facturación | Dominio | La segunda asignación reemplaza solo con un comando explícito, y deja uno |
| Quitar el último propietario | Dominio | Se rechaza |
| `evaluar` no escala privilegios ni se autoautoriza | Dominio | Denegado, salvo la excepción de turno marcada |
| Tope de sede por encima del de la empresa | Dominio | Se rechaza |
| Cadena de hash | Dominio | Alterar un evento rompe la verificación |
| `IniciarSesionPin` sin dispositivo registrado | Aplicación, adaptadores en memoria | Denegado |
| `IniciarSesionPin` sin entrada, con la regla activa | Aplicación | Denegado, tras consultar el puerto de M8 |
| `AplicarLote` repetido | Aplicación | La segunda vez no duplica |
| Escritura con generación vieja | Aplicación | Rechazada en los dos lados |
| `RepositorioAuditoria` | Contrato, memoria, SQLite y PostgreSQL | Solo inserta; la lectura respeta el alcance |
| `ActivarHibrido` | Aplicación | La nube deja de aceptar la operación de esa sede |

- [ ] Cada invariante de la sección 2 tiene prueba de dominio, sin Nest ni base de datos
- [ ] Cada caso de uso de la sección 4 tiene prueba con adaptadores en memoria
- [ ] Cada puerto de salida tiene una suite de contrato corrida por todos sus adaptadores
- [ ] Rutas que modifican datos declaran permiso
- [ ] Sincronización: duplicado, desorden y corte
- [ ] Un recorrido Playwright: registrar un celular, entrar con PIN y revocarlo

## 10. Riesgos y ADRs

| Riesgo / ADR | Mitigación / Estado |
|--------------|---------------------|
| ADR-001 Modo por sede | Decidido. Este TRD lo implementa |
| ADR-003 HTTPS local | Spike de la Fase 0. Sin eso la PWA no opera sin internet |
| ADR-004 Relevo del nodo | Solo con outbox vacía o confirmación del administrador |
| ADR-006 Router dedicado | Recomendado. El diseño asume Wi-Fi compartida (TRD-00, 10.1.2) |
| ADR-008 Módem 4G | Recomendado. No cambia los casos de uso |
| Relojes distintos | El nodo es la referencia. Los reportes usan su hora |
