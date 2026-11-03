import { expect, it } from "vitest";

import { renderInvoice, renderOfflineReceipt } from "#domain/templates.js";

const PULSE = "1B-70-00-19-FA";
const NUMBER = "SETP990000001-EXTRA-REFERENCE-CODE";
const CUFE = "cufe".repeat(24);
const QR = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${"qr".repeat(40)}`;
const LOOKUP_QR = "https://venue.example/lookup/sale-100-pending-issuance";

const pulseHex = (pulse: Uint8Array): string =>
  [...pulse]
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
    .join("-");

const compact = (text: string): string => text.replaceAll("\n", "");

const expectWithinColumns = (text: string, columns: number): void => {
  for (const line of text.split("\n")) {
    expect(line.length).toBeLessThanOrEqual(columns);
  }
};

it("given a 58 mm invoice, when it is rendered, then the number, CUFE, and QR stay on 32 columns", () => {
  const rendered = renderInvoice({
    paper: "58",
    number: NUMBER,
    cufe: CUFE,
    qr: QR,
    kickDrawer: false,
  });

  expect(rendered.columns).toBe(32);
  expect(compact(rendered.text)).toContain(NUMBER);
  expect(compact(rendered.text)).toContain(CUFE);
  expect(compact(rendered.text)).toContain(QR);
  expectWithinColumns(rendered.text, rendered.columns);
});

it("given an 80 mm invoice, when it is rendered, then the number, CUFE, and QR stay on 48 columns", () => {
  const rendered = renderInvoice({
    paper: "80",
    number: NUMBER,
    cufe: CUFE,
    qr: QR,
    kickDrawer: false,
  });

  expect(rendered.columns).toBe(48);
  expect(compact(rendered.text)).toContain(NUMBER);
  expect(compact(rendered.text)).toContain(CUFE);
  expect(compact(rendered.text)).toContain(QR);
  expectWithinColumns(rendered.text, rendered.columns);
});

it("given an offline receipt, when it is rendered, then it says it is not an invoice and includes the lookup QR", () => {
  const rendered = renderOfflineReceipt({
    paper: "58",
    lookupQr: LOOKUP_QR,
    kickDrawer: false,
  });

  expect(rendered.columns).toBe(32);
  expect(compact(rendered.text)).toContain("not an invoice");
  expect(compact(rendered.text)).toContain(LOOKUP_QR);
  expectWithinColumns(rendered.text, rendered.columns);
});

it("given a sale document whose caller asks to kick, when it is rendered, then the pulse is 1B-70-00-19-FA", () => {
  const invoice = renderInvoice({
    paper: "80",
    number: NUMBER,
    cufe: CUFE,
    qr: QR,
    kickDrawer: true,
  });
  const receipt = renderOfflineReceipt({
    paper: "58",
    lookupQr: LOOKUP_QR,
    kickDrawer: true,
  });

  expect(invoice.pulse).not.toBeNull();
  expect(pulseHex(invoice.pulse ?? new Uint8Array())).toBe(PULSE);
  expect(receipt.pulse).not.toBeNull();
  expect(pulseHex(receipt.pulse ?? new Uint8Array())).toBe(PULSE);
});

it("given a sale document whose caller does not ask to kick, when it is rendered, then there is no pulse", () => {
  const invoice = renderInvoice({
    paper: "58",
    number: NUMBER,
    cufe: CUFE,
    qr: QR,
    kickDrawer: false,
  });
  const receipt = renderOfflineReceipt({
    paper: "80",
    lookupQr: LOOKUP_QR,
    kickDrawer: false,
  });

  expect(invoice.pulse).toBeNull();
  expect(invoice.columns).toBe(32);
  expect(receipt.pulse).toBeNull();
  expect(receipt.columns).toBe(48);
});
