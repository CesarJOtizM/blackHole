import { PrintTipSettlement } from "@blackhole/cash-register/application/entry-port";
import {
  type PrintedTipSettlement,
  printedTipSettlement,
  printTipSettlementCommand,
} from "@blackhole/contracts";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import { DispatchPrintJobs } from "@blackhole/printing/application/entry-port";
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

import { readText } from "#src/http/void-command.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST tip-settlements/:id/print": "cash.settle-tips",
} as const;

const rejectedPrint = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "MissingTipSettlement" ||
    error.name === "InvalidTipSettlementId" ||
    error.name === "PrinterNotConfigured");

@Controller("tenants/:tenantId/venues/:venueId")
export class PrintTipSettlementController {
  constructor(
    @Inject(PrintTipSettlement)
    private readonly printing: PrintTipSettlement,
    @Inject(DispatchPrintJobs)
    private readonly dispatch: DispatchPrintJobs,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
  ) {}

  @Post("tip-settlements/:id/print")
  @HttpCode(HttpStatus.OK)
  async print(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("id") settlementId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<PrintedTipSettlement | null> {
    const sessionId = readText(sessionHeader);
    const parsed = printTipSettlementCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    try {
      const queued = await this.printing.execute({
        tenantId,
        venueId,
        sessionId,
        settlementId,
        printerId: parsed.data.printerId,
        commandId: parsed.data.commandId,
        period: parsed.data.period,
      });

      if (queued === null) {
        return null;
      }

      if (queued.status === "queued") {
        await this.dispatch.execute();
      }

      return printedTipSettlement.parse(queued);
    } catch (error: unknown) {
      if (rejectedPrint(error)) {
        throw new BadRequestException();
      }

      throw error;
    }
  }
}
