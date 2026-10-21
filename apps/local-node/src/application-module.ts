import { Module } from "@nestjs/common";

import { UpdateStructureController } from "#src/update-structure.controller.js";

@Module({
  controllers: [UpdateStructureController],
})
export class ApplicationModule {}
