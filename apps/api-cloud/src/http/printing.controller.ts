import {
  type RecordedReprint,
  recordedReprint,
  reprintDocumentCommand,
} from "@blackhole/contracts";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import {
  ReprintAudit,
  type ReprintAuditEvent,
  ReprintCapUnconfigured,
  ReprintDocument,
} from "@blackhole/printing/application/entry-port";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

import { authorizerOf } from "#src/http/void-command.js";

const ACTOR_HEADER = "x-actor-id";
const DEVICE_HEADER = "x-device-id";

export const routePermissions = {
  "POST reprints": "sale.reprint",
} as const;

export class ReprintCap {
  constructor(readonly limit: number | null) {}
}

export type StoredReprintAudit = ReprintAuditEvent & {
  authorizerId?: string;
};

export class MemoryReprintAudit extends ReprintAudit {
  readonly events: StoredReprintAudit[] = [];

  override async record(event: ReprintAuditEvent): Promise<void> {
    this.events.push({ ...event });
  }

  async recordAuthorized(
    event: ReprintAuditEvent,
    authorizerId: string,
  ): Promise<void> {
    this.events.push({ ...event, authorizerId });
  }
}

@Controller("tenants/:tenantId")
export class PrintingController {
  constructor(
    @Inject(MemoryReprintAudit)
    private readonly audits: MemoryReprintAudit,
    @Inject(ReprintCap)
    private readonly cap: ReprintCap,
    @Inject(Clock)
    private readonly clock: Clock,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("reprints")
  @HttpCode(HttpStatus.OK)
  async reprint(
    @Param("tenantId") tenantId: string,
    @Headers(ACTOR_HEADER) actorHeader: unknown,
    @Headers(DEVICE_HEADER) deviceHeader: unknown,
    @Body() body: unknown,
  ): Promise<RecordedReprint> {
    const actorId = readText(actorHeader);
    const deviceId = readText(deviceHeader);
    const parsed = reprintDocumentCommand.safeParse(body);

    if (actorId === null || deviceId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const occurredAt = new Date(this.clock.now()).toISOString();
    const document = parsed.data.document;
    const limit = this.cap.limit;
    const overCap = limit !== null && this.priorReprints(document) >= limit;

    if (overCap) {
      const authorizerId = await authorizerOf(
        this.authorizations,
        tenantId,
        parsed.data.authorizationId ?? null,
      );

      if (authorizerId === null) {
        throw new ConflictException({ error: "ReprintNeedsAuthorization" });
      }

      await this.audits.recordAuthorized(
        {
          action: "sale.reprint",
          actorId,
          deviceId,
          document,
          occurredAt,
        },
        authorizerId,
      );

      return recordedReprint.parse({
        action: "sale.reprint",
        actorId,
        deviceId,
        document,
        occurredAt,
        authorizerId,
      });
    }

    try {
      await new ReprintDocument(this.audits).execute({
        actorId,
        deviceId,
        document,
        occurredAt,
        limit,
      });
    } catch (error: unknown) {
      if (error instanceof ReprintCapUnconfigured) {
        throw new ConflictException({ error: error.name });
      }

      throw error;
    }

    return recordedReprint.parse({
      action: "sale.reprint",
      actorId,
      deviceId,
      document,
      occurredAt,
    });
  }

  private priorReprints(document: string): number {
    return this.audits.events.filter(
      (event) => event.action === "sale.reprint" && event.document === document,
    ).length;
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
