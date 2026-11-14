import { expect, it } from "vitest";

import {
  Check,
  ComboNotSent,
  channelLabel,
  EmptyOrder,
  InvalidCheckId,
  InvalidCheckPrice,
  InvalidLineId,
  InvalidOrderChannel,
  InvalidOrderId,
  LineTransitionRejected,
  TableNotOpen,
} from "#domain/check.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const ORDER_ID = "order_1";
const OPENED_AT = "2026-10-28T12:00:00Z";
const SENT_AT = "2026-10-28T12:03:10Z";
const PREPARED_AT = "2026-10-28T12:05:00Z";
const READY_AT = "2026-10-28T12:11:00Z";
const DELIVERED_AT = "2026-10-28T12:15:00Z";
const LATER_SENT_AT = "2026-10-28T12:20:00Z";
const NOT_DELIVERED_AT = "2026-10-28T12:30:00Z";
const RIBS_ID = "menu_product_ribs";
const SALAD_ID = "menu_product_salad";

const openTableCheck = () =>
  Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

const openSeatedCheck = (id: string, tableId: string) =>
  Check.open({
    id,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId,
    openedAt: OPENED_AT,
  });

const addCourseLine = (
  check: Check,
  input: { orderId: string; lineId: string; name: string; price: number },
) => {
  check.addLine({
    orderId: input.orderId,
    lineId: input.lineId,
    productId: `menu_product_${input.name.toLowerCase()}`,
    name: input.name,
    course: 1,
    price: input.price,
    channel: "waiter",
  });
};

const addProductLine = (
  check: Check,
  input: {
    orderId: string;
    lineId: string;
    productId: string;
    name: string;
    price: number;
  },
) => {
  check.addLine({
    orderId: input.orderId,
    lineId: input.lineId,
    productId: input.productId,
    name: input.name,
    course: 1,
    price: input.price,
    channel: "waiter",
  });
};

it("given four diners, when the check opens, then the check keeps that count", () => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
    diners: 4,
  });

  expect(check.diners).toBe(4);
});

it("given no diner count, when the check opens, then diners stay empty", () => {
  expect(openTableCheck().diners).toBeNull();
});

it("given starters and mains, when course 1 is sent, then mains stay held and off the total", () => {
  const check = openTableCheck();
  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_soup",
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_salad",
    productId: "menu_product_salad",
    name: "Salad",
    course: 1,
    price: 8_000,
    channel: "waiter",
  });
  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_steak",
    productId: "menu_product_steak",
    name: "Steak",
    course: 2,
    price: 45_000,
    channel: "waiter",
  });

  check.send({ course: 1, sentAt: SENT_AT });

  expect(check.orders).toEqual([
    {
      id: ORDER_ID,
      channel: "waiter",
      lines: [
        {
          id: "line_soup",
          productId: "menu_product_soup",
          name: "Soup",
          course: 1,
          price: 12_000,
          state: "sent",
          sentAt: SENT_AT,
          originTableId: TABLE_ID,
        },
        {
          id: "line_salad",
          productId: "menu_product_salad",
          name: "Salad",
          course: 1,
          price: 8_000,
          state: "sent",
          sentAt: SENT_AT,
          originTableId: TABLE_ID,
        },
        {
          id: "line_steak",
          productId: "menu_product_steak",
          name: "Steak",
          course: 2,
          price: 45_000,
          state: "held",
          originTableId: TABLE_ID,
        },
      ],
    },
  ]);
  expect(check.total).toBe(20_000);
});

it("given a sent soup, when it is resent, then price, state, and total stay", () => {
  const check = openTableCheck();
  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_soup",
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 18_000,
    channel: "fixed_point",
  });
  check.send({ course: 1, sentAt: SENT_AT });
  const before = { orders: check.orders, total: check.total };

  check.resend({ lineId: "line_soup" });

  expect(check.orders).toEqual(before.orders);
  expect(check.total).toBe(before.total);
  expect(check.total).toBe(18_000);
  expect(check.orders[0]?.lines[0]).toMatchObject({
    price: 18_000,
    state: "sent",
  });
});

it("given 12:00:00Z and 12:03:10Z, when the first product is sent, then order-taking time is 190 s", () => {
  const check = openTableCheck();
  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_soup",
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });

  check.send({ course: 1, sentAt: SENT_AT });

  expect(check.openedAt).toBe(OPENED_AT);
  expect(check.firstSentAt).toBe(SENT_AT);
  expect(check.orderTakingSeconds).toBe(190);
});

it("given a combo, when it is sent, then ComboNotSent and the account stays", () => {
  const check = openTableCheck();
  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_lunch",
    productId: "menu_combo_lunch",
    name: "Lunch",
    course: 1,
    price: 30_000,
    channel: "waiter",
    kind: "combo",
  });
  const before = { orders: check.orders, total: check.total };

  const sendCombo = () => {
    check.send({ course: 1, sentAt: SENT_AT });
  };

  expect(sendCombo).toThrow(ComboNotSent);
  expect({ orders: check.orders, total: check.total }).toEqual(before);
  expect(check.total).toBe(0);
  expect(check.firstSentAt).toBeUndefined();
});

it("given no lines, when the order is sent, then EmptyOrder", () => {
  const check = openTableCheck();

  const sendEmpty = () => {
    check.send({ course: 1, sentAt: SENT_AT });
  };

  expect(sendEmpty).toThrow(EmptyOrder);
  expect(check.orders).toEqual([]);
  expect(check.total).toBe(0);
  expect(check.firstSentAt).toBeUndefined();
});

it("given an identifier without the check_ prefix, when a check is opened, then it is rejected", () => {
  const open = () => {
    Check.open({
      id: "5",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      tableId: TABLE_ID,
      openedAt: OPENED_AT,
    });
  };

  expect(open).toThrow(InvalidCheckId);
});

it("given an identifier without the order_ prefix, when a line is added, then it is rejected", () => {
  const check = openTableCheck();

  const addLine = () => {
    check.addLine({
      orderId: "1",
      lineId: "line_soup",
      productId: "menu_product_soup",
      name: "Soup",
      course: 1,
      price: 12_000,
      channel: "waiter",
    });
  };

  expect(addLine).toThrow(InvalidOrderId);
  expect(check.orders).toEqual([]);
});

it("given an identifier without the line_ prefix, when a line is added, then it is rejected", () => {
  const check = openTableCheck();

  const addLine = () => {
    check.addLine({
      orderId: ORDER_ID,
      lineId: "soup",
      productId: "menu_product_soup",
      name: "Soup",
      course: 1,
      price: 12_000,
      channel: "waiter",
    });
  };

  expect(addLine).toThrow(InvalidLineId);
  expect(check.orders).toEqual([]);
});

it("given a price that is not an integer number of COP, when a line is added, then it is rejected", () => {
  const check = openTableCheck();

  const addLine = () => {
    check.addLine({
      orderId: ORDER_ID,
      lineId: "line_soup",
      productId: "menu_product_soup",
      name: "Soup",
      course: 1,
      price: 12_000.5,
      channel: "waiter",
    });
  };

  expect(addLine).toThrow(InvalidCheckPrice);
  expect(check.orders).toEqual([]);
  expect(check.total).toBe(0);
});

it("given a channel other than waiter, fixed_point, or qr_table, when a line is added, then it is rejected", () => {
  const check = openTableCheck();

  const addLine = () => {
    check.addLine({
      orderId: ORDER_ID,
      lineId: "line_soup",
      productId: "menu_product_soup",
      name: "Soup",
      course: 1,
      price: 12_000,
      channel: "delivery",
    });
  };

  expect(addLine).toThrow(InvalidOrderChannel);
  expect(check.orders).toEqual([]);
});

it("given a QR table channel, when a line is added, then the order is labeled QR table", () => {
  const check = openTableCheck();

  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_soup",
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "qr_table",
  });

  expect(check.orders[0]?.channel).toBe("qr_table");
  expect(channelLabel("qr_table")).toBe("QR table");
});

it("given a sent line, when it moves to in preparation and then ready, then both stamps and a ready notice exist", () => {
  const check = openTableCheck();
  addCourseLine(check, {
    orderId: ORDER_ID,
    lineId: "line_soup",
    name: "Soup",
    price: 12_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });

  check.advance({
    lineId: "line_soup",
    state: "in_preparation",
    at: PREPARED_AT,
  });

  expect(check.readyNotices).toEqual([]);
  expect(check.orders[0]?.lines[0]).toMatchObject({
    state: "in_preparation",
    sentAt: SENT_AT,
    inPreparationAt: PREPARED_AT,
  });

  check.advance({ lineId: "line_soup", state: "ready", at: READY_AT });

  expect(check.orders[0]?.lines[0]).toMatchObject({
    state: "ready",
    sentAt: SENT_AT,
    inPreparationAt: PREPARED_AT,
    readyAt: READY_AT,
  });
  expect(check.readyNotices).toEqual([
    { tableId: TABLE_ID, lineId: "line_soup", at: READY_AT },
  ]);
});

it("given a ready line, when it steps back, then LineTransitionRejected", () => {
  const check = openTableCheck();
  addCourseLine(check, {
    orderId: ORDER_ID,
    lineId: "line_soup",
    name: "Soup",
    price: 12_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });
  check.advance({
    lineId: "line_soup",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_soup", state: "ready", at: READY_AT });
  const before = {
    orders: check.orders,
    notices: check.readyNotices,
  };

  const stepBack = () => {
    check.advance({ lineId: "line_soup", state: "sent", at: LATER_SENT_AT });
  };

  expect(stepBack).toThrow(LineTransitionRejected);
  expect({ orders: check.orders, notices: check.readyNotices }).toEqual(before);
  expect(check.orders[0]?.lines[0]?.state).toBe("ready");
});

it("given a join or a transfer, when lines move, then originTableId and both table states stay", () => {
  const target = openSeatedCheck("check_5", "table_5");
  const source = openSeatedCheck("check_6", "table_6");
  addCourseLine(target, {
    orderId: "order_5",
    lineId: "line_steak",
    name: "Steak",
    price: 15_000,
  });
  addCourseLine(source, {
    orderId: "order_6",
    lineId: "line_soup",
    name: "Soup",
    price: 9_000,
  });
  target.send({ course: 1, sentAt: SENT_AT });
  source.send({ course: 1, sentAt: SENT_AT });
  source.requestCheck();

  target.join({
    source,
    sourceState: source.tableState,
    targetState: target.tableState,
  });

  expect(target.id).toBe("check_5");
  expect(source.id).toBe("check_6");
  expect(target.tableId).toBe("table_5");
  expect(source.tableId).toBe("table_6");
  expect(target.tableState).toBe("occupied");
  expect(source.tableState).toBe("check_requested");
  expect(source.orders).toEqual([]);
  expect(source.total).toBe(0);
  expect(target.total).toBe(24_000);
  expect(target.orders.flatMap((order) => order.lines)).toEqual([
    expect.objectContaining({
      id: "line_steak",
      originTableId: "table_5",
      state: "sent",
    }),
    expect.objectContaining({
      id: "line_soup",
      originTableId: "table_6",
      state: "sent",
    }),
  ]);

  const transferTarget = openSeatedCheck("check_8", "table_8");
  const transferSource = openSeatedCheck("check_9", "table_9");
  addCourseLine(transferTarget, {
    orderId: "order_8",
    lineId: "line_bread",
    name: "Bread",
    price: 4_000,
  });
  addCourseLine(transferSource, {
    orderId: "order_9",
    lineId: "line_salad",
    name: "Salad",
    price: 8_000,
  });
  addCourseLine(transferSource, {
    orderId: "order_9",
    lineId: "line_fish",
    name: "Fish",
    price: 22_000,
  });
  transferTarget.send({ course: 1, sentAt: SENT_AT });
  transferSource.send({ course: 1, sentAt: SENT_AT });
  transferTarget.requestCheck();

  transferTarget.transfer({
    source: transferSource,
    lineIds: ["line_salad"],
    sourceState: transferSource.tableState,
    targetState: transferTarget.tableState,
  });

  expect(transferTarget.id).toBe("check_8");
  expect(transferSource.id).toBe("check_9");
  expect(transferTarget.tableId).toBe("table_8");
  expect(transferSource.tableId).toBe("table_9");
  expect(transferTarget.tableState).toBe("check_requested");
  expect(transferSource.tableState).toBe("occupied");
  expect(transferTarget.total).toBe(12_000);
  expect(transferSource.total).toBe(22_000);
  expect(transferTarget.orders.flatMap((order) => order.lines)).toEqual([
    expect.objectContaining({
      id: "line_bread",
      originTableId: "table_8",
    }),
    expect.objectContaining({
      id: "line_salad",
      originTableId: "table_9",
    }),
  ]);
  expect(transferSource.orders.flatMap((order) => order.lines)).toEqual([
    expect.objectContaining({
      id: "line_fish",
      originTableId: "table_9",
    }),
  ]);
});

it("given a free or to_clean table, when lines are joined or transferred, then TableNotOpen", () => {
  const target = openSeatedCheck("check_5", "table_5");
  const source = openSeatedCheck("check_6", "table_6");
  addCourseLine(target, {
    orderId: "order_5",
    lineId: "line_steak",
    name: "Steak",
    price: 15_000,
  });
  addCourseLine(source, {
    orderId: "order_6",
    lineId: "line_soup",
    name: "Soup",
    price: 9_000,
  });
  target.send({ course: 1, sentAt: SENT_AT });
  source.send({ course: 1, sentAt: SENT_AT });
  const before = {
    targetOrders: target.orders,
    sourceOrders: source.orders,
    targetTotal: target.total,
    sourceTotal: source.total,
    targetState: target.tableState,
    sourceState: source.tableState,
    targetId: target.id,
    sourceId: source.id,
    targetTableId: target.tableId,
    sourceTableId: source.tableId,
  };

  const joinFromFree = () => {
    target.join({
      source,
      sourceState: "free",
      targetState: "occupied",
    });
  };
  const joinIntoToClean = () => {
    target.join({
      source,
      sourceState: "occupied",
      targetState: "to_clean",
    });
  };
  const transferOntoFree = () => {
    target.transfer({
      source,
      lineIds: ["line_soup"],
      sourceState: "check_requested",
      targetState: "free",
    });
  };
  const transferFromToClean = () => {
    target.transfer({
      source,
      lineIds: ["line_soup"],
      sourceState: "to_clean",
      targetState: "check_requested",
    });
  };

  expect(joinFromFree).toThrow(TableNotOpen);
  expect(joinIntoToClean).toThrow(TableNotOpen);
  expect(transferOntoFree).toThrow(TableNotOpen);
  expect(transferFromToClean).toThrow(TableNotOpen);
  expect({
    targetOrders: target.orders,
    sourceOrders: source.orders,
    targetTotal: target.total,
    sourceTotal: source.total,
    targetState: target.tableState,
    sourceState: source.tableState,
    targetId: target.id,
    sourceId: source.id,
    targetTableId: target.tableId,
    sourceTableId: source.tableId,
  }).toEqual(before);
});

it("given check_requested, when another product is sent, then the table is occupied", () => {
  const check = openTableCheck();
  addCourseLine(check, {
    orderId: ORDER_ID,
    lineId: "line_soup",
    name: "Soup",
    price: 12_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });
  check.requestCheck();

  expect(check.tableState).toBe("check_requested");

  addCourseLine(check, {
    orderId: ORDER_ID,
    lineId: "line_salad",
    name: "Salad",
    price: 8_000,
  });
  check.send({ course: 1, sentAt: LATER_SENT_AT });

  expect(check.tableState).toBe("occupied");
  expect(check.total).toBe(20_000);
  expect(check.orders[0]?.lines.map((line) => line.state)).toEqual([
    "sent",
    "sent",
  ]);
});

it("given soup and salad, when the soup price changes, then only that line price changes", () => {
  const check = openTableCheck();
  addCourseLine(check, {
    orderId: ORDER_ID,
    lineId: "line_soup",
    name: "Soup",
    price: 12_000,
  });
  addCourseLine(check, {
    orderId: ORDER_ID,
    lineId: "line_salad",
    name: "Salad",
    price: 8_000,
  });

  check.changePrice({ lineId: "line_soup", price: 9_000 });

  expect(check.orders[0]?.lines).toEqual([
    expect.objectContaining({
      id: "line_soup",
      productId: "menu_product_soup",
      price: 9_000,
      state: "held",
    }),
    expect.objectContaining({
      id: "line_salad",
      productId: "menu_product_salad",
      price: 8_000,
      state: "held",
    }),
  ]);
  expect(check.total).toBe(0);
});

it("given soup at 12000, when the new price is not an integer or the line is unknown, then the price stays", () => {
  const check = openTableCheck();
  addCourseLine(check, {
    orderId: ORDER_ID,
    lineId: "line_soup",
    name: "Soup",
    price: 12_000,
  });

  expect(() => {
    check.changePrice({ lineId: "line_soup", price: 9_000.5 });
  }).toThrow(InvalidCheckPrice);
  expect(() => {
    check.changePrice({ lineId: "line_missing", price: 9_000 });
  }).toThrow(InvalidLineId);
  expect(check.orders[0]?.lines.map((line) => line.price)).toEqual([12_000]);
});

it("given ribs sent at 12:20 and ribs sent at 12:03, when one uncovered portion is withdrawn, then the older line is not delivered and the total skips it", () => {
  const check = openTableCheck();
  addProductLine(check, {
    orderId: "order_late",
    lineId: "line_late",
    productId: RIBS_ID,
    name: "Ribs",
    price: 18_000,
  });
  check.send({ course: 1, sentAt: LATER_SENT_AT });
  addProductLine(check, {
    orderId: "order_early",
    lineId: "line_early",
    productId: RIBS_ID,
    name: "Ribs",
    price: 22_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });

  check.withdrawUncoveredSent({
    productId: RIBS_ID,
    uncoveredPortions: 1,
    at: NOT_DELIVERED_AT,
  });

  expect(check.orders[1]?.lines[0]).toEqual({
    id: "line_early",
    productId: RIBS_ID,
    name: "Ribs",
    course: 1,
    price: 22_000,
    state: "not_delivered",
    originTableId: TABLE_ID,
    sentAt: SENT_AT,
    notDeliveredAt: NOT_DELIVERED_AT,
  });
  expect(check.orders[0]?.lines[0]).toMatchObject({
    id: "line_late",
    state: "sent",
    sentAt: LATER_SENT_AT,
    price: 18_000,
  });
  expect(check.total).toBe(18_000);
  expect(check.readyNotices).toEqual([]);
  expect(Object.hasOwn(check, "stockMovements")).toBe(false);
  expect(Object.hasOwn(check.orders[1]?.lines[0] ?? {}, "stockMovement")).toBe(
    false,
  );
});

it("given two ribs sent together, when one uncovered portion is withdrawn, then the earlier line is not delivered", () => {
  const check = openTableCheck();
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_first",
    productId: RIBS_ID,
    name: "Ribs",
    price: 10_000,
  });
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_second",
    productId: RIBS_ID,
    name: "Ribs",
    price: 14_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });

  check.withdrawUncoveredSent({
    productId: RIBS_ID,
    uncoveredPortions: 1,
    at: NOT_DELIVERED_AT,
  });

  expect(check.orders[0]?.lines.map((line) => line.state)).toEqual([
    "not_delivered",
    "sent",
  ]);
  expect(check.total).toBe(14_000);
});

it("given sent ribs and no uncovered portion, when withdrawal runs, then every sent line stays and the total stays", () => {
  const check = openTableCheck();
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_ribs",
    productId: RIBS_ID,
    name: "Ribs",
    price: 22_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });
  const before = { orders: check.orders, total: check.total };

  check.withdrawUncoveredSent({
    productId: RIBS_ID,
    uncoveredPortions: 0,
    at: NOT_DELIVERED_AT,
  });

  expect(check.orders).toEqual(before.orders);
  expect(check.total).toBe(before.total);
  expect(check.total).toBe(22_000);
});

it("given sent, in preparation, ready, delivered, and held ribs, when uncovered portions are withdrawn, then started and held lines stay", () => {
  const check = openTableCheck();
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_sent",
    productId: RIBS_ID,
    name: "Ribs",
    price: 10_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_prep",
    productId: RIBS_ID,
    name: "Ribs",
    price: 11_000,
  });
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_ready",
    productId: RIBS_ID,
    name: "Ribs",
    price: 12_000,
  });
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_delivered",
    productId: RIBS_ID,
    name: "Ribs",
    price: 13_000,
  });
  addProductLine(check, {
    orderId: "order_salad",
    lineId: "line_salad",
    productId: SALAD_ID,
    name: "Salad",
    price: 8_000,
  });
  check.send({ course: 1, sentAt: LATER_SENT_AT });
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_held",
    productId: RIBS_ID,
    name: "Ribs",
    price: 9_000,
  });
  check.advance({
    lineId: "line_prep",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({
    lineId: "line_ready",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_ready", state: "ready", at: READY_AT });
  check.advance({
    lineId: "line_delivered",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_delivered", state: "ready", at: READY_AT });
  check.advance({
    lineId: "line_delivered",
    state: "delivered",
    at: DELIVERED_AT,
  });

  check.withdrawUncoveredSent({
    productId: RIBS_ID,
    uncoveredPortions: 4,
    at: NOT_DELIVERED_AT,
  });

  expect(
    check.orders[0]?.lines.map((line) => ({ id: line.id, state: line.state })),
  ).toEqual([
    { id: "line_sent", state: "not_delivered" },
    { id: "line_prep", state: "in_preparation" },
    { id: "line_ready", state: "ready" },
    { id: "line_delivered", state: "delivered" },
    { id: "line_held", state: "held" },
  ]);
  expect(check.orders[1]?.lines[0]).toMatchObject({
    id: "line_salad",
    state: "sent",
    price: 8_000,
  });
  expect(check.orders[0]?.lines[0]).toMatchObject({
    sentAt: SENT_AT,
    notDeliveredAt: NOT_DELIVERED_AT,
  });
  expect(check.orders[0]?.lines[1]).toMatchObject({
    state: "in_preparation",
    inPreparationAt: PREPARED_AT,
  });
  expect(check.orders[0]?.lines[2]).toMatchObject({
    state: "ready",
    readyAt: READY_AT,
  });
  expect(check.orders[0]?.lines[3]).toMatchObject({
    state: "delivered",
    deliveredAt: DELIVERED_AT,
  });
  expect(check.total).toBe(44_000);
  expect(Object.hasOwn(check, "stockMovements")).toBe(false);
});

it("given ribs in preparation and ribs ready, when the station cannot finish them, then those lines are not delivered and delivered or sent lines stay", () => {
  const check = openTableCheck();
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_sent",
    productId: RIBS_ID,
    name: "Ribs",
    price: 10_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_prep",
    productId: RIBS_ID,
    name: "Ribs",
    price: 11_000,
  });
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_ready",
    productId: RIBS_ID,
    name: "Ribs",
    price: 12_000,
  });
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_delivered",
    productId: RIBS_ID,
    name: "Ribs",
    price: 13_000,
  });
  check.send({ course: 1, sentAt: LATER_SENT_AT });
  check.advance({
    lineId: "line_prep",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({
    lineId: "line_ready",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_ready", state: "ready", at: READY_AT });
  check.advance({
    lineId: "line_delivered",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_delivered", state: "ready", at: READY_AT });
  check.advance({
    lineId: "line_delivered",
    state: "delivered",
    at: DELIVERED_AT,
  });
  const kept = {
    sent: check.orders[0]?.lines[0],
    delivered: check.orders[0]?.lines[3],
    notices: check.readyNotices,
  };

  check.markNotDeliverable({ lineId: "line_prep", at: NOT_DELIVERED_AT });
  check.markNotDeliverable({ lineId: "line_ready", at: NOT_DELIVERED_AT });

  expect(check.orders[0]?.lines[1]).toEqual({
    id: "line_prep",
    productId: RIBS_ID,
    name: "Ribs",
    course: 1,
    price: 11_000,
    state: "not_delivered",
    originTableId: TABLE_ID,
    sentAt: LATER_SENT_AT,
    inPreparationAt: PREPARED_AT,
    notDeliveredAt: NOT_DELIVERED_AT,
  });
  expect(check.orders[0]?.lines[2]).toMatchObject({
    id: "line_ready",
    state: "not_delivered",
    sentAt: LATER_SENT_AT,
    inPreparationAt: PREPARED_AT,
    readyAt: READY_AT,
    notDeliveredAt: NOT_DELIVERED_AT,
  });
  expect(check.total).toBe(23_000);
  expect(check.readyNotices).toEqual(kept.notices);
  expect(() => {
    check.markNotDeliverable({
      lineId: "line_delivered",
      at: NOT_DELIVERED_AT,
    });
  }).toThrow(expect.objectContaining({ name: "UndeliverableLineRejected" }));
  expect(() => {
    check.markNotDeliverable({ lineId: "line_sent", at: NOT_DELIVERED_AT });
  }).toThrow(expect.objectContaining({ name: "UndeliverableLineRejected" }));
  expect(check.orders[0]?.lines[0]).toEqual(kept.sent);
  expect(check.orders[0]?.lines[3]).toEqual(kept.delivered);
  expect(() => {
    check.advance({ lineId: "line_prep", state: "ready", at: READY_AT });
  }).toThrow(LineTransitionRejected);
  expect(check.orders[0]?.lines[1]?.state).toBe("not_delivered");
  expect(Object.hasOwn(check.orders[0]?.lines[1] ?? {}, "stockMovement")).toBe(
    false,
  );
});

it("given a sent rib, when advance targets not delivered, then LineTransitionRejected and the line still moves one rank", () => {
  const check = openTableCheck();
  addProductLine(check, {
    orderId: ORDER_ID,
    lineId: "line_ribs",
    productId: RIBS_ID,
    name: "Ribs",
    price: 22_000,
  });
  check.send({ course: 1, sentAt: SENT_AT });
  const sent = check.orders;

  expect(() => {
    check.advance({
      lineId: "line_ribs",
      state: "not_delivered",
      at: NOT_DELIVERED_AT,
    });
  }).toThrow(LineTransitionRejected);
  expect(check.orders).toEqual(sent);

  check.advance({
    lineId: "line_ribs",
    state: "in_preparation",
    at: PREPARED_AT,
  });

  expect(check.orders[0]?.lines[0]?.state).toBe("in_preparation");
  expect(() => {
    check.advance({
      lineId: "line_ribs",
      state: "not_delivered",
      at: NOT_DELIVERED_AT,
    });
  }).toThrow(LineTransitionRejected);
  expect(check.orders[0]?.lines[0]?.state).toBe("in_preparation");

  check.advance({ lineId: "line_ribs", state: "ready", at: READY_AT });

  expect(() => {
    check.advance({
      lineId: "line_ribs",
      state: "not_delivered",
      at: NOT_DELIVERED_AT,
    });
  }).toThrow(LineTransitionRejected);

  check.advance({
    lineId: "line_ribs",
    state: "delivered",
    at: DELIVERED_AT,
  });

  expect(check.orders[0]?.lines[0]).toMatchObject({
    state: "delivered",
    deliveredAt: DELIVERED_AT,
  });
  expect(check.total).toBe(22_000);
  expect(() => {
    check.advance({
      lineId: "line_ribs",
      state: "not_delivered",
      at: NOT_DELIVERED_AT,
    });
  }).toThrow(LineTransitionRejected);
  expect(check.orders[0]?.lines[0]?.state).toBe("delivered");
});
