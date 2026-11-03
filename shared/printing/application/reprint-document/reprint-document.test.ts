import { expect, it, vi } from "vitest";

import {
  ReprintAudit,
  type ReprintAuditEvent,
  ReprintCapUnconfigured,
  ReprintDocument,
  type ReprintDocumentCommand,
} from "#application/reprint-document/reprint-document.js";

const connect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("socket opened");
  }),
);

vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    connect,
    createConnection: connect,
  };
});

const ACTOR_ID = "identity_cashier";
const DEVICE_ID = "device_register";
const DOCUMENT_ID = "invoice_setp990000001";
const OCCURRED_AT = "2026-11-02T18:00:00.000Z";
const LIMIT = 3;

class MemoryReprintAudits extends ReprintAudit {
  readonly events: ReprintAuditEvent[] = [];

  override async record(event: ReprintAuditEvent): Promise<void> {
    this.events.push({ ...event });
  }
}

const harness = () => {
  const audits = new MemoryReprintAudits();
  const reprint = new ReprintDocument(audits);

  return { audits, reprint };
};

const command = (
  overrides: Partial<ReprintDocumentCommand> = {},
): ReprintDocumentCommand => ({
  actorId: ACTOR_ID,
  deviceId: DEVICE_ID,
  document: DOCUMENT_ID,
  occurredAt: OCCURRED_AT,
  limit: LIMIT,
  ...overrides,
});

it("given a cashier under the reprint cap, when she reprints a document, then sale.reprint carries the actor, device, document, and time", async () => {
  const { audits, reprint } = harness();

  await reprint.execute(command());

  expect(audits.events).toEqual([
    {
      action: "sale.reprint",
      actorId: ACTOR_ID,
      deviceId: DEVICE_ID,
      document: DOCUMENT_ID,
      occurredAt: OCCURRED_AT,
    },
  ]);
  expect(connect).not.toHaveBeenCalled();
});

it("given a null reprint cap, when she reprints a document, then ReprintCapUnconfigured is thrown and nothing is stored", async () => {
  const { audits, reprint } = harness();

  const pending = reprint.execute(command({ limit: null }));

  await expect(pending).rejects.toBeInstanceOf(ReprintCapUnconfigured);
  expect(audits.events).toEqual([]);
  expect(connect).not.toHaveBeenCalled();
});
