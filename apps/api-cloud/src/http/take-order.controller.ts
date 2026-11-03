import {
  addOrderLineCommand,
  deliverLineCommand,
  resendLineCommand,
  type SavedOrderLine,
  savedOrderLine,
  sendCourseCommand,
  sentCourse,
} from "@blackhole/contracts";
import {
  ChangeLineState,
  ComboNotSent,
  EmptyOrder,
  ForeignModifier,
  InvalidCheckPrice,
  InvalidLineId,
  InvalidOrderChannel,
  InvalidOrderId,
  LineTransitionRejected,
  MissingStation,
  ProductNotOrderable,
  TableNotOpen,
  TakeOrder,
  UnknownMenuReference,
} from "@blackhole/orders/application/entry-port";
import { Printer } from "@blackhole/orders/application/ports/printer";
import { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";
import {
  EvaluatePermission,
  RecordAuditEvent,
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import { AuditDigest } from "@blackhole/platform/application/ports/audit-digest";
import { AuditRepository } from "@blackhole/platform/application/ports/audit-repository";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
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
import {
  orderStayedWaiting,
  queuedOrderCount,
} from "#src/composition/sale-receipt.js";
import { PlatformDiningAudit } from "#src/http/platform-dining-audit.js";
import { authorizerOf } from "#src/http/void-command.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST checks/:checkId/lines": "sale.open-table",
  "POST checks/:checkId/send": "sale.open-table",
  "POST checks/:checkId/lines/:lineId/resend": "sale.open-table",
  "POST checks/:checkId/lines/:lineId/deliver": "sale.open-table",
} as const;

const ACTION = routePermissions["POST checks/:checkId/send"];

const DOMAIN_REJECTION = [
  ComboNotSent,
  EmptyOrder,
  ForeignModifier,
  InvalidCheckPrice,
  InvalidLineId,
  InvalidOrderChannel,
  InvalidOrderId,
  LineTransitionRejected,
  MissingStation,
  ProductNotOrderable,
  TableNotOpen,
  UnknownMenuReference,
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
      deliveredAt?: string;
    }[];
  }[];
}

@Controller("tenants/:tenantId/venues/:venueId")
export class TakeOrderController {
  constructor(
    @Inject(TakeOrder)
    private readonly takeOrder: TakeOrder,
    @Inject(ChangeLineState)
    private readonly changeLineState: ChangeLineState,
    @Inject(VenueDirectory)
    private readonly venues: VenueDirectory,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
    @Inject(AuditRepository)
    private readonly audits: AuditRepository,
    @Inject(AuditDigest)
    private readonly digests: AuditDigest,
    @Inject(Clock)
    private readonly clock: Clock,
    @Inject(Printer)
    private readonly orders: Printer,
  ) {}

  @Post("checks/:checkId/lines")
  @HttpCode(HttpStatus.OK)
  async addLine(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<SavedOrderLine> {
    const sessionId = readText(sessionHeader);
    const parsed = addOrderLineCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const { session } = await this.authorize(tenantId, venueId, sessionId);
    const { reason, shiftId, authorizationId, ...line } = parsed.data;
    const edit =
      reason === undefined ||
      shiftId === undefined ||
      authorizationId === undefined
        ? undefined
        : {
            actorId: session.userId,
            authorizerId: await authorizerOf(
              this.authorizations,
              tenantId,
              authorizationId,
            ),
            sessionId,
            deviceId: session.deviceId,
            shiftId,
            reason,
            authorizationId,
          };

    try {
      const brandId = await this.brandOf(tenantId, venueId);
      const saved =
        edit === undefined
          ? await this.takeOrder.hold({
              tenantId,
              brandId,
              venueId,
              checkId,
              line: parsed.data,
            })
          : await this.takeOrder.hold({
              tenantId,
              brandId,
              venueId,
              checkId,
              line,
              edit,
            });

      if (!holdsLine(saved, parsed.data.lineId)) {
        throw new ConflictException({ error: "PrintedCheckEditRefused" });
      }

      return presentLine(saved, parsed.data.lineId);
    } catch (error: unknown) {
      throw rejectionOf(error);
    }
  }

  @Post("checks/:checkId/send")
  @HttpCode(HttpStatus.OK)
  async send(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = sendCourseCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const { session, decision } = await this.authorize(
      tenantId,
      venueId,
      sessionId,
    );

    try {
      const brandId = await this.brandOf(tenantId, venueId);
      const before = queuedOrderCount(this.orders);
      const saved =
        "lines" in parsed.data
          ? await this.takeOrder.execute({
              tenantId,
              brandId,
              venueId,
              checkId,
              course: parsed.data.course,
              lines: parsed.data.lines,
            })
          : await this.takeOrder.fire({
              tenantId,
              brandId,
              venueId,
              checkId,
              course: parsed.data.course,
            });
      const lines = sentLines(saved, parsed.data.course);
      const sentAt = lines[0]?.sentAt;

      if (sentAt === undefined) {
        throw new EmptyOrder();
      }

      await new PlatformDiningAudit(
        new RecordAuditEvent(this.audits, this.digests, this.clock),
      ).record({
        tenantId,
        actorId: session.userId,
        authorizerId: decision.selfAuthorized ? session.userId : null,
        deviceId: session.deviceId,
        siteId: venueId,
        action: ACTION,
        entity: checkId,
        before: {
          course: parsed.data.course,
          lineIds: lines.map((line) => line.id),
          state: "held",
        },
        after: {
          course: parsed.data.course,
          lineIds: lines.map((line) => line.id),
          state: "sent",
          sentAt,
        },
        reason: ACTION,
      });

      return sentCourse.parse({
        checkId: saved.id,
        course: parsed.data.course,
        lines,
        ...(orderStayedWaiting(this.orders, before) ? { printed: false } : {}),
      });
    } catch (error: unknown) {
      throw rejectionOf(error);
    }
  }

  @Post("checks/:checkId/lines/:lineId/resend")
  @HttpCode(HttpStatus.OK)
  async resend(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<SavedOrderLine> {
    const sessionId = readText(sessionHeader);
    const parsed = resendLineCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.authorize(tenantId, venueId, sessionId);

    try {
      const before = queuedOrderCount(this.orders);
      const saved = await this.takeOrder.resend({
        tenantId,
        venueId,
        checkId,
        lineId,
      });
      const line = presentLine(saved, lineId);

      if (!orderStayedWaiting(this.orders, before)) {
        return line;
      }

      return savedOrderLine.parse({ ...line, printed: false });
    } catch (error: unknown) {
      throw rejectionOf(error);
    }
  }

  @Post("checks/:checkId/lines/:lineId/deliver")
  @HttpCode(HttpStatus.OK)
  async deliver(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<SavedOrderLine> {
    const sessionId = readText(sessionHeader);
    const parsed = deliverLineCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.authorize(tenantId, venueId, sessionId);

    try {
      const saved = await this.changeLineState.execute({
        tenantId,
        venueId,
        checkId,
        lineId,
        state: "delivered",
      });

      return presentLine(saved, lineId);
    } catch (error: unknown) {
      throw rejectionOf(error);
    }
  }

  private async authorize(
    tenantId: string,
    venueId: string,
    sessionId: string,
  ) {
    const decision = await this.permit(tenantId, sessionId, venueId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "SaleOpenTableDenied" });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    return { session, decision };
  }

  private async brandOf(tenantId: string, venueId: string): Promise<string> {
    const brandId = await this.venues.brandOf(tenantId, venueId);

    if (brandId === null) {
      throw new ProductNotOrderable();
    }

    return brandId;
  }

  private async permit(tenantId: string, sessionId: string, venueId: string) {
    const evaluate = new EvaluatePermission(
      this.authorizations,
      this.sessions,
      this.identities,
      this.authorizationClock,
    );

    try {
      return await evaluate.execute({
        tenantId,
        sessionId,
        permission: ACTION,
        target: { kind: "site", id: venueId, brandId: null },
        value: null,
        supportGrantId: null,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });
    } catch (error: unknown) {
      if (
        error instanceof UnknownSession ||
        error instanceof UnknownAuthorization
      ) {
        throw new ForbiddenException({ error: error.name });
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

function rejectionOf(error: unknown): unknown {
  const rejection = domainRejectionName(error);

  if (rejection !== null) {
    return new ConflictException({ error: rejection });
  }

  return error;
}

function domainRejectionName(error: unknown): string | null {
  for (const Rejection of DOMAIN_REJECTION) {
    if (error instanceof Rejection) {
      return error.name;
    }
  }

  return null;
}

function holdsLine(check: SavedCheck, lineId: string): boolean {
  return check.orders.some((order) =>
    order.lines.some((line) => line.id === lineId),
  );
}

function presentLine(check: SavedCheck, lineId: string): SavedOrderLine {
  for (const order of check.orders) {
    const line = order.lines.find((item) => item.id === lineId);

    if (line === undefined) {
      continue;
    }

    return savedOrderLine.parse(lineRecord(check.id, order, line));
  }

  throw new TableNotOpen();
}

function sentLines(check: SavedCheck, course: number): SavedOrderLine[] {
  const lines: SavedOrderLine[] = [];

  for (const order of check.orders) {
    for (const line of order.lines) {
      if (line.course === course && line.state === "sent") {
        lines.push(savedOrderLine.parse(lineRecord(check.id, order, line)));
      }
    }
  }

  return lines;
}

function lineRecord(
  checkId: string,
  order: { id: string; channel: string },
  line: {
    id: string;
    productId: string;
    name: string;
    course: number;
    price: number;
    state: string;
    sentAt?: string;
    deliveredAt?: string;
  },
) {
  return {
    id: line.id,
    orderId: order.id,
    checkId,
    productId: line.productId,
    name: line.name,
    course: line.course,
    price: line.price,
    state: line.state,
    channel: order.channel,
    ...(line.sentAt === undefined ? {} : { sentAt: line.sentAt }),
    ...(line.deliveredAt === undefined
      ? {}
      : { deliveredAt: line.deliveredAt }),
  };
}
