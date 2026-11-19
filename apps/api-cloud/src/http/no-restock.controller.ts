import {
  type ConfirmNoRestockTodayInput,
  RemoveNoRestockToday,
} from "@blackhole/inventory/application/entry-port";
import {
  ConfirmGuestTold,
  MarkLineUndeliverable,
} from "@blackhole/orders/application/entry-port";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";

const SESSION_HEADER = "x-session-id";

const emptyCommand = z.object({}).strict();

const PERMITTED = "NoRestockNotPermitted";
const DISABLED = "NoRestockTodayDisabled";
const UNKNOWN_MARK = "UnknownNoRestockMark";
const GUEST_REJECTED = "GuestToldRejected";
const UNDELIVERABLE = "UndeliverableLineRejected";
const TABLE_NOT_OPEN = "TableNotOpen";
const INVALID_LINE = "InvalidLineId";
const MISSING_GUEST = "MissingGuestActor";

export const routePermissions = {
  "GET no-restock": "session",
  "POST products/:productId/no-restock/confirm": "inventory.confirm-no-restock",
  "POST products/:productId/no-restock/remove": "inventory.remove-no-restock",
  "POST checks/:checkId/lines/:lineId/guest-told": "session",
  "POST checks/:checkId/lines/:lineId/cannot-finish": "session",
} as const;

export interface NoRestockMarkView {
  productId: string;
  status: string;
  serviceDate: string | null;
  actorId: string | null;
}

export interface ConfirmedNoRestock {
  productId: string;
  status: string;
  serviceDate: string | null;
  tables: readonly string[];
}

export abstract class NoRestockCatalog {
  abstract list(
    tenantId: string,
    venueId: string,
    at: Date,
  ): Promise<readonly NoRestockMarkView[]>;
}

export abstract class ConfirmNoRestockFlow {
  abstract execute(
    input: ConfirmNoRestockTodayInput,
  ): Promise<ConfirmedNoRestock>;
}

interface SavedLine {
  id: string;
  state: string;
}

interface SavedCheck {
  id: string;
  orders: readonly { lines: readonly SavedLine[] }[];
}

const rejectionName = (error: unknown): string | null =>
  error instanceof Error ? error.name : null;

const readText = (header: unknown): string | null => {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
};

@Controller("tenants/:tenantId/venues/:venueId")
export class NoRestockController {
  constructor(
    @Inject(NoRestockCatalog)
    private readonly catalog: NoRestockCatalog,
    @Inject(ConfirmNoRestockFlow)
    private readonly confirming: ConfirmNoRestockFlow,
    @Inject(RemoveNoRestockToday)
    private readonly removing: RemoveNoRestockToday,
    @Inject(ConfirmGuestTold)
    private readonly guestTold: ConfirmGuestTold,
    @Inject(MarkLineUndeliverable)
    private readonly undeliverable: MarkLineUndeliverable,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(Clock)
    private readonly clock: Clock,
  ) {}

  @Get("no-restock")
  async list(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ) {
    await this.actor(tenantId, sessionHeader);
    const at = new Date(this.clock.now());
    const [marks, notices] = await Promise.all([
      this.catalog.list(tenantId, venueId, at),
      this.guestTold.pending(tenantId, venueId),
    ]);

    return { marks, notices };
  }

  @Post("products/:productId/no-restock/confirm")
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ConfirmedNoRestock> {
    const actor = await this.commandActor(tenantId, sessionHeader, body);

    try {
      return await this.confirming.execute({
        tenantId,
        venueId,
        productId,
        actorId: actor.userId,
        sessionId: actor.sessionId,
        deviceId: actor.deviceId,
        at: new Date(this.clock.now()),
      });
    } catch (error: unknown) {
      throw this.markFailure(error);
    }
  }

  @Post("products/:productId/no-restock/remove")
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<{
    productId: string;
    status: string;
    serviceDate: string | null;
  }> {
    const actor = await this.commandActor(tenantId, sessionHeader, body);
    const at = new Date(this.clock.now());

    try {
      const removed = await this.removing.execute({
        tenantId,
        venueId,
        productId,
        actorId: actor.userId,
        sessionId: actor.sessionId,
        deviceId: actor.deviceId,
        at,
      });

      return {
        productId: removed.mark.productId,
        status: removed.mark.statusAt(at),
        serviceDate: removed.mark.serviceDate,
      };
    } catch (error: unknown) {
      throw this.markFailure(error);
    }
  }

  @Post("checks/:checkId/lines/:lineId/guest-told")
  @HttpCode(HttpStatus.OK)
  async tellGuest(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const actor = await this.commandActor(tenantId, sessionHeader, body);

    try {
      return await this.guestTold.execute({
        tenantId,
        venueId,
        checkId,
        lineId,
        actorId: actor.userId,
        deviceId: actor.deviceId,
      });
    } catch (error: unknown) {
      throw this.lineFailure(error);
    }
  }

  @Post("checks/:checkId/lines/:lineId/cannot-finish")
  @HttpCode(HttpStatus.OK)
  async cannotFinish(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    await this.commandActor(tenantId, sessionHeader, body);

    try {
      const saved: SavedCheck = await this.undeliverable.execute({
        tenantId,
        venueId,
        checkId,
        lineId,
      });
      const line = saved.orders
        .flatMap((order) => order.lines)
        .find((item) => item.id === lineId);

      return {
        checkId: saved.id,
        lineId,
        state: line?.state,
      };
    } catch (error: unknown) {
      throw this.lineFailure(error);
    }
  }

  private async commandActor(
    tenantId: string,
    sessionHeader: unknown,
    body: unknown,
  ) {
    if (!emptyCommand.safeParse(body).success) {
      throw new BadRequestException();
    }

    return this.actor(tenantId, sessionHeader);
  }

  private async actor(tenantId: string, sessionHeader: unknown) {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    return session;
  }

  private markFailure(error: unknown): Error {
    const name = rejectionName(error);

    if (name === PERMITTED || name === DISABLED) {
      return new ForbiddenException({ error: name });
    }

    if (name === UNKNOWN_MARK) {
      return new NotFoundException({ error: name });
    }

    return error instanceof Error ? error : new Error("NoRestockFailed");
  }

  private lineFailure(error: unknown): Error {
    const name = rejectionName(error);

    if (
      name === GUEST_REJECTED ||
      name === UNDELIVERABLE ||
      name === TABLE_NOT_OPEN ||
      name === INVALID_LINE
    ) {
      return new ConflictException({ error: name });
    }

    if (name === MISSING_GUEST) {
      return new BadRequestException({ error: name });
    }

    return error instanceof Error ? error : new Error("NoRestockFailed");
  }
}
