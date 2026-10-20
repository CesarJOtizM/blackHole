import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

import { closeDecisionReport } from "#decision-report";

const SPIKE = "escpos-cash-drawer";
const DEDICATED_ROUTER = "owner-buys";
const CONSUMER_DELIVERY = "1.6";
const ADR003 = "pending-hybrid";

const PAPER_MM = {
  WIDE: 80,
  NARROW: 58,
} as const;

const TRANSPORT = {
  NETWORK: "network",
  USB: "usb",
} as const;

const DELIVERY_16 = {
  PENDING: "pending",
  UNBLOCKED: "unblocked",
} as const;

const REPORT_STATUS = {
  CONCLUDED: "concluded",
  BLOCKING: "blocking",
} as const;

type PaperMm = (typeof PAPER_MM)[keyof typeof PAPER_MM];
type Transport = (typeof TRANSPORT)[keyof typeof TRANSPORT];
type Delivery16 = (typeof DELIVERY_16)[keyof typeof DELIVERY_16];

interface PrinterSetup {
  id: string;
  paperMm: PaperMm;
  transport: Transport;
}

interface PrinterEvidence {
  printerId: string;
  ticketLegible: boolean | null;
  drawerOpened: boolean | null;
}

interface NetworkFindings {
  unregisteredDeviceReachedPrinterPort: boolean | null;
  currentRouterIsolatesPrinters: boolean | null;
}

interface ReportSetup {
  printers: PrinterSetup[];
}

interface DecisionReportInput {
  spike: string;
  setup: ReportSetup;
  evidence: PrinterEvidence[];
  network: NetworkFindings;
  dedicatedRouter: string;
  decision: string;
  consumerDelivery: string;
  delivery16: Delivery16;
  owner: string;
  adr003: string;
}

function readyReport(): DecisionReportInput {
  const printers: PrinterSetup[] = [
    {
      id: "paper-80-network",
      paperMm: PAPER_MM.WIDE,
      transport: TRANSPORT.NETWORK,
    },
    {
      id: "paper-58-usb",
      paperMm: PAPER_MM.NARROW,
      transport: TRANSPORT.USB,
    },
  ];

  return {
    spike: SPIKE,
    setup: { printers },
    evidence: printers.map((printer) => ({
      printerId: printer.id,
      ticketLegible: true,
      drawerOpened: true,
    })),
    network: {
      unregisteredDeviceReachedPrinterPort: false,
      currentRouterIsolatesPrinters: true,
    },
    dedicatedRouter: DEDICATED_ROUTER,
    decision: "The ticket was legible and the drawer opened.",
    consumerDelivery: CONSUMER_DELIVERY,
    delivery16: DELIVERY_16.UNBLOCKED,
    owner: "pilot-visit",
    adr003: ADR003,
  };
}

function readExampleReport(): DecisionReportInput & { status: string } {
  const examplePath = fileURLToPath(import.meta.resolve("#report-example"));

  return JSON.parse(readFileSync(examplePath, "utf8"));
}

it("given every printer result, both network booleans, and delivery 1.6 unblocked, when the report is closed, then the spike is concluded", () => {
  const report = readyReport();

  const closed = closeDecisionReport(report);

  expect(closed.status).toBe(REPORT_STATUS.CONCLUDED);
  expect(closed.delivery16).toBe(DELIVERY_16.UNBLOCKED);
  expect(closed.spike).toBe(SPIKE);
  expect(closed.consumerDelivery).toBe(CONSUMER_DELIVERY);
  expect(closed.dedicatedRouter).toBe(DEDICATED_ROUTER);
  expect(closed.adr003).toBe(ADR003);
  expect(JSON.stringify(closed)).not.toMatch(/\$\s*\d|\bprice\b/i);
});

it("given one printer with null legibility, when the report is closed, then it is blocking with an owner and delivery 1.6 pending", () => {
  const report = readyReport();
  report.evidence[0].ticketLegible = null;

  const closed = closeDecisionReport(report);

  expect(closed.status).toBe(REPORT_STATUS.BLOCKING);
  expect(closed.owner.length).toBeGreaterThan(0);
  expect(closed.delivery16).toBe(DELIVERY_16.PENDING);
  expect(closed.consumerDelivery).toBe(CONSUMER_DELIVERY);
});

it("given one printer with a null drawer result, when the report is closed, then it is blocking and delivery 1.6 is pending", () => {
  const report = readyReport();
  report.evidence[1].drawerOpened = null;

  const closed = closeDecisionReport(report);

  expect(closed.status).toBe(REPORT_STATUS.BLOCKING);
  expect(closed.owner).toBe("pilot-visit");
  expect(closed.delivery16).toBe(DELIVERY_16.PENDING);
});

it("given a null network boolean, when the report is closed, then the spike is blocking and delivery 1.6 is pending", () => {
  const unreachable = readyReport();
  unreachable.network.unregisteredDeviceReachedPrinterPort = null;
  const isolationUnknown = readyReport();
  isolationUnknown.network.currentRouterIsolatesPrinters = null;

  const closedUnreachable = closeDecisionReport(unreachable);
  const closedIsolation = closeDecisionReport(isolationUnknown);

  expect(closedUnreachable.status).toBe(REPORT_STATUS.BLOCKING);
  expect(closedUnreachable.delivery16).toBe(DELIVERY_16.PENDING);
  expect(closedIsolation.status).toBe(REPORT_STATUS.BLOCKING);
  expect(closedIsolation.delivery16).toBe(DELIVERY_16.PENDING);
});

it("given one setup printer without evidence, when the report is closed, then the spike is blocking and delivery 1.6 is pending", () => {
  const report = readyReport();
  report.evidence = report.evidence.slice(0, 1);

  const closed = closeDecisionReport(report);

  expect(closed.status).toBe(REPORT_STATUS.BLOCKING);
  expect(closed.delivery16).toBe(DELIVERY_16.PENDING);
  expect(closed.owner).not.toBe("");
});

it("given complete evidence and delivery 1.6 pending, when the report is closed, then the spike stays blocking", () => {
  const report = readyReport();
  report.delivery16 = DELIVERY_16.PENDING;

  const closed = closeDecisionReport(report);

  expect(closed.status).toBe(REPORT_STATUS.BLOCKING);
  expect(closed.delivery16).toBe(DELIVERY_16.PENDING);
});

it("given an inconclusive spike and an empty owner, when the report is closed, then the guard rejects it", () => {
  const report = readyReport();
  report.evidence[0].ticketLegible = null;
  report.owner = "  ";

  expect(() => closeDecisionReport(report)).toThrow(/owner/i);
});

it("given hardware priced in the decision, when the report is closed, then the guard rejects the price", () => {
  const report = readyReport();
  report.decision = "Buy the dedicated router for $40.";

  expect(() => closeDecisionReport(report)).toThrow(/price/i);
});

it("given a price field on the report, when the report is closed, then the guard rejects it", () => {
  const report = {
    ...readyReport(),
    price: 40,
  };

  expect(() => closeDecisionReport(report)).toThrow(/price/i);
});

it("given dedicatedRouter is not owner-buys, when the report is closed, then the guard rejects it", () => {
  const report = readyReport();
  report.dedicatedRouter = "$40";

  expect(() => closeDecisionReport(report)).toThrow(/owner-buys|price/i);
});

it("given adr003 is not pending-hybrid, when the report is closed, then the guard rejects it", () => {
  const report = readyReport();
  report.adr003 = "accepted";

  expect(() => closeDecisionReport(report)).toThrow(/pending-hybrid/i);
});

it("given the site router has no isolation rules, when the visit is recorded, then the decision tells the owner to buy the dedicated router or use wired printers", () => {
  const report = readyReport();
  report.network = {
    unregisteredDeviceReachedPrinterPort: true,
    currentRouterIsolatesPrinters: false,
  };
  report.decision = "The guest phone reached the printer port.";

  const closed = closeDecisionReport(report);

  expect(closed.decision.toLowerCase()).toContain("buy the dedicated router");
  expect(closed.decision.toLowerCase()).toContain("or use wired printers");
  expect(closed.status).toBe(REPORT_STATUS.CONCLUDED);
});

it("given the current router isolates printers, when the visit is recorded, then the decision stays the operator text", () => {
  const report = readyReport();
  report.decision = "The site router isolates printers.";

  const closed = closeDecisionReport(report);

  expect(closed.decision).toBe("The site router isolates printers.");
  expect(closed.status).toBe(REPORT_STATUS.CONCLUDED);
});

it("given report.example.json, when it is read, then status is blocking, owner is pilot-visit, and delivery16 is pending", () => {
  const report = readExampleReport();

  expect(report.status).toBe(REPORT_STATUS.BLOCKING);
  expect(report.owner).toBe("pilot-visit");
  expect(report.delivery16).toBe(DELIVERY_16.PENDING);
  expect(report.spike).toBe(SPIKE);
  expect(report.dedicatedRouter).toBe(DEDICATED_ROUTER);
  expect(report.consumerDelivery).toBe(CONSUMER_DELIVERY);
  expect(report.adr003).toBe(ADR003);
});

it("given the checked-in example, when the report is closed, then the visit stays blocking", () => {
  const report = readExampleReport();

  const closed = closeDecisionReport(report);

  expect(closed.status).toBe(REPORT_STATUS.BLOCKING);
  expect(closed.owner).toBe("pilot-visit");
  expect(closed.delivery16).toBe(DELIVERY_16.PENDING);
  expect(closed.spike).toBe(SPIKE);
  expect(closed.dedicatedRouter).toBe(DEDICATED_ROUTER);
  expect(closed.adr003).toBe(ADR003);
});
