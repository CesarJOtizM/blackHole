import { Module } from "@nestjs/common";

import { OperateDevicesController } from "#src/operate-devices.controller.js";
import { OperateIdentityController } from "#src/operate-identity.controller.js";
import { UpdateStructureController } from "#src/update-structure.controller.js";

@Module({
  controllers: [
    UpdateStructureController,
    OperateIdentityController,
    OperateDevicesController,
  ],
})
export class ApplicationModule {}
