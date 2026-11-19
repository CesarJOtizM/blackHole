import { expect, it } from "vitest";

import { oneTapRestockBody } from "#src/kitchen/restock-request.js";

const ids = { documentId: "document_1", lineId: "line_1" };

it("given one supplying warehouse and a purchase unit, when the one-tap body is built, then the warehouse is sent and the supplier is omitted", () => {
  const body = oneTapRestockBody(
    {
      purchaseUnit: 1000,
      warehouseIds: ["warehouse_general"],
      supplierId: "supplier_market",
    },
    ids,
  );

  expect(body).toEqual({
    purchaseUnit: 1000,
    documentId: "document_1",
    lineId: "line_1",
    warehouseId: "warehouse_general",
    supplierId: null,
  });
});

it("given several supplying warehouses, when the one-tap body is built, then neither warehouse nor supplier is sent", () => {
  const body = oneTapRestockBody(
    {
      purchaseUnit: 1000,
      warehouseIds: ["warehouse_a", "warehouse_b"],
      supplierId: "supplier_market",
    },
    ids,
  );

  expect(body.warehouseId).toBeNull();
  expect(body.supplierId).toBeNull();
});
