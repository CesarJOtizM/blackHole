import { expect, it } from "vitest";
import type {
  PendingIssuance,
  SyntheticPendingDocument,
} from "#application/ports/pending-issuance.js";

export type PendingIssuanceSubject = PendingIssuance & {
  record(document: SyntheticPendingDocument): Promise<void>;
};

const now = Date.parse("2026-10-22T12:02:00.000Z");

export function pendingIssuanceContract(
  createIssuance: (
    now: number,
  ) => PendingIssuanceSubject | Promise<PendingIssuanceSubject>,
): void {
  it("given no documents, when snapshot runs, then it is empty", async () => {
    const issuance = await createIssuance(now);

    const snapshot = await issuance.snapshot();

    expect(snapshot).toEqual([]);
  });

  it("given a pending issuance document, when snapshot runs, then venue id, status, and age seconds are returned", async () => {
    const issuance = await createIssuance(now);

    await issuance.record({
      id: "doc-pending",
      venueId: "venue-1",
      status: "pending_issuance",
      requestedAt: Date.parse("2026-10-22T12:00:30.000Z"),
    });
    const snapshot = await issuance.snapshot();

    expect(snapshot).toEqual([
      { venueId: "venue-1", status: "pending_issuance", ageSeconds: 90 },
    ]);
  });

  it("given an uncertain document, when snapshot runs, then venue id, status, and age seconds are returned", async () => {
    const issuance = await createIssuance(now);

    await issuance.record({
      id: "doc-uncertain",
      venueId: "venue-2",
      status: "uncertain",
      requestedAt: Date.parse("2026-10-22T12:01:15.000Z"),
    });
    const snapshot = await issuance.snapshot();

    expect(snapshot).toEqual([
      { venueId: "venue-2", status: "uncertain", ageSeconds: 45 },
    ]);
  });

  it("given pending and uncertain documents, when snapshot runs, then the older document is first", async () => {
    const issuance = await createIssuance(now);

    await issuance.record({
      id: "doc-newer",
      venueId: "venue-2",
      status: "uncertain",
      requestedAt: Date.parse("2026-10-22T12:01:30.000Z"),
    });
    await issuance.record({
      id: "doc-older",
      venueId: "venue-1",
      status: "pending_issuance",
      requestedAt: Date.parse("2026-10-22T12:00:00.000Z"),
    });
    const snapshot = await issuance.snapshot();

    expect(snapshot).toEqual([
      { venueId: "venue-1", status: "pending_issuance", ageSeconds: 120 },
      { venueId: "venue-2", status: "uncertain", ageSeconds: 30 },
    ]);
  });

  it("given a document that is not pending or uncertain, when snapshot runs, then it is omitted", async () => {
    const issuance = await createIssuance(now);
    const closed: SyntheticPendingDocument["status"][] = [
      "generated",
      "sending",
      "accepted",
      "rejected",
    ];

    for (const [index, status] of closed.entries()) {
      await issuance.record({
        id: `doc-${status}`,
        venueId: `venue-${index}`,
        status,
        requestedAt: now,
      });
    }
    await issuance.record({
      id: "doc-open",
      venueId: "venue-open",
      status: "pending_issuance",
      requestedAt: Date.parse("2026-10-22T12:01:00.000Z"),
    });
    const snapshot = await issuance.snapshot();

    expect(snapshot).toEqual([
      { venueId: "venue-open", status: "pending_issuance", ageSeconds: 60 },
    ]);
  });
}
