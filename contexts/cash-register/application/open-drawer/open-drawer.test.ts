import {
  AuthorizationAlreadyConsumed,
  ConsumeAuthorization,
  type ConsumeAuthorizationInput,
  CountExecutedOperations,
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import { OpenDrawer } from "#application/open-drawer/open-drawer.js";
import { Printer, type SaleReceiptJob } from "#application/ports/printer.js";
import {
  type KnownRegister,
  REGISTER_DRAWER,
  type RegisterDrawer,
  RegisterLookup,
} from "#application/ports/register-lookup.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const PRINTER_ID = "printer_front";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const SHIFT_ID = "shift_1";
const COMMAND_ID = "command_open_drawer";
const REQUEST_ID = "request_drawer";
const REASON = "Change fund";
const OPENING = 1;
const COUNTED = { waiterVoidsBeforeKitchen: 0, compShiftCop: 0 };
const DRAWER_OPENED = "cash.drawer-opened";
const blank = {} as never;

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type GrantMode = "match" | "consumed" | "unknown";

interface RegisterProfile {
  drawer: RegisterDrawer;
  printerId: string | null;
}

interface StoredGrant {
  authorizationId: string;
  targetId: string;
  value: number | null;
}

interface Scene {
  title: string;
  profile?: RegisterProfile | null;
  decision?: Decision;
  grant?: StoredGrant | null;
  authorizationId?: string | null;
  mode?: GrantMode;
  steps: string[];
}

const present: RegisterProfile = {
  drawer: REGISTER_DRAWER.PRESENT,
  printerId: PRINTER_ID,
};
const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });
const needsGrant = (): Decision => ({
  outcome: "requires_authorization",
  exceededLimit: null,
  selfAuthorized: false,
});
const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });
const matchingGrant: StoredGrant = {
  authorizationId: REQUEST_ID,
  targetId: REGISTER_ID,
  value: OPENING,
};
const consumeCall = (): ConsumeAuthorizationInput => ({
  tenantId: TENANT_ID,
  authorizationId: REQUEST_ID,
  permission: PERMISSION.CASH_OPEN_DRAWER,
  targetId: REGISTER_ID,
  value: OPENING,
});

class MemoryRegisters extends RegisterLookup {
  constructor(private readonly profile: RegisterProfile | null) {
    super();
  }

  override find(): Promise<KnownRegister | null> {
    return Promise.resolve(
      this.profile === null
        ? null
        : {
            id: REGISTER_ID,
            venueId: VENUE_ID,
            drawer: this.profile.drawer,
            printerId: this.profile.printerId,
          },
    );
  }
}

class MemoryPrinter extends Printer {
  readonly jobs: SaleReceiptJob[] = [];

  constructor(private readonly steps: string[]) {
    super();
  }

  override enqueue(job: SaleReceiptJob) {
    this.steps.push("enqueue");
    this.jobs.push(job);
    return Promise.resolve({
      status: "waiting" as const,
      kickDrawer: job.kickDrawer,
    });
  }
}

class FixedCounts extends CountExecutedOperations {
  constructor(private readonly steps: string[]) {
    super(blank);
  }

  override execute() {
    this.steps.push("count");
    return Promise.resolve(COUNTED);
  }
}

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: Parameters<EvaluatePermission["execute"]>[0][] = [];

  constructor(
    private readonly steps: string[],
    private readonly decision: Decision,
  ) {
    super(blank, blank, blank, blank);
  }

  override execute(input: (typeof this.inputs)[number]) {
    this.steps.push("evaluate");
    this.inputs.push(input);
    return Promise.resolve(this.decision);
  }
}

class MemoryGrant extends ConsumeAuthorization {
  readonly calls: ConsumeAuthorizationInput[] = [];

  constructor(
    private readonly steps: string[],
    private readonly grant: StoredGrant | null,
    private readonly mode: GrantMode,
  ) {
    super(blank, blank);
  }

  override execute(input: ConsumeAuthorizationInput) {
    this.steps.push("consume");
    this.calls.push(input);
    if (this.mode === "consumed") {
      throw new AuthorizationAlreadyConsumed();
    }
    if (this.mode === "unknown") {
      throw new UnknownAuthorizationReference();
    }
    return Promise.resolve(
      this.grant !== null &&
        input.authorizationId === this.grant.authorizationId &&
        input.permission === PERMISSION.CASH_OPEN_DRAWER &&
        input.targetId === this.grant.targetId &&
        input.value === this.grant.value,
    );
  }
}

class RecordingAudit extends RecordAuditEvent {
  readonly commands: AuditCommand[] = [];

  constructor(private readonly steps: string[]) {
    super(blank, blank, blank);
  }

  override execute(command: AuditCommand) {
    this.steps.push("audit");
    this.commands.push(command);
    return Promise.resolve(blank);
  }
}

const command = (
  authorizationId: string | null,
  authorizerId: string | null = null,
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  actorId: CASHIER_ID,
  authorizerId,
  sessionId: "session_cashier",
  deviceId: "device_register",
  shiftId: SHIFT_ID,
  reason: REASON,
  commandId: COMMAND_ID,
  authorizationId,
});

const harness = (scene: Partial<Scene> = {}) => {
  const steps: string[] = [];
  const printer = new MemoryPrinter(steps);
  const permissions = new ScriptedPermission(
    steps,
    scene.decision ?? needsGrant(),
  );
  const grants = new MemoryGrant(
    steps,
    scene.grant === undefined ? matchingGrant : scene.grant,
    scene.mode ?? "match",
  );
  const audits = new RecordingAudit(steps);
  return {
    steps,
    printer,
    permissions,
    grants,
    audits,
    openDrawer: new OpenDrawer(
      new MemoryRegisters(
        scene.profile === undefined ? present : scene.profile,
      ),
      new FixedCounts(steps),
      permissions,
      grants,
      audits,
      printer,
    ),
  };
};

const drawerJob = {
  commandId: COMMAND_ID,
  printerId: PRINTER_ID,
  document: "drawer_open" as const,
  kickDrawer: true as const,
};

const openedAudit = (authorizerId: string | null): AuditCommand => ({
  tenantId: TENANT_ID,
  actorId: CASHIER_ID,
  authorizerId,
  deviceId: "device_register",
  siteId: VENUE_ID,
  action: DRAWER_OPENED,
  entity: REGISTER_ID,
  before: { value: 0 },
  after: { value: OPENING, shiftId: SHIFT_ID, kitchen: null },
  reason: REASON,
});

const refusals: Scene[] = [
  {
    title:
      "given no cash drawer, when the cashier asks to open it, then no drawer command is sent",
    profile: { drawer: REGISTER_DRAWER.ABSENT, printerId: PRINTER_ID },
    steps: [],
  },
  {
    title:
      "given a missing register, when the cashier asks to open the drawer, then no drawer command is sent",
    profile: null,
    steps: [],
  },
  {
    title:
      "given a present drawer and no printer, when the cashier asks to open it, then nothing is enqueued",
    profile: { drawer: REGISTER_DRAWER.PRESENT, printerId: null },
    steps: [],
  },
  {
    title:
      "given the cashier is denied cash.open-drawer, when she asks to open the drawer, then no job is sent",
    decision: denied(),
    steps: ["count", "evaluate"],
  },
  {
    title:
      "given no authorization, when the cashier requests an opening, then no drawer command is sent",
    grant: null,
    authorizationId: null,
    steps: ["count", "evaluate"],
  },
  {
    title:
      "given a grant for another register, when the cashier opens this drawer, then the drawer stays closed",
    grant: {
      authorizationId: REQUEST_ID,
      targetId: "organization_register_other",
      value: OPENING,
    },
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given an unknown authorization reference, when the cashier opens the drawer, then the drawer stays closed",
    mode: "unknown",
    steps: ["count", "evaluate", "consume"],
  },
];

it("given a supervisor grant for this register, when the cashier opens the drawer without a sale, then one drawer_open job kicks the drawer and cash.drawer-opened is audited once", async () => {
  const scene = harness();
  await scene.openDrawer.execute(command(REQUEST_ID, SUPERVISOR_ID));
  expect(scene.printer.jobs).toEqual([drawerJob]);
  expect(scene.audits.commands).toEqual([openedAudit(SUPERVISOR_ID)]);
  expect(scene.grants.calls).toEqual([consumeCall()]);
  expect(scene.permissions.inputs[0]).toMatchObject({
    permission: PERMISSION.CASH_OPEN_DRAWER,
    value: OPENING,
    shiftTotals: COUNTED,
    supportGrantId: null,
    target: { kind: "site", id: VENUE_ID, brandId: null },
  });
  expect(scene.steps).toEqual([
    "count",
    "evaluate",
    "consume",
    "enqueue",
    "audit",
  ]);
});

it("given cash.open-drawer is allowed, when the cashier opens the drawer, then the job is audited and the grant is not consumed", async () => {
  const scene = harness({ decision: allowed() });
  await scene.openDrawer.execute(command(REQUEST_ID));
  expect(scene.printer.jobs).toEqual([drawerJob]);
  expect(scene.audits.commands).toEqual([openedAudit(null)]);
  expect(scene.grants.calls).toEqual([]);
  expect(scene.steps).toEqual(["count", "evaluate", "enqueue", "audit"]);
});

it.each(refusals)("$title", async (refusal) => {
  const scene = harness(refusal);
  await scene.openDrawer.execute(
    command(
      refusal.authorizationId === undefined
        ? REQUEST_ID
        : refusal.authorizationId,
    ),
  );
  expect(scene.printer.jobs).toEqual([]);
  expect(scene.audits.commands).toEqual([]);
  expect(scene.grants.calls).toEqual(
    refusal.steps.includes("consume") ? [consumeCall()] : [],
  );
  expect(scene.steps).toEqual(refusal.steps);
});

it("given an already consumed grant, when the cashier opens the drawer, then AuthorizationAlreadyConsumed is rethrown and nothing is queued", async () => {
  const scene = harness({ mode: "consumed" });
  await expect(
    scene.openDrawer.execute(command(REQUEST_ID, SUPERVISOR_ID)),
  ).rejects.toBeInstanceOf(AuthorizationAlreadyConsumed);
  expect(scene.printer.jobs).toEqual([]);
  expect(scene.audits.commands).toEqual([]);
  expect(scene.steps).toEqual(["count", "evaluate", "consume"]);
});
