export const GENESIS_PREVIOUS_HASH = "0".repeat(64);

export class MissingActor extends Error {
  constructor() {
    super("An audit event requires an actor.");
    this.name = "MissingActor";
  }
}

export class AuditSequenceConflict extends Error {
  constructor() {
    super("An audit sequence already stores a different event.");
    this.name = "AuditSequenceConflict";
  }
}

export interface AuditLink {
  actorId: string;
  authorizerId: string | null;
  deviceId: string;
  siteId: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
  reason: string;
  occurredAt: number;
  sequence: number;
  previousHash: string;
  digest: string;
}

export interface AuditLinkDraft {
  actorId: string;
  authorizerId: string | null;
  deviceId: string;
  siteId: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
  reason: string;
  occurredAt: number;
  digest: string;
}

export type ChainFinding =
  | { kind: "altered"; deviceId: string; sequence: number }
  | { kind: "deleted"; deviceId: string; sequence: number };

const copyLink = (link: AuditLink): AuditLink => ({ ...link });

export class DeviceChain {
  private readonly linkList: AuditLink[];

  private constructor(
    readonly tenantId: string,
    readonly deviceId: string,
    links: readonly AuditLink[],
  ) {
    this.linkList = links.map(copyLink);
  }

  static open(tenantId: string, deviceId: string): DeviceChain {
    return new DeviceChain(tenantId, deviceId, []);
  }

  static restore(
    tenantId: string,
    deviceId: string,
    links: readonly AuditLink[],
  ): DeviceChain {
    return new DeviceChain(tenantId, deviceId, links);
  }

  get links(): readonly AuditLink[] {
    return this.linkList.map(copyLink);
  }

  append(draft: AuditLinkDraft): AuditLink {
    if (draft.actorId.trim() === "") {
      throw new MissingActor();
    }

    if (draft.deviceId !== this.deviceId) {
      throw new Error("An audit event belongs to one device chain.");
    }

    const previous = this.linkList.at(-1);
    const link: AuditLink = {
      actorId: draft.actorId,
      authorizerId: draft.authorizerId,
      deviceId: draft.deviceId,
      siteId: draft.siteId,
      action: draft.action,
      entity: draft.entity,
      before: draft.before,
      after: draft.after,
      reason: draft.reason,
      occurredAt: draft.occurredAt,
      sequence: previous ? previous.sequence + 1 : 1,
      previousHash: previous ? previous.digest : GENESIS_PREVIOUS_HASH,
      digest: draft.digest,
    };

    this.linkList.push(link);

    return copyLink(link);
  }

  inspect(digestOf: (link: AuditLink) => string): ChainFinding | null {
    const ordered = [...this.linkList].sort(
      (left, right) => left.sequence - right.sequence,
    );
    let expectedSequence = 1;
    let expectedPrevious = GENESIS_PREVIOUS_HASH;

    for (const link of ordered) {
      if (link.sequence !== expectedSequence) {
        return {
          kind: "deleted",
          deviceId: this.deviceId,
          sequence: expectedSequence,
        };
      }

      if (
        link.previousHash !== expectedPrevious ||
        link.digest !== digestOf(link)
      ) {
        return {
          kind: "altered",
          deviceId: this.deviceId,
          sequence: link.sequence,
        };
      }

      expectedPrevious = link.digest;
      expectedSequence += 1;
    }

    return null;
  }
}
