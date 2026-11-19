import { z } from "zod";

export const tableState = z.enum([
  "free",
  "occupied",
  "check_requested",
  "to_clean",
]);

export const stationOutput = z.enum(["screen", "printer", "both"]);

export const placeTableCommand = z
  .object({
    id: z.string().min(1),
    zone: z.string().min(1),
  })
  .strict();

export type PlaceTableCommand = z.infer<typeof placeTableCommand>;

export const placedTable = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    venueId: z.string(),
    zone: z.string(),
    state: tableState,
  })
  .strict();

export type PlacedTable = z.infer<typeof placedTable>;

const venueStation = z
  .object({
    id: z.string().min(1),
    venueId: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

export const configureStationRouteCommand = z
  .object({
    station: venueStation,
    productId: z.string().min(1),
    output: stationOutput,
    redThresholdMinutes: z.number().int(),
  })
  .strict();

export type ConfigureStationRouteCommand = z.infer<
  typeof configureStationRouteCommand
>;

export const configuredStationRoute = z
  .object({
    tenantId: z.string(),
    venueId: z.string(),
    stationId: z.string(),
    stationName: z.string(),
    productId: z.string(),
    output: stationOutput,
    redThresholdMinutes: z.number().int(),
  })
  .strict();

export type ConfiguredStationRoute = z.infer<typeof configuredStationRoute>;

export const openTableCommand = z
  .object({
    checkId: z.string().min(1),
    diners: z.number().int().positive(),
  })
  .strict();

export type OpenTableCommand = z.infer<typeof openTableCommand>;

export const openedTable = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    venueId: z.string(),
    zone: z.string(),
    state: tableState,
    diners: z.number().int(),
    checkId: z.string(),
    openedAt: z.string().min(1),
  })
  .strict();

export type OpenedTable = z.infer<typeof openedTable>;

export const releaseTableCommand = z.object({}).strict();

export type ReleaseTableCommand = z.infer<typeof releaseTableCommand>;

export const markTableReadyCommand = z.object({}).strict();

export type MarkTableReadyCommand = z.infer<typeof markTableReadyCommand>;

export const diningTableRecord = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    venueId: z.string(),
    zone: z.string(),
    state: tableState,
    diners: z.number().int(),
  })
  .strict();

export type DiningTableRecord = z.infer<typeof diningTableRecord>;

export const requestCheckCommand = z.object({}).strict();

export type RequestCheckCommand = z.infer<typeof requestCheckCommand>;

export const requestedCheck = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    venueId: z.string(),
    tableId: z.string(),
    state: tableState,
    preBillRequestedAt: z.string().min(1),
    printed: z.literal(false).optional(),
  })
  .strict();

export type RequestedCheck = z.infer<typeof requestedCheck>;

export const orderChannel = z.enum(["waiter", "fixed_point", "qr_table"]);

export const lineState = z.enum([
  "held",
  "sent",
  "in_preparation",
  "ready",
  "delivered",
]);

const orderLineDraft = z
  .object({
    orderId: z.string().min(1),
    lineId: z.string().min(1),
    productId: z.string().min(1),
    name: z.string().min(1),
    course: z.number().int().positive(),
    channel: orderChannel,
    kind: z.enum(["product", "combo"]).optional(),
    variantIds: z.array(z.string().min(1)).optional(),
    modifierIds: z.array(z.string().min(1)).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

export const addOrderLineCommand = orderLineDraft
  .extend({
    reason: z.string().optional(),
    shiftId: z.string().optional(),
    authorizationId: z.string().nullable().optional(),
  })
  .strict();

export type AddOrderLineCommand = z.infer<typeof addOrderLineCommand>;

export const sendCourseCommand = z.union([
  z
    .object({
      course: z.number().int().positive(),
      lines: z.array(orderLineDraft).min(1),
    })
    .strict(),
  z
    .object({
      course: z.number().int().positive(),
    })
    .strict(),
]);

export type SendCourseCommand = z.infer<typeof sendCourseCommand>;

export const resendLineCommand = z.object({}).strict();

export type ResendLineCommand = z.infer<typeof resendLineCommand>;

export const deliverLineCommand = z.object({}).strict();

export type DeliverLineCommand = z.infer<typeof deliverLineCommand>;

export const savedOrderLine = z
  .object({
    id: z.string(),
    orderId: z.string(),
    checkId: z.string(),
    productId: z.string(),
    name: z.string(),
    course: z.number().int(),
    price: z.number().int(),
    state: lineState,
    channel: orderChannel,
    sentAt: z.string().min(1).optional(),
    deliveredAt: z.string().min(1).optional(),
    printed: z.literal(false).optional(),
  })
  .strict();

export type SavedOrderLine = z.infer<typeof savedOrderLine>;

export const sentCourse = z
  .object({
    checkId: z.string(),
    course: z.number().int(),
    lines: z.array(savedOrderLine).min(1),
    printed: z.literal(false).optional(),
  })
  .strict();

export type SentCourse = z.infer<typeof sentCourse>;

const reassignCheckTarget = {
  targetCheckId: z.string().min(1),
  sourceCheckId: z.string().min(1),
};

export const reassignCheckCommand = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.enum(["join"]),
      ...reassignCheckTarget,
    })
    .strict(),
  z
    .object({
      kind: z.enum(["transfer"]),
      ...reassignCheckTarget,
      lineIds: z.array(z.string().min(1)).min(1),
    })
    .strict(),
]);

export type ReassignCheckCommand = z.infer<typeof reassignCheckCommand>;

const reassignedLine = z
  .object({
    id: z.string().min(1),
    originTableId: z.string().min(1),
    state: lineState,
  })
  .strict();

export const reassignedCheck = z
  .object({
    id: z.string().min(1),
    tableId: z.string().min(1),
    sourceCheckId: z.string().min(1),
    kind: z.enum(["join", "transfer"]),
    lines: z.array(reassignedLine),
  })
  .strict();

export type ReassignedCheck = z.infer<typeof reassignedCheck>;

export const prepareLineCommand = z.object({}).strict();

export type PrepareLineCommand = z.infer<typeof prepareLineCommand>;

export const readyLineCommand = z.object({}).strict();

export type ReadyLineCommand = z.infer<typeof readyLineCommand>;

export const changedOrderLine = savedOrderLine.extend({
  inPreparationAt: z.string().min(1).optional(),
  readyAt: z.string().min(1).optional(),
});

export type ChangedOrderLine = z.infer<typeof changedOrderLine>;

export const tableMap = z
  .object({
    zones: z.array(
      z
        .object({
          zone: z.string().min(1),
          tables: z.array(
            z
              .object({
                id: z.string().min(1),
                state: tableState,
                diners: z.number().int().nonnegative(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export type TableMap = z.infer<typeof tableMap>;

export const stationQueueColor = z.enum(["red", "green"]);

export const stationQueue = z
  .object({
    stationId: z.string().min(1),
    lines: z.array(
      z
        .object({
          checkId: z.string().min(1),
          tableId: z.string().min(1),
          lineId: z.string().min(1),
          productId: z.string().min(1),
          name: z.string().min(1),
          sentAt: z.string().min(1),
          state: lineState,
          channel: orderChannel,
          color: stationQueueColor,
        })
        .strict(),
    ),
  })
  .strict();

export type StationQueue = z.infer<typeof stationQueue>;

const checkAccountLine = z
  .object({
    id: z.string().min(1),
    productId: z.string().min(1),
    name: z.string().min(1),
    course: z.number().int(),
    price: z.number().int(),
    state: lineState,
    originTableId: z.string().min(1),
    variantIds: z.array(z.string().min(1)).optional(),
    modifierIds: z.array(z.string().min(1)).optional(),
    note: z.string().min(1).optional(),
    sentAt: z.string().min(1).optional(),
    inPreparationAt: z.string().min(1).optional(),
    readyAt: z.string().min(1).optional(),
    deliveredAt: z.string().min(1).optional(),
  })
  .strict();

export const checkAccount = z
  .object({
    checkId: z.string().min(1),
    tableId: z.string().min(1),
    tenantId: z.string().min(1),
    venueId: z.string().min(1),
    lineIds: z.array(z.string().min(1)),
    total: z.number().int(),
    orders: z.array(
      z
        .object({
          id: z.string().min(1),
          channel: orderChannel,
          lines: z.array(checkAccountLine),
        })
        .strict(),
    ),
  })
  .strict();

export type CheckAccount = z.infer<typeof checkAccount>;

const realtimeIds = {
  tenantId: z.string().min(1),
  venueId: z.string().min(1),
  checkId: z.string().min(1),
  tableId: z.string().min(1),
};

export const ordersRealtimeEvent = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.enum(["ids"]),
      ...realtimeIds,
      lineIds: z.array(z.string().min(1)),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["printer_failed"]),
      ...realtimeIds,
      lineId: z.string().min(1),
      stationId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["line_ready"]),
      ...realtimeIds,
      lineId: z.string().min(1),
      at: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["billing_data_received"]),
      ...realtimeIds,
    })
    .strict(),
  z
    .object({
      kind: z.enum(["availability_changed"]),
      tenantId: z.string().min(1),
      venueId: z.string().min(1),
      productId: z.string().min(1),
      variantId: z.string().min(1).nullable(),
      state: z.enum(["available", "low_units", "sold_out"]),
    })
    .strict(),
]);

export type OrdersRealtimeEvent = z.infer<typeof ordersRealtimeEvent>;
