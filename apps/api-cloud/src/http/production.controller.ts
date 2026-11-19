import {
  configureProductionCostCommand,
  correctProductionCommand,
  type ProductionCorrection,
  type ProductionCostPolicy,
  type ProductionRun as ProductionRunBody,
  productionCorrection,
  productionCostPolicy,
  productionRun,
  recordProductionCommand,
} from "@blackhole/contracts";
import {
  ConfigureProductionCost,
  CorrectProduction,
  InvalidProductionCost,
  MissingProductionCostPolicy,
  PreparationNotStocked,
  ProductionCorrectionDenied,
  ProductionCostDenied,
  RecordProduction,
  UnknownProductionLocation,
  UnknownProductionRun,
  UnknownVenue,
} from "@blackhole/inventory/application/entry-port";
import { ProductionRepository } from "@blackhole/inventory/application/ports/production-repository";
import { RecipeCatalogRepository } from "@blackhole/inventory/application/ports/recipe-catalog-repository";
import { VenueDirectory } from "@blackhole/inventory/application/ports/venue-directory";
import {
  InvalidProduction,
  MissingOutputQuantity,
  ProductionAlreadyCompensated,
  UnknownRecipe,
} from "@blackhole/inventory/domain";
import {
  ConsumeAuthorization,
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
  Put,
} from "@nestjs/common";

import { OrganizationInventoryLocationDirectory } from "#src/composition/inventory-location-directory.js";

const SESSION_HEADER = "x-session-id";
const RECORD_DENIED = "ProductionRecordDenied";
const VIEW_COST = "inventory.view-cost";

export const routePermissions = {
  "POST production-runs": "inventory.record-production",
  "POST production-corrections": "inventory.adjust",
  "PUT production-cost-policy": "recipe.edit",
} as const;

const FORBIDDEN = [ProductionCorrectionDenied, ProductionCostDenied] as const;

const DOMAIN_REJECTION = [
  PreparationNotStocked,
  MissingProductionCostPolicy,
  UnknownProductionLocation,
  UnknownProductionRun,
  UnknownVenue,
  UnknownRecipe,
  MissingOutputQuantity,
  InvalidProduction,
  ProductionAlreadyCompensated,
  InvalidProductionCost,
] as const;

type RoutePermission = (typeof routePermissions)[keyof typeof routePermissions];

interface EvaluationTarget {
  kind: "site" | "warehouse";
  id: string;
  brandId: string | null;
}

interface Actor {
  userId: string;
  deviceId: string;
}

interface StoredRun {
  runId: string;
  locationId: string;
  recipeId: string;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  outputUnitCost: number | null;
  venueId: string;
}

@Controller("tenants/:tenantId")
export class ProductionController {
  constructor(
    @Inject(ProductionRepository)
    private readonly production: ProductionRepository,
    @Inject(RecipeCatalogRepository)
    private readonly catalogs: RecipeCatalogRepository,
    @Inject(VenueDirectory)
    private readonly venues: VenueDirectory,
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
  ) {}

  @Post("production-runs")
  @HttpCode(HttpStatus.OK)
  async record(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ProductionRunBody> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const parsed = recordProductionCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const place = await this.placeOf(tenantId, parsed.data.locationId);
    const actor = await this.actor(
      tenantId,
      sessionId,
      routePermissions["POST production-runs"],
      place.target,
      RECORD_DENIED,
    );
    const seesCost = await this.allowed(
      tenantId,
      sessionId,
      VIEW_COST,
      place.target,
    );

    try {
      const run = await new RecordProduction(
        this.catalogs,
        this.venues,
        new OrganizationInventoryLocationDirectory(this.organizations),
        this.production,
        this.audit(),
      ).execute({
        tenantId,
        venueId: place.venueId,
        locationId: parsed.data.locationId,
        recipeId: parsed.data.recipeId,
        runId: parsed.data.runId,
        expectedQuantity: parsed.data.expectedQuantity,
        actualQuantity: parsed.data.actualQuantity,
        occurredAt: new Date(this.clock.now()).toISOString(),
        actorId: actor.userId,
        deviceId: actor.deviceId,
      });

      return this.present(run, seesCost);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("production-runs/:originalRunId/corrections")
  @HttpCode(HttpStatus.OK)
  async correct(
    @Param("tenantId") tenantId: string,
    @Param("originalRunId") originalRunId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ProductionCorrection> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const parsed = correctProductionCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.sessionActor(tenantId, sessionId);
    const original = await this.production.findRun(tenantId, originalRunId);

    if (!original) {
      throw new ConflictException({ error: "UnknownProductionRun" });
    }

    try {
      const correction = await new CorrectProduction(
        this.production,
        this.permissions(),
        new ConsumeAuthorization(this.authorizations, this.authorizationClock),
        this.audit(),
      ).execute({
        tenantId,
        venueId: original.venueId,
        originalRunId,
        correctionRunId: parsed.data.correctionRunId,
        occurredAt: new Date(this.clock.now()).toISOString(),
        actorId: actor.userId,
        authorizerId: null,
        sessionId,
        deviceId: actor.deviceId,
        authorizationId: parsed.data.authorizationId ?? null,
      });

      return productionCorrection.parse({
        originalRunId: correction.originalRunId,
        correctionRunId: correction.correctionRunId,
      });
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Put("venues/:venueId/production-cost-policy")
  @HttpCode(HttpStatus.OK)
  async configureCost(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ProductionCostPolicy> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const parsed = configureProductionCostCommand.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.sessionActor(tenantId, sessionId);
    const organization = await this.organizations.load(tenantId);
    const venue = organization?.venues.find((item) => item.id === venueId);

    if (!venue) {
      throw new ConflictException({ error: "UnknownVenue" });
    }

    try {
      await new ConfigureProductionCost(
        this.permissions(),
        this.production,
        this.audit(),
      ).execute({
        tenantId,
        venueId,
        actorId: actor.userId,
        authorizerId: null,
        sessionId,
        deviceId: actor.deviceId,
        costRule: parsed.data.costRule,
        preparations: parsed.data.preparations,
      });

      return productionCostPolicy.parse(parsed.data);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  private present(run: StoredRun, seesCost: boolean): ProductionRunBody {
    const shown = {
      runId: run.runId,
      locationId: run.locationId,
      recipeId: run.recipeId,
      expectedQuantity: run.expectedQuantity,
      actualQuantity: run.actualQuantity,
    };

    if (!seesCost) {
      return productionRun.parse(shown);
    }

    return productionRun.parse({
      ...shown,
      variance: run.variance,
      outputUnitCost: run.outputUnitCost,
    });
  }

  private async placeOf(
    tenantId: string,
    locationId: string,
  ): Promise<{ venueId: string; target: EvaluationTarget }> {
    const location = await new OrganizationInventoryLocationDirectory(
      this.organizations,
    ).find(tenantId, locationId);
    const organization = await this.organizations.load(tenantId);
    const stored = organization?.locations.find(
      (item) => item.id === location?.id,
    );

    if (!location || !stored || stored.venueId === null) {
      throw new ConflictException({ error: "UnknownProductionLocation" });
    }

    const venue = organization?.venues.find(
      (item) => item.id === stored.venueId,
    );

    return {
      venueId: stored.venueId,
      target: {
        kind: "site",
        id: stored.venueId,
        brandId: venue?.brandId ?? null,
      },
    };
  }

  private async actor(
    tenantId: string,
    sessionId: string,
    permission: RoutePermission,
    target: EvaluationTarget,
    denied: string,
  ): Promise<Actor> {
    const allowed = await this.allowed(tenantId, sessionId, permission, target);

    if (!allowed) {
      throw new ForbiddenException({ error: denied });
    }

    return this.sessionActor(tenantId, sessionId);
  }

  private async sessionActor(
    tenantId: string,
    sessionId: string,
  ): Promise<Actor> {
    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    return { userId: session.userId, deviceId: session.deviceId };
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
    const evaluate = this.permissions();

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

  private permissions(): EvaluatePermission {
    return new EvaluatePermission(
      this.authorizations,
      this.sessions,
      this.identities,
      this.authorizationClock,
    );
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

    return error instanceof Error ? error : new Error("Production failed.");
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
