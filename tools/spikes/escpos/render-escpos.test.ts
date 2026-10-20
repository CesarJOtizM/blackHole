import { expect, it } from "vitest";

import { renderEscPos } from "#render-escpos";

const PAPER_MM = {
  WIDE: 80,
  NARROW: 58,
} as const;

const TRANSPORT = {
  NETWORK: "network",
  USB: "usb",
} as const;

const DRAWER_PULSE = Uint8Array.of(0x1b, 0x70, 0x00, 0x19, 0xfa);

it("given paper 80, when renderEscPos runs, then lines wrap at 48 columns and the drawer pulse follows the text", () => {
  const job = {
    jobId: "job-80",
    paperMm: PAPER_MM.WIDE,
    transport: TRANSPORT.NETWORK,
    lines: ["short", "A".repeat(49)],
    kickDrawer: true as const,
  };

  const rendered = renderEscPos(job);

  const text = new TextDecoder().decode(
    rendered.subarray(0, rendered.length - DRAWER_PULSE.length),
  );
  expect(text.split("\n")).toEqual(["short", "A".repeat(48), "A"]);
  expect(rendered.subarray(rendered.length - DRAWER_PULSE.length)).toEqual(
    DRAWER_PULSE,
  );
});

it("given paper 58, when renderEscPos runs, then lines wrap at 32 columns and the drawer pulse follows the text", () => {
  const job = {
    jobId: "job-58",
    paperMm: PAPER_MM.NARROW,
    transport: TRANSPORT.USB,
    lines: ["B".repeat(33)],
    kickDrawer: true as const,
  };

  const rendered = renderEscPos(job);

  const text = new TextDecoder().decode(
    rendered.subarray(0, rendered.length - DRAWER_PULSE.length),
  );
  expect(text.split("\n")).toEqual(["B".repeat(32), "B"]);
  expect(rendered.subarray(rendered.length - DRAWER_PULSE.length)).toEqual(
    DRAWER_PULSE,
  );
});

it("given the same ticket on network and usb, when renderEscPos runs, then transport does not change the bytes", () => {
  const lines = ["Ticket", "A".repeat(40)];
  const networkJob = {
    jobId: "job-transport",
    paperMm: PAPER_MM.WIDE,
    transport: TRANSPORT.NETWORK,
    lines,
    kickDrawer: true as const,
  };
  const usbJob = {
    ...networkJob,
    transport: TRANSPORT.USB,
  };

  const networkBytes = renderEscPos(networkJob);
  const usbBytes = renderEscPos(usbJob);

  expect(usbBytes).toEqual(networkBytes);
});
