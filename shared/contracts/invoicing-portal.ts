import { z } from "zod";

export const portalBuyerLookupCommand = z
  .object({
    token: z.string().min(1),
    documentType: z.string().min(1),
    documentNumber: z.string().min(1),
    at: z.string().min(1),
  })
  .strict();

export type PortalBuyerLookupCommand = z.infer<typeof portalBuyerLookupCommand>;

export const portalBuyerFound = z
  .object({
    outcome: z.literal("found"),
    lookupId: z.string().min(1),
    maskedName: z.string().min(1),
    maskedEmail: z.string().min(1),
  })
  .strict();

export type PortalBuyerFound = z.infer<typeof portalBuyerFound>;

export const reinvoiceWindowMode = z.enum(["same_day", "same_month", "off"]);

export type ReinvoiceWindowMode = z.infer<typeof reinvoiceWindowMode>;

export const requestReinvoiceCommand = z
  .object({
    invoiceNumber: z.string().min(1),
    issuedAt: z.string().min(1),
    at: z.string().min(1),
    windowMode: reinvoiceWindowMode.optional(),
  })
  .strict();

export type RequestReinvoiceCommand = z.infer<typeof requestReinvoiceCommand>;

export const reinvoiceRequestResult = z
  .object({
    outcome: z.enum(["recorded", "rejected"]),
  })
  .strict();

export type ReinvoiceRequestResult = z.infer<typeof reinvoiceRequestResult>;

const salesDocumentStatus = z.enum([
  "generated",
  "sending",
  "accepted",
  "rejected",
  "pending_issuance",
  "uncertain",
]);

const genericBuyer = z
  .object({
    documentType: z.literal("13"),
    documentNumber: z.literal("222222222222"),
    name: z.literal("Consumidor final"),
    responsibility: z.literal("R-99-PN"),
    email: z.email(),
  })
  .strict();

const originalSalesDocument = z
  .object({
    closureId: z.string().min(1),
    referenceCode: z.string().min(1),
    status: salesDocumentStatus,
    buyer: genericBuyer,
    number: z.string().min(1).optional(),
    cufe: z.string().min(1).optional(),
    qr: z.string().min(1).optional(),
  })
  .strict();

const creditNoteCommand = z
  .object({
    referenceCode: z.string().min(1),
    tenantId: z.string().min(1),
    actorId: z.string().min(1),
    authorizerId: z.string().min(1).nullable(),
    deviceId: z.string().min(1),
    siteId: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const taxComponent = z
  .object({
    code: z.string().min(1),
    rate: z.string().min(1),
  })
  .strict();

const documentTaxRule = z
  .object({
    id: z.string().min(1),
    version: z.number().int(),
    taxClassification: z.string().min(1),
    taxes: z.array(taxComponent),
    regime: z.enum(["ordinary", "simple"]).optional(),
    vatResponsible: z.boolean().optional(),
    incResponsible: z.boolean().optional(),
    franchise: z.boolean().optional(),
    channel: z.enum(["dine-in", "take-out", "delivery"]).optional(),
    validFrom: z.string().min(1).optional(),
    validTo: z.string().min(1).optional(),
    fixedCop: z.number().int().optional(),
    marker: z.literal("is_excluded").optional(),
  })
  .strict();

const replacementInvoice = z
  .object({
    closureId: z.string().min(1),
    referenceCode: z.string().min(1),
    taxpayerEmail: z.email(),
    documentBalance: z.number().int().nonnegative(),
    rules: z.array(documentTaxRule),
    siteRangeId: z.string().min(1),
    registerRangeId: z.string().min(1).optional(),
  })
  .strict();

export const approveReinvoiceCommand = z
  .object({
    invoiceNumber: z.string().min(1),
    at: z.string().min(1),
    windowMode: reinvoiceWindowMode.optional(),
    original: originalSalesDocument,
    creditNote: creditNoteCommand,
    invoice: replacementInvoice,
  })
  .strict();

export type ApproveReinvoiceCommand = z.infer<typeof approveReinvoiceCommand>;

export const reinvoiceApprovalResult = z
  .object({
    outcome: z.enum(["approved", "rejected", "denied"]),
  })
  .strict();

export type ReinvoiceApprovalResult = z.infer<typeof reinvoiceApprovalResult>;
