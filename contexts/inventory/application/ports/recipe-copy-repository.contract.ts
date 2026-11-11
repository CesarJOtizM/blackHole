import { expect, it } from "vitest";

import type { RecipePublication } from "#application/ports/recipe-catalog-repository.js";
import type { RecipeCopyRepository } from "#application/ports/recipe-copy-repository.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const BRAND_ID = "organization_brand_shared";
const OTHER_BRAND_ID = "organization_brand_other";
const AUTHOR_ID = "user_owner";
const EDITOR_ID = "user_editor";
const BURGER_ID = "product_burger";
const BURGER_RECIPE_ID = "recipe_burger";

const publication = (
  tenantId: string,
  version: number,
  authorId: string,
): RecipePublication => ({
  tenantId,
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

export function recipeCopyRepositoryContract(
  createRepository: () => RecipeCopyRepository | Promise<RecipeCopyRepository>,
): void {
  it("given a stored copy, when a newer copy is applied and then an older one, then the newer copy stays", async () => {
    const repository = await createRepository();
    const first = publication(TENANT_A, 1, AUTHOR_ID);
    const newer = publication(TENANT_A, 4, EDITOR_ID);
    const older = {
      ...publication(TENANT_A, 3, AUTHOR_ID),
      recipes: [],
    };
    const replay = { ...newer, authorId: AUTHOR_ID };

    expect(await repository.apply(first)).toEqual(first);
    expect(await repository.load(TENANT_A, BRAND_ID)).toEqual(first);

    expect(await repository.apply(newer)).toEqual(newer);
    expect(await repository.load(TENANT_A, BRAND_ID)).toEqual(newer);

    expect(await repository.apply(older)).toEqual(newer);
    expect(await repository.apply(replay)).toEqual(newer);
    expect(await repository.load(TENANT_A, BRAND_ID)).toEqual(newer);
    expect(await repository.load(TENANT_A, OTHER_BRAND_ID)).toBeNull();
  });

  it("given tenants A and B, when tenant A loads its copy, then B stays hidden", async () => {
    const repository = await createRepository();
    const copyA = publication(TENANT_A, 1, AUTHOR_ID);
    const copyB = publication(TENANT_B, 2, EDITOR_ID);

    await repository.apply(copyA);
    await repository.apply(copyB);

    expect(await repository.load(TENANT_A, BRAND_ID)).toEqual(copyA);
    expect(await repository.load(TENANT_B, BRAND_ID)).toEqual(copyB);
    expect(await repository.load(TENANT_A, BRAND_ID)).not.toEqual(copyB);
    expect(await repository.load(TENANT_B, OTHER_BRAND_ID)).toBeNull();
  });
}
