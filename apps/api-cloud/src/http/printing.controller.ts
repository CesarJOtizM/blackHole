import {
  type RecordedReprint,
  recordedReprint,
  reprintDocumentCommand,
} from "@blackhole/contracts";
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
  Post,
} from "@nestjs/common";

const ACTOR_HEADER = "x-actor-id";
const DEVICE_HEADER = "x-device-id";

export const routePermissions = {
  "POST reprints": "sale.reprint",
} as const;

export class ReprintCap {
  constructor(readonly limit: number | null) {}
}

export class MemoryReprintAudit extends ReprintAudit {
  readonly events: ReprintAuditEvent[] = [];

  override async record(event: ReprintAuditEvent): Promise<void> {
    this.events.push({ ...event });
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
  ) {}

  @Post("reprints")
  @HttpCode(HttpStatus.OK)
  async reprint(
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
    const reprintDocument = new ReprintDocument(this.audits);

    try {
      await reprintDocument.execute({
        actorId,
        deviceId,
        document: parsed.data.document,
        occurredAt,
        limit: this.cap.limit,
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
      document: parsed.data.document,
      occurredAt,
    });
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
