import {
  RecipeCopyRepository,
  type RecipePublication,
} from "@blackhole/inventory/application/ports/recipe-copy-repository";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
} from "@nestjs/common";

const RECIPE_REJECTION = {
  ERROR: "RecipeRejected",
} as const;

export const routePermissions = {
  "POST brands/:brandId/recipe-catalog": "recipe.edit",
} as const;

interface RecipeRejection {
  error: typeof RECIPE_REJECTION.ERROR;
}

@Controller("tenants/:tenantId")
export class RecipeCopyController {
  constructor(
    @Optional()
    @Inject(RecipeCopyRepository)
    private readonly copies?: RecipeCopyRepository,
  ) {}

  @Post("brands/:brandId/recipe-catalog")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectWrite(): RecipeRejection {
    return { error: RECIPE_REJECTION.ERROR };
  }

  @Get("brands/:brandId/recipe-catalog")
  async readCopy(
    @Param("tenantId") tenantId: string,
    @Param("brandId") brandId: string,
  ): Promise<RecipePublication> {
    const copy = await this.copies?.load(tenantId, brandId);

    if (!copy) {
      throw new NotFoundException();
    }

    return copy;
  }
}
