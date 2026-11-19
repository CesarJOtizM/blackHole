import {
  type QrOrderStatus,
  qrOrderStatus,
  submitQrOrderCommand,
  type TableQrMenu,
  tableQrMenu,
} from "@blackhole/contracts";
import {
  ApplyQrOrder,
  RecordQrOrderIntent,
  ResolveTableQr,
  TableQrDisabled,
  TableQrRetired,
  TableQrUnknown,
  TakeOrder,
  ViewVenueMenu,
} from "@blackhole/orders/application/entry-port";
import { Clock } from "@blackhole/orders/application/ports/clock";
import { DiningRoomRepository } from "@blackhole/orders/application/ports/dining-room-repository";
import { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
import { Printer } from "@blackhole/orders/application/ports/printer";
import {
  QrOrderIntentRepository,
  type StoredQrOrderIntent,
} from "@blackhole/orders/application/ports/qr-order-intent-repository";
import { RealtimeHub } from "@blackhole/orders/application/ports/realtime-hub";
import { StationDirectory } from "@blackhole/orders/application/ports/station-directory";
import { TableQrRepository } from "@blackhole/orders/application/ports/table-qr-repository";
import { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";
import { QR_INTENT_NONE } from "@blackhole/orders/domain";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
} from "@nestjs/common";
import { QrNotRestockedProducts } from "#src/composition/qr-not-restocked.js";

export const tableQrMenuPath = "m/:token";
export const tableQrOrderPath = "m/:token/orders";
export const tableQrStatusPath = "m/:token/orders/:intentId";

const noneStatus = (intentId: string): QrOrderStatus =>
  qrOrderStatus.parse({
    intentId,
    status: "none",
    checkId: null,
    lineIds: [],
    unavailableProductIds: [],
  });

const storedStatus = (intent: StoredQrOrderIntent): QrOrderStatus =>
  qrOrderStatus.parse({
    intentId: intent.id,
    status: intent.status,
    checkId: intent.checkId,
    lineIds: [...intent.sentLineIds],
    unavailableProductIds: [...intent.unavailableProductIds],
  });

@Controller()
export class TableQrController {
  constructor(
    @Inject(TableQrRepository)
    private readonly tokens: TableQrRepository,
    @Inject(MenuRepository)
    private readonly menus: MenuRepository,
    @Inject(VenueDirectory)
    private readonly venues: VenueDirectory,
    @Inject(Clock)
    private readonly clock: Clock,
    @Inject(QrOrderIntentRepository)
    private readonly intents?: QrOrderIntentRepository,
    @Inject(DiningRoomRepository)
    private readonly dining?: DiningRoomRepository,
    @Inject(StationDirectory)
    private readonly stations?: StationDirectory,
    @Inject(Printer)
    private readonly printer?: Printer,
    @Inject(RealtimeHub)
    private readonly realtime?: RealtimeHub,
    @Optional()
    @Inject(QrNotRestockedProducts)
    private readonly notRestocked?: QrNotRestockedProducts,
  ) {}

  @Get(tableQrMenuPath)
  async readMenu(@Param("token") token: string): Promise<TableQrMenu> {
    const resolved = await this.resolve(token);
    const menu = await new ViewVenueMenu(
      this.menus,
      this.venues,
      this.clock,
    ).execute(resolved);

    if (menu === null) {
      throw new NotFoundException({ error: "TableQrUnknown" });
    }

    return tableQrMenu.parse({ ...resolved, ...menu });
  }

  @Post(tableQrOrderPath)
  async submit(
    @Param("token") token: string,
    @Body() body: unknown,
  ): Promise<QrOrderStatus> {
    const parsed = submitQrOrderCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({ error: "QrOrderRejected" });
    }

    const resolved = await this.resolve(token);
    const recorded = await new RecordQrOrderIntent(
      this.intentRepository(),
      this.menus,
      this.venues,
      this.clock,
    ).execute({
      id: parsed.data.intentId,
      lines: parsed.data.lines,
      tenantId: resolved.tenantId,
      venueId: resolved.venueId,
      tableId: resolved.tableId,
    });

    if (recorded === QR_INTENT_NONE) {
      return noneStatus(parsed.data.intentId);
    }

    if (recorded.status !== "pending_acceptance") {
      return storedStatus(recorded);
    }

    const settings = await this.tokens.loadSettings(
      resolved.tenantId,
      resolved.venueId,
    );

    if (settings.acceptance !== "direct") {
      return storedStatus(recorded);
    }

    const applied = await new ApplyQrOrder(
      this.intentRepository(),
      this.diningRoom(),
      this.tokens,
      this.menus,
      this.venues,
      new TakeOrder(
        this.diningRoom(),
        this.menus,
        this.stationDirectory(),
        this.kitchenPrinter(),
        this.clock,
        this.realtimeHub(),
        undefined,
        undefined,
        this.notRestocked,
      ),
      this.clock,
      this.notRestocked,
    ).execute({
      tenantId: resolved.tenantId,
      intentId: recorded.id,
    });

    return qrOrderStatus.parse(applied);
  }

  @Get(tableQrStatusPath)
  async readStatus(
    @Param("token") token: string,
    @Param("intentId") intentId: string,
  ): Promise<QrOrderStatus> {
    const resolved = await this.resolve(token);
    const stored = await this.intentRepository().find(
      resolved.tenantId,
      intentId,
    );

    if (stored === null || stored.tableId !== resolved.tableId) {
      throw new NotFoundException({ error: "QrIntentMissing" });
    }

    return storedStatus(stored);
  }

  private async resolve(token: string) {
    try {
      return await new ResolveTableQr(this.tokens).execute({ token });
    } catch (error) {
      if (error instanceof TableQrDisabled) {
        throw new ForbiddenException({ error: "TableQrDisabled" });
      }

      if (error instanceof TableQrUnknown || error instanceof TableQrRetired) {
        throw new NotFoundException({ error: error.name });
      }

      throw error;
    }
  }

  private intentRepository(): QrOrderIntentRepository {
    if (this.intents === undefined) {
      throw new NotFoundException({ error: "QrIntentMissing" });
    }

    return this.intents;
  }

  private diningRoom(): DiningRoomRepository {
    if (this.dining === undefined) {
      throw new NotFoundException({ error: "TableQrUnknown" });
    }

    return this.dining;
  }

  private stationDirectory(): StationDirectory {
    if (this.stations === undefined) {
      throw new NotFoundException({ error: "TableQrUnknown" });
    }

    return this.stations;
  }

  private kitchenPrinter(): Printer {
    if (this.printer === undefined) {
      throw new NotFoundException({ error: "TableQrUnknown" });
    }

    return this.printer;
  }

  private realtimeHub(): RealtimeHub {
    if (this.realtime === undefined) {
      throw new NotFoundException({ error: "TableQrUnknown" });
    }

    return this.realtime;
  }
}
