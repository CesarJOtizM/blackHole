import {
  ApplyQrPayment,
  ConfirmQrPayment,
  StartQrPayment,
} from "@blackhole/cash-register/application/entry-port";
import { startQrPaymentCommand } from "@blackhole/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  createParamDecorator,
  type ExecutionContext,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";

export const qrTableBalancePath = "d/:token";
export const qrTablePaymentPath = "d/:token/payments";
export const qrPaymentWebhookPath = "payments/bold/webhook";
export const boldSignatureHeader = "x-bold-signature";

export interface QrTableContext {
  tenantId: string;
  venueId: string;
  checkId: string;
  registerId: string;
  balanceCop: number;
}

export abstract class QrTableAccess {
  abstract resolve(token: string): Promise<QrTableContext | null>;
}

export interface QrRemainingPart {
  partId: string;
  balanceCop: number;
}

export interface QrStalePayment {
  reference: string;
  status: "pending_application";
}

export interface QrCountReading {
  countedCashCop: number;
  expectedCashCop: number;
  qrCop: number;
}

export abstract class QrPaymentDesk {
  abstract remaining(input: {
    tenantId: string;
    venueId: string;
    checkId: string;
  }): Promise<readonly QrRemainingPart[]>;

  abstract stale(input: {
    tenantId: string;
    venueId: string;
  }): Promise<readonly QrStalePayment[]>;

  abstract count(input: {
    tenantId: string;
    venueId: string;
    registerId: string;
  }): Promise<QrCountReading>;
}

const rawRequestBody = createParamDecorator(
  (_data: undefined, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<{
      rawBody?: Buffer | string;
    }>();

    if (typeof request.rawBody === "string") {
      return request.rawBody;
    }

    if (Buffer.isBuffer(request.rawBody)) {
      return request.rawBody.toString("utf8");
    }

    return "";
  },
);

const webhookEnvelope = z
  .object({
    reference: z.string().regex(/^qrpay_.+/),
    amountCop: z.number().int().nonnegative(),
    instrument: z.enum(["card", "nequi", "daviplata", "bre-b"]),
    tenantId: z.string().min(1),
    venueId: z.string().min(1),
    registerId: z.string().min(1),
  })
  .strict();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const withoutClientAmount = (body: unknown): unknown => {
  if (!isRecord(body)) {
    return body;
  }

  const rest = { ...body };
  delete rest.amount;
  delete rest.amountCop;
  delete rest.price;

  return rest;
};

const readEnvelope = (
  rawBody: string,
): z.infer<typeof webhookEnvelope> | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const result = webhookEnvelope.safeParse(parsed);

  return result.success ? result.data : null;
};

@Controller()
export class QrPaymentController {
  constructor(
    @Inject(QrTableAccess)
    private readonly tables: QrTableAccess,
    @Inject(StartQrPayment)
    private readonly startPayment: StartQrPayment,
    @Inject(ConfirmQrPayment)
    private readonly confirmPayment: ConfirmQrPayment,
    @Inject(ApplyQrPayment)
    private readonly applyPayment: ApplyQrPayment,
    @Optional()
    @Inject(QrPaymentDesk)
    private readonly desk?: QrPaymentDesk,
  ) {}

  @Get(qrTableBalancePath)
  async readBalance(
    @Param("token") token: string,
  ): Promise<{ balanceCop: number }> {
    const table = await this.tables.resolve(token);

    if (table === null) {
      throw new NotFoundException({ error: "UnknownTable" });
    }

    return { balanceCop: table.balanceCop };
  }

  @Get("d/:token/stale")
  async listStale(
    @Param("token") token: string,
  ): Promise<readonly QrStalePayment[]> {
    const table = await this.requireTable(token);

    if (this.desk === undefined) {
      return [];
    }

    return this.desk.stale({
      tenantId: table.tenantId,
      venueId: table.venueId,
    });
  }

  @Get("d/:token/count")
  async readCount(@Param("token") token: string): Promise<QrCountReading> {
    const table = await this.requireTable(token);

    if (this.desk === undefined) {
      return { countedCashCop: 0, expectedCashCop: 0, qrCop: 0 };
    }

    return this.desk.count({
      tenantId: table.tenantId,
      venueId: table.venueId,
      registerId: table.registerId,
    });
  }

  @Post(qrTablePaymentPath)
  async start(@Param("token") token: string, @Body() body: unknown) {
    const parsed = startQrPaymentCommand.safeParse(withoutClientAmount(body));

    if (!parsed.success) {
      throw new BadRequestException({ error: "QrPaymentRejected" });
    }

    const table = await this.tables.resolve(token);

    if (table === null) {
      throw new NotFoundException({ error: "UnknownTable" });
    }

    const started = await this.startPayment.execute({
      tenantId: table.tenantId,
      venueId: table.venueId,
      checkId: table.checkId,
      tipCop: parsed.data.tipCop,
      partId: parsed.data.partId,
    });

    return {
      reference: started.payment.reference,
      amountCop: started.payment.amountCop,
      balanceCop: started.payment.balanceCop,
      tipCop: started.payment.tipCop,
      status: started.payment.status,
      redirectUrl: started.redirectUrl,
    };
  }

  @Post(qrPaymentWebhookPath)
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @rawRequestBody() rawBody: string,
    @Headers(boldSignatureHeader) signature: string | undefined,
  ): Promise<
    | { confirmed: false }
    | {
        confirmed: true;
        reference: string;
        status: string;
        occupied?: boolean;
        remaining?: readonly QrRemainingPart[];
      }
  > {
    const envelope = readEnvelope(rawBody);

    if (envelope === null) {
      return { confirmed: false };
    }

    const confirmed = await this.confirmPayment.execute({
      tenantId: envelope.tenantId,
      venueId: envelope.venueId,
      rawBody,
      signature: signature ?? "",
    });

    if (confirmed === null) {
      return { confirmed: false };
    }

    if (confirmed.status !== "confirmed") {
      return {
        confirmed: true,
        reference: confirmed.reference,
        status: confirmed.status,
      };
    }

    const applied = await this.applyPayment.execute({
      tenantId: envelope.tenantId,
      venueId: envelope.venueId,
      registerId: envelope.registerId,
      reference: confirmed.reference,
    });
    const remaining =
      this.desk === undefined
        ? []
        : await this.desk.remaining({
            tenantId: envelope.tenantId,
            venueId: envelope.venueId,
            checkId: confirmed.checkId,
          });

    return {
      confirmed: true,
      reference: applied.reference,
      status: applied.status,
      occupied: remaining.length > 0,
      remaining,
    };
  }

  private async requireTable(token: string): Promise<QrTableContext> {
    const table = await this.tables.resolve(token);

    if (table === null) {
      throw new NotFoundException({ error: "UnknownTable" });
    }

    return table;
  }
}
