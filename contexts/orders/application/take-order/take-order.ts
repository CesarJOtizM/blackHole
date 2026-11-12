import {
  type ConsumeAuthorization,
  type CountExecutedOperations,
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";

import type { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { MenuRepository } from "#application/ports/menu-repository.js";
import type { OpenShiftReader } from "#application/ports/open-shift-reader.js";
import type { Printer, PrintJobStatus } from "#application/ports/printer.js";
import type { RealtimeHub } from "#application/ports/realtime-hub.js";
import type { StationDirectory } from "#application/ports/station-directory.js";
import {
  type Check,
  ComboNotSent,
  EmptyOrder,
  InvalidLineId,
  TableNotOpen,
} from "#domain/check.js";
import { KitchenTicket } from "#domain/kitchen-ticket.js";
import type { Menu } from "#domain/menu.js";
import { MissingStation } from "#domain/station-router.js";

const BOGOTA_TIME_ZONE = "America/Bogota";
const LINE_KIND = {
  COMBO: "combo",
} as const;

export class ProductNotOrderable extends Error {
  constructor() {
    super("The product is outside its schedule.");
    this.name = "ProductNotOrderable";
  }
}

export interface TakeOrderLine {
  orderId: string;
  lineId: string;
  productId: string;
  name: string;
  course: number;
  channel: string;
  kind?: string;
  variantIds?: readonly string[];
  modifierIds?: readonly string[];
  note?: string;
}

export interface PrintedCheckEdit {
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  shiftId: string;
  reason: string;
  authorizationId: string | null;
}

export interface PrintedCheckGuard {
  shifts: OpenShiftReader;
  counts: CountExecutedOperations;
  permissions: EvaluatePermission;
  grants: ConsumeAuthorization;
  audits: RecordAuditEvent;
}

export interface TakeOrderInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  checkId: string;
  course: number;
  lines: readonly TakeOrderLine[];
  edit?: PrintedCheckEdit;
}

export interface ResendOrderInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  lineId: string;
}

export interface HoldOrderLineInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  checkId: string;
  line: TakeOrderLine;
  edit?: PrintedCheckEdit;
}

export interface FireCourseInput {
  tenantId: string;
  brandId: string;
  venueId: string;
  checkId: string;
  course: number;
}

interface RoutedTicket {
  commandId: string;
  stationId: string;
  stationName: string;
  lineId: string;
  productName: string;
  note?: string;
  screen: boolean;
  channel?: "qr_table";
}

const qrChannel = (channel: string | undefined): { channel?: "qr_table" } =>
  channel === "qr_table" ? { channel: "qr_table" } : {};

const orderChannel = (check: Check, lineId: string): string | undefined =>
  check.orders.find((order) => order.lines.some((line) => line.id === lineId))
    ?.channel;

const ALERTING_STATUS = new Set<PrintJobStatus>(["waiting", "failed"]);

const bogotaMinute = (instant: number): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  return `${hour}:${minute}`;
};

const isCombo = (line: TakeOrderLine, menu: Menu): boolean =>
  line.kind === LINE_KIND.COMBO ||
  menu.combos.some((combo) => combo.id === line.productId);

export class TakeOrder {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly menus: MenuRepository,
    private readonly stations: StationDirectory,
    private readonly printer: Printer,
    private readonly clock: Clock,
    private readonly hub: RealtimeHub,
    private readonly printedCheck?: PrintedCheckGuard,
  ) {}

  async execute(input: TakeOrderInput): Promise<Check> {
    const firing = input.lines.filter((line) => line.course === input.course);

    if (firing.length === 0) {
      throw new EmptyOrder();
    }

    const check = await this.diningRoom.loadCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (check === null) {
      throw new TableNotOpen();
    }

    const menu = await this.menus.load(input.tenantId, input.brandId);

    if (menu === null) {
      throw new ProductNotOrderable();
    }

    const view = menu.viewAt({
      venueId: check.venueId,
      minute: bogotaMinute(this.clock.now()),
    });
    const router = await this.stations.load(input.tenantId, check.venueId);
    const tickets: RoutedTicket[] = [];

    for (const line of firing) {
      if (isCombo(line, menu)) {
        throw new ComboNotSent();
      }

      const product = view.products.find((item) => item.id === line.productId);

      if (!product?.orderable) {
        throw new ProductNotOrderable();
      }

      if (router === null) {
        throw new MissingStation();
      }

      const destination = router.route({
        productId: line.productId,
        kind: line.kind,
      });

      if (destination.printer) {
        tickets.push({
          commandId: `kitchen_ticket:${check.id}:${line.lineId}`,
          stationId: destination.stationId,
          stationName: destination.stationName,
          lineId: line.lineId,
          productName: line.name,
          screen: destination.screen,
          ...(line.note === undefined ? {} : { note: line.note }),
          ...qrChannel(line.channel),
        });
      }
    }

    const sentAt = new Date(this.clock.now()).toISOString();
    const priced = input.lines.map((line) => ({
      line,
      price: menu.quote({
        venueId: check.venueId,
        productId: line.productId,
        modifierIds: [...(line.modifierIds ?? [])],
      }),
    }));
    const addedValue = priced.reduce((sum, item) => sum + item.price, 0);
    const accepted = await this.acceptPrintedCheckEdit(
      check,
      input.edit,
      addedValue,
    );

    if (!accepted) {
      return check;
    }

    for (const { line, price } of priced) {
      check.addLine({
        orderId: line.orderId,
        lineId: line.lineId,
        productId: line.productId,
        name: line.name,
        course: line.course,
        price,
        channel: line.channel,
        ...(line.kind === undefined ? {} : { kind: line.kind }),
        variantIds: [...(line.variantIds ?? [])],
        modifierIds: [...(line.modifierIds ?? [])],
        ...(line.note === undefined ? {} : { note: line.note }),
      });
    }

    check.send({ course: input.course, sentAt });
    await this.commit(
      check,
      firing.map((line) => line.lineId),
      tickets,
    );
    await this.auditPrintedCheckEdit(check, input.edit, addedValue);

    return check;
  }

  async resend(input: ResendOrderInput): Promise<Check> {
    const check = await this.diningRoom.loadCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (check === null) {
      throw new TableNotOpen();
    }

    const line = check.orders
      .flatMap((order) => order.lines)
      .find((item) => item.id === input.lineId);

    if (!line) {
      throw new InvalidLineId();
    }

    const router = await this.stations.load(input.tenantId, check.venueId);

    if (router === null) {
      throw new MissingStation();
    }

    const destination = router.route({ productId: line.productId });
    check.resend({ lineId: input.lineId });
    const tickets: RoutedTicket[] = destination.printer
      ? [
          {
            commandId: `kitchen_ticket:${check.id}:${line.id}:resend`,
            stationId: destination.stationId,
            stationName: destination.stationName,
            lineId: line.id,
            productName: line.name,
            screen: destination.screen,
            ...(line.note === undefined ? {} : { note: line.note }),
            ...qrChannel(orderChannel(check, line.id)),
          },
        ]
      : [];

    await this.commit(check, [line.id], tickets);

    return check;
  }

  async hold(input: HoldOrderLineInput): Promise<Check> {
    const check = await this.loadCheck(input);
    const menu = await this.loadMenu(input.tenantId, input.brandId);
    const view = menu.viewAt({
      venueId: check.venueId,
      minute: bogotaMinute(this.clock.now()),
    });
    const line = input.line;
    const product = view.products.find((item) => item.id === line.productId);

    if (!product?.orderable) {
      throw new ProductNotOrderable();
    }

    const price = menu.quote({
      venueId: check.venueId,
      productId: line.productId,
      modifierIds: [...(line.modifierIds ?? [])],
    });
    const accepted = await this.acceptPrintedCheckEdit(
      check,
      input.edit,
      price,
    );

    if (!accepted) {
      return check;
    }

    check.addLine({
      orderId: line.orderId,
      lineId: line.lineId,
      productId: line.productId,
      name: line.name,
      course: line.course,
      price,
      channel: line.channel,
      ...(line.kind === undefined ? {} : { kind: line.kind }),
      variantIds: [...(line.variantIds ?? [])],
      modifierIds: [...(line.modifierIds ?? [])],
      ...(line.note === undefined ? {} : { note: line.note }),
    });
    await this.diningRoom.saveCheck(check);
    await this.auditPrintedCheckEdit(check, input.edit, price);

    return check;
  }

  async fire(input: FireCourseInput): Promise<Check> {
    const check = await this.loadCheck(input);
    const menu = await this.loadMenu(input.tenantId, input.brandId);
    const view = menu.viewAt({
      venueId: check.venueId,
      minute: bogotaMinute(this.clock.now()),
    });
    const held = check.orders
      .flatMap((order) => order.lines)
      .filter((line) => line.course === input.course && line.state === "held");

    if (held.length === 0) {
      throw new EmptyOrder();
    }

    const router = await this.stations.load(input.tenantId, check.venueId);
    const tickets: RoutedTicket[] = [];

    for (const line of held) {
      if (view.combos.some((combo) => combo.id === line.productId)) {
        throw new ComboNotSent();
      }

      const product = view.products.find((item) => item.id === line.productId);

      if (!product?.orderable) {
        throw new ProductNotOrderable();
      }

      if (router === null) {
        throw new MissingStation();
      }

      const destination = router.route({ productId: line.productId });

      if (destination.printer) {
        tickets.push({
          commandId: `kitchen_ticket:${check.id}:${line.id}`,
          stationId: destination.stationId,
          stationName: destination.stationName,
          lineId: line.id,
          productName: line.name,
          screen: destination.screen,
          ...(line.note === undefined ? {} : { note: line.note }),
          ...qrChannel(orderChannel(check, line.id)),
        });
      }
    }

    const sentAt = new Date(this.clock.now()).toISOString();

    check.send({ course: input.course, sentAt });
    await this.commit(
      check,
      held.map((line) => line.id),
      tickets,
    );

    return check;
  }

  private async loadCheck(input: {
    tenantId: string;
    venueId: string;
    checkId: string;
  }): Promise<Check> {
    const check = await this.diningRoom.loadCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (check === null) {
      throw new TableNotOpen();
    }

    return check;
  }

  private async loadMenu(tenantId: string, brandId: string): Promise<Menu> {
    const menu = await this.menus.load(tenantId, brandId);

    if (menu === null) {
      throw new ProductNotOrderable();
    }

    return menu;
  }

  private async commit(
    check: Check,
    lineIds: readonly string[],
    tickets: readonly RoutedTicket[],
  ): Promise<void> {
    await this.diningRoom.saveCheck(check);
    await this.hub.publish({
      kind: "ids",
      tenantId: check.tenantId,
      venueId: check.venueId,
      checkId: check.id,
      tableId: check.tableId,
      lineIds: [...lineIds],
    });

    for (const ticket of tickets) {
      await this.printTicket(check, ticket);
    }
  }

  private async printTicket(check: Check, ticket: RoutedTicket): Promise<void> {
    const rendered = KitchenTicket.render({
      stationName: ticket.stationName,
      tableId: check.tableId,
      productName: ticket.productName,
      ...(ticket.note === undefined ? {} : { note: ticket.note }),
      ...(ticket.channel === undefined ? {} : { channel: ticket.channel }),
    });
    const queued = await this.printer.enqueue({
      document: "kitchen_ticket",
      commandId: ticket.commandId,
      stationId: ticket.stationId,
      station: ticket.stationName,
      table: check.tableId,
      lines: [
        {
          quantity: "1",
          name: ticket.productName,
          ...(ticket.note === undefined ? {} : { note: ticket.note }),
        },
      ],
      kickDrawer: false,
      ...(ticket.channel === undefined ? {} : { channel: ticket.channel }),
    });

    if (!ALERTING_STATUS.has(queued.status)) {
      return;
    }

    await this.hub.publish({
      kind: "printer_failed",
      tenantId: check.tenantId,
      venueId: check.venueId,
      checkId: check.id,
      tableId: check.tableId,
      lineId: ticket.lineId,
      stationId: ticket.stationId,
      ...(ticket.screen ? {} : { text: rendered.text }),
    });
  }

  private async acceptPrintedCheckEdit(
    check: Check,
    edit: PrintedCheckEdit | undefined,
    value: number,
  ): Promise<boolean> {
    if (check.preBillRequest === undefined) {
      return true;
    }

    const guard = this.printedCheck;

    if (guard === undefined || edit === undefined) {
      return false;
    }

    const open = await guard.shifts.isOpen({
      tenantId: check.tenantId,
      venueId: check.venueId,
      shiftId: edit.shiftId,
    });

    if (!open) {
      return false;
    }

    const shiftTotals = await guard.counts.execute({
      tenantId: check.tenantId,
      actorId: edit.actorId,
      shiftId: edit.shiftId,
    });
    const decision = await guard.permissions.execute({
      tenantId: check.tenantId,
      sessionId: edit.sessionId,
      permission: PERMISSION.SALE_EDIT_PRINTED_CHECK,
      target: { kind: "site", id: check.venueId, brandId: null },
      value,
      supportGrantId: null,
      shiftTotals,
    });

    if (decision.outcome === "denied") {
      return false;
    }

    if (decision.outcome === "requires_authorization") {
      return this.consumePrintedCheckGrant(guard, check, edit, value);
    }

    return decision.outcome === "allowed";
  }

  private async consumePrintedCheckGrant(
    guard: PrintedCheckGuard,
    check: Check,
    edit: PrintedCheckEdit,
    value: number,
  ): Promise<boolean> {
    if (edit.authorizationId === null) {
      return false;
    }

    try {
      return await guard.grants.execute({
        tenantId: check.tenantId,
        authorizationId: edit.authorizationId,
        permission: PERMISSION.SALE_EDIT_PRINTED_CHECK,
        targetId: check.id,
        value,
      });
    } catch (error: unknown) {
      if (error instanceof UnknownAuthorizationReference) {
        return false;
      }

      throw error;
    }
  }

  private async auditPrintedCheckEdit(
    check: Check,
    edit: PrintedCheckEdit | undefined,
    value: number,
  ): Promise<void> {
    const guard = this.printedCheck;

    if (
      check.preBillRequest === undefined ||
      edit === undefined ||
      guard === undefined
    ) {
      return;
    }

    await guard.audits.execute({
      tenantId: check.tenantId,
      actorId: edit.actorId,
      authorizerId: edit.authorizerId,
      deviceId: edit.deviceId,
      siteId: check.venueId,
      action: PERMISSION.SALE_EDIT_PRINTED_CHECK,
      entity: check.id,
      before: { value: 0 },
      after: {
        value,
        shiftId: edit.shiftId,
        kitchen: null,
      },
      reason: edit.reason,
    });
  }
}
