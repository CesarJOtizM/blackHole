export interface OneTapRestockFacts {
  purchaseUnit: number;
  warehouseIds: readonly string[];
  supplierId?: string | null;
}

export interface OneTapRestockBody {
  purchaseUnit: number;
  documentId: string;
  lineId: string;
  warehouseId: string | null;
  supplierId: string | null;
}

export const oneTapRestockBody = (
  facts: OneTapRestockFacts,
  ids: { documentId: string; lineId: string },
): OneTapRestockBody => ({
  purchaseUnit: facts.purchaseUnit,
  documentId: ids.documentId,
  lineId: ids.lineId,
  warehouseId:
    facts.warehouseIds.length === 1 ? (facts.warehouseIds[0] ?? null) : null,
  supplierId: facts.warehouseIds.length > 0 ? null : (facts.supplierId ?? null),
});
