import type { IngredientCategory } from "#application/ports/ingredient-classification.js";
import { IngredientClassification } from "#application/ports/ingredient-classification.js";
import {
  COUNT_SESSION_STATUS,
  type CountLedgerLine,
  type CountSession,
  StockCountRepository,
} from "#application/ports/stock-count-repository.js";
import { onHandDelta } from "#domain/stock-ledger.js";

const sessionKey = (tenantId: string, documentId: string): string =>
  `${tenantId}\u0000${documentId}`;

const ingredientKey = (tenantId: string, ingredientId: string): string =>
  `${tenantId}\u0000${ingredientId}`;

const copyLine = (line: CountLedgerLine): CountLedgerLine => ({ ...line });

const copySession = (session: CountSession): CountSession => ({
  ...session,
  lines: session.lines.map((line) => ({ ...line })),
});

const chronological = (lines: readonly CountLedgerLine[]): CountLedgerLine[] =>
  lines.toSorted((left, right) => {
    const byTime = left.occurredAt.localeCompare(right.occurredAt);

    if (byTime !== 0) {
      return byTime;
    }

    return left.id.localeCompare(right.id);
  });

export class InMemoryStockCountRepository extends StockCountRepository {
  private readonly movements: CountLedgerLine[] = [];
  private readonly sessions = new Map<string, CountSession>();

  override async movementsAt(
    tenantId: string,
    venueId: string,
    locationId: string,
  ): Promise<readonly CountLedgerLine[]> {
    return this.movements
      .filter(
        (line) =>
          line.tenantId === tenantId &&
          line.venueId === venueId &&
          line.locationId === locationId,
      )
      .map(copyLine);
  }

  override async appendAdjustments(
    lines: readonly CountLedgerLine[],
  ): Promise<void> {
    for (const line of lines) {
      this.movements.push(copyLine(line));
    }
  }

  override async saveSession(session: CountSession): Promise<void> {
    this.sessions.set(
      sessionKey(session.tenantId, session.documentId),
      copySession(session),
    );
  }

  async sessionOf(
    tenantId: string,
    documentId: string,
  ): Promise<CountSession | null> {
    const session = this.sessions.get(sessionKey(tenantId, documentId));

    if (session === undefined || session.tenantId !== tenantId) {
      return null;
    }

    return copySession(session);
  }

  async stockOf(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    const lines = chronological(
      this.movements.filter(
        (line) =>
          line.tenantId === tenantId &&
          line.locationId === locationId &&
          line.ingredientId === ingredientId,
      ),
    );
    let onHand = 0;
    const prior: CountLedgerLine[] = [];

    for (const line of lines) {
      onHand += onHandDelta(line, prior);
      prior.push(line);
    }

    return onHand;
  }

  async seed(line: CountLedgerLine): Promise<void> {
    this.movements.push(copyLine(line));
  }

  // Rejection keeps the frozen session and does not append a stock line.
  async reject(tenantId: string, documentId: string): Promise<void> {
    const session = this.sessions.get(sessionKey(tenantId, documentId));

    if (
      session === undefined ||
      session.tenantId !== tenantId ||
      session.status !== COUNT_SESSION_STATUS.PENDING
    ) {
      return;
    }
  }
}

export class InMemoryIngredientClassification extends IngredientClassification {
  private readonly ingredients = new Set<string>();
  private readonly categories = new Map<string, IngredientCategory>();

  know(tenantId: string, ingredientId: string): void {
    this.ingredients.add(ingredientKey(tenantId, ingredientId));
  }

  override async ingredientOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<string | null> {
    if (!this.ingredients.has(ingredientKey(tenantId, ingredientId))) {
      return null;
    }

    return ingredientId;
  }

  override async save(category: IngredientCategory): Promise<void> {
    this.categories.set(
      ingredientKey(category.tenantId, category.ingredientId),
      {
        tenantId: category.tenantId,
        ingredientId: category.ingredientId,
        category: category.category,
      },
    );
  }

  override async find(
    tenantId: string,
    ingredientId: string,
  ): Promise<IngredientCategory | null> {
    const stored = this.categories.get(ingredientKey(tenantId, ingredientId));

    if (stored === undefined) {
      return null;
    }

    return { ...stored };
  }
}
