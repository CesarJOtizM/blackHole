# PRD-01 · Roles y permisos

| Campo | Valor |
|-------|-------|
| Estado | Borrador |
| Versión | 0.5 |
| Fecha | 2026-10-17 |
| Módulo | M0 · Plataforma |
| Fase | 0 |
| Hereda de | [PRD-00](PRD-00-vision-producto.md) |
| Parte técnica | [TRD-M0](../trd/TRD-M0-plataforma.md) · [TRD-00, sección 10.2](../trd/TRD-00-arquitectura-base.md) |

## 1. Resumen

Define **quién puede hacer qué, dónde y hasta cuánto**. Es la base del control contra robos: cada acción sensible está permitida, limitada por un tope, sujeta a la autorización de otra persona o prohibida, y todo queda en la auditoría.

El sistema trae **roles predefinidos** que sirven para la mayoría de restaurantes. Cada empresa puede crear sus propios roles a partir de ellos, sin desarrollo a la medida.

## 2. Principios

| Principio | Qué significa en la práctica |
|-----------|------------------------------|
| **Mínimo privilegio** | Cada rol tiene solo lo que necesita para su trabajo. Un mesero no cobra, ni anula después de cocina, ni ve costos. |
| **Alcance** | Un permiso vale en un lugar: la empresa, una marca, una sede o una bodega. Un administrador de la sede 1 no ve la sede 2. |
| **Varios roles por persona** | Una persona puede ser cajera en la sede 1 y administradora en la sede 2. |
| **Topes** | Algunos permisos tienen límite. Por ejemplo, un cajero puede dar hasta un 5 % de descuento; más que eso requiere autorización. |
| **Autorizar no es ejecutar** | Hacer una acción y autorizarla son permisos distintos. |
| **Nadie se autoriza a sí mismo** | En las acciones sensibles, quien autoriza debe ser otra persona. |
| **Sin escalar privilegios** | Nadie puede dar a otro (ni a sí mismo) un permiso que no tiene, ni fuera de su alcance. |
| **El servidor decide** | La app oculta lo que no se puede hacer, pero la decisión final siempre la toma el servidor (el nodo o la nube). Funciona igual sin internet. |
| **Todo queda registrado** | Cada acción sensible, cada autorización y cada cambio de roles queda en la auditoría. |

## 3. Alcances

```
Empresa
├── Marca
│   └── Sede ── (cajas, estaciones, inventario del punto, bodega de la sede)
└── Bodega general
```

- Un permiso con alcance **empresa** vale en todas sus marcas, sedes y bodegas.
- Con alcance **marca**, vale en todas las sedes de esa marca.
- Con alcance **sede**, vale solo en esa sede, incluida su bodega.
- Con alcance **bodega general**, vale solo en esa bodega.
- Un contador puede tener alcance de **contribuyente** (NIT): ve los reportes fiscales de las sedes que facturan con ese NIT.

Las asignaciones pueden tener **vigencia**: por ejemplo, "cajero de reemplazo en la sede 3 solo este sábado".

## 4. Roles predefinidos

| Rol | Alcance típico | Para qué |
|-----|----------------|----------|
| **Propietario** | Empresa | Todo, incluida la suscripción, los contribuyentes y la asignación de cualquier rol. Recibe aviso de cada cambio de roles. |
| **Gerente general** | Empresa o marca | Reportes consolidados, configuración del menú y de las sedes, usuarios de su alcance. No maneja la suscripción. |
| **Administrador de sede** | Sede | Toda la operación de su sede: personal, caja, inventario, reservas, configuración local. Autoriza lo que el supervisor no puede. |
| **Supervisor de turno** | Sede | Autoriza anulaciones, descuentos y diferencias de caja dentro de sus topes. Puede cobrar. |
| **Cajero** | Sede (o una caja) | Cobrar, abrir y cerrar su turno de caja, facturar. |
| **Mesero** | Sede | Abrir mesas, tomar pedidos, enviarlos a cocina, pedir la cuenta. |
| **Anfitrión** | Sede | Reservas, recibir clientes, asignar mesas. |
| **Jefe de cocina** | Sede | Pantalla de cocina, mermas de cocina, conteos, solicitar reabastecimiento, ver recetas. |
| **Cocina / estación** | Sede (una o varias estaciones) | Ver y avanzar los productos de su estación. |
| **Bartender** | Sede (estación bar) | Igual que cocina para el bar. Puede cobrar en la barra si la sede le activa ese permiso. En el piloto empieza apagado (D-22). |
| **Bodeguero** | Bodega o sede | Recibir compras, despachar y recibir traslados, conteos de bodega. |
| **Compras** | Empresa | Proveedores, órdenes de compra y costos. |
| **Domiciliario** | Sede | Ver sus pedidos asignados, confirmar entrega y cobro contra entrega. |
| **Contador** | Empresa o contribuyente | Solo lectura de ventas, facturas, impuestos y exportaciones. |
| **Auditor** | Empresa | Solo lectura de la auditoría, las autorizaciones y los reportes de control. |

**Roles personalizados**: la empresa puede **copiar** un rol predefinido y ajustarlo (quitar o agregar permisos, cambiar topes). Los roles predefinidos no se editan, para que una actualización del producto los pueda mejorar sin romper nada.

**Roles de nuestra plataforma** (no visibles para el cliente):

- **Soporte**: entra a la cuenta de un cliente **solo con su autorización**, por un tiempo limitado, y todo lo que hace queda en la auditoría del cliente.
- **Administrador de la plataforma**: crea empresas y gestiona planes. No ve datos operativos del cliente sin acceso de soporte autorizado.

## 5. Tipos de permiso

Para cada acción, un rol puede tener uno de estos valores:

| Valor | Significa |
|-------|-----------|
| **S** | Sí, sin restricción |
| **L** | Sí, hasta un tope configurable. Por encima del tope, requiere autorización |
| **A** | Solo con la autorización de otra persona que tenga el permiso de autorizar esa acción |
| **—** | No puede |

## 6. Matriz de acciones sensibles

Estas son las acciones donde se concentran los robos y los errores. Los valores son los **predeterminados**; cada empresa los ajusta.

**Roles**: Prop = propietario, GG = gerente general, Adm = administrador de sede, Sup = supervisor, Caj = cajero, Mes = mesero, Coc = jefe de cocina, Bod = bodeguero.

### 6.1 Pedidos y cuentas

| Acción | Prop | GG | Adm | Sup | Caj | Mes | Coc | Bod |
|--------|:----:|:--:|:---:|:---:|:---:|:---:|:---:|:---:|
| Abrir mesa y tomar pedidos | S | S | S | S | S | S | — | — |
| Anular producto **antes** de que cocina lo empiece | S | S | S | S | S | L | — | — |
| Anular producto **después** de que cocina lo empezó | S | S | S | L | A | A | — | — |
| Anular una cuenta completa | S | S | S | A | A | — | — | — |
| Descuento en un producto o en la cuenta | S | S | L | L | L | — | — | — |
| Cortesía (producto sin cobro) | S | S | L | A | A | — | — | — |
| Cambiar el precio de un producto en la venta | S | S | A | A | — | — | — | — |
| Modificar una cuenta después de imprimir la precuenta | S | S | S | S | A | A | — | — |
| Mover productos entre cuentas, unir o dividir mesas | S | S | S | S | S | S | — | — |
| Transferir una mesa a otro mesero | S | S | S | S | A | A | — | — |
| Ver cuentas de otros meseros | S | S | S | S | S | — | — | — |

### 6.2 Caja

| Acción | Prop | GG | Adm | Sup | Caj | Mes | Coc | Bod |
|--------|:----:|:--:|:---:|:---:|:---:|:---:|:---:|:---:|
| Abrir y cerrar su turno de caja | S | S | S | S | S | — | — | — |
| Cobrar y facturar | S | S | S | S | S | — | — | — |
| Ver el **total esperado** de la caja antes de contar | S | S | S | — | — | — | — | — |
| Aprobar una diferencia de arqueo | S | S | L | L | — | — | — | — |
| Abrir el cajón **sin venta** | S | S | S | A | A | — | — | — |
| Ingreso o egreso de caja | S | S | L | L | A | — | — | — |
| Retiro parcial de efectivo | S | S | S | S | A | — | — | — |
| Cambiar el medio de pago de una venta ya cobrada | S | S | A | A | — | — | — | — |
| Reabrir una cuenta ya pagada | S | S | A | — | — | — | — | — |
| Reimprimir una factura o una precuenta | S | S | S | S | L | — | — | — |
| Emitir nota crédito o refacturar | S | S | A | — | — | — | — | — |
| Liquidar propinas o cambiar su regla de reparto | S | S | S | — | — | — | — | — |

El **arqueo es ciego**: el cajero cuenta sin ver el total esperado. Por eso el cajero y el supervisor no tienen ese permiso.

### 6.3 Inventario

| Acción | Prop | GG | Adm | Sup | Caj | Mes | Coc | Bod |
|--------|:----:|:--:|:---:|:---:|:---:|:---:|:---:|:---:|
| Registrar una merma | S | S | S | S | — | — | L | L |
| Ajustar inventario | S | S | A | — | — | — | — | A |
| Hacer un conteo físico | S | S | S | — | — | — | S | S |
| Aprobar el resultado de un conteo | S | S | L | — | — | — | — | — |
| Recibir una compra | S | S | S | — | — | — | S | S |
| Recibir un traslado con diferencias | S | S | S | — | — | — | A | A |
| Solicitar reabastecimiento | S | S | S | S | — | — | S | S |
| Editar recetas | S | S | — | — | — | — | — | — |
| Ver costos y márgenes | S | S | S | — | — | — | — | — |
| Configurar niveles mínimos y máximos | S | S | S | — | — | — | L | L |

### 6.4 Personal, reservas, plataformas y datos

| Acción | Prop | GG | Adm | Sup | Caj | Mes | Coc | Bod |
|--------|:----:|:--:|:---:|:---:|:---:|:---:|:---:|:---:|
| Crear usuarios y asignar roles (de su alcance) | S | S | L | — | — | — | — | — |
| Registrar o revocar un dispositivo | S | S | S | — | — | — | — | — |
| Corregir una marcación de asistencia | S | S | S | — | — | — | — | — |
| Verificar el pago de una reserva | S | S | S | S | S | — | — | — |
| Aprobar la devolución de una reserva | S | S | S | A | — | — | — | — |
| Aceptar o rechazar un pedido de plataforma | S | S | S | S | S | — | — | — |
| Pausar una plataforma | S | S | S | S | — | — | — | — |
| Editar el menú y los precios | S | S | L | — | — | — | — | — |
| Ver reportes de ventas | S | S | S | L | — | — | — | — |
| Exportar datos personales de clientes | S | A | — | — | — | — | — | — |
| Ver la auditoría | S | S | L | — | — | — | — | — |

**Pausar una plataforma** está permitido de forma explícita al administrador de sede y al supervisor, además del propietario y el gerente general. Si un PRD de módulo dice otra cosa, manda esta matriz.

En la tabla de personal, la **L** del administrador significa que solo asigna roles de su sede y con permisos que él mismo tenga (sección 8). En los reportes, la **L** del supervisor significa que ve solo el turno actual. En la auditoría, la **L** del administrador significa que ve solo la de su sede.

## 7. Topes configurables

Cada empresa define los topes por rol, y cada sede los puede ajustar hacia abajo (nunca hacia arriba):

| Tope | Ejemplo predeterminado |
|------|------------------------|
| Descuento máximo sin autorización | Cajero 5 %, supervisor 15 %, administrador 30 % |
| Valor máximo de anulación sin autorización | Supervisor $50.000 por producto |
| Cortesías por turno | Administrador hasta $100.000 por turno |
| Diferencia de arqueo que se puede aprobar | Supervisor hasta $10.000, administrador hasta $50.000 |
| Egreso de caja sin autorización | Supervisor hasta $50.000 |
| Merma sin autorización | Jefe de cocina hasta $30.000 por registro |
| Ajuste por conteo sin aprobación | $1.000 por ajuste. Por encima pide aprobación (D-28) |
| Anulaciones del mesero antes de cocina | Hasta 3 por turno sin autorización |

## 8. Reglas de seguridad

1. **Nadie se autoriza a sí mismo** en las acciones marcadas como sensibles. Quien autoriza en cada sede es el administrador de la sede (D-30). Si en el turno esa persona es la única con permiso de autorizar, puede activar la **autoautorización**; cada caso queda marcado y genera una alerta.
2. **Sin escalar privilegios**: solo se pueden asignar roles cuyos permisos y topes sean iguales o menores a los propios, y dentro del propio alcance.
3. **El propietario recibe aviso** de cada cambio de roles, permisos o topes.
4. Los cambios de roles y permisos quedan en la auditoría con el antes y el después.
5. **Revocación inmediata**: desactivar a un usuario corta sus sesiones en todos los dispositivos de la sede, aunque no haya internet (el administrador lo hace en el nodo).
6. **Siempre existe al menos un propietario activo.** El sistema no permite quitar el último.
7. Ningún rol, ni el propietario, puede **borrar ni editar** la auditoría.

## 9. Cómo funciona una autorización en el momento

1. El cajero intenta una acción que requiere autorización (por ejemplo, anular un producto ya preparado).
2. El sistema pide el **motivo** (de una lista configurable, más un texto opcional).
3. Quien autoriza es el administrador de la sede (D-30). Hay dos formas:
   - **En el mismo dispositivo**: el administrador escribe su PIN.
   - **A distancia**: la solicitud llega a su celular, que la aprueba o la rechaza. Funciona por la red del local, y desde fuera cuando hay internet.
4. Queda registrado: quién pidió, quién autorizó, la acción, el valor, el motivo, el dispositivo y la hora.
5. Si nadie responde en un tiempo configurable, la solicitud vence.

## 10. Sesiones en dispositivos compartidos

- Cada persona entra con **su PIN**. La pantalla muestra siempre quién está operando.
- Cambio rápido de usuario con PIN, sin cerrar la app.
- Bloqueo por inactividad configurable por dispositivo (por ejemplo, 2 minutos en la caja, 5 en el celular del mesero).
- Si la sede usa la regla "sin entrada no opera" (M8), un usuario sin entrada marcada no puede hacer acciones operativas.

## 11. Alertas de control

| Alerta | Ejemplo |
|--------|---------|
| Muchas anulaciones o descuentos | Más de 5 anulaciones después de cocina en un turno |
| La misma pareja de solicitante y autorizador se repite mucho | Puede indicar acuerdo entre dos personas |
| Uso de la autoautorización | Cada vez que ocurre |
| Cambios de roles o topes | Siempre, al propietario |
| Intentos fallidos de PIN | Varios seguidos en el mismo dispositivo |
| Acciones fuera del horario del trabajador | Si tiene horario programado (M8) |

Estos números son el valor inicial. Cada sede puede cambiarlos (D-31).

## 12. Criterios de aceptación

- [ ] Un mesero no ve ni puede ejecutar acciones de caja, ni siquiera llamando directamente al servidor.
- [ ] Un cajero con tope de 5 % que intenta un 10 % de descuento recibe la solicitud de autorización.
- [ ] Un supervisor no puede autorizar su propia anulación.
- [ ] Un administrador de la sede 1 no puede asignarse ni asignar roles en la sede 2.
- [ ] Un administrador no puede crear un rol con permisos que él no tiene.
- [ ] Revocar un usuario en el nodo sin internet cierra sus sesiones en menos de 5 segundos.
- [ ] Cada autorización aparece en la auditoría con solicitante, autorizador, motivo y valor.
- [ ] Un cambio de topes llega como aviso al propietario.

## 13. Preguntas abiertas

Viven en el [registro de preguntas abiertas](../preguntas-abiertas.md):

- Los topes y el autorizador quedaron decididos (D-30): se adoptan los predeterminados de la sección 7 y autoriza el administrador de la sede.
- Los umbrales de la sección 11 quedaron decididos (D-31): esos ejemplos son el valor inicial y cada sede puede cambiarlos.
- El cobro en la barra quedó decidido (D-22): el permiso existe y en el piloto empieza apagado.
- El tope del ajuste por conteo quedó decidido (D-28): configurable, predeterminado $1.000.
