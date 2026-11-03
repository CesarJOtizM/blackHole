import { expect, it } from "vitest";

import { DrawerKickRejected, renderTicket } from "#domain/render.js";

const PULSE = "1B-70-00-19-FA";

const REJECTED_KICKS = [
  "kitchen_ticket",
  "pre_bill",
  "cash_close",
  "transfer",
  "tips_settlement",
] as const;

const pulseHex = (pulse: Uint8Array): string =>
  [...pulse]
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
    .join("-");

it("given 80 mm paper, when a ticket is rendered, then it is 48 columns wide", () => {
  const rendered = renderTicket({
    paper: "80",
    document: "invoice",
    kickDrawer: false,
  });

  expect(rendered.columns).toBe(48);
});

it("given 58 mm paper, when a ticket is rendered, then it is 32 columns wide", () => {
  const rendered = renderTicket({
    paper: "58",
    document: "offline_receipt",
    kickDrawer: false,
  });

  expect(rendered.columns).toBe(32);
});

it("given an invoice that kicks the drawer, when it is rendered, then the pulse is 1B-70-00-19-FA", () => {
  const rendered = renderTicket({
    paper: "80",
    document: "invoice",
    kickDrawer: true,
  });

  expect(rendered.pulse).not.toBeNull();
  expect(pulseHex(rendered.pulse ?? new Uint8Array())).toBe(PULSE);
});

it("given an offline receipt that kicks the drawer, when it is rendered, then the pulse is 1B-70-00-19-FA", () => {
  const rendered = renderTicket({
    paper: "58",
    document: "offline_receipt",
    kickDrawer: true,
  });

  expect(rendered.pulse).not.toBeNull();
  expect(pulseHex(rendered.pulse ?? new Uint8Array())).toBe(PULSE);
});

it("given an invoice or receipt that does not kick, when it is rendered, then there is no pulse", () => {
  const invoice = renderTicket({
    paper: "80",
    document: "invoice",
    kickDrawer: false,
  });
  const receipt = renderTicket({
    paper: "58",
    document: "offline_receipt",
    kickDrawer: false,
  });

  expect(invoice.pulse).toBeNull();
  expect(receipt.pulse).toBeNull();
});

it("given a kick on any document other than an invoice or a receipt, when it is rendered, then the drawer kick is rejected", () => {
  for (const document of REJECTED_KICKS) {
    expect(() =>
      renderTicket({
        paper: "80",
        document,
        kickDrawer: true,
      }),
    ).toThrow(DrawerKickRejected);
  }
});
