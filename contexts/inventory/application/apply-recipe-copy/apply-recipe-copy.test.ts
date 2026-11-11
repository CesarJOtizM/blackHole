import { expect, it } from "vitest";

import { InMemoryRecipeCopyRepository } from "#adapters/memory/in-memory-recipe-copy-repository.js";
import { ApplyRecipeCopy } from "#application/apply-recipe-copy/apply-recipe-copy.js";
import type { RecipePublication } from "#application/ports/recipe-catalog-repository.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const AUTHOR_ID = "user_owner";
const EDITOR_ID = "user_editor";
const BURGER_ID = "product_burger";
const BURGER_RECIPE_ID = "recipe_burger";

const publication = (version: number, authorId: string): RecipePublication => ({
  tenantId: TENANT_ID,
  brandId: BRAND_ID,
  version,
  authorId,
  ingredients: [],
  recipes: [
    {
      id: BURGER_RECIPE_ID,
      name: "burger",
      productId: BURGER_ID,
      lines: [],
    },
  ],
  modifiers: [],
});

it("given the node holds version 4, when an older copy is applied, then version 4 stays", async () => {
  const copies = new InMemoryRecipeCopyRepository();
  const apply = new ApplyRecipeCopy(copies);
  const current = publication(4, AUTHOR_ID);
  await apply.execute({ publication: current });

  const kept = await apply.execute({
    publication: {
      ...publication(3, EDITOR_ID),
      recipes: [],
    },
  });

  expect(kept).toEqual(current);
  expect(await copies.load(TENANT_ID, BRAND_ID)).toEqual(current);
});
