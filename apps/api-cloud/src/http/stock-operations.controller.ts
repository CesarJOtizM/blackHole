import {
  ApproveAdjustment,
  IngredientHidden,
  RecordOperationalWaste,
  RecordStockCount,
  SetIngredientCategory,
  UnknownCountSession,
} from "@blackhole/inventory/application/entry-port";
import {
  InvalidCount,
  InvalidWaste,
  MissingCountLine,
  MissingWasteReason,
  WasteNoteRequired,
} from "@blackhole/inventory/domain";
import {
  EvaluatePermission,
  PERMISSION,
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
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { z } from "zod";

const SESSION_HEADER = "x-session-id";

const WASTE_REASON = [
  "expired",
  "damaged",
  "preparation_error",
  "other",
] as const;

export const routePermissions = {
  "POST operational-waste": "inventory.record-waste",
  "POST stock-counts": "inventory.count",
  "POST stock-counts/:documentId/approval": "inventory.approve-count",
  "PUT ingredients/:ingredientId/category": "inventory.count",
} as const;

const wasteCommand = z
  .object({
    locationId: z.string().min(1),
    ingredientId: z.string().min(1),
    documentId: z.string().min(1),
    quantity: z.number().int().positive(),
    averageCost: z.number().int().nonnegative(),
    reason: z.enum(WASTE_REASON),
    note: z.string().optional(),
    authorizerId: z.string().min(1).nullable().optional(),
  })
  .strict();

const countLine = z
  .object({
    ingredientId: z.string().min(1),
    purchaseQuantity: z.number().int().nonnegative(),
  })
  .strict();

const sheetQuery = z
  .object({
    locationId: z.string().min(1),
    cutOff: z.string().min(1),
    scope: z.enum(["full", "category"]),
    category: z.string().min(1).optional(),
  })
  .strict();

const countCommand = z
  .object({
    locationId: z.string().min(1),
    documentId: z.string().min(1),
    cutOff: z.string().min(1),
    scope: z.enum(["full", "category"]),
    category: z.string().min(1).optional(),
    lines: z.array(countLine).min(1),
    siteCap: z.number().int().nonnegative().optional(),
  })
  .strict();

const approvalCommand = z
  .object({
    countedBy: z.string().min(1),
    decision: z.enum(["approve", "reject"]),
    openRecount: z.boolean().optional(),
    recountDocumentId: z.string().min(1).optional(),
  })
  .strict();

const categoryCommand = z
  .object({
    category: z.string().trim().min(1),
  })
  .strict();

export interface FrozenCountSession {
  locationId: string;
  lines: readonly {
    ingredientId: string;
    quantity: number;
    averageCost: number;
    valueCop: number;
  }[];
}

export abstract class CountSessionReader {
  abstract sessionOf(
    tenantId: string,
    documentId: string,
  ): Promise<FrozenCountSession | null>;
}

interface Actor {
  sessionId: string;
  userId: string;
  deviceId: string;
}

@Controller("tenants/:tenantId/venues/:venueId")
export class StockOperationsController {
  constructor(
    @Inject(RecordOperationalWaste)
    private readonly waste: RecordOperationalWaste,
    @Inject(RecordStockCount)
    private readonly counts: RecordStockCount,
    @Inject(ApproveAdjustment)
    private readonly approvals: ApproveAdjustment,
    @Inject(SetIngredientCategory)
    private readonly categories: SetIngredientCategory,
    @Inject(CountSessionReader)
    private readonly countSessions: CountSessionReader,
    @Inject(EvaluatePermission)
    private readonly permissions: EvaluatePermission,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(OrganizationRepository)
    private readonly organizations: OrganizationRepository,
    @Inject(Clock)
    private readonly clock: Clock,
  ) {}

  @Post("operational-waste")
  @HttpCode(HttpStatus.OK)
  async recordWaste(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const parsed = wasteCommand.safeParse(body);

    if (!parsed.success || !noted(parsed.data.reason, parsed.data.note)) {
      throw new BadRequestException();
    }

    await this.venueOf(tenantId, venueId);

    try {
      const result = await this.waste.execute({
        tenantId,
        venueId,
        locationId: parsed.data.locationId,
        ingredientId: parsed.data.ingredientId,
        documentId: parsed.data.documentId,
        quantity: parsed.data.quantity,
        averageCost: parsed.data.averageCost,
        reason: parsed.data.reason,
        ...(parsed.data.note === undefined ? {} : { note: parsed.data.note }),
        occurredAt: new Date(this.clock.now()).toISOString(),
        actorId: actor.userId,
        sessionId: actor.sessionId,
        deviceId: actor.deviceId,
        authorizerId: parsed.data.authorizerId ?? null,
      });

      if (!result.posted && result.outcome === "denied") {
        throw new ForbiddenException({ error: "OperationalWasteDenied" });
      }

      return result;
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Get("stock-count-sheets")
  async openSheet(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Query() query: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const parsed = sheetQuery.safeParse(query);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    await this.venueOf(tenantId, venueId);

    try {
      const result = await this.counts.sheet({
        tenantId,
        venueId,
        locationId: parsed.data.locationId,
        cutOff: parsed.data.cutOff,
        scope: parsed.data.scope,
        ...(parsed.data.category === undefined
          ? {}
          : { category: parsed.data.category }),
        sessionId: actor.sessionId,
      });

      if (result.outcome === "denied") {
        throw new ForbiddenException({ error: "StockCountDenied" });
      }

      return { ingredientIds: result.ingredientIds };
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("stock-counts")
  @HttpCode(HttpStatus.OK)
  async recordCount(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const parsed = countCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    await this.venueOf(tenantId, venueId);

    try {
      const result = await this.counts.execute({
        tenantId,
        venueId,
        locationId: parsed.data.locationId,
        documentId: parsed.data.documentId,
        cutOff: parsed.data.cutOff,
        occurredAt: new Date(this.clock.now()).toISOString(),
        scope: parsed.data.scope,
        ...(parsed.data.category === undefined
          ? {}
          : { category: parsed.data.category }),
        lines: parsed.data.lines,
        actorId: actor.userId,
        sessionId: actor.sessionId,
        deviceId: actor.deviceId,
        ...(parsed.data.siteCap === undefined
          ? {}
          : { siteCap: parsed.data.siteCap }),
      });

      if (!result.posted && result.outcome === "denied") {
        throw new ForbiddenException({ error: "StockCountDenied" });
      }

      return result;
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("stock-counts/:documentId/approval")
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("documentId") documentId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const parsed = approvalCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    await this.venueOf(tenantId, venueId);

    try {
      const result = await this.approvals.execute({
        tenantId,
        venueId,
        documentId,
        countedBy: parsed.data.countedBy,
        actorId: actor.userId,
        sessionId: actor.sessionId,
        deviceId: actor.deviceId,
        occurredAt: new Date(this.clock.now()).toISOString(),
        decision: parsed.data.decision,
        ...(parsed.data.openRecount === undefined
          ? {}
          : { openRecount: parsed.data.openRecount }),
        ...(parsed.data.recountDocumentId === undefined
          ? {}
          : { recountDocumentId: parsed.data.recountDocumentId }),
      });

      if (!result.posted && result.outcome === "denied") {
        throw new ForbiddenException({ error: "CountApprovalDenied" });
      }

      if (!result.posted) {
        return result;
      }

      const session = await this.countSessions.sessionOf(tenantId, documentId);

      if (!session) {
        throw new ConflictException({ error: "UnknownCountSession" });
      }

      return {
        posted: true,
        locationId: session.locationId,
        valueCop: result.valueCop,
        lines: result.lines.map((line) => ({
          locationId: session.locationId,
          movementId: line.movementId,
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          valueCop: line.valueCop,
          averageCost: line.averageCost,
        })),
      };
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Put("ingredients/:ingredientId/category")
  @HttpCode(HttpStatus.OK)
  async classify(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("ingredientId") ingredientId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(tenantId, sessionHeader);
    const parsed = categoryCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const venue = await this.venueOf(tenantId, venueId);
    const decision = await this.permissions.execute({
      tenantId,
      sessionId: actor.sessionId,
      permission: PERMISSION.INVENTORY_COUNT,
      target: { kind: "site", id: venueId, brandId: venue.brandId },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "IngredientCategoryDenied" });
    }

    try {
      return await this.categories.execute({
        tenantId,
        ingredientId,
        category: parsed.data.category,
      });
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

    return {
      sessionId,
      userId: session.userId,
      deviceId: session.deviceId,
    };
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
    if (error instanceof BadRequestException) {
      return error;
    }

    if (error instanceof ForbiddenException) {
      return error;
    }

    if (error instanceof ConflictException) {
      return error;
    }

    if (
      error instanceof UnknownSession ||
      error instanceof UnknownAuthorization
    ) {
      return new ForbiddenException({ error: error.name });
    }

    if (
      error instanceof MissingWasteReason ||
      error instanceof WasteNoteRequired ||
      error instanceof InvalidWaste ||
      error instanceof InvalidCount
    ) {
      return new BadRequestException();
    }

    if (error instanceof MissingCountLine) {
      return new ConflictException({
        error: error.name,
        ingredientIds: [...error.ingredientIds],
      });
    }

    if (error instanceof UnknownCountSession) {
      return new ConflictException({ error: error.name });
    }

    if (error instanceof IngredientHidden) {
      return new NotFoundException({ error: error.name });
    }

    return error instanceof Error
      ? error
      : new Error("Stock operation failed.");
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}

function noted(
  reason: (typeof WASTE_REASON)[number],
  note: string | undefined,
) {
  if (reason !== "other") {
    return true;
  }

  return note !== undefined && note.trim().length > 0;
}
