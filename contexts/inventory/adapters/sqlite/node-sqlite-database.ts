import type { DatabaseSync, StatementSync } from "node:sqlite";
import { entityKind } from "drizzle-orm/entity";
import type { ExtractTablesWithRelations } from "drizzle-orm/relations";
import { fillPlaceholders, type Query } from "drizzle-orm/sql";
import {
  BaseSQLiteDatabase,
  type SQLiteExecuteMethod,
  SQLitePreparedQuery,
  SQLiteSession,
  SQLiteSyncDialect,
  SQLiteTransaction,
  type SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core";

type RunResult = {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
};

type FullSchema = Record<string, never>;
type Schema = ExtractTablesWithRelations<FullSchema>;
type SyncTransaction = SQLiteTransaction<"sync", RunResult, FullSchema, Schema>;

type OrderedField = {
  path: string[];
  field: unknown;
};

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof value.then === "function";

const sqlParameters = (
  values: readonly unknown[],
): (string | number | bigint | null | Uint8Array)[] =>
  values.map((value) => {
    if (
      value === null ||
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "bigint" ||
      value instanceof Uint8Array
    ) {
      return value;
    }

    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }

    throw new Error("SQLite received an unsupported parameter.");
  });

const readDriverValue = (field: unknown, raw: unknown): unknown => {
  if (
    typeof field === "object" &&
    field !== null &&
    "mapFromDriverValue" in field &&
    typeof field.mapFromDriverValue === "function"
  ) {
    return field.mapFromDriverValue(raw);
  }

  return raw;
};

const mapRow = (
  fields: readonly OrderedField[] | undefined,
  row: readonly unknown[],
): Record<string, unknown> => {
  if (fields === undefined) {
    throw new Error("SQLite row is missing its selected columns.");
  }

  const result: Record<string, unknown> = {};

  for (const [index, selected] of fields.entries()) {
    let node = result;

    for (const [pathIndex, key] of selected.path.entries()) {
      if (pathIndex < selected.path.length - 1) {
        const child = node[key];

        if (typeof child !== "object" || child === null) {
          node[key] = {};
        }

        node = node[key] as Record<string, unknown>;
        continue;
      }

      const raw = row[index];
      node[key] = raw === null ? null : readDriverValue(selected.field, raw);
    }
  }

  return result;
};

class NodeSqlitePreparedQuery extends SQLitePreparedQuery<{
  type: "sync";
  run: RunResult;
  all: Record<string, unknown>[];
  get: Record<string, unknown> | undefined;
  values: unknown[][];
  execute: unknown;
}> {
  static readonly [entityKind] = "NodeSqlitePreparedQuery";

  constructor(
    private readonly statement: StatementSync,
    query: Query,
    private readonly fields: readonly OrderedField[] | undefined,
    executeMethod: SQLiteExecuteMethod,
  ) {
    super("sync", executeMethod, query);
  }

  override run(): RunResult {
    return this.statement.run(
      ...sqlParameters(fillPlaceholders(this.query.params, {})),
    );
  }

  override all(): Record<string, unknown>[] {
    const parameters = sqlParameters(fillPlaceholders(this.query.params, {}));

    if (this.fields === undefined) {
      return this.statement.all(...parameters) as Record<string, unknown>[];
    }

    this.statement.setReturnArrays(true);

    return (this.statement.all(...parameters) as unknown as unknown[][]).map(
      (row) => mapRow(this.fields, row),
    );
  }

  override get(): Record<string, unknown> | undefined {
    const parameters = sqlParameters(fillPlaceholders(this.query.params, {}));

    if (this.fields === undefined) {
      return this.statement.get(...parameters) as
        | Record<string, unknown>
        | undefined;
    }

    this.statement.setReturnArrays(true);
    const row = this.statement.get(...parameters) as unknown as
      | unknown[]
      | undefined;

    if (row === undefined) {
      return undefined;
    }

    return mapRow(this.fields, row);
  }

  override values(): unknown[][] {
    this.statement.setReturnArrays(true);

    return this.statement.all(
      ...sqlParameters(fillPlaceholders(this.query.params, {})),
    ) as unknown as unknown[][];
  }
}

class NodeSqliteTransaction extends SQLiteTransaction<
  "sync",
  RunResult,
  FullSchema,
  Schema
> {
  static readonly [entityKind] = "NodeSqliteTransaction";
}

class NodeSqliteSession extends SQLiteSession<
  "sync",
  RunResult,
  FullSchema,
  Schema
> {
  static readonly [entityKind] = "NodeSqliteSession";

  constructor(
    private readonly client: DatabaseSync,
    private readonly sqliteDialect: SQLiteSyncDialect,
  ) {
    super(sqliteDialect);
  }

  override prepareQuery(
    query: Query,
    fields: readonly OrderedField[] | undefined,
    executeMethod: SQLiteExecuteMethod,
    _isResponseInArrayMode: boolean,
  ): NodeSqlitePreparedQuery {
    return new NodeSqlitePreparedQuery(
      this.client.prepare(query.sql),
      query,
      fields,
      executeMethod,
    );
  }

  override transaction<T>(
    transaction: (tx: SyncTransaction) => T,
    _config?: SQLiteTransactionConfig,
  ): T {
    this.client.exec("BEGIN");

    try {
      const result = transaction(
        new NodeSqliteTransaction("sync", this.sqliteDialect, this, undefined),
      );

      return this.settle(result);
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  private settle<T>(result: T): T {
    if (!isPromise(result)) {
      this.client.exec("COMMIT");
      return result;
    }

    return result.then(
      (value) => {
        this.client.exec("COMMIT");
        return value;
      },
      (error: unknown) => {
        this.rollback();
        throw error;
      },
    ) as T;
  }

  private rollback(): void {
    this.client.exec("ROLLBACK");
  }
}

class NodeSqliteDatabase extends BaseSQLiteDatabase<"sync", RunResult> {
  static readonly [entityKind] = "NodeSqliteDatabase";
}

export const createNodeSqliteDatabase = (client: DatabaseSync) => {
  const dialect = new SQLiteSyncDialect();
  const session = new NodeSqliteSession(client, dialect);

  return new NodeSqliteDatabase("sync", dialect, session, undefined);
};
