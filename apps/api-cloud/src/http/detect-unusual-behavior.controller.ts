import {
  DetectUnusualBehavior,
  EvaluatePermission,
  UnknownSession,
  type UnusualBehaviorAlert,
} from "@blackhole/platform/application/entry-port";
import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Query,
} from "@nestjs/common";
import { z } from "zod";

const SESSION_HEADER = "x-session-id";

const unusualBehaviorQuery = z
  .object({
    shiftId: z.string().min(1),
  })
  .strict();

export const routePermissions = {
  "GET unusual-behavior": "audit.view",
} as const;

const readText = (header: unknown): string | null => {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
};

@Controller("tenants/:tenantId/venues/:venueId")
export class DetectUnusualBehaviorController {
  constructor(
    @Inject(DetectUnusualBehavior)
    private readonly detector: DetectUnusualBehavior,
    @Inject(EvaluatePermission)
    private readonly permissions: EvaluatePermission,
  ) {}

  @Get("unusual-behavior")
  async detect(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Query() query: unknown,
  ): Promise<readonly UnusualBehaviorAlert[]> {
    const sessionId = readText(sessionHeader);
    const parsed = unusualBehaviorQuery.safeParse(query);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    let decision: Awaited<ReturnType<EvaluatePermission["execute"]>>;

    try {
      decision = await this.permissions.execute({
        tenantId,
        sessionId,
        permission: "audit.view",
        target: { kind: "site", id: venueId, brandId: null },
        value: null,
        supportGrantId: null,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });
    } catch (error: unknown) {
      if (error instanceof UnknownSession) {
        throw new BadRequestException();
      }

      throw error;
    }

    if (decision.outcome !== "allowed") {
      return [];
    }

    return this.detector.execute({
      tenantId,
      siteId: venueId,
      shiftId: parsed.data.shiftId,
    });
  }
}
