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

import { ChangePrice } from "#application/change-price/change-price.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { OpenShiftReader } from "#application/ports/open-shift-reader.js";
import { Check } from "#domain/check.js";
import { Menu } from "#domain/menu.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "check_a";
const ADMIN_ID = "user_admin";
const SUPERVISOR_ID = "user_supervisor";
const SHIFT_ID = "shift_1";
const REQUEST_ID = "request_price";
const REASON = "Authorized price";
const LINE_SOUP = "line_soup";
const LINE_SALAD = "line_salad";
const SOUP_ID = "menu_product_soup";
const SALAD_ID = "menu_product_salad";
const SITE_PRICE = 12_000;
const SALAD_PRICE = 8_000;
const NEW_PRICE = 9_000;
const OTHER_PRICE = 7_000;
const COUNTED = { waiterVoidsBeforeKitchen: 0, compShiftCop: 90_000 };
const SHIFT_QUERY = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  shiftId: SHIFT_ID,
};

type Decision = Awaited<ReturnType<EvaluatePermission["execute"]>>;
type AuditCommand = Parameters<RecordAuditEvent["execute"]>[0];
type GrantMode = "match" | "consumed" | "unknown";

interface StoredGrant {
  authorizationId: string;
  targetId: string;
  value: number | null;
}

const blank = {} as never;

const allowed = (): Decision => ({ outcome: "allowed", selfAuthorized: false });

const needsGrant = (): Decision => ({
  outcome: "requires_authorization",
  exceededLimit: null,
  selfAuthorized: false,
});

const denied = (): Decision => ({ outcome: "denied", selfAuthorized: false });

const linePrices = (check: Check | null): number[] =>
  check?.orders.flatMap((order) => order.lines.map((line) => line.price)) ?? [];

const sitePrices = (menu: Menu): number[] => [
  menu.quote({ venueId: VENUE_ID, productId: SOUP_ID, modifierIds: [] }),
  menu.quote({ venueId: VENUE_ID, productId: SALAD_ID, modifierIds: [] }),
];

class MemoryDiningRoom extends DiningRoomRepository {
  readonly savedIds: string[] = [];
  private readonly checks = new Map<string, Check>();

  constructor(private readonly steps: string[]) {
    super();
  }

  override load() {
    return Promise.resolve(null);
  }

  override save() {
    return Promise.resolve();
  }

  override loadCheck(tenantId: string, venueId: string, checkId: string) {
    return Promise.resolve(
      this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null,
    );
  }

  override saveCheck(check: Check) {
    this.steps.push("save");
    this.savedIds.push(check.id);
    this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
    return Promise.resolve();
  }

  override async saveChecks(checks: readonly Check[]) {
    for (const check of checks) {
      await this.saveCheck(check);
    }
  }
}

class MemoryShift extends OpenShiftReader {
  readonly queries: (typeof SHIFT_QUERY)[] = [];

  constructor(private readonly open: boolean) {
    super();
  }

  override isOpen(query: typeof SHIFT_QUERY) {
    this.queries.push(query);
    return Promise.resolve(this.open);
  }
}

class FixedCounts extends CountExecutedOperations {
  readonly queries: { tenantId: string; actorId: string; shiftId: string }[] =
    [];

  constructor(private readonly steps: string[]) {
    super(blank);
  }

  override execute(query: (typeof this.queries)[number]) {
    this.steps.push("count");
    this.queries.push(query);
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
        input.permission === PERMISSION.SALE_CHANGE_PRICE &&
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
  authorizationId: string | null = null,
  authorizerId: string | null = null,
  price = NEW_PRICE,
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  lineId: LINE_SOUP,
  actorId: ADMIN_ID,
  authorizerId,
  sessionId: "session_admin",
  deviceId: "device_register",
  shiftId: SHIFT_ID,
  reason: REASON,
  price,
  authorizationId,
});

const openAccount = (): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: "table_5",
    openedAt: "2026-10-28T12:00:00.000Z",
  });
  check.addLine({
    orderId: "order_1",
    lineId: LINE_SOUP,
    productId: SOUP_ID,
    name: "Soup",
    course: 1,
    price: SITE_PRICE,
    channel: "waiter",
  });
  check.addLine({
    orderId: "order_1",
    lineId: LINE_SALAD,
    productId: SALAD_ID,
    name: "Salad",
    course: 1,
    price: SALAD_PRICE,
    channel: "waiter",
  });
  return check;
};

const siteMenu = (): Menu => {
  const menu = Menu.open({
    id: "menu_house",
    tenantId: TENANT_ID,
    brandId: "menu_brand_1",
  });
  menu.publishProduct({
    id: SOUP_ID,
    name: "Soup",
    price: SITE_PRICE,
    taxClassification: "prepared_food",
  });
  menu.publishProduct({
    id: SALAD_ID,
    name: "Salad",
    price: SALAD_PRICE,
    taxClassification: "prepared_food",
  });
  menu.setVenuePrice({
    venueId: VENUE_ID,
    itemId: SOUP_ID,
    price: SITE_PRICE,
    available: true,
  });
  menu.setVenuePrice({
    venueId: VENUE_ID,
    itemId: SALAD_ID,
    price: SALAD_PRICE,
    available: true,
  });
  return menu;
};

const matchingGrant = {
  authorizationId: REQUEST_ID,
  targetId: LINE_SOUP,
  value: NEW_PRICE,
};

const consumeCall = (price: number): ConsumeAuthorizationInput => ({
  tenantId: TENANT_ID,
  authorizationId: REQUEST_ID,
  permission: PERMISSION.SALE_CHANGE_PRICE,
  targetId: LINE_SOUP,
  value: price,
});

const harness = async (options: {
  decision: Decision;
  open: boolean;
  grant: StoredGrant | null;
  mode?: GrantMode;
}) => {
  const steps: string[] = [];
  const dining = new MemoryDiningRoom(steps);
  const shifts = new MemoryShift(options.open);
  const counts = new FixedCounts(steps);
  const permissions = new ScriptedPermission(steps, options.decision);
  const grants = new MemoryGrant(steps, options.grant, options.mode ?? "match");
  const audits = new RecordingAudit(steps);
  const menu = siteMenu();
  await dining.saveCheck(openAccount());
  steps.length = 0;
  dining.savedIds.length = 0;

  return {
    steps,
    dining,
    shifts,
    counts,
    permissions,
    grants,
    audits,
    menu,
    changePrice: new ChangePrice(
      dining,
      shifts,
      counts,
      permissions,
      grants,
      audits,
    ),
  };
};

const expectMenuStays = (menu: Menu) => {
  expect(sitePrices(menu)).toEqual([SITE_PRICE, SALAD_PRICE]);
  expect(menu.products.map((product) => product.price)).toEqual([
    SITE_PRICE,
    SALAD_PRICE,
  ]);
  expect(menu.venuePrices.map((price) => price.price)).toEqual([
    SITE_PRICE,
    SALAD_PRICE,
  ]);
};

const expectUnchanged = async (
  dining: MemoryDiningRoom,
  audits: RecordingAudit,
  menu: Menu,
) => {
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(linePrices(stored)).toEqual([SITE_PRICE, SALAD_PRICE]);
  expect(dining.savedIds).toEqual([]);
  expect(audits.commands).toEqual([]);
  expectMenuStays(menu);
};

it("given a price change without a grant, when authorization is required, then the line and the site price stay", async () => {
  const {
    dining,
    steps,
    counts,
    permissions,
    grants,
    audits,
    menu,
    changePrice,
  } = await harness({ decision: needsGrant(), open: true, grant: null });

  await changePrice.execute(command());

  await expectUnchanged(dining, audits, menu);
  expect(command()).not.toHaveProperty("shiftTotals");
  expect(counts.queries).toEqual([
    { tenantId: TENANT_ID, actorId: ADMIN_ID, shiftId: SHIFT_ID },
  ]);
  expect(permissions.inputs[0]).toMatchObject({
    permission: PERMISSION.SALE_CHANGE_PRICE,
    value: NEW_PRICE,
    shiftTotals: COUNTED,
    supportGrantId: null,
    target: { kind: "site", id: VENUE_ID, brandId: null },
  });
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate"]);
});

it("given an authorized price change on a line, when applied, then only that line changes and the site price stays", async () => {
  const { dining, steps, grants, audits, menu, changePrice } = await harness({
    decision: needsGrant(),
    open: true,
    grant: matchingGrant,
  });

  const result = await changePrice.execute(command(REQUEST_ID, SUPERVISOR_ID));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(result.id).toBe(CHECK_ID);
  expect(linePrices(result)).toEqual([NEW_PRICE, SALAD_PRICE]);
  expect(linePrices(stored)).toEqual([NEW_PRICE, SALAD_PRICE]);
  expect(stored?.orders[0]?.lines.map((line) => line.productId)).toEqual([
    SOUP_ID,
    SALAD_ID,
  ]);
  expect(dining.savedIds).toEqual([CHECK_ID]);
  expectMenuStays(menu);
  expect(grants.calls).toEqual([consumeCall(NEW_PRICE)]);
  expect(steps).toEqual(["count", "evaluate", "consume", "save", "audit"]);
  expect(audits.commands[0]).toMatchObject({
    actorId: ADMIN_ID,
    authorizerId: SUPERVISOR_ID,
    deviceId: "device_register",
    siteId: VENUE_ID,
    action: PERMISSION.SALE_CHANGE_PRICE,
    entity: LINE_SOUP,
    reason: REASON,
    before: { value: SITE_PRICE },
    after: { value: NEW_PRICE, shiftId: SHIFT_ID, kitchen: null },
  });
});

it("given a price change the role may make, when no grant is required, then the line is saved and the grant is not consumed", async () => {
  const { dining, steps, grants, audits, menu, changePrice } = await harness({
    decision: allowed(),
    open: true,
    grant: null,
  });

  await changePrice.execute(command());

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(linePrices(stored)).toEqual([NEW_PRICE, SALAD_PRICE]);
  expect(dining.savedIds).toEqual([CHECK_ID]);
  expectMenuStays(menu);
  expect(grants.calls).toEqual([]);
  expect(steps).toEqual(["count", "evaluate", "save", "audit"]);
  expect(audits.commands[0]?.after).toEqual({
    value: NEW_PRICE,
    shiftId: SHIFT_ID,
    kitchen: null,
  });
});

it.each([
  {
    title:
      "given an approved price of 9000 on the soup line, when the admin applies 7000, then the line stays",
    price: OTHER_PRICE,
    grant: matchingGrant,
    calls: [consumeCall(OTHER_PRICE)],
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given an approved price for another line, when the admin changes the soup line, then the soup price stays",
    grant: {
      authorizationId: REQUEST_ID,
      targetId: "line_other",
      value: NEW_PRICE,
    },
    calls: [consumeCall(NEW_PRICE)],
    steps: ["count", "evaluate", "consume"],
  },
  {
    title:
      "given the admin is denied a price change, when she applies 9000, then the line stays",
    decision: denied(),
    calls: [],
    steps: ["count", "evaluate"],
  },
  {
    title:
      "given a closed shift, when the admin applies a matching price change, then the line stays",
    open: false,
    calls: [],
    steps: [],
  },
  {
    title:
      "given a matching grant that was already consumed, when the admin changes the price, then the error is raised and the line stays",
    mode: "consumed" as const,
    calls: [consumeCall(NEW_PRICE)],
    steps: ["count", "evaluate", "consume"],
    thrown: true,
  },
  {
    title:
      "given an unknown authorization reference, when the admin changes the price, then the line stays",
    mode: "unknown" as const,
    calls: [consumeCall(NEW_PRICE)],
    steps: ["count", "evaluate", "consume"],
  },
])("$title", async (row) => {
  const { dining, steps, shifts, grants, audits, menu, changePrice } =
    await harness({
      decision: row.decision ?? needsGrant(),
      open: row.open ?? true,
      grant: row.grant === undefined ? matchingGrant : row.grant,
      mode: row.mode,
    });
  const run = changePrice.execute(
    command(REQUEST_ID, SUPERVISOR_ID, row.price ?? NEW_PRICE),
  );

  if (row.thrown) {
    await expect(run).rejects.toThrow(AuthorizationAlreadyConsumed);
  } else {
    await run;
  }

  await expectUnchanged(dining, audits, menu);
  expect(grants.calls).toEqual(row.calls);
  expect(steps).toEqual(row.steps);
  if (row.open === false) {
    expect(shifts.queries).toEqual([SHIFT_QUERY]);
  }
});
