import { type QrOrderStatus, qrOrderStatus } from "@blackhole/contracts";
import {
  ApplyQrOrder,
  IssueTableQr,
  ListStaleQrIntents,
  QrIntentMissing,
  QrReviewRefused,
  ReviewQrOrderIntent,
  TableQrReprintRefused,
  TakeOrder,
} from "@blackhole/orders/application/entry-port";
import { Clock } from "@blackhole/orders/application/ports/clock";
import { DiningRoomRepository } from "@blackhole/orders/application/ports/dining-room-repository";
import { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
import { Printer } from "@blackhole/orders/application/ports/printer";
import { QrOrderIntentRepository } from "@blackhole/orders/application/ports/qr-order-intent-repository";
import { RealtimeHub } from "@blackhole/orders/application/ports/realtime-hub";
import { StationDirectory } from "@blackhole/orders/application/ports/station-directory";
import { TableQrRepository } from "@blackhole/orders/application/ports/table-qr-repository";
import { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";
import {
  EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
import {
  BadRequestException,
  Body,
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

export const reprintTableQrPath = "venues/:venueId/tables/:tableId/qr";
export const reviewQrOrderPath = "venues/:venueId/qr-orders/:intentId";
export const staleQrOrdersPath = "venues/:venueId/qr-orders";

export const routePermissions = {
  [reprintTableQrPath]: PERMISSION.SALE_REPRINT,
  [reviewQrOrderPath]: PERMISSION.SALE_CHARGE,
  [staleQrOrdersPath]: PERMISSION.SALE_CHARGE,
} as const;

const reprintTableQrCommand = z
  .object({
    nonce: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
  })
  .strict();

const reviewQrOrderCommand = z
  .object({
    decision: z.enum(["accept", "reject"]),
  })
  .strict();

const issuedTableQr = z
  .object({
    plaintext: z.string().min(1),
    path: z.string().startsWith("/m/"),
    digest: z.string().min(1),
  })
  .strict();

const staleQrIntent = z
  .object({
    intentId: z.string().min(1),
    ageSeconds: z.number().int().nonnegative(),
  })
  .strict();

const SESSION_HEADER = "x-session-id";

const requireSession = (sessionId: unknown): string => {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new BadRequestException({ error: "SessionRequired" });
  }

  return sessionId;
};

@Controller("tenants/:tenantId")
export class TableQrAdminController {
  constructor(
    @Inject(TableQrRepository)
    private readonly tokens: TableQrRepository,
    @Inject(QrOrderIntentRepository)
    private readonly intents: QrOrderIntentRepository,
    @Inject(EvaluatePermission)
    private readonly permissions: EvaluatePermission,
    @Inject(DiningRoomRepository)
    private readonly dining: DiningRoomRepository,
    @Inject(MenuRepository)
    private readonly menus: MenuRepository,
    @Inject(VenueDirectory)
    private readonly venues: VenueDirectory,
    @Inject(StationDirectory)
    private readonly stations: StationDirectory,
    @Inject(Printer)
    private readonly printer: Printer,
    @Inject(RealtimeHub)
    private readonly realtime: RealtimeHub,
    @Inject(Clock)
    private readonly clock: Clock,
  ) {}

  @Post(reprintTableQrPath)
  @HttpCode(HttpStatus.OK)
  async reprint(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("tableId") tableId: string,
    @Headers(SESSION_HEADER) sessionId: unknown,
    @Body() body: unknown,
  ): Promise<z.infer<typeof issuedTableQr>> {
    const actor = requireSession(sessionId);
    const parsed = reprintTableQrCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({ error: "QrOrderRejected" });
    }

    try {
      return issuedTableQr.parse(
        await new IssueTableQr(this.tokens, this.permissions).execute({
          tenantId,
          venueId,
          tableId,
          nonce: parsed.data.nonce,
          sessionId: actor,
        }),
      );
    } catch (error) {
      if (error instanceof TableQrReprintRefused) {
        throw new ForbiddenException({ error: error.name });
      }

      throw error;
    }
  }

  @Post(reviewQrOrderPath)
  @HttpCode(HttpStatus.OK)
  async review(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("intentId") intentId: string,
    @Headers(SESSION_HEADER) sessionId: unknown,
    @Body() body: unknown,
  ): Promise<QrOrderStatus> {
    const actor = requireSession(sessionId);
    const parsed = reviewQrOrderCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({ error: "QrOrderRejected" });
    }

    try {
      return qrOrderStatus.parse(
        await this.reviewing().execute({
          tenantId,
          venueId,
          intentId,
          sessionId: actor,
          decision: parsed.data.decision,
        }),
      );
    } catch (error) {
      if (error instanceof QrReviewRefused) {
        throw new ForbiddenException({ error: error.name });
      }

      if (error instanceof QrIntentMissing) {
        throw new NotFoundException({ error: error.name });
      }

      throw error;
    }
  }

  @Get(staleQrOrdersPath)
  async stale(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionId: unknown,
  ): Promise<z.infer<typeof staleQrIntent>[]> {
    const actor = requireSession(sessionId);
    const decision = await this.permissions.execute({
      tenantId,
      sessionId: actor,
      permission: PERMISSION.SALE_CHARGE,
      target: { kind: "site", id: venueId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "QrReviewRefused" });
    }

    const rows = await new ListStaleQrIntents(
      this.intents,
      this.tokens,
      this.clock,
    ).execute({ tenantId, venueId });

    return z.array(staleQrIntent).parse(rows);
  }

  private reviewing(): ReviewQrOrderIntent {
    return new ReviewQrOrderIntent(
      this.intents,
      this.permissions,
      new ApplyQrOrder(
        this.intents,
        this.dining,
        this.tokens,
        this.menus,
        this.venues,
        new TakeOrder(
          this.dining,
          this.menus,
          this.stations,
          this.printer,
          this.clock,
          this.realtime,
        ),
        this.clock,
      ),
    );
  }
}
