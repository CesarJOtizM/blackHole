import {
  InvalidLineId,
  TableNotOpen,
} from "@blackhole/orders/application/entry-port";
import type { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { ConflictException } from "@nestjs/common";
import { z } from "zod";

export const voidCommand = z
  .object({
    reason: z.string(),
    shiftId: z.string(),
    authorizationId: z.string().nullable(),
  })
  .strict();

const voidResult = z
  .object({
    checkId: z.string(),
    lineIds: z.array(z.string()),
  })
  .strict();

interface ListedCheck {
  id: string;
  orders: readonly {
    lines: readonly { id: string }[];
  }[];
}

export const readText = (header: unknown): string | null => {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
};

export const authorizerOf = async (
  authorizations: AuthorizationRepository,
  tenantId: string,
  authorizationId: string | null,
): Promise<string | null> => {
  if (authorizationId === null) {
    return null;
  }

  const authorization = await authorizations.load(tenantId);
  const grant = authorization
    ?.snapshot()
    .resolutions.find(
      (resolution) =>
        resolution.requestId === authorizationId && resolution.approved,
    );

  return grant?.authorizerId ?? null;
};

export const presentVoid = (check: ListedCheck) =>
  voidResult.parse({
    checkId: check.id,
    lineIds: check.orders.flatMap((order) =>
      order.lines.map((line) => line.id),
    ),
  });

export const rejectionOf = (error: unknown): unknown => {
  if (error instanceof TableNotOpen || error instanceof InvalidLineId) {
    return new ConflictException({ error: error.name });
  }

  return error;
};
