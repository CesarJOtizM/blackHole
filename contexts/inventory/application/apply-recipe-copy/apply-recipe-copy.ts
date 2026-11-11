import type { RecipePublication } from "#application/ports/recipe-catalog-repository.js";
import type { RecipeCopyRepository } from "#application/ports/recipe-copy-repository.js";

export interface ApplyRecipeCopyInput {
  publication: RecipePublication;
}

export class ApplyRecipeCopy {
  constructor(private readonly copies: RecipeCopyRepository) {}

  async execute(input: ApplyRecipeCopyInput): Promise<RecipePublication> {
    return this.copies.apply(input.publication);
  }
}
