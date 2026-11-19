import {
  type PurchaseReceipt as PurchaseReceiptBody,
  purchaseReceipt,
  receivePurchaseCommand,
} from "@blackhole/contracts";
import {
  type PurchaseReceipt,
  ReceivePurchase,
  UnknownInventoryLocation,
} from "@blackhole/inventory/application/entry-port";
import { InventoryLocationDirectory } from "@blackhole/inventory/application/ports/inventory-location-directory";
import { PublishedPurchaseFactor } from "@blackhole/inventory/application/ports/published-purchase-factor";
import { PurchasingRepository } from "@blackhole/inventory/application/ports/purchasing-repository";
import {
  DuplicateId,
  InvalidPurchase,
  OverReceipt,
  PurchaseOrderClosed,
} from "@blackhole/inventory/domain";
import {
  EvaluatePermission,
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
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
  Optional,
  Param,
  Post,
} from "@nestjs/common";
import {
  PurchaseAverageCost,
  UnpublishedPurchaseFactor,
} from "#src/composition/inventory-location-directory.js";
import { ProjectAffectedProducts } from "#src/composition/project-affected-products.js";

const SESSION_HEADER = "x-session-id";
const RECEIVE_DENIED = "PurchaseReceiveDenied";
const VIEW_COST = "inventory.view-cost";

export const routePermissions = {
  "POST purchase-receipts": "inventory.receive-purchase",
} as const;

const DOMAIN_REJECTION = [
  DuplicateId,
  InvalidPurchase,
  OverReceipt,
  PurchaseOrderClosed,
  UnknownInventoryLocation,
  UnpublishedPurchaseFactor,
] as const;

type RoutePermission = (typeof routePermissions)[keyof typeof routePermissions];

interface EvaluationTarget {
  kind: "site" | "warehouse";
  id: string;
  brandId: string | null;
}

interface Actor {
  userId: string;
}

@Controller("tenants/:tenantId")
export class PurchasingController {
  constructor(
    @Inject(PurchasingRepository)
    private readonly purchasing: PurchasingRepository,
    @Inject(InventoryLocationDirectory)
    private readonly locations: InventoryLocationDirectory,
    @Inject(PublishedPurchaseFactor)
    private readonly factors: PublishedPurchaseFactor,
    @Inject(PurchaseAverageCost)
    private readonly averages: PurchaseAverageCost,
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
    @Optional()
    @Inject(ProjectAffectedProducts)
    private readonly affected?: ProjectAffectedProducts,
  ) {}

  @Post("purchase-receipts")
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<PurchaseReceiptBody> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const parsed = receivePurchaseCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const target = await this.targetOf(tenantId, parsed.data.locationId);
    const actor = await this.actor(tenantId, sessionId, target);
    const seesAverage = await this.allowed(
      tenantId,
      sessionId,
      VIEW_COST,
      target,
    );

    try {
      const receipt = await new ReceivePurchase(
        this.purchasing,
        this.locations,
        this.factors,
      ).execute({
        tenantId,
        receiptId: parsed.data.receiptId,
        locationId: parsed.data.locationId,
        actorId: actor.userId,
        occurredAt: new Date(this.clock.now()).toISOString(),
        ...(parsed.data.purchaseOrderId === undefined
          ? {}
          : { purchaseOrderId: parsed.data.purchaseOrderId }),
        lines: parsed.data.lines,
      });
      await this.affected?.afterReceipt({
        tenantId,
        venueId: target.kind === "site" ? target.id : null,
        locationId: parsed.data.locationId,
        ingredientIds: receipt.lines.map((line) => line.ingredientId),
      });

      return await this.present(receipt, seesAverage);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  private async present(
    receipt: PurchaseReceipt,
    seesAverage: boolean,
  ): Promise<PurchaseReceiptBody> {
    const lines = [];

    for (const line of receipt.lines) {
      const shown = {
        ingredientId: line.ingredientId,
        purchaseQuantity: line.purchaseQuantity,
        purchaseUnitCost: line.purchaseUnitCost,
        factor: line.factor,
        quantity: line.quantity,
        unitCost: line.unitCost,
      };

      if (!seesAverage) {
        lines.push(shown);
        continue;
      }

      lines.push({
        ...shown,
        averageCost: await this.averages.costOf(
          receipt.tenantId,
          receipt.locationId,
          line.ingredientId,
        ),
      });
    }

    return purchaseReceipt.parse({
      receiptId: receipt.receiptId,
      locationId: receipt.locationId,
      purchaseOrderId: receipt.purchaseOrderId,
      lines,
    });
  }

  private async targetOf(
    tenantId: string,
    locationId: string,
  ): Promise<EvaluationTarget> {
    const location = await this.locations.find(tenantId, locationId);
    const organization = await this.organizations.load(tenantId);
    const stored = organization?.locations.find(
      (item) => item.id === location?.id,
    );

    if (!location || !stored) {
      throw new ConflictException({ error: "UnknownInventoryLocation" });
    }

    if (stored.venueId === null) {
      return { kind: "warehouse", id: stored.id, brandId: null };
    }

    const venue = organization?.venues.find(
      (item) => item.id === stored.venueId,
    );

    return {
      kind: "site",
      id: stored.venueId,
      brandId: venue?.brandId ?? null,
    };
  }

  private async actor(
    tenantId: string,
    sessionId: string,
    target: EvaluationTarget,
  ): Promise<Actor> {
    const allowed = await this.allowed(
      tenantId,
      sessionId,
      routePermissions["POST purchase-receipts"],
      target,
    );

    if (!allowed) {
      throw new ForbiddenException({ error: RECEIVE_DENIED });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    return { userId: session.userId };
  }

  private async allowed(
    tenantId: string,
    sessionId: string,
    permission: RoutePermission | typeof VIEW_COST,
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
  ) {
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

  private failure(error: unknown): Error {
    if (
      DOMAIN_REJECTION.some((rejection) => error instanceof rejection) &&
      error instanceof Error
    ) {
      return new ConflictException({ error: error.name });
    }

    return error instanceof Error
      ? error
      : new Error("Purchase receipt failed.");
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
