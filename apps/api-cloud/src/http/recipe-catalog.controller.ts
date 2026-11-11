import {
  type RecipeCatalog as RecipeCatalogBody,
  type RecipeCost,
  type RecipePublication as RecipePublicationBody,
  recipeCatalog,
  recipeCatalogCommand,
  recipeCost,
  recipeImportCommand,
  recipeImportReport,
  recipePublication,
} from "@blackhole/contracts";
import {
  ImportRecipes,
  InvalidQuantity,
  InvalidRecipeCatalogId,
  InvalidReferenceCost,
  InvalidYield,
  MissingSitePrice,
  RecipeCycle,
  RecipeImportRejected,
  UnknownIngredient,
  UnknownModifier,
  UnknownRecipe,
  UnknownRecipeVersion,
  UnknownVenue,
  UpdateRecipeCatalog,
  ViewTheoreticalCost,
  ZeroUnitFactor,
} from "@blackhole/inventory/application/entry-port";
import { RecipeCatalogRepository } from "@blackhole/inventory/application/ports/recipe-catalog-repository";
import { RecipeWorkbook } from "@blackhole/inventory/application/ports/recipe-workbook";
import { SitePrice } from "@blackhole/inventory/application/ports/site-price";
import { VenueDirectory as RecipeVenueDirectory } from "@blackhole/inventory/application/ports/venue-directory";
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
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";

import { ExcelRecipeWorkbookError } from "#src/composition/excel-recipe-workbook.js";

const SESSION_HEADER = "x-session-id";
const EDIT_DENIED = "RecipeEditDenied";
const COST_DENIED = "CostViewDenied";

export const routePermissions = {
  "POST recipe-catalog": "recipe.edit",
  "POST brands/:brandId/recipe-catalog": "recipe.edit",
  "POST recipe-catalog/import": "recipe.edit",
  "POST brands/:brandId/recipe-catalog/import": "recipe.edit",
  "GET recipe-catalog": "recipe.edit",
  "GET recipe-cost": "inventory.view-cost",
} as const;

const EDIT_ACTION = routePermissions["POST recipe-catalog"];

const DOMAIN_REJECTION = [
  InvalidQuantity,
  InvalidRecipeCatalogId,
  InvalidReferenceCost,
  InvalidYield,
  RecipeCycle,
  UnknownIngredient,
  UnknownModifier,
  UnknownRecipe,
  UnknownRecipeVersion,
  UnknownVenue,
  MissingSitePrice,
  ZeroUnitFactor,
] as const;

type RoutePermission = (typeof routePermissions)[keyof typeof routePermissions];

interface PermissionTarget {
  kind: "brand" | "site";
  id: string;
  brandId: string | null;
}

interface Actor {
  userId: string;
  deviceId: string;
  selfAuthorized: boolean;
}

@Controller("tenants/:tenantId")
export class RecipeCatalogController {
  constructor(
    @Inject(RecipeCatalogRepository)
    private readonly catalogs: RecipeCatalogRepository,
    @Inject(RecipeWorkbook)
    private readonly workbook: RecipeWorkbook,
    @Inject(SitePrice)
    private readonly prices: SitePrice,
    @Inject(RecipeVenueDirectory)
    private readonly recipeVenues: RecipeVenueDirectory,
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
  ) {}

  @Post("brands/:brandId/recipe-catalog")
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param("tenantId") tenantId: string,
    @Param("brandId") brandId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<RecipePublicationBody> {
    const sessionId = readText(sessionHeader);
    const parsed = recipeCatalogCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.actor(
      tenantId,
      sessionId,
      EDIT_ACTION,
      { kind: "brand", id: brandId, brandId: null },
      EDIT_DENIED,
    );
    const before = await this.versionOf(tenantId, brandId);

    try {
      const catalog = await new UpdateRecipeCatalog(this.catalogs).execute({
        tenantId,
        brandId,
        authorId: actor.userId,
        commands: parsed.data.commands,
      });
      await this.audit(
        tenantId,
        brandId,
        actor,
        before,
        catalog.currentVersion,
      );

      return published(catalog);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Post("brands/:brandId/recipe-catalog/import")
  @HttpCode(HttpStatus.OK)
  async importWorkbook(
    @Param("tenantId") tenantId: string,
    @Param("brandId") brandId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<RecipePublicationBody> {
    const sessionId = readText(sessionHeader);
    const parsed = recipeImportCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.actor(
      tenantId,
      sessionId,
      routePermissions["POST recipe-catalog/import"],
      { kind: "brand", id: brandId, brandId: null },
      EDIT_DENIED,
    );
    const before = await this.versionOf(tenantId, brandId);

    try {
      const catalog = await new ImportRecipes(
        this.catalogs,
        this.workbook,
      ).execute({
        tenantId,
        brandId,
        authorId: actor.userId,
        contents: Uint8Array.from(Buffer.from(parsed.data.contents, "base64")),
      });
      await this.audit(
        tenantId,
        brandId,
        actor,
        before,
        catalog.currentVersion,
      );

      return published(catalog);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  @Get("brands/:brandId/recipe-catalog")
  async list(
    @Param("tenantId") tenantId: string,
    @Param("brandId") brandId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<RecipeCatalogBody> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    await this.actor(
      tenantId,
      sessionId,
      routePermissions["GET recipe-catalog"],
      { kind: "brand", id: brandId, brandId: null },
      EDIT_DENIED,
    );
    const publications = await this.catalogs.listPublications(
      tenantId,
      brandId,
    );

    return recipeCatalog.parse({ publications });
  }

  @Get("venues/:venueId/recipes/:productId/cost")
  async cost(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("productId") productId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Query("variantId") variantHeader: unknown,
  ): Promise<RecipeCost> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    const brandId = await this.recipeVenues.brandOf(tenantId, venueId);
    await this.actor(
      tenantId,
      sessionId,
      routePermissions["GET recipe-cost"],
      { kind: "site", id: venueId, brandId },
      COST_DENIED,
    );
    const variantId = readText(variantHeader);

    try {
      const cost = await new ViewTheoreticalCost(
        this.catalogs,
        this.recipeVenues,
        this.prices,
      ).execute({
        tenantId,
        venueId,
        productId,
        ...(variantId === null ? {} : { variantId }),
      });

      return recipeCost.parse(cost);
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  private async versionOf(
    tenantId: string,
    brandId: string,
  ): Promise<number | null> {
    const loaded = await this.catalogs.load(tenantId, brandId);

    return loaded?.currentVersion ?? null;
  }

  private async audit(
    tenantId: string,
    brandId: string,
    actor: Actor,
    before: number | null,
    after: number,
  ): Promise<void> {
    await new RecordAuditEvent(this.audits, this.digests, this.clock).execute({
      tenantId,
      actorId: actor.userId,
      authorizerId: actor.selfAuthorized ? actor.userId : null,
      deviceId: actor.deviceId,
      siteId: brandId,
      action: EDIT_ACTION,
      entity: `recipe_catalog_${brandId}`,
      before: { version: before },
      after: { version: after },
      reason: EDIT_ACTION,
    });
  }

  private async actor(
    tenantId: string,
    sessionId: string,
    permission: RoutePermission,
    target: PermissionTarget,
    denied: string,
  ): Promise<Actor> {
    const decision = await this.permit(tenantId, sessionId, permission, target);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: denied });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    return {
      userId: session.userId,
      deviceId: session.deviceId,
      selfAuthorized: decision.selfAuthorized,
    };
  }

  private async permit(
    tenantId: string,
    sessionId: string,
    permission: RoutePermission,
    target: PermissionTarget,
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
    if (error instanceof ExcelRecipeWorkbookError) {
      return new BadRequestException();
    }

    if (error instanceof RecipeImportRejected) {
      return new ConflictException(
        recipeImportReport.parse({
          error: "RecipeImportRejected",
          rows: error.rows.map((row) => ({
            row: row.row,
            reason: row.reason,
          })),
        }),
      );
    }

    const rejection = domainRejectionName(error);

    if (rejection !== null) {
      return new ConflictException({ error: rejection });
    }

    return error instanceof Error ? error : new Error("Recipe catalog failed.");
  }
}

function published(
  catalog: Awaited<ReturnType<UpdateRecipeCatalog["execute"]>>,
): RecipePublicationBody {
  const version = catalog.publishedVersion(catalog.currentVersion);

  return recipePublication.parse({
    tenantId: catalog.tenantId,
    brandId: catalog.brandId,
    version: catalog.currentVersion,
    authorId: version.authorId,
    ingredients: version.ingredients,
    recipes: version.recipes,
    modifiers: version.modifiers,
  });
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
