# Glosario de nombres en código

| Campo | Valor |
|-------|-------|
| Estado | Decidido |
| Versión | 0.2 |
| Fecha | 2026-10-17 |
| Relación | [TRD-00, sección 14](trd/TRD-00-arquitectura-base.md), [ADR-018](adr/ADR-018-screaming-y-bounded-context.md) |

Los documentos se escriben en español. El código, en inglés: carpetas, archivos, paquetes, clases, casos de uso, eventos, errores, tablas, permisos y estados. Cuando un documento nombra una pieza de código, usa el nombre de este glosario. Un nombre que cruza dos módulos existe una sola vez aquí; un nombre que solo vive dentro de un módulo lo fija su TRD con las mismas reglas.

## 1. Reglas de forma

| Pieza | Forma | Ejemplo |
|-------|-------|---------|
| Carpeta, archivo, paquete, app | kebab-case | `contexts/cash-register`, `create-application.ts` |
| Paquete del workspace | `@blackhole/<nombre>` | `@blackhole/platform` |
| Clase, puerto, agregado, objeto de valor | PascalCase, sustantivo | `OrderRepository`, `TaxProfile` |
| Caso de uso | PascalCase, verbo en imperativo | `SendToKitchen`, `IssueDocument` |
| Evento | PascalCase, en pasado | `LineSent`, `IssuanceResolved` |
| Error de dominio | PascalCase, el hecho de negocio | `EmptyOrder`, `LimitExceeded` |
| Tabla y columna | snake_case; tablas en plural | `sales_documents`, `operation_owner` |
| Permiso | `<contexto>.<acción>` en snake_case | `reservation.verify_payment` |
| Estado | snake_case | `pending_issuance`, `uncertain` |
| Prueba de contrato | `<puerto>.contract.ts` y `<adaptador>.contract.test.ts` | `order-repository.contract.ts` |

## 2. Estructura del repositorio

| Español (documentos anteriores) | Código |
|---------------------------------|--------|
| `contextos/` | `contexts/` |
| `dominio/`, `aplicacion/`, `adaptadores/` | `domain/`, `application/`, `adapters/` |
| `adaptadores/memoria`, `postgres`, `sqlite`, `http` | `adapters/memory`, `postgres`, `sqlite`, `http` |
| `puerto-de-entrada.ts` | `entry-port.ts` |
| `<caso-de-uso>/` | `<use-case>/` |
| `compartido/contratos`, `sincronizacion`, `impresion`, `ui` | `shared/contracts`, `sync`, `printing`, `ui` |
| `herramientas/` | `tools/` |
| `infra/modulos/comun/` | `infra/modules/common/` |
| `.contrato.ts`, `.contrato.test.ts` | `.contract.ts`, `.contract.test.ts` |

## 3. Contextos y apps

| Módulo | Contexto |
|--------|----------|
| M0 Plataforma | `contexts/platform` |
| M1 Pedidos y salón | `contexts/orders` |
| M2 Caja | `contexts/cash-register` |
| M3 Facturación e impresión | `contexts/invoicing` |
| M4 Inventario | `contexts/inventory` |
| M5 Domicilios y plataformas | `contexts/delivery` |
| M6 Reportes | `contexts/reporting` |
| M7 SaaS comercial | `contexts/saas` |
| M8 Asistencia | `contexts/attendance` |
| M9 Reservas | `contexts/reservations` |

| App | Código |
|-----|--------|
| API de la nube | `apps/api-cloud` |
| Nodo local (y perfil puente) | `apps/local-node` |
| App de la sede (mesero, caja, cocina) | `apps/venue-app` |
| App del domiciliario | `apps/delivery-app` |
| Web de administración (incluye el panel de soporte) | `apps/admin-web` |
| Portal de clientes | `apps/customer-portal` |

## 4. Puertos técnicos compartidos

| Español | Código |
|---------|--------|
| `UnidadDeTrabajo` | `UnitOfWork` |
| `Reloj` | `Clock` |
| Generador de UUIDv7 | `IdGenerator` |
| `Secretos` | `Secrets` |
| `AlmacenamientoArchivos` | `FileStorage` |
| `Impresora` | `Printer` |
| Trabajo de impresión (`shared/printing`) | `PrintJob`, tabla `print_jobs` |
| `Notificador` | `Notifier` |
| `NotificadorTiempoReal` | `RealtimeNotifier` |
| `Mensajeria` (correo, SMS, WhatsApp) | `Messaging` |
| `LimitadorRitmo` | `RateLimiter` |
| `FirmadorTokens` | `TokenSigner` |
| `HashPin` | `PinHasher` |
| Outbox, inbox, cursor, lote | `Outbox`, `Inbox`, `SyncCursor`, `SyncBatch` |
| `Repositorio<Agregado>` | `<Aggregate>Repository` |

## 5. Nombres que cruzan módulos

| Dueño | Español | Código |
|-------|---------|--------|
| M0 | `evaluar(usuario, accion, contexto)` | `evaluate(user, action, context)` |
| M0 | `Permitido`, `RequiereAutorizacion`, `Denegado` | `Allowed`, `RequiresAuthorization`, `Denied` |
| M0 | `EvaluarPermiso`, `TopeExcedido` | `EvaluatePermission`, `LimitExceeded` |
| M0 | `RegistrarEvento`, `EventoAuditoria` | `RecordAuditEvent`, `AuditEvent` |
| M0 | `CrearOrganizacion`, `OrganizacionCambiada` | `CreateOrganization`, `OrganizationChanged` |
| M0 | `RolAsignado`, `DispositivoRevocado`, `DuenoCambiado` | `RoleAssigned`, `DeviceRevoked`, `OwnerChanged` |
| M0 | `ActivarHibrido`, `VolverANube`, `RelevarNodo`, `EmparejarNodo`, `AplicarLote` | `ActivateHybrid`, `ReturnToCloud`, `FailOverToCloud`, `PairNode`, `ApplyBatch` |
| M0 | `dueno_operacion` | `operation_owner` |
| M0 | Empresa, contribuyente, marca, sede | `Company`, `Taxpayer`, `Brand`, `Venue` |
| M0 | Caja, estación de cocina, ubicación de inventario (punto, bodega) | `CashRegister`, `KitchenStation`, `InventoryLocation` (`point`, `warehouse`) |
| M0 | Modo de sede nube, híbrido; dueño de la operación nube, nodo; perfil puente | `cloud`, `hybrid`; `cloud`, `node`; `bridge` |
| M0 | Campos del lote | `tenant_id`, `venue_id`, `device_id`, `sequence`, `occurred_at`, `received_at` |
| M0 | `CanalSede` | `VenueChannel` |
| M0 | Presencia en el local | `VenuePresence` |
| M1 | `CatalogoMenu` | `MenuCatalog` |
| M1 | `CrearPedidoInterno` | `CreateInternalOrder` |
| M1 | `EnviarACocina`, `PedidoVacio` | `SendToKitchen`, `EmptyOrder` |
| M1 | `LineaEnviada`, `LineaCambioEstado`, `CuentaPedida` | `LineSent`, `LineStateChanged`, `CheckRequested` |
| M1 | `IntencionPedidoQr`, `PedidoQrPorAplicar`, `AplicarPedidoQr` | `QrOrderIntent`, `QrOrderPendingApply`, `ApplyQrOrder` |
| M1 | `AsociarReserva` | `AttachReservation` |
| M1 | Cuenta, consultar cuenta | `Check`, `GetCheck` |
| M1 | `MesaAbierta`, `CuentaReasignada` | `TableOpened`, `CheckReassigned` |
| M1 | Estados de línea | `sent`, `in_preparation`, `ready`, `delivered`, `voided`, `not_delivered` |
| M2 | `PasarelaPagos`, `Datafono` | `PaymentGateway`, `CardTerminal` |
| M2 | `PagoQrPorAplicar`, `PagoQrConfirmado`, `AplicarPagoQr` | `QrPaymentPendingApply`, `QrPaymentConfirmed`, `ApplyQrPayment` |
| M2 | `TurnoCerrado`, `PagoRegistrado` | `ShiftClosed`, `PaymentRecorded` |
| M2 | Registrar en el turno el efectivo de una reserva | `RecordReservationCash` |
| M2 | Registrar el recaudo de un domicilio, registrar una cuenta por cobrar | `RecordDeliveryCollection`, `RecordReceivable` |
| M2 | Liquidación de ajuste de propinas | `AdjustTipSettlement` |
| M3 | `ProveedorFacturacion` | `InvoicingProvider` |
| M3 | `CrearDocumentoVenta`, `DocumentoVenta` | `CreateSalesDocument`, `SalesDocument` |
| M3 | `EmitirDocumento`, `EmitirPendientes`, `VerificarIncierto`, `EmisionResuelta` | `IssueDocument`, `IssuePendingDocuments`, `VerifyUncertain`, `IssuanceResolved` |
| M3 | `pendiente_emision`, `incierto` | `pending_issuance`, `uncertain` |
| M3 | `DocumentoConsumido` | `DocumentConsumed` |
| M3 | `Refacturar`, `AdquirenteGenerico`, `ClienteFiscal` | `Reinvoice`, `GenericBuyer`, `TaxCustomer` |
| M3 | `PerfilFiscal`, `ClasificacionTributaria`, `ReglaImpuesto` | `TaxProfile`, `TaxClassification`, `TaxRule` |
| M4 | `CatalogoRecetas` | `RecipeCatalog` |
| M4 | `RegistrarConsumoVenta`, `Devolucion`, `Merma` | `RegisterSaleConsumption`, `ReturnStock`, `RecordWaste` |
| M4 | `DisponibilidadCambiada` | `AvailabilityChanged` |
| M4 | `TrasladoDespachado`, `TrasladoRecibido` | `TransferDispatched`, `TransferReceived` |
| M4 | `StockMovido` | `StockMoved` |
| M4 | Unidad de inventario (TRD-00 la llama unidad base) | `base_unit` |
| M5 | `ConectorPlataforma`, `PedidoExterno` | `PlatformConnector`, `ExternalOrder` |
| M6 | `FuenteEventos`, `RepositorioProyecciones` | `EventSource`, `ProjectionRepository` |
| M7 | `AccesoSoporte`, `SuscripcionCambiada`, `BolsaDocumentos` | `SupportAccess`, `SubscriptionChanged`, `DocumentWallet` |
| M7 | Pasarela de la suscripción, distinta de la del QR | `SubscriptionGateway` |
| M8 | `TieneEntradaAbierta`, `ParticipantesDelPeriodo` | `HasOpenClockIn`, `ParticipantsForPeriod` |
| M9 | `ReservasDelDia`, `CobroReserva` | `DayReservations`, `ReservationPayment` |
| M9 | `AplicarAnticipo` (lo llama M2 al cobrar) | `ApplyDeposit` |
| M9 | Pasarela de reservas (entrega 5.3), distinta de la del QR | `ReservationGateway` |
| M9 | Registrar el pago en efectivo de una reserva hecha en persona | `RecordCashPayment` |

`CreateOrganization` crea el árbol completo de un cliente (empresa, contribuyentes, marcas, sedes y propietario); `Company` es solo la raíz de ese árbol. Por eso el caso de uso no se llama `CreateCompany`.

## 6. Valores y modelos compartidos

| Dueño | Concepto | Código |
|-------|----------|--------|
| M0 | Permiso y su asignación a un rol | `Permission` (`code`, `sensitive`, `allows_limit`, `limit_unit`, `valid_scopes`), `RolePermission` (`mode`: `yes`, `with_limit`, `with_authorization`) |
| M0 | Solicitud de autorización | `AuthorizationRequest`; estados `pending`, `approved`, `rejected`, `expired`; canales `local_pin`, `remote` |
| M0 | Ajuste del tope por sede | `VenueLimitAdjustment`, `AdjustVenueLimit` |
| M0 | Alcances de un rol | `company`, `brand`, `venue`, `warehouse`, `taxpayer` |
| M1 | Pedido, precio por sede, producto por canal | `Order`, `VenuePrice`, `ChannelProduct` |
| M1 | QR de mesa y modo de aceptación | `table_qr`; `qr_acceptance`: `direct`, `cash_register` |
| M2 | Propina y reparto | `Tip`, `TipDistributionRule` (`equal`, `percentage`, `by_hours`), `TipSettlement` |
| M3 | Datos de facturación del cliente | `CheckBillingData`, `BillingDataReceived` |
| M4 | Tipos de movimiento | `purchase`, `sale_consumption`, `sale_return`, `waste`, `production_consumption`, `production_output`, `transfer_out`, `transfer_in`, `count_adjustment` |
| M4 | Disponibilidad de un plato | `available`, `low`, `sold_out` |
| M4 | Cantidad producible | `units_possible_at_point`, `units_with_replenishment`, `limiting_ingredient` |
| M4 | Niveles, alertas y reposición | `StockLevel`, `DishLevel`, `NotificationRule`, `ShortageAlert`, `ReplenishmentRequest`, `PurchaseOrder` |
| M8 | Marcación | `ClockEntry` (`clock_in`, `clock_out`, `break_start`, `break_end`), `ClockEntryCorrection`, `ScheduledShift` |
| M9 | Reserva | `Reservation`, `ReservationSeating`, `ReservationPolicy` |
| M9 | Canal de la reserva | `public_link`, `phone`, `chat`, `in_person` |
| M9 | Estados de la reserva y del cobro | `provisional`, `conflict`, `pending_payment`, `receipt_received`, `verified`, `confirmed` |

Los puertos de salida de un contexto viven en `application/ports/`, junto a su `<port>.contract.ts`. Los nombres de métricas y etiquetas de telemetría los fija [TRD-01](trd/TRD-01-infraestructura-y-operacion.md).

Un nombre nuevo que cruza módulos entra primero aquí y después en los TRD que lo usan.
