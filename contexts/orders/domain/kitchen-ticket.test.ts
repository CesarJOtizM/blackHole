import { expect, it } from "vitest";

import { ComboNotSent } from "#domain/check.js";
import { KitchenTicket } from "#domain/kitchen-ticket.js";

const LINE_FEED = 10;

it("given a ticket for Steak at Grill, when it is rendered, then it is UTF-8 text and has no ESC/POS bytes", () => {
  const ticket = KitchenTicket.render({
    stationName: "Grill",
    tableId: "table_5",
    productName: "Steak",
    note: "jalapeño\u001B@\u001DV1",
  });
  const text = ticket.text;
  const encoded = new TextEncoder().encode(text);
  const controls = [...encoded].filter(
    (byte) => (byte < 32 && byte !== LINE_FEED) || byte === 127,
  );

  expect(text).toContain("Grill");
  expect(text).toContain("table_5");
  expect(text).toContain("Steak");
  expect(text).toContain("jalapeño");
  expect(new TextDecoder().decode(encoded)).toBe(text);
  expect(encoded.includes(0x1b)).toBe(false);
  expect(encoded.includes(0x1d)).toBe(false);
  expect(controls).toEqual([]);
});

it("given a QR table ticket, when it is rendered, then the text says QR table", () => {
  const ticket = KitchenTicket.render({
    stationName: "Grill",
    tableId: "table_5",
    productName: "Steak",
    channel: "qr_table",
  });

  expect(ticket.text).toContain("QR table");
  expect(ticket.text).toContain("Steak");
});

it("given a combo, when a ticket is rendered, then ComboNotSent", () => {
  const render = () => {
    KitchenTicket.render({
      stationName: "Grill",
      tableId: "table_5",
      productName: "Lunch",
      kind: "combo",
    });
  };

  expect(render).toThrow(ComboNotSent);
});
