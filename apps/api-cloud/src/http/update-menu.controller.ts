import {
  type MenuUpdated,
  menuCommand,
  menuUpdated,
} from "@blackhole/contracts";
import {
  DuplicateMenuId,
  ForeignModifier,
  ForeignVenue,
  InvalidMenuId,
  InvalidMenuPrice,
  MissingTaxClassification,
  UnknownMenuReference,
  UpdateMenu,
  type UpdateMenuInput,
} from "@blackhole/orders/application/entry-port";
import { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
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

const SESSION_HEADER = "x-session-id";
const ACTION = "menu.edit";

export const routePermissions = {
  "POST menu": ACTION,
} as const;

const DOMAIN_REJECTION = [
  DuplicateMenuId,
  ForeignModifier,
  ForeignVenue,
  InvalidMenuId,
  InvalidMenuPrice,
  MissingTaxClassification,
  UnknownMenuReference,
] as const;

interface PricedItem {
  id: string;
  price: number;
}

interface StoredMenu {
  id: string;
  brandId: string;
  products: readonly PricedItem[];
  combos: readonly PricedItem[];
  venuePrices: readonly { venueId: string; itemId: string; price: number }[];
}

@Controller("tenants/:tenantId")
export class UpdateMenuController {
  constructor(
    @Inject(MenuRepository)
    private readonly menus: MenuRepository,
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
  ) {}

  @Post("menu")
  @HttpCode(HttpStatus.OK)
  async updateMenu(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<MenuUpdated> {
    const sessionId = readText(sessionHeader);
    const parsed = menuCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const { brandId, command } = parsed.data;
    const itemId =
      command.type === "setVenuePrice" ? command.itemId : command.id;
    const venueId = command.type === "setVenuePrice" ? command.venueId : null;
    const decision = await this.permit(tenantId, sessionId, brandId, venueId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "MenuEditDenied" });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    const priceBefore = listedPrice(
      await this.menus.load(tenantId, brandId),
      itemId,
      venueId,
    );
    const updateMenu = new UpdateMenu(this.menus, this.venues);
    const input: UpdateMenuInput = { tenantId, brandId, command };

    try {
      const menu = await updateMenu.execute(input);
      const recordAudit = new RecordAuditEvent(
        this.audits,
        this.digests,
        this.clock,
      );

      await recordAudit.execute({
        tenantId,
        actorId: session.userId,
        authorizerId: decision.selfAuthorized ? session.userId : null,
        deviceId: session.deviceId,
        siteId: venueId ?? brandId,
        action: ACTION,
        entity: itemId,
        before: { price: priceBefore },
        after: { price: command.price },
        reason: ACTION,
      });

      return menuUpdated.parse({ menuId: menu.id, brandId: menu.brandId });
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
      }

      throw error;
    }
  }

  private async permit(
    tenantId: string,
    sessionId: string,
    brandId: string,
    venueId: string | null,
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
        permission: ACTION,
        target:
          venueId === null
            ? { kind: "brand", id: brandId, brandId: null }
            : { kind: "site", id: venueId, brandId },
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

function listedPrice(
  menu: StoredMenu | null,
  itemId: string,
  venueId: string | null,
): number | null {
  if (menu === null) {
    return null;
  }

  if (venueId !== null) {
    const override = menu.venuePrices.find(
      (price) => price.venueId === venueId && price.itemId === itemId,
    );

    if (override) {
      return override.price;
    }
  }

  return (
    menu.products.find((item) => item.id === itemId)?.price ??
    menu.combos.find((item) => item.id === itemId)?.price ??
    null
  );
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
