import { Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";

const DINING_ROOM_REJECTION = {
  ERROR: "DiningRoomRejected",
} as const;

export const routePermissions = {
  "POST dining-tables": "organization.structure",
  "POST station-routes": "organization.structure",
  "POST dining-tables/:tableId/open": "sale.open-table",
  "POST dining-tables/:tableId/release": "sale.open-table",
  "POST dining-tables/:tableId/ready": "sale.open-table",
  "POST checks/:checkId/bill": "sale.open-table",
  "POST checks/:checkId/lines": "sale.open-table",
  "POST checks/:checkId/send": "sale.open-table",
  "POST checks/:checkId/lines/:lineId/resend": "sale.open-table",
  "POST checks/:checkId/lines/:lineId/deliver": "sale.open-table",
  "POST checks/reassign": "sale.move-items",
  "POST checks/:checkId/lines/:lineId/preparation": "session",
  "POST checks/:checkId/lines/:lineId/ready": "session",
  "GET table-map": "session",
  "GET stations/:stationId/queue": "session",
  "GET checks/:checkId": "session",
  "GET orders-realtime": "session",
} as const;

interface DiningRoomRejection {
  error: typeof DINING_ROOM_REJECTION.ERROR;
}

@Controller("tenants/:tenantId/venues/:venueId")
export class DiningRoomController {
  @Post("dining-tables")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectPlaceTable(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("station-routes")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectStationRoute(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("dining-tables/:tableId/open")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectOpen(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("dining-tables/:tableId/release")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectRelease(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("dining-tables/:tableId/ready")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectTableReady(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("checks/:checkId/bill")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectBill(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("checks/:checkId/lines")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectAddLine(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("checks/:checkId/send")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectSend(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("checks/:checkId/lines/:lineId/resend")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectResend(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("checks/:checkId/lines/:lineId/deliver")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectDeliver(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("checks/reassign")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectReassign(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("checks/:checkId/lines/:lineId/preparation")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectPreparation(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Post("checks/:checkId/lines/:lineId/ready")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectLineReady(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Get("table-map")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectTableMap(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Get("stations/:stationId/queue")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectStationQueue(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Get("checks/:checkId")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectGetCheck(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }

  @Get("orders-realtime")
  @HttpCode(HttpStatus.FORBIDDEN)
  rejectOrdersRealtime(): DiningRoomRejection {
    return { error: DINING_ROOM_REJECTION.ERROR };
  }
}
