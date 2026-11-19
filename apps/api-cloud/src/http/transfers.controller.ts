import {
  dispatchTransferCommand,
  type RecordedTransfer,
  receiveTransferCommand,
  recordedTransfer,
  requestTransferCommand,
} from "@blackhole/contracts";
import type { DrizzleTransferRepository } from "@blackhole/inventory/adapters/postgres/drizzle-transfer-repository";
import {
  DestinationStock,
  DispatchTransfer,
  ReceiveTransfer,
  RequestTransfer,
  type TransferOutRecord,
  TransferStock,
  UnauthorizedTransferDifference,
  UnknownTransferDispatch,
  UnknownTransferReceipt,
  UnlinkedWarehouse,
} from "@blackhole/inventory/application/entry-port";
import { TransferRepository } from "@blackhole/inventory/application/ports/transfer-repository";
import {
  TransferVoucher,
  type TransferVoucherDraft,
} from "@blackhole/inventory/application/ports/transfer-voucher";
import { WarehouseSupply } from "@blackhole/inventory/application/ports/warehouse-supply";
import {
  InsufficientOnHand,
  InvalidTransfer,
  type Transfer,
  TransferNotInTransit,
} from "@blackhole/inventory/domain";
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
import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import type { EnqueuePrintJob } from "@blackhole/printing/application/entry-port";
import type { PGlite } from "@electric-sql/pglite";
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
  Optional,
  Param,
  Post,
} from "@nestjs/common";
import { ProjectAffectedProducts } from "#src/composition/project-affected-products.js";

const SESSION_HEADER = "x-session-id";
const REQUEST_DENIED = "TransferRequestDenied";
const DISPATCH_DENIED = "TransferDispatchDenied";
const RECEIPT_DENIED = "TransferReceiptDenied";
const VIEW_COST = "inventory.view-cost";

export const routePermissions = {
  "POST transfers": "inventory.request-replenishment",
  "POST transfers/:transferId/dispatch": "inventory.receive-transfer",
  "POST transfers/:transferId/receipt": "inventory.receive-transfer",
} as const;

const FORBIDDEN = [UnauthorizedTransferDifference] as const;

const DOMAIN_REJECTION = [
  UnlinkedWarehouse,
  UnknownTransferDispatch,
  UnknownTransferReceipt,
  InsufficientOnHand,
  InvalidTransfer,
  TransferNotInTransit,
] as const;

type RoutePermission = (typeof routePermissions)[keyof typeof routePermissions];

interface EvaluationTarget {
  kind: "site";
  id: string;
  brandId: string | null;
}

interface Actor {
  userId: string;
  deviceId: string;
}

interface Place {
  venueId: string;
  originVenueId: string | null;
  target: EvaluationTarget;
}

interface SqlRunner {
  exec(statement: string): Promise<unknown>;
  query<Row extends Record<string, unknown>>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
}

interface PermissionDecision {
  outcome: "allowed" | "requires_authorization" | "denied";
}

export class OrganizationWarehouseSupply extends WarehouseSupply {
  constructor(private readonly organizations: OrganizationRepository) {
    super();
  }

  override async linked(
    tenantId: string,
    venueId: string,
    warehouseLocationId: string,
  ): Promise<boolean> {
    const organization = await this.organizations.load(tenantId);
    const warehouse = organization?.locations.find(
      (location) => location.id === warehouseLocationId,
    );

    if (!warehouse || warehouse.kind !== "warehouse") {
      return false;
    }

    return warehouse.venueId === null || warehouse.venueId === venueId;
  }
}

export class PostgresTransferStock extends TransferStock {
  constructor(
    private readonly client: PGlite,
    private readonly transfers: DrizzleTransferRepository,
  ) {
    super();
  }

  override async read(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<{ onHand: number; averageCost: number } | null> {
    const [onHand, averageCost] = await Promise.all([
      this.transfers.balance(tenantId, locationId, ingredientId),
      this.transfers.averageCost(tenantId, locationId, ingredientId),
    ]);

    return { onHand, averageCost };
  }

  override async append(
    movements: readonly TransferOutRecord[],
  ): Promise<void> {
    const [first] = movements;

    if (!first) {
      return;
    }

    const database = this.client as PGlite & {
      transaction<T>(work: (tx: SqlRunner) => Promise<T>): Promise<T>;
    };

    await database.transaction(async (tx) => {
      await tx.exec("SET LOCAL ROLE inventory_app");
      await tx.query("SELECT set_config('app.tenant_id', $1, true)", [
        first.tenantId,
      ]);
      const selected = await tx.query<{ position: number | string }>(
        "SELECT coalesce(max(position), 0) AS position FROM stock_movements",
      );
      let position = Number(selected.rows[0]?.position ?? 0) + 1;

      for (const movement of movements) {
        await tx.query(
          `INSERT INTO stock_movements (
            tenant_id,
            id,
            position,
            venue_id,
            location_id,
            ingredient_id,
            quantity,
            unit_cost,
            movement_type,
            reference,
            occurred_at,
            order_line_id,
            role,
            recipe_version,
            reason,
            actor_id,
            reverses_movement_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            NULL, NULL, NULL, NULL, $12, NULL
          )`,
          [
            movement.tenantId,
            movement.id,
            position,
            movement.venueId,
            movement.locationId,
            movement.ingredientId,
            movement.quantity,
            movement.unitCost,
            movement.type,
            movement.reference,
            movement.occurredAt,
            movement.actorId,
          ],
        );
        await tx.query(
          `INSERT INTO stock_balances (
            tenant_id,
            location_id,
            ingredient_id,
            quantity,
            average_cost
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (tenant_id, location_id, ingredient_id) DO UPDATE SET
            quantity = stock_balances.quantity + excluded.quantity`,
          [
            movement.tenantId,
            movement.locationId,
            movement.ingredientId,
            movement.quantity,
            movement.unitCost,
          ],
        );
        position += 1;
      }
    });
  }
}

export class PostgresDestinationStock extends DestinationStock {
  constructor(private readonly transfers: DrizzleTransferRepository) {
    super();
  }

  override async read(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<{ onHand: number; averageCost: number } | null> {
    const [onHand, averageCost] = await Promise.all([
      this.transfers.balance(tenantId, locationId, ingredientId),
      this.transfers.averageCost(tenantId, locationId, ingredientId),
    ]);

    return { onHand, averageCost };
  }
}

interface BoundTransferPrinter {
  printJobs: EnqueuePrintJob;
  printerId: string;
}

let boundTransferPrinter: BoundTransferPrinter | undefined;

export function bindPendingTransferVoucher(
  printJobs: EnqueuePrintJob,
  printerId: string,
): void {
  boundTransferPrinter = { printJobs, printerId };
}

export class PendingTransferVoucher extends TransferVoucher {
  constructor(private readonly printer?: BoundTransferPrinter) {
    super();
  }

  override async print(voucher: TransferVoucherDraft): Promise<void> {
    const printer = this.printer ?? boundTransferPrinter;

    if (printer === undefined) {
      return;
    }

    await printer.printJobs.execute({
      commandId: voucher.transferId,
      printerId: printer.printerId,
      kickDrawer: false,
      document: voucher.document,
      reference: voucher.transferId,
      origin: voucher.originLocationId,
      destination: voucher.destinationLocationId,
      lines: voucher.lines.map(
        (line) => `${line.ingredientId} ${line.quantity}`,
      ),
      qr: transferVoucherQr(voucher),
    });
  }
}

function transferVoucherQr(voucher: TransferVoucherDraft): string {
  return JSON.stringify({
    transferId: voucher.transferId,
    lines: voucher.lines.map((line) => ({
      ingredientId: line.ingredientId,
      quantity: line.quantity,
    })),
  });
}

@Controller("tenants/:tenantId")
export class TransfersController {
  constructor(
    @Inject(TransferRepository)
    private readonly transfers: TransferRepository,
    @Inject(WarehouseSupply)
    private readonly supplies: WarehouseSupply,
    @Inject(TransferStock)
    private readonly originStock: TransferStock,
    @Inject(DestinationStock)
    private readonly destinationStock: DestinationStock,
    @Inject(TransferVoucher)
    private readonly vouchers: TransferVoucher,
    @Inject(OrganizationRepository)
    private readonly organizations: OrganizationRepository,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
    @Inject(Clock)
    private readonly clock: Clock,
    @Inject(AuditRepository)
    private readonly audits: AuditRepository,
    @Inject(AuditDigest)
    private readonly digests: AuditDigest,
    @Optional()
    @Inject(ProjectAffectedProducts)
    private readonly affected?: ProjectAffectedProducts,
  ) {}

  @Post("transfers")
  @HttpCode(HttpStatus.OK)
  async request(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<RecordedTransfer> {
    const sessionId = readText(sessionHeader);
    const parsed = requestTransferCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.actor(tenantId, sessionId);
    const place = await this.place(
      tenantId,
      parsed.data.originLocationId,
      parsed.data.destinationLocationId,
    );
    await this.permitRequest(tenantId, sessionId, place.target);

    try {
      const transfer = await new RequestTransfer(
        this.supplies,
        this.transfers,
      ).execute({
        tenantId,
        venueId: place.venueId,
        transferId: parsed.data.transferId,
        originLocationId: parsed.data.originLocationId,
        destinationLocationId: parsed.data.destinationLocationId,
        lines: parsed.data.lines,
      });

      return this.present(transfer, false);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("transfers/:transferId/dispatch")
  @HttpCode(HttpStatus.OK)
  async dispatch(
    @Param("tenantId") tenantId: string,
    @Param("transferId") transferId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<RecordedTransfer> {
    const sessionId = readText(sessionHeader);
    const parsed = dispatchTransferCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.actor(tenantId, sessionId);
    const transfer = await this.transfers.find(tenantId, transferId);

    if (!transfer) {
      throw new ConflictException({ error: "UnknownTransfer" });
    }

    const place = await this.place(
      tenantId,
      transfer.originLocationId,
      transfer.destinationLocationId,
    );
    await this.permitMovement(
      tenantId,
      sessionId,
      routePermissions["POST transfers/:transferId/dispatch"],
      place.target,
      DISPATCH_DENIED,
    );
    const seesCost = await this.allowed(
      tenantId,
      sessionId,
      VIEW_COST,
      place.target,
    );

    try {
      const dispatched = await new DispatchTransfer(
        this.transfers,
        this.originStock,
        this.vouchers,
        this.audit(),
      ).execute({
        tenantId,
        transferId,
        actorId: actor.userId,
        deviceId: actor.deviceId,
        occurredAt: new Date(this.clock.now()).toISOString(),
        originVenueId: place.originVenueId,
        destinationVenueId: place.venueId,
      });

      return this.present(dispatched, seesCost);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("transfers/:transferId/receipt")
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param("tenantId") tenantId: string,
    @Param("transferId") transferId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<RecordedTransfer> {
    const sessionId = readText(sessionHeader);
    const parsed = receiveTransferCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.actor(tenantId, sessionId);
    const transfer = await this.transfers.find(tenantId, transferId);

    if (!transfer) {
      throw new ConflictException({ error: "UnknownTransfer" });
    }

    const place = await this.place(
      tenantId,
      transfer.originLocationId,
      transfer.destinationLocationId,
    );
    const decision = await this.permitMovement(
      tenantId,
      sessionId,
      routePermissions["POST transfers/:transferId/receipt"],
      place.target,
      RECEIPT_DENIED,
    );
    const seesCost = await this.allowed(
      tenantId,
      sessionId,
      VIEW_COST,
      place.target,
    );
    const authorizerId =
      parsed.data.authorizerId ??
      (decision.outcome === "allowed" ? actor.userId : null);

    try {
      const received = await new ReceiveTransfer(
        this.transfers,
        this.destinationStock,
        this.audit(),
      ).execute({
        tenantId,
        transferId,
        actorId: actor.userId,
        deviceId: actor.deviceId,
        occurredAt: new Date(this.clock.now()).toISOString(),
        destinationVenueId: place.venueId,
        authorizerId,
        lines: parsed.data.lines,
      });
      await this.affected?.afterReceipt({
        tenantId,
        venueId: place.venueId,
        locationId: received.destinationLocationId,
        ingredientIds: received.lines.map(
          (line: { ingredientId: string }) => line.ingredientId,
        ),
      });

      return this.present(received, seesCost);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  private present(transfer: Transfer, seesCost: boolean): RecordedTransfer {
    return recordedTransfer.parse({
      transferId: transfer.id,
      originLocationId: transfer.originLocationId,
      destinationLocationId: transfer.destinationLocationId,
      status: transfer.status,
      lines: transfer.lines.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        ...(seesCost && line.unitCost !== undefined
          ? { unitCost: line.unitCost }
          : {}),
        ...(line.receivedQuantity === undefined
          ? {}
          : { receivedQuantity: line.receivedQuantity }),
        ...(line.shortfall === undefined ? {} : { shortfall: line.shortfall }),
      })),
    });
  }

  private async place(
    tenantId: string,
    originLocationId: string,
    destinationLocationId: string,
  ): Promise<Place> {
    const organization = await this.organizations.load(tenantId);
    const origin = organization?.locations.find(
      (location) => location.id === originLocationId,
    );
    const destination = organization?.locations.find(
      (location) => location.id === destinationLocationId,
    );

    if (!origin || !destination || destination.venueId === null) {
      throw new ConflictException({ error: "UnlinkedWarehouse" });
    }

    const venue = organization?.venues.find(
      (item) => item.id === destination.venueId,
    );

    return {
      venueId: destination.venueId,
      originVenueId: origin.venueId,
      target: {
        kind: "site",
        id: destination.venueId,
        brandId: venue?.brandId ?? null,
      },
    };
  }

  private async actor(tenantId: string, sessionId: string): Promise<Actor> {
    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    if (session.deviceId.length === 0) {
      throw new ForbiddenException({ error: "UnregisteredDevice" });
    }

    return { userId: session.userId, deviceId: session.deviceId };
  }

  private async permitRequest(
    tenantId: string,
    sessionId: string,
    target: EvaluationTarget,
  ): Promise<void> {
    const decision = await this.permit(
      tenantId,
      sessionId,
      routePermissions["POST transfers"],
      target,
    );

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: REQUEST_DENIED });
    }
  }

  private async permitMovement(
    tenantId: string,
    sessionId: string,
    permission: RoutePermission,
    target: EvaluationTarget,
    denied: string,
  ): Promise<PermissionDecision> {
    const decision = await this.permit(tenantId, sessionId, permission, target);

    if (decision.outcome === "denied") {
      throw new ForbiddenException({ error: denied });
    }

    return decision;
  }

  private async allowed(
    tenantId: string,
    sessionId: string,
    permission: typeof VIEW_COST,
    target: EvaluationTarget,
  ): Promise<boolean> {
    const decision = await this.permit(tenantId, sessionId, permission, target);

    return decision.outcome === "allowed";
  }

  private async permit(
    tenantId: string,
    sessionId: string,
    permission: RoutePermission | typeof VIEW_COST,
    target: EvaluationTarget,
  ): Promise<PermissionDecision> {
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
        permission,
        target,
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

  private audit(): RecordAuditEvent {
    return new RecordAuditEvent(this.audits, this.digests, this.clock);
  }

  private failure(error: unknown): Error {
    if (
      FORBIDDEN.some((rejection) => error instanceof rejection) &&
      error instanceof Error
    ) {
      return new ForbiddenException({ error: error.name });
    }

    if (
      DOMAIN_REJECTION.some((rejection) => error instanceof rejection) &&
      error instanceof Error
    ) {
      return new ConflictException({ error: error.name });
    }

    return error instanceof Error ? error : new Error("Transfer failed.");
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
