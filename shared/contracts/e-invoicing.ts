import { z } from "zod";

export const lookupAcquirerCommand = z
  .object({
    documentType: z.string().min(1),
    documentNumber: z.string().min(1),
  })
  .strict();

export type LookupAcquirerCommand = z.infer<typeof lookupAcquirerCommand>;

const foundAcquirer = z
  .object({
    outcome: z.literal("found"),
    name: z.string().min(1),
    email: z.email(),
  })
  .strict();

const emptyAcquirer = z
  .object({
    outcome: z.literal("empty"),
  })
  .strict();

export const acquirerLookupResult = z.discriminatedUnion("outcome", [
  foundAcquirer,
  emptyAcquirer,
]);

export type AcquirerLookupResult = z.infer<typeof acquirerLookupResult>;

export const attachBuyerCommand = z
  .object({
    taxpayerEmail: z.email(),
    documentType: z.string().min(1).optional(),
    documentNumber: z.string().min(1).optional(),
  })
  .strict();

export type AttachBuyerCommand = z.infer<typeof attachBuyerCommand>;

const genericBuyer = z
  .object({
    documentType: z.literal("13"),
    documentNumber: z.literal("222222222222"),
    name: z.literal("Consumidor final"),
    responsibility: z.literal("R-99-PN"),
    email: z.email(),
  })
  .strict();

const identifiedBuyer = z
  .object({
    documentType: z.string().min(1),
    documentNumber: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

const buyerLookup = z
  .object({
    name: z.string().min(1),
    email: z.email(),
  })
  .strict();

const genericAttachment = z
  .object({
    kind: z.literal("generic"),
    buyer: genericBuyer,
  })
  .strict();

const identifiedAttachment = z
  .object({
    kind: z.literal("identified"),
    buyer: identifiedBuyer,
    lookup: buyerLookup,
  })
  .strict();

export const attachedBuyer = z.discriminatedUnion("kind", [
  genericAttachment,
  identifiedAttachment,
]);

export type AttachedBuyer = z.infer<typeof attachedBuyer>;

export const setDocumentBalanceCommand = z
  .object({
    nit: z.string().min(1),
    remaining: z.number().int().nonnegative(),
  })
  .strict();

export type SetDocumentBalanceCommand = z.infer<
  typeof setDocumentBalanceCommand
>;

export const documentBalanceResult = z
  .object({
    companyId: z.string().min(1),
    nit: z.string().min(1),
    siteId: z.string().min(1),
    remaining: z.number().int().nonnegative(),
  })
  .strict();

export type DocumentBalanceResult = z.infer<typeof documentBalanceResult>;

export const assignNumberingRangeCommand = z
  .object({
    numberingRangeId: z.string().min(1),
    registerId: z.string().min(1).optional(),
  })
  .strict();

export type AssignNumberingRangeCommand = z.infer<
  typeof assignNumberingRangeCommand
>;

export const numberingRangeAssignment = z
  .object({
    tenantId: z.string().min(1),
    venueId: z.string().min(1),
    numberingRangeId: z.string().min(1),
    registerId: z.string().min(1).nullable(),
  })
  .strict();

export type NumberingRangeAssignment = z.infer<typeof numberingRangeAssignment>;

export const issueCreditNoteCommand = z
  .object({
    closureId: z.string().min(1),
    referenceCode: z.string().min(1),
    originalReferenceCode: z.string().min(1),
    taxpayerEmail: z.email(),
    reason: z.string().min(1),
  })
  .strict();

export type IssueCreditNoteCommand = z.infer<typeof issueCreditNoteCommand>;

export const issuedCreditNote = z
  .object({
    outcome: z.literal("issued"),
    note: z
      .object({
        referenceCode: z.string().min(1),
        originalReferenceCode: z.string().min(1),
        status: z.literal("generated"),
      })
      .strict(),
  })
  .strict();

export type IssuedCreditNote = z.infer<typeof issuedCreditNote>;
