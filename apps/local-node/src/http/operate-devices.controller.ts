import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

const DEVICE_REJECTION = {
  ERROR: "DeviceCommandRejected",
} as const;

interface DeviceCommandRejection {
  error: typeof DEVICE_REJECTION.ERROR;
}

export const routePermissions = {
  "POST devices": "device.register",
} as const;

@Controller("tenants/:tenantId")
export class OperateDevicesController {
  @Post("devices")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectDevices(): DeviceCommandRejection {
    return { error: DEVICE_REJECTION.ERROR };
  }
}
