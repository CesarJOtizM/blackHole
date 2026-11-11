import { DatabaseSync } from "node:sqlite";
import type { RecipePublication } from "@blackhole/inventory/application/ports/recipe-copy-repository";
import { BASE_UNIT, QUANTITY_SCALE } from "@blackhole/inventory/domain";
import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";
import { sqliteRecipeCopies } from "#src/composition/recipe-copies.js";
import {
  RecipeCopyController,
  routePermissions,
} from "#src/http/recipe-copy.controller.js";

const tenantId = "organization_tenant_1";
const brandId = "organization_brand_1";

const storedCopy = (): RecipePublication => ({
  tenantId,
  brandId,
  version: 3,
  authorId: "user_owner",
  ingredients: [
    {
      id: "ingredient_onion",
      name: "onion",
      baseUnit: BASE_UNIT.GRAM,
      purchaseUnit: { name: "50 kg sack", factor: 50_000 * QUANTITY_SCALE },
      recipeUnit: { name: "g", factor: QUANTITY_SCALE },
      referenceCostCop: 80,
    },
  ],
  recipes: [
    {
      id: "recipe_burger",
      name: "burger",
      productId: "product_burger",
      lines: [
        {
          kind: "ingredient",
          ingredientId: "ingredient_onion",
          netQuantity: 150 * QUANTITY_SCALE,
          yieldPercent: 75,
        },
      ],
    },
  ],
  modifiers: [],
});

it("given a stored recipe copy, when the node is asked to write or read it, then the write is rejected and the read returns that copy", async () => {
  expect(routePermissions).toEqual({
    "POST brands/:brandId/recipe-catalog": "recipe.edit",
  });
  expect(RecipeCopyController).toBeDefined();
  const client = new DatabaseSync(":memory:");
  const copies = sqliteRecipeCopies(client);
  const stored = storedCopy();
  await copies.apply(stored);
  const application = await createApplication({ recipeCopies: copies });

  try {
    const posted = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/brands/${brandId}/recipe-catalog`,
      payload: {
        version: 9,
        commands: [{ type: "not-a-catalog-command" }],
      },
    });
    const read = await application.inject({
      method: "GET",
      url: `/tenants/${tenantId}/brands/${brandId}/recipe-catalog`,
    });
    const otherBrand = await application.inject({
      method: "GET",
      url: `/tenants/${tenantId}/brands/organization_brand_other/recipe-catalog`,
    });

    expect(posted.statusCode).toBe(403);
    expect(posted.json()).toEqual({ error: "RecipeRejected" });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual(stored);
    expect(otherBrand.statusCode).toBe(404);
    expect(await copies.load(tenantId, brandId)).toEqual(stored);
    expect(Reflect.getMetadata("providers", ApplicationModule) ?? []).toEqual(
      [],
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
    client.close();
  }
});
