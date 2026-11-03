import { expect, it } from "vitest";

import { DrawerKickRejected } from "#domain/render.js";
import {
  renderCashClose,
  renderKitchenTicket,
  renderPreBill,
  renderTipsSettlement,
  renderTransfer,
} from "#domain/templates.js";

const STATION = "Grill station north pass";
const TABLE = "terrace-12-window";
const ITEM = "Ribeye with pepper sauce and grilled vegetables";
const NOTE = "No salt, extra chimichurri on the side please";
const PRE_BILL_QR = `https://venue.example/d/${"token".repeat(12)}`;
const REGISTER = "register-main-floor-01";
const EXPECTED = "1234567.00";
const COUNTED = "1234500.00";
const DIFFERENCE = "-67.00";
const TRANSFER_REFERENCE = "transfer-bog-med-2026-00041";
const ORIGIN = "Central warehouse cold room";
const DESTINATION = "Venue north dry storage";
const TRANSFER_LINE = "Beef ribeye 12 kg lot A-4481";
const TRANSFER_QR = `https://venue.example/transfer/${"ref".repeat(16)}`;
const PERIOD = "2026-10-01/2026-10-15";
const PARTICIPANT = "Ana Morales service team";
const TIP_AMOUNT = "185000.00";
const TIP_TOTAL = "640000.00";

const PAPERS = [
  { paper: "80", columns: 48 },
  { paper: "58", columns: 32 },
] as const;

const compact = (text: string): string => text.replaceAll("\n", "");

const expectWithinColumns = (text: string, columns: number): void => {
  for (const line of text.split("\n")) {
    expect(line.length).toBeLessThanOrEqual(columns);
  }
};

const expectLaidOut = (
  rendered: { columns: number; text: string; pulse: Uint8Array | null },
  columns: number,
  parts: readonly string[],
): void => {
  expect(rendered.columns).toBe(columns);
  expect(rendered.pulse).toBeNull();

  const text = compact(rendered.text);

  for (const part of parts) {
    expect(text).toContain(part);
  }

  expectWithinColumns(rendered.text, columns);
};

it("given a kitchen ticket on 80 mm and 58 mm, when it is rendered, then the station, table, and items stay inside the columns and there is no pulse", () => {
  for (const { paper, columns } of PAPERS) {
    const rendered = renderKitchenTicket({
      paper,
      station: STATION,
      table: TABLE,
      lines: [
        { quantity: "2", name: ITEM, note: NOTE },
        { quantity: "1", name: "Water" },
      ],
      kickDrawer: false,
    });

    expectLaidOut(rendered, columns, [
      "Kitchen ticket",
      STATION,
      TABLE,
      `2 ${ITEM}`,
      NOTE,
      "1 Water",
    ]);
    expect(rendered.text).not.toContain("undefined");
  }
});

it("given a pre-bill on 80 mm and 58 mm, when it is rendered, then the lines, total, and QR stay inside the columns and there is no pulse", () => {
  for (const { paper, columns } of PAPERS) {
    const rendered = renderPreBill({
      paper,
      table: TABLE,
      lines: [{ quantity: "2", name: ITEM, amount: "90000.00" }],
      total: "90000.00",
      qr: PRE_BILL_QR,
      kickDrawer: false,
    });

    expectLaidOut(rendered, columns, [
      "Pre-bill",
      TABLE,
      `2 ${ITEM} 90000.00`,
      "90000.00",
      PRE_BILL_QR,
    ]);
  }
});

it("given a cash close on 80 mm and 58 mm, when it is rendered, then the register, expected, counted, and difference stay inside the columns and there is no pulse", () => {
  for (const { paper, columns } of PAPERS) {
    const rendered = renderCashClose({
      paper,
      register: REGISTER,
      expected: EXPECTED,
      counted: COUNTED,
      difference: DIFFERENCE,
      kickDrawer: false,
    });

    expectLaidOut(rendered, columns, [
      "Cash close",
      REGISTER,
      EXPECTED,
      COUNTED,
      DIFFERENCE,
    ]);
  }
});

it("given a transfer on 80 mm and 58 mm, when it is rendered, then the caller payload stays inside the columns and there is no pulse", () => {
  for (const { paper, columns } of PAPERS) {
    const rendered = renderTransfer({
      paper,
      reference: TRANSFER_REFERENCE,
      origin: ORIGIN,
      destination: DESTINATION,
      lines: [TRANSFER_LINE],
      qr: TRANSFER_QR,
      kickDrawer: false,
    });

    expectLaidOut(rendered, columns, [
      "Transfer",
      TRANSFER_REFERENCE,
      ORIGIN,
      DESTINATION,
      TRANSFER_LINE,
      TRANSFER_QR,
    ]);
  }
});

it("given a tips settlement on 80 mm and 58 mm, when it is rendered, then the caller payload stays inside the columns and there is no pulse", () => {
  for (const { paper, columns } of PAPERS) {
    const rendered = renderTipsSettlement({
      paper,
      period: PERIOD,
      lines: [{ participant: PARTICIPANT, amount: TIP_AMOUNT }],
      total: TIP_TOTAL,
      kickDrawer: false,
    });

    expectLaidOut(rendered, columns, [
      "Tips settlement",
      PERIOD,
      PARTICIPANT,
      TIP_AMOUNT,
      TIP_TOTAL,
    ]);
  }
});

it("given a kick on a kitchen, pre-bill, cash close, transfer, or tips job, when it is rendered, then the drawer kick is rejected", () => {
  const kitchen = {
    paper: "80" as const,
    station: STATION,
    table: TABLE,
    lines: [{ quantity: "1", name: ITEM }],
    kickDrawer: true,
  };
  const preBill = {
    paper: "58" as const,
    table: TABLE,
    lines: [{ quantity: "1", name: ITEM, amount: "1000.00" }],
    total: "1000.00",
    qr: PRE_BILL_QR,
    kickDrawer: true,
  };
  const cashClose = {
    paper: "80" as const,
    register: REGISTER,
    expected: EXPECTED,
    counted: COUNTED,
    difference: DIFFERENCE,
    kickDrawer: true,
  };
  const transfer = {
    paper: "58" as const,
    reference: TRANSFER_REFERENCE,
    origin: ORIGIN,
    destination: DESTINATION,
    lines: [TRANSFER_LINE],
    qr: TRANSFER_QR,
    kickDrawer: true,
  };
  const tips = {
    paper: "80" as const,
    period: PERIOD,
    lines: [{ participant: PARTICIPANT, amount: TIP_AMOUNT }],
    total: TIP_TOTAL,
    kickDrawer: true,
  };

  expect(() => renderKitchenTicket(kitchen)).toThrow(DrawerKickRejected);
  expect(() => renderPreBill(preBill)).toThrow(DrawerKickRejected);
  expect(() => renderCashClose(cashClose)).toThrow(DrawerKickRejected);
  expect(() => renderTransfer(transfer)).toThrow(DrawerKickRejected);
  expect(() => renderTipsSettlement(tips)).toThrow(DrawerKickRejected);
});
