import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

const STRUCTURE_REJECTION = {
  ERROR: "StructureEditRejected",
} as const;

interface StructureEditRejection {
  error: typeof STRUCTURE_REJECTION.ERROR;
}

@Controller("tenants/:tenantId")
export class UpdateStructureController {
  @Post("structure")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectStructure(): StructureEditRejection {
    return { error: STRUCTURE_REJECTION.ERROR };
  }
}
