const SPIKE = "escpos-cash-drawer";
const DEDICATED_ROUTER = "owner-buys";
const CONSUMER_DELIVERY = "1.6";
const ADR003 = "pending-hybrid";

const DELIVERY_16 = {
  PENDING: "pending",
  UNBLOCKED: "unblocked",
};

const REPORT_STATUS = {
  CONCLUDED: "concluded",
  BLOCKING: "blocking",
};

const ISOLATION_DECISION = "Buy the dedicated router or use wired printers.";

const PRICE_KEY = /^(?:price|cost|amount)$/i;
const PRICE_TEXT = /(?:\$\s*\d|\b\d+(?:[.,]\d+)?\s*(?:usd|eur)\b)/i;

export function closeDecisionReport(input) {
  const report = readReport(input);
  rejectPrice(input);

  const decision = decisionFor(report);

  if (canConclude(report)) {
    return {
      ...visibleReport(report, decision),
      delivery16: DELIVERY_16.UNBLOCKED,
      status: REPORT_STATUS.CONCLUDED,
    };
  }

  if (report.owner.trim() === "") {
    throw new Error("A blocking report requires a non-empty owner");
  }

  return {
    ...visibleReport(report, decision),
    delivery16: DELIVERY_16.PENDING,
    status: REPORT_STATUS.BLOCKING,
  };
}

function readReport(input) {
  if (input === null || typeof input !== "object") {
    throw new Error("Decision report must be an object");
  }

  if (input.spike !== SPIKE) {
    throw new Error('spike must be "escpos-cash-drawer"');
  }

  if (input.consumerDelivery !== CONSUMER_DELIVERY) {
    throw new Error('consumerDelivery must be "1.6"');
  }

  if (input.adr003 !== ADR003) {
    throw new Error('adr003 must be "pending-hybrid"');
  }

  if (input.dedicatedRouter !== DEDICATED_ROUTER) {
    throw new Error(
      "dedicatedRouter must be owner-buys and must not include a price",
    );
  }

  if (
    input.delivery16 !== DELIVERY_16.PENDING &&
    input.delivery16 !== DELIVERY_16.UNBLOCKED
  ) {
    throw new Error('delivery16 must be "pending" or "unblocked"');
  }

  if (typeof input.decision !== "string") {
    throw new Error("decision must be a string");
  }

  if (typeof input.owner !== "string") {
    throw new Error("owner must be a string");
  }

  const printers = input.setup?.printers;
  if (!Array.isArray(printers)) {
    throw new Error("setup.printers must be an array");
  }

  if (!Array.isArray(input.evidence)) {
    throw new Error("evidence must be an array");
  }

  const network = input.network;
  if (network === null || typeof network !== "object") {
    throw new Error("network findings are required");
  }

  requireBooleanOrNull(
    network.unregisteredDeviceReachedPrinterPort,
    "unregisteredDeviceReachedPrinterPort",
  );
  requireBooleanOrNull(
    network.currentRouterIsolatesPrinters,
    "currentRouterIsolatesPrinters",
  );

  return {
    spike: SPIKE,
    setup: {
      printers: printers.map(readPrinter),
    },
    evidence: input.evidence.map(readEvidence),
    network: {
      unregisteredDeviceReachedPrinterPort:
        network.unregisteredDeviceReachedPrinterPort,
      currentRouterIsolatesPrinters: network.currentRouterIsolatesPrinters,
    },
    dedicatedRouter: DEDICATED_ROUTER,
    decision: input.decision,
    consumerDelivery: CONSUMER_DELIVERY,
    delivery16: input.delivery16,
    owner: input.owner,
    adr003: ADR003,
  };
}

function readPrinter(printer) {
  if (printer === null || typeof printer !== "object") {
    throw new Error("Each setup printer must be an object");
  }

  if (typeof printer.id !== "string" || printer.id.trim() === "") {
    throw new Error("Each setup printer requires an id");
  }

  if (printer.paperMm !== 80 && printer.paperMm !== 58) {
    throw new Error("paperMm must be 80 or 58");
  }

  if (printer.transport !== "network" && printer.transport !== "usb") {
    throw new Error('transport must be "network" or "usb"');
  }

  return {
    id: printer.id,
    paperMm: printer.paperMm,
    transport: printer.transport,
  };
}

function readEvidence(evidence) {
  if (evidence === null || typeof evidence !== "object") {
    throw new Error("Each evidence item must be an object");
  }

  if (
    typeof evidence.printerId !== "string" ||
    evidence.printerId.trim() === ""
  ) {
    throw new Error("Each evidence item requires a printerId");
  }

  requireBooleanOrNull(evidence.ticketLegible, "ticketLegible");
  requireBooleanOrNull(evidence.drawerOpened, "drawerOpened");

  return {
    printerId: evidence.printerId,
    ticketLegible: evidence.ticketLegible,
    drawerOpened: evidence.drawerOpened,
  };
}

function requireBooleanOrNull(value, fieldName) {
  if (typeof value !== "boolean" && value !== null) {
    throw new Error(`${fieldName} must be a boolean or null`);
  }
}

function rejectPrice(value, seen = new Set()) {
  if (typeof value === "string") {
    if (PRICE_TEXT.test(value)) {
      throw new Error("The report must not price hardware");
    }

    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      rejectPrice(item, seen);
    }

    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (PRICE_KEY.test(key)) {
      throw new Error("The report must not price hardware");
    }

    rejectPrice(nested, seen);
  }
}

function canConclude(report) {
  if (report.delivery16 !== DELIVERY_16.UNBLOCKED) {
    return false;
  }

  if (report.setup.printers.length === 0) {
    return false;
  }

  if (
    typeof report.network.unregisteredDeviceReachedPrinterPort !== "boolean" ||
    typeof report.network.currentRouterIsolatesPrinters !== "boolean"
  ) {
    return false;
  }

  return report.setup.printers.every((printer) => {
    const evidence = report.evidence.find(
      (item) => item.printerId === printer.id,
    );

    return (
      evidence !== undefined &&
      typeof evidence.ticketLegible === "boolean" &&
      typeof evidence.drawerOpened === "boolean"
    );
  });
}

function decisionFor(report) {
  if (report.network.currentRouterIsolatesPrinters !== false) {
    return report.decision;
  }

  const decision = report.decision.toLowerCase();
  const tellsOwner =
    decision.includes("buy the dedicated router") &&
    decision.includes("or use wired printers");

  if (tellsOwner) {
    return report.decision;
  }

  if (report.decision.trim() === "") {
    return ISOLATION_DECISION;
  }

  return `${report.decision.trim()} ${ISOLATION_DECISION}`;
}

function visibleReport(report, decision) {
  return {
    spike: report.spike,
    setup: {
      printers: report.setup.printers.map((printer) => ({ ...printer })),
    },
    evidence: report.evidence.map((item) => ({ ...item })),
    network: { ...report.network },
    dedicatedRouter: report.dedicatedRouter,
    decision,
    consumerDelivery: report.consumerDelivery,
    owner: report.owner,
    adr003: report.adr003,
  };
}
