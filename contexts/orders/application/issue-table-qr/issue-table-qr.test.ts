import {
  EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import { InMemoryTableQrRepository } from "#adapters/memory/in-memory-table-qr-repository.js";
import {
  IssueTableQr,
  TableQrReprintRefused,
} from "#application/issue-table-qr/issue-table-qr.js";
import { TableQrToken } from "#domain/table-qr-token.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const SESSION_ID = "session_cashier";
const FIRST_NONCE = "table-qr-nonce-0001";
const NEXT_NONCE = "table-qr-nonce-0002";

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type PermissionInput = Parameters<EvaluatePermission["execute"]>[0];

const blank = {} as never;

const allowed = (): Decision => ({
  outcome: "allowed",
  selfAuthorized: false,
});

const denied = (): Decision => ({
  outcome: "denied",
  selfAuthorized: false,
});

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: PermissionInput[] = [];

  constructor(private readonly decision: Decision) {
    super(blank, blank, blank, blank);
  }

  override async execute(input: PermissionInput) {
    this.inputs.push(input);
    return this.decision;
  }
}

const command = (nonce: string) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  tableId: TABLE_ID,
  nonce,
  sessionId: SESSION_ID,
});

it("given sale.reprint, when the table QR is issued again, then the digest rotates and the previous one is retired", async () => {
  const tokens = new InMemoryTableQrRepository();
  const permissions = new ScriptedPermission(allowed());
  const issue = new IssueTableQr(tokens, permissions);

  const first = await issue.execute(command(FIRST_NONCE));
  const second = await issue.execute(command(NEXT_NONCE));

  expect(permissions.inputs.map((input) => input.permission)).toEqual([
    PERMISSION.SALE_REPRINT,
    PERMISSION.SALE_REPRINT,
  ]);
  expect(second.digest).not.toBe(first.digest);
  expect(second.path.startsWith("/m/")).toBe(true);
  expect(second.path).not.toContain("/f/");
  expect((await tokens.findByDigest(first.digest))?.retired).toBe(true);
  expect((await tokens.findByDigest(second.digest))?.retired).toBe(false);
  expect(await tokens.findByDigest(second.digest)).toMatchObject({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });
});

it("given sale.reprint is denied, when a reprint is requested, then the active digest stays", async () => {
  const tokens = new InMemoryTableQrRepository();
  const firstIssue = new IssueTableQr(
    tokens,
    new ScriptedPermission(allowed()),
  );
  const first = await firstIssue.execute(command(FIRST_NONCE));
  const refused = new IssueTableQr(tokens, new ScriptedPermission(denied()));

  await expect(refused.execute(command(NEXT_NONCE))).rejects.toThrow(
    TableQrReprintRefused,
  );

  expect((await tokens.findByDigest(first.digest))?.retired).toBe(false);
  expect(await tokens.findByDigest(TableQrToken.digest(NEXT_NONCE))).toBeNull();
});
