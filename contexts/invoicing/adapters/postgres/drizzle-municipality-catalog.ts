import type { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { FACTUS_MUNICIPALITIES } from "#adapters/factus/factus-municipalities.js";
import { daneMunicipalities } from "#adapters/postgres/schema.js";
import { MunicipalityCatalog } from "#application/ports/municipality-catalog.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const MUNICIPALITY_CODE = /^\d{5}$/;
const SEED_CHUNK = 200;

const asReader = async <T>(
  database: Database,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> =>
  database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE invoicing_app`);

    return work(tx);
  });

export const seedFactusMunicipalities = async (
  client: PGlite,
): Promise<void> => {
  const database = drizzle(client);

  for (
    let index = 0;
    index < FACTUS_MUNICIPALITIES.length;
    index += SEED_CHUNK
  ) {
    const values = FACTUS_MUNICIPALITIES.slice(index, index + SEED_CHUNK).map(
      (row) => ({
        code: row.code,
        name: row.name,
        departmentCode: row.departmentCode,
        departmentName: row.departmentName,
      }),
    );

    await database
      .insert(daneMunicipalities)
      .values(values)
      .onConflictDoNothing({ target: daneMunicipalities.code });
  }
};

export class DrizzleMunicipalityCatalog extends MunicipalityCatalog {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async find(code: string): Promise<string | null> {
    const trimmed = code.trim();

    if (!MUNICIPALITY_CODE.test(trimmed)) {
      return null;
    }

    return asReader(this.database, async (tx) => {
      const rows = await tx
        .select({ code: daneMunicipalities.code })
        .from(daneMunicipalities)
        .where(eq(daneMunicipalities.code, trimmed))
        .limit(1);
      const stored = rows[0];

      return stored === undefined ? null : stored.code;
    });
  }
}
