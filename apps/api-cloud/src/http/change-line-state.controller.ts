import {
  type ChangedOrderLine,
  changedOrderLine,
  prepareLineCommand,
  readyLineCommand,
} from "@blackhole/contracts";
import {
  ChangeLineState,
  InvalidLineId,
  LineTransitionRejected,
  TableNotOpen,
} from "@blackhole/orders/application/entry-port";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST checks/:checkId/lines/:lineId/preparation": "session",
  "POST checks/:checkId/lines/:lineId/ready": "session",
} as const;

const DOMAIN_REJECTION = [
  InvalidLineId,
  LineTransitionRejected,
  TableNotOpen,
] as const;

interface SavedCheck {
  id: string;
  orders: readonly {
    id: string;
    channel: string;
    lines: readonly {
      id: string;
      productId: string;
      name: string;
      course: number;
      price: number;
      state: string;
      sentAt?: string;
      inPreparationAt?: string;
      readyAt?: string;
    }[];
  }[];
}

@Controller("tenants/:tenantId/venues/:venueId")
export class ChangeLineStateController {
  constructor(
    @Inject(ChangeLineState)
    private readonly changeLineState: ChangeLineState,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
  ) {}

  @Post("checks/:checkId/lines/:lineId/preparation")
  @HttpCode(HttpStatus.OK)
  prepare(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ChangedOrderLine> {
    return this.advance(
      tenantId,
      venueId,
      checkId,
      lineId,
      sessionHeader,
      body,
      prepareLineCommand,
      "in_preparation",
    );
  }

  @Post("checks/:checkId/lines/:lineId/ready")
  @HttpCode(HttpStatus.OK)
  ready(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ChangedOrderLine> {
    return this.advance(
      tenantId,
      venueId,
      checkId,
      lineId,
      sessionHeader,
      body,
      readyLineCommand,
      "ready",
    );
  }

  private async advance(
    tenantId: string,
    venueId: string,
    checkId: string,
    lineId: string,
    sessionHeader: unknown,
    body: unknown,
    command: { safeParse(data: unknown): { success: boolean } },
    state: "in_preparation" | "ready",
  ): Promise<ChangedOrderLine> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null || !command.safeParse(body).success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    try {
      const saved = await this.changeLineState.execute({
        tenantId,
        venueId,
        checkId,
        lineId,
        state,
      });

      return presentLine(saved, lineId);
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
      }

      throw error;
    }
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}

function domainRejectionName(error: unknown): string | null {
  for (const Rejection of DOMAIN_REJECTION) {
    if (error instanceof Rejection) {
      return error.name;
    }
  }

  return null;
}

function presentLine(check: SavedCheck, lineId: string): ChangedOrderLine {
  for (const order of check.orders) {
    const line = order.lines.find((item) => item.id === lineId);

    if (line === undefined) {
      continue;
    }

    return changedOrderLine.parse({
      id: line.id,
      orderId: order.id,
      checkId: check.id,
      productId: line.productId,
      name: line.name,
      course: line.course,
      price: line.price,
      state: line.state,
      channel: order.channel,
      ...(line.sentAt === undefined ? {} : { sentAt: line.sentAt }),
      ...(line.inPreparationAt === undefined
        ? {}
        : { inPreparationAt: line.inPreparationAt }),
      ...(line.readyAt === undefined ? {} : { readyAt: line.readyAt }),
    });
  }

  throw new TableNotOpen();
}
