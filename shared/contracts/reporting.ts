import { z } from "zod";

export const reportFamily = z.enum(["sales", "times", "cash", "staff"]);

export type ReportFamily = z.infer<typeof reportFamily>;

export const reportPeriodQuery = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
  })
  .strict();

export type ReportPeriodQuery = z.infer<typeof reportPeriodQuery>;

const tenderMethod = z.enum([
  "cash",
  "card",
  "transfer",
  "wallet",
  "voucher",
  "customer_credit",
  "corporate_credit",
]);

const reportDenial = z.enum([
  "other_venue",
  "previous_shift",
  "missing_permission",
  "other_waiter",
]);

const deniedReport = z
  .object({
    outcome: z.literal("denied"),
    reason: reportDenial,
  })
  .strict();

const nullableCop = z.number().nullable();

const productRank = z
  .object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number(),
    netCop: z.number(),
  })
  .strict();

const salesReport = z
  .object({
    grossCop: nullableCop,
    netCop: nullableCop,
    ticketCount: nullableCop,
    averageTicketCop: nullableCop,
    ticketPerDinerCop: nullableCop,
    hourBands: z.array(
      z
        .object({
          hour: z.number().int(),
          netCop: z.number(),
        })
        .strict(),
    ),
    channels: z.array(
      z
        .object({
          channel: z.enum(["waiter", "fixed_point"]),
          grossCop: z.number(),
          netCop: z.number(),
        })
        .strict(),
    ),
    waiters: z.array(
      z
        .object({
          waiterId: z.string(),
          netCop: z.number(),
          tipCop: z.number(),
        })
        .strict(),
    ),
    products: z
      .object({
        top: productRank.nullable(),
        bottom: productRank.nullable(),
      })
      .strict(),
    rotation: nullableCop,
    tenders: z.array(
      z
        .object({
          method: tenderMethod,
          amountCop: z.number(),
          share: z.number().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

const durationFigures = z
  .object({
    averageMs: nullableCop,
    p50Ms: nullableCop,
    p90Ms: nullableCop,
  })
  .strict();

const timeReport = z
  .object({
    orderTaking: durationFigures,
    kitchenWait: durationFigures,
    preparation: durationFigures,
    totalKitchen: durationFigures,
    tableDelivery: durationFigures,
    totalService: durationFigures,
    tableDuration: durationFigures,
    payment: durationFigures,
  })
  .strict();

const cashCountRow = z
  .object({
    shiftId: z.string(),
    method: tenderMethod,
    expectedCop: z.number(),
    countedCop: z.number(),
    differenceCop: z.number(),
  })
  .strict();

const cashReport = z
  .object({
    counts: z.discriminatedUnion("visible", [
      z.object({ visible: z.literal(false) }).strict(),
      z
        .object({
          visible: z.literal(true),
          rows: z.array(cashCountRow),
        })
        .strict(),
    ]),
  })
  .strict();

const staffReport = z
  .object({
    salesPerHourCop: nullableCop,
    hours: z.array(
      z
        .object({
          waiterId: z.string(),
          workedMinutes: z.number(),
          latenessMinutes: z.number(),
          absent: z.boolean(),
          corrected: z.boolean(),
        })
        .strict(),
    ),
    tips: z.array(
      z
        .object({
          waiterId: z.string(),
          method: tenderMethod,
          tipCop: z.number(),
        })
        .strict(),
    ),
    productivity: z.array(
      z
        .object({
          waiterId: z.string(),
          stationId: z.string().nullable(),
          netCopPerHour: nullableCop,
        })
        .strict(),
    ),
  })
  .strict();

const ready = <Report extends z.ZodType>(report: Report) =>
  z
    .object({
      outcome: z.literal("ready"),
      report,
    })
    .strict();

export const salesReportResult = z.union([ready(salesReport), deniedReport]);
export const timeReportResult = z.union([ready(timeReport), deniedReport]);
export const cashReportResult = z.union([ready(cashReport), deniedReport]);
export const staffReportResult = z.union([ready(staffReport), deniedReport]);

export type SalesReportResult = z.infer<typeof salesReportResult>;
export type TimeReportResult = z.infer<typeof timeReportResult>;
export type CashReportResult = z.infer<typeof cashReportResult>;
export type StaffReportResult = z.infer<typeof staffReportResult>;

export const siteReportResponse = z.discriminatedUnion("family", [
  z
    .object({
      family: z.literal("sales"),
      result: salesReportResult,
    })
    .strict(),
  z
    .object({
      family: z.literal("times"),
      result: timeReportResult,
    })
    .strict(),
  z
    .object({
      family: z.literal("cash"),
      result: cashReportResult,
    })
    .strict(),
  z
    .object({
      family: z.literal("staff"),
      result: staffReportResult,
    })
    .strict(),
]);

export type SiteReportResponse = z.infer<typeof siteReportResponse>;
