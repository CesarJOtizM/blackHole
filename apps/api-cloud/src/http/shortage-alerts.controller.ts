import {
  AcceptStockLevels,
  AcceptStockLevelsDenied,
  MarkAlertSeen,
  MissingLocationLevels,
  ResolveAlert,
  ResolveReasonRequired,
  RestockDenied,
  RestockFromAlert,
  SetStockLevels,
  ShortageAlertNotFound,
  StockLevelsDenied,
  SuggestedStockLevelNotFound,
  WarehouseChoiceRequired,
} from "@blackhole/inventory/application/entry-port";
import { InvalidStockLevels } from "@blackhole/inventory/domain";
import {
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
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
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST stock-levels": "inventory.configure-levels",
  "POST stock-level-suggestions/:suggestionId/acceptance":
    "inventory.configure-levels",
  "POST shortage-alerts/:alertId/seen": "session",
  "POST shortage-alerts/:alertId/resolution": "session",
  "POST shortage-alerts/:alertId/restock": "inventory.request-replenishment",
} as const;

const levelsCommand = z
  .object({
    ingredientId: z.string().min(1),
    maximum: z.number().int().nonnegative(),
    reorderPoint: z.number().int().nonnegative(),
    minimum: z.number().int().nonnegative(),
  })
  .strict();

const resolveCommand = z
  .object({
    reason: z.string().trim().min(1),
  })
  .strict();

const restockCommand = z
  .object({
    purchaseUnit: z.number().int().positive(),
    documentId: z.string().min(1),
    lineId: z.string().min(1),
    warehouseId: z.string().min(1).nullable(),
    supplierId: z.string().min(1).nullable(),
  })
  .strict();

type ShortageTx = Parameters<RestockFromAlert["execute"]>[0];

export abstract class ShortageTransactions {
  abstract run<T>(
    tenantId: string,
    work: (tx: ShortageTx) => Promise<T>,
  ): Promise<T>;
}

interface Actor {
  sessionId: string;
  userId: string;
}

@Controller("tenants/:tenantId/venues/:venueId")
export class ShortageAlertsController {
  constructor(
    @Inject(SetStockLevels)
    private readonly levels: SetStockLevels,
    @Inject(AcceptStockLevels)
    private readonly acceptance: AcceptStockLevels,
    @Inject(MarkAlertSeen)
    private readonly seen: MarkAlertSeen,
    @Inject(ResolveAlert)
    private readonly resolutions: ResolveAlert,
    @Inject(RestockFromAlert)
    private readonly restocks: RestockFromAlert,
    @Inject(ShortageTransactions)
    private readonly transactions: ShortageTransactions,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(OrganizationRepository)
    private readonly organizations: OrganizationRepository,
    @Inject(Clock)
    private readonly clock: Clock,
  ) {}

  @Post("stock-levels")
  @HttpCode(HttpStatus.OK)
  async setLevels(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const parsed = levelsCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const venue = await this.venueOf(tenantId, venueId);

    try {
      return await this.levels.execute({
        tenantId,
        brandId: venue.brandId,
        venueId,
        ingredientId: parsed.data.ingredientId,
        sessionId: actor.sessionId,
        maximum: parsed.data.maximum,
        reorderPoint: parsed.data.reorderPoint,
        minimum: parsed.data.minimum,
      });
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("stock-level-suggestions/:suggestionId/acceptance")
  @HttpCode(HttpStatus.OK)
  async acceptLevels(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("suggestionId") suggestionId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const venue = await this.venueOf(tenantId, venueId);

    try {
      return await this.acceptance.execute({
        tenantId,
        brandId: venue.brandId,
        venueId,
        suggestionId,
        sessionId: actor.sessionId,
      });
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("shortage-alerts/:alertId/seen")
  @HttpCode(HttpStatus.OK)
  async markSeen(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("alertId") alertId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    await this.venueOf(tenantId, venueId);

    try {
      return await this.transactions.run(tenantId, (tx) =>
        this.seen.execute(tx, {
          tenantId,
          venueId,
          alertId,
          actorId: actor.userId,
          seenAt: new Date(this.clock.now()).toISOString(),
        }),
      );
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("shortage-alerts/:alertId/resolution")
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("alertId") alertId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const parsed = resolveCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    await this.venueOf(tenantId, venueId);

    try {
      return await this.transactions.run(tenantId, (tx) =>
        this.resolutions.execute(tx, {
          tenantId,
          venueId,
          alertId,
          actorId: actor.userId,
          resolvedAt: new Date(this.clock.now()).toISOString(),
          reason: parsed.data.reason,
        }),
      );
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("shortage-alerts/:alertId/restock")
  @HttpCode(HttpStatus.OK)
  async restock(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("alertId") alertId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const parsed = restockCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const venue = await this.venueOf(tenantId, venueId);

    try {
      return await this.transactions.run(tenantId, (tx) =>
        this.restocks.execute(tx, {
          tenantId,
          brandId: venue.brandId,
          venueId,
          alertId,
          sessionId: actor.sessionId,
          actorId: actor.userId,
          purchaseUnit: parsed.data.purchaseUnit,
          documentId: parsed.data.documentId,
          lineId: parsed.data.lineId,
          warehouseId: parsed.data.warehouseId,
          supplierId: parsed.data.supplierId,
        }),
      );
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  private async actor(
    tenantId: string,
    sessionHeader: unknown,
  ): Promise<Actor> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    return { sessionId, userId: session.userId };
  }

  private async venueOf(tenantId: string, venueId: string) {
    const organization = await this.organizations.load(tenantId);
    const venue = organization?.venues.find((item) => item.id === venueId);

    if (!venue) {
      throw new ConflictException({ error: "UnknownVenue" });
    }

    return venue;
  }

  private failure(error: unknown): Error {
    if (
      error instanceof BadRequestException ||
      error instanceof ForbiddenException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      return error;
    }

    if (
      error instanceof UnknownSession ||
      error instanceof UnknownAuthorization ||
      error instanceof RestockDenied ||
      error instanceof StockLevelsDenied ||
      error instanceof AcceptStockLevelsDenied
    ) {
      return new ForbiddenException({ error: error.name });
    }

    if (
      error instanceof ResolveReasonRequired ||
      error instanceof WarehouseChoiceRequired ||
      error instanceof InvalidStockLevels ||
      error instanceof MissingLocationLevels
    ) {
      return new BadRequestException({ error: error.name });
    }

    if (
      error instanceof ShortageAlertNotFound ||
      error instanceof SuggestedStockLevelNotFound
    ) {
      return new NotFoundException({ error: error.name });
    }

    return error instanceof Error
      ? error
      : new Error("Shortage alert request failed.");
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
