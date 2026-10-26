import { Module } from "@nestjs/common";

import { AuthorizationController } from "#src/http/authorization.controller.js";
import { OperateDevicesController } from "#src/http/operate-devices.controller.js";
import { OperateIdentityController } from "#src/http/operate-identity.controller.js";
import { UpdateMenuController } from "#src/http/update-menu.controller.js";
import { UpdateStructureController } from "#src/http/update-structure.controller.js";

@Module({
  controllers: [
    UpdateMenuController,
    UpdateStructureController,
    OperateIdentityController,
    OperateDevicesController,
    AuthorizationController,
  ],
})
export class ApplicationModule {}
