import { expect, it } from "vitest";
import {
  PrintDocument,
  type PrintDocumentCommand,
} from "#application/print-document/print-document.js";
import {
  createSalesDocument,
  SALES_DOCUMENT_STATUS,
  type SalesDocument,
} from "#domain/sales-document.js";

const CLOSURE_ID = "closure_front_1";
const REFERENCE_CODE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const TAXPAYER_EMAIL = "facturas@taxpayer.example";
const NUMBER = "SETP990000001-EXTRA-REFERENCE-CODE";
const CUFE = "cufe".repeat(24);
const QR = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${"qr".repeat(40)}`;
const LOOKUP_QR = "https://venue.example/lookup/sale-100-pending-issuance";
const NOT_AN_INVOICE = "This is not an invoice.";

const salesDocument = (
  status: SalesDocument["status"],
  fiscal?: Pick<SalesDocument, "number" | "cufe" | "qr">,
): SalesDocument => ({
  ...createSalesDocument({
    closureId: CLOSURE_ID,
    referenceCode: REFERENCE_CODE,
    taxpayerEmail: TAXPAYER_EMAIL,
  }),
  status,
  ...fiscal,
});

const issuedInvoice = (): PrintDocumentCommand => ({
  document: salesDocument(SALES_DOCUMENT_STATUS.ACCEPTED, {
    number: NUMBER,
    cufe: CUFE,
    qr: QR,
  }),
});

const pendingIssuance = (): PrintDocumentCommand => ({
  document: salesDocument(SALES_DOCUMENT_STATUS.PENDING_ISSUANCE),
  lookupQr: LOOKUP_QR,
});

const expectNoDrawerKick = (payload: unknown): void => {
  expect(JSON.stringify(payload)).not.toContain("1B 70");
  expect(JSON.stringify(payload)).not.toContain("\\u001b");
  expect(JSON.stringify(payload)).not.toContain("\u001b");
};

it("given an issued invoice, when its print payload is built, then it carries the number, CUFE, and QR and does not kick", () => {
  const print = new PrintDocument();

  const payload = print.execute(issuedInvoice());

  expect(payload).toEqual({
    document: "invoice",
    number: NUMBER,
    cufe: CUFE,
    qr: QR,
    kickDrawer: false,
  });
  expect(payload).not.toHaveProperty("lookupQr");
  expect(payload).not.toHaveProperty("status");
  expect(payload).not.toHaveProperty("commandId");
  expect(payload).not.toHaveProperty("printerId");
  expect(Object.getOwnPropertyNames(PrintDocument.prototype)).toEqual([
    "constructor",
    "execute",
  ]);
  expectNoDrawerKick(payload);
});

it("given a sale whose document is pending issuance, when its print payload is built, then it says it is not an invoice, carries the lookup QR, and does not kick", () => {
  const print = new PrintDocument();

  const payload = print.execute(pendingIssuance());

  expect(payload).toEqual({
    document: "offline_receipt",
    statement: NOT_AN_INVOICE,
    lookupQr: LOOKUP_QR,
    kickDrawer: false,
  });
  expect(JSON.stringify(payload)).toContain("not an invoice");
  expect(JSON.stringify(payload)).toContain(LOOKUP_QR);
  expect(payload).not.toHaveProperty("number");
  expect(payload).not.toHaveProperty("cufe");
  expect(payload).not.toHaveProperty("qr");
  expect(payload).not.toHaveProperty("status");
  expect(payload).not.toHaveProperty("commandId");
  expect(payload).not.toHaveProperty("printerId");
  expect(Object.getOwnPropertyNames(PrintDocument.prototype)).toEqual([
    "constructor",
    "execute",
  ]);
  expectNoDrawerKick(payload);
});
