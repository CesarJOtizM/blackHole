import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import {
  stationRouteProducts,
  stationRoutes,
} from "#adapters/postgres/schema.js";
import {
  type StationRoute,
  StationRouteRepository,
} from "#application/ports/station-route-repository.js";
import type { StationOutput } from "#domain/station-router.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type StationRouteRow = typeof stationRoutes.$inferSelect;
type StationRouteProductRow = typeof stationRouteProducts.$inferSelect;

const STATION_OUTPUTS = new Set<StationOutput>(["screen", "printer", "both"]);

export class DrizzleStationRouteRepository extends StationRouteRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async load(
    tenantId: string,
    venueId: string,
  ): Promise<readonly StationRoute[]> {
    return this.inTenant(tenantId, async (tx) => {
      const routeRows = await tx
        .select()
        .from(stationRoutes)
        .where(eq(stationRoutes.venueId, venueId))
        .orderBy(asc(stationRoutes.id));
      const productRows = await tx
        .select()
        .from(stationRouteProducts)
        .where(eq(stationRouteProducts.venueId, venueId))
        .orderBy(asc(stationRouteProducts.productId));

      if (
        routeRows.some((row) => row.tenantId !== tenantId) ||
        productRows.some((row) => row.tenantId !== tenantId)
      ) {
        throw new Error("Stored station route does not match the tenant.");
      }

      const byStation = new Map(routeRows.map((row) => [row.id, row]));

      return productRows.map((product) =>
        restoreRoute(product, byStation.get(product.stationId)),
      );
    });
  }

  override async save(route: StationRoute): Promise<void> {
    await this.inTenant(route.tenantId, async (tx) => {
      const existing = await tx
        .select()
        .from(stationRouteProducts)
        .where(
          and(
            eq(stationRouteProducts.tenantId, route.tenantId),
            eq(stationRouteProducts.venueId, route.venueId),
            eq(stationRouteProducts.productId, route.productId),
          ),
        );

      if (existing.length > 0) {
        return;
      }

      const stations = await tx
        .select()
        .from(stationRoutes)
        .where(
          and(
            eq(stationRoutes.tenantId, route.tenantId),
            eq(stationRoutes.venueId, route.venueId),
            eq(stationRoutes.id, route.stationId),
          ),
        );

      if (stations.length === 0) {
        await tx.insert(stationRoutes).values({
          id: route.stationId,
          tenantId: route.tenantId,
          venueId: route.venueId,
          name: route.stationName,
          output: route.output,
          redThresholdMinutes: route.redThresholdMinutes,
        });
      }

      await tx.insert(stationRouteProducts).values({
        tenantId: route.tenantId,
        venueId: route.venueId,
        stationId: route.stationId,
        productId: route.productId,
      });
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE orders_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

function restoreRoute(
  product: StationRouteProductRow,
  route: StationRouteRow | undefined,
): StationRoute {
  if (route === undefined || !isOutput(route.output)) {
    throw new Error("Stored station route cannot be restored.");
  }

  return {
    tenantId: route.tenantId,
    venueId: route.venueId,
    stationId: route.id,
    stationName: route.name,
    productId: product.productId,
    output: route.output,
    redThresholdMinutes: route.redThresholdMinutes,
  };
}

function isOutput(value: string): value is StationOutput {
  return STATION_OUTPUTS.has(value as StationOutput);
}
