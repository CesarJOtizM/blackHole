import type { TableState } from "#domain/dining-table.js";

const CHECK_ID_PREFIX = "check_";
const ORDER_ID_PREFIX = "order_";
const LINE_ID_PREFIX = "line_";

const LINE_STATE = {
  HELD: "held",
  SENT: "sent",
  IN_PREPARATION: "in_preparation",
  READY: "ready",
  DELIVERED: "delivered",
} as const;

export type LineState = (typeof LINE_STATE)[keyof typeof LINE_STATE];

const LINE_RANK: Record<LineState, number> = {
  held: 0,
  sent: 1,
  in_preparation: 2,
  ready: 3,
  delivered: 4,
};

const ORDER_CHANNEL = {
  WAITER: "waiter",
  FIXED_POINT: "fixed_point",
} as const;

export type OrderChannel = (typeof ORDER_CHANNEL)[keyof typeof ORDER_CHANNEL];

const LINE_KIND = {
  PRODUCT: "product",
  COMBO: "combo",
} as const;

type LineKind = (typeof LINE_KIND)[keyof typeof LINE_KIND];

interface OpenCheck {
  id: string;
  tenantId: string;
  venueId: string;
  tableId: string;
  openedAt: string;
}

interface AddLine {
  orderId: string;
  lineId: string;
  productId: string;
  name: string;
  course: number;
  price: number;
  channel: string;
  kind?: string;
  variantIds?: readonly string[];
  modifierIds?: readonly string[];
  note?: string;
}

interface ChangeLinePrice {
  lineId: string;
  price: number;
}

interface SendCourse {
  course: number;
  sentAt: string;
}

interface ResendLine {
  lineId: string;
}

interface AdvanceLine {
  lineId: string;
  state: LineState;
  at: string;
}

interface JoinCheck {
  source: Check;
  sourceState: TableState;
  targetState: TableState;
}

interface TransferLines {
  source: Check;
  lineIds: readonly string[];
  sourceState: TableState;
  targetState: TableState;
}

interface StoredLine {
  id: string;
  productId: string;
  name: string;
  course: number;
  price: number;
  state: LineState;
  kind: LineKind;
  originTableId: string;
  variantIds: readonly string[];
  modifierIds: readonly string[];
  note?: string;
  sentAt?: string;
  inPreparationAt?: string;
  readyAt?: string;
  deliveredAt?: string;
}

interface StoredOrder {
  id: string;
  channel: OrderChannel;
  lines: StoredLine[];
}

interface ListedLine {
  id: string;
  productId: string;
  name: string;
  course: number;
  price: number;
  state: LineState;
  originTableId: string;
  variantIds?: readonly string[];
  modifierIds?: readonly string[];
  note?: string;
  sentAt?: string;
  inPreparationAt?: string;
  readyAt?: string;
  deliveredAt?: string;
}

interface ListedOrder {
  id: string;
  channel: OrderChannel;
  lines: ListedLine[];
}

interface ReadyNotice {
  tableId: string;
  lineId: string;
  at: string;
}

interface RequestCheckStamp {
  requestedAt: string;
}

export interface PreBillRequest {
  requestedAt: string;
}

interface LocatedLine {
  orderId: string;
  channel: OrderChannel;
  line: StoredLine;
}

export class InvalidCheckId extends Error {
  constructor() {
    super("A check identifier must use the check_ prefix.");
    this.name = "InvalidCheckId";
  }
}

export class InvalidOrderId extends Error {
  constructor() {
    super("An order identifier must use the order_ prefix.");
    this.name = "InvalidOrderId";
  }
}

export class InvalidLineId extends Error {
  constructor() {
    super("A line identifier must use the line_ prefix.");
    this.name = "InvalidLineId";
  }
}

export class InvalidCheckPrice extends Error {
  constructor() {
    super("A line price must be an integer number of COP.");
    this.name = "InvalidCheckPrice";
  }
}

export class InvalidOrderChannel extends Error {
  constructor() {
    super("An order channel must be waiter or fixed_point.");
    this.name = "InvalidOrderChannel";
  }
}

export class ComboNotSent extends Error {
  constructor() {
    super("A combo is not sent to the kitchen.");
    this.name = "ComboNotSent";
  }
}

export class EmptyOrder extends Error {
  constructor() {
    super("An order must contain at least one line.");
    this.name = "EmptyOrder";
  }
}

export class LineTransitionRejected extends Error {
  constructor() {
    super("A line only moves forward one step.");
    this.name = "LineTransitionRejected";
  }
}

export class TableNotOpen extends Error {
  constructor() {
    super("The table must be occupied or have the bill requested.");
    this.name = "TableNotOpen";
  }
}

function assertPrefixed(
  id: string,
  prefix: string,
  failure: () => Error,
): void {
  if (!id.startsWith(prefix) || id.length === prefix.length) {
    throw failure();
  }
}

function assertCop(price: number): void {
  if (!Number.isInteger(price) || price < 0) {
    throw new InvalidCheckPrice();
  }
}

function parseChannel(channel: string): OrderChannel {
  if (
    channel === ORDER_CHANNEL.WAITER ||
    channel === ORDER_CHANNEL.FIXED_POINT
  ) {
    return channel;
  }

  throw new InvalidOrderChannel();
}

function assertTableOpen(state: TableState): void {
  if (state === "occupied" || state === "check_requested") {
    return;
  }

  throw new TableNotOpen();
}

export class Check {
  readonly id: string;
  readonly tenantId: string;
  readonly venueId: string;
  readonly tableId: string;
  readonly openedAt: string;

  private readonly orderList: StoredOrder[] = [];
  private readonly readyNoticeList: ReadyNotice[] = [];
  private firstSentAtValue: string | undefined;
  private tableStateValue: TableState = "occupied";
  private preBillRequestValue: PreBillRequest | undefined;

  private constructor(input: OpenCheck) {
    this.id = input.id;
    this.tenantId = input.tenantId;
    this.venueId = input.venueId;
    this.tableId = input.tableId;
    this.openedAt = input.openedAt;
  }

  static open(input: OpenCheck): Check {
    assertPrefixed(input.id, CHECK_ID_PREFIX, () => new InvalidCheckId());

    return new Check(input);
  }

  get firstSentAt(): string | undefined {
    return this.firstSentAtValue;
  }

  get tableState(): TableState {
    return this.tableStateValue;
  }

  get preBillRequest(): PreBillRequest | undefined {
    if (this.preBillRequestValue === undefined) {
      return undefined;
    }

    return { requestedAt: this.preBillRequestValue.requestedAt };
  }

  get orderTakingSeconds(): number | undefined {
    if (this.firstSentAtValue === undefined) {
      return undefined;
    }

    return (
      (Date.parse(this.firstSentAtValue) - Date.parse(this.openedAt)) / 1000
    );
  }

  get total(): number {
    return this.orderList
      .flatMap((order) => order.lines)
      .filter((line) => line.state !== LINE_STATE.HELD)
      .reduce((sum, line) => sum + line.price, 0);
  }

  get orders(): readonly ListedOrder[] {
    return this.orderList.map((order) => ({
      id: order.id,
      channel: order.channel,
      lines: order.lines.map((line) => this.presentLine(line)),
    }));
  }

  get readyNotices(): readonly ReadyNotice[] {
    return this.readyNoticeList.map((notice) => ({ ...notice }));
  }

  addLine(input: AddLine): void {
    assertPrefixed(input.orderId, ORDER_ID_PREFIX, () => new InvalidOrderId());
    assertPrefixed(input.lineId, LINE_ID_PREFIX, () => new InvalidLineId());
    assertCop(input.price);

    const channel = parseChannel(input.channel);

    if (this.findLine(input.lineId)) {
      throw new InvalidLineId();
    }

    const line: StoredLine = {
      id: input.lineId,
      productId: input.productId,
      name: input.name,
      course: input.course,
      price: input.price,
      state: LINE_STATE.HELD,
      kind:
        input.kind === LINE_KIND.COMBO ? LINE_KIND.COMBO : LINE_KIND.PRODUCT,
      originTableId: this.tableId,
      variantIds: [...(input.variantIds ?? [])],
      modifierIds: [...(input.modifierIds ?? [])],
      ...(input.note === undefined || input.note === ""
        ? {}
        : { note: input.note }),
    };
    const order = this.orderList.find((item) => item.id === input.orderId);

    if (!order) {
      this.orderList.push({ id: input.orderId, channel, lines: [line] });
      return;
    }

    if (order.channel !== channel) {
      throw new InvalidOrderChannel();
    }

    order.lines.push(line);
  }

  changePrice(input: ChangeLinePrice): void {
    assertPrefixed(input.lineId, LINE_ID_PREFIX, () => new InvalidLineId());
    assertCop(input.price);

    const line = this.findLine(input.lineId);

    if (!line) {
      throw new InvalidLineId();
    }

    line.price = input.price;
  }

  send(input: SendCourse): void {
    const inCourse = this.linesInCourse(input.course);

    if (inCourse.length === 0) {
      throw new EmptyOrder();
    }

    if (inCourse.some((line) => line.kind === LINE_KIND.COMBO)) {
      throw new ComboNotSent();
    }

    let sentOne = false;

    for (const line of inCourse) {
      if (line.state !== LINE_STATE.HELD) {
        continue;
      }

      line.state = LINE_STATE.SENT;
      line.sentAt = input.sentAt;
      sentOne = true;
    }

    if (sentOne && this.firstSentAtValue === undefined) {
      this.firstSentAtValue = input.sentAt;
    }

    if (sentOne && this.tableStateValue === "check_requested") {
      this.tableStateValue = "occupied";
    }
  }

  resend(input: ResendLine): void {
    assertPrefixed(input.lineId, LINE_ID_PREFIX, () => new InvalidLineId());

    const line = this.findLine(input.lineId);

    if (!line) {
      throw new InvalidLineId();
    }

    if (line.state === LINE_STATE.SENT) {
      return;
    }
  }

  requestCheck(input?: RequestCheckStamp): void {
    if (this.tableStateValue !== "occupied") {
      throw new TableNotOpen();
    }

    this.tableStateValue = "check_requested";

    if (input !== undefined) {
      this.preBillRequestValue = { requestedAt: input.requestedAt };
    }
  }

  advance(input: AdvanceLine): void {
    assertPrefixed(input.lineId, LINE_ID_PREFIX, () => new InvalidLineId());

    const line = this.findLine(input.lineId);

    if (!line) {
      throw new InvalidLineId();
    }

    const nextRank = LINE_RANK[line.state] + 1;

    if (line.state === LINE_STATE.HELD || LINE_RANK[input.state] !== nextRank) {
      throw new LineTransitionRejected();
    }

    line.state = input.state;

    if (input.state === LINE_STATE.IN_PREPARATION) {
      line.inPreparationAt = input.at;
      return;
    }

    if (input.state === LINE_STATE.READY) {
      line.readyAt = input.at;
      this.readyNoticeList.push({
        tableId: this.tableId,
        lineId: line.id,
        at: input.at,
      });
      return;
    }

    line.deliveredAt = input.at;
  }

  join(input: JoinCheck): void {
    assertTableOpen(input.sourceState);
    assertTableOpen(input.targetState);
    this.assertCanReceive(input.source.orderList);

    const moved = input.source.orderList.splice(
      0,
      input.source.orderList.length,
    );

    for (const order of moved) {
      this.acceptOrder(order);
    }
  }

  transfer(input: TransferLines): void {
    assertTableOpen(input.sourceState);
    assertTableOpen(input.targetState);

    const seen = new Set<string>();
    const located: LocatedLine[] = [];

    for (const lineId of input.lineIds) {
      if (seen.has(lineId)) {
        throw new InvalidLineId();
      }

      seen.add(lineId);
      const found = input.source.locateLine(lineId);

      if (!found) {
        throw new InvalidLineId();
      }

      located.push(found);
    }

    this.assertCanReceive(
      located.map((item) => ({
        id: item.orderId,
        channel: item.channel,
        lines: [item.line],
      })),
    );

    for (const item of located) {
      const line = input.source.detachLine(item.line.id);

      if (!line) {
        throw new InvalidLineId();
      }

      this.acceptLine(item.orderId, item.channel, line);
    }
  }

  private assertCanReceive(orders: readonly StoredOrder[]): void {
    for (const order of orders) {
      const existing = this.orderList.find((item) => item.id === order.id);

      if (existing && existing.channel !== order.channel) {
        throw new InvalidOrderChannel();
      }

      for (const line of order.lines) {
        if (this.findLine(line.id)) {
          throw new InvalidLineId();
        }
      }
    }
  }

  private acceptOrder(order: StoredOrder): void {
    const existing = this.orderList.find((item) => item.id === order.id);

    if (!existing) {
      this.orderList.push(order);
      return;
    }

    existing.lines.push(...order.lines);
  }

  private acceptLine(
    orderId: string,
    channel: OrderChannel,
    line: StoredLine,
  ): void {
    this.acceptOrder({ id: orderId, channel, lines: [line] });
  }

  private locateLine(lineId: string): LocatedLine | undefined {
    for (const order of this.orderList) {
      const line = order.lines.find((item) => item.id === lineId);

      if (line) {
        return { orderId: order.id, channel: order.channel, line };
      }
    }

    return undefined;
  }

  private detachLine(lineId: string): StoredLine | undefined {
    for (const order of this.orderList) {
      const index = order.lines.findIndex((item) => item.id === lineId);

      if (index === -1) {
        continue;
      }

      const [line] = order.lines.splice(index, 1);

      if (order.lines.length === 0) {
        const orderIndex = this.orderList.indexOf(order);
        this.orderList.splice(orderIndex, 1);
      }

      return line;
    }

    return undefined;
  }

  private linesInCourse(course: number): StoredLine[] {
    return this.orderList
      .flatMap((order) => order.lines)
      .filter((line) => line.course === course);
  }

  private findLine(lineId: string): StoredLine | undefined {
    return this.locateLine(lineId)?.line;
  }

  private presentLine(line: StoredLine): ListedLine {
    return {
      id: line.id,
      productId: line.productId,
      name: line.name,
      course: line.course,
      price: line.price,
      state: line.state,
      originTableId: line.originTableId,
      ...(line.variantIds.length === 0
        ? {}
        : { variantIds: [...line.variantIds] }),
      ...(line.modifierIds.length === 0
        ? {}
        : { modifierIds: [...line.modifierIds] }),
      ...(line.note === undefined ? {} : { note: line.note }),
      ...(line.sentAt === undefined ? {} : { sentAt: line.sentAt }),
      ...(line.inPreparationAt === undefined
        ? {}
        : { inPreparationAt: line.inPreparationAt }),
      ...(line.readyAt === undefined ? {} : { readyAt: line.readyAt }),
      ...(line.deliveredAt === undefined
        ? {}
        : { deliveredAt: line.deliveredAt }),
    };
  }
}
