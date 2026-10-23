import { expect, it } from "vitest";

import {
  authorizeGrant,
  authorizePermission,
  BARTENDER_CHARGE_DEFAULT,
  defaultLimit,
  GRANT,
  type Grant,
  LIMIT,
  type LimitCode,
  limitUnit,
  MATRIX_ROLE,
  MATRIX_ROLES,
  type MatrixRole,
  PERMISSION,
  type PermissionCode,
  permissionMatrix,
  proseRoles,
} from "#domain/permission-catalog.js";

const Y = GRANT.YES;
const L = GRANT.WITH_LIMIT;
const A = GRANT.WITH_AUTHORIZATION;
const N = GRANT.NO;

const cells = (
  owner: Grant,
  generalManager: Grant,
  siteAdministrator: Grant,
  shiftSupervisor: Grant,
  cashier: Grant,
  waiter: Grant,
  kitchenChief: Grant,
  warehouseKeeper: Grant,
): Record<MatrixRole, Grant> => ({
  owner,
  generalManager,
  siteAdministrator,
  shiftSupervisor,
  cashier,
  waiter,
  kitchenChief,
  warehouseKeeper,
});

const expectedMatrix: Record<PermissionCode, Record<MatrixRole, Grant>> = {
  [PERMISSION.SALE_OPEN_TABLE]: cells(Y, Y, Y, Y, Y, Y, N, N),
  [PERMISSION.SALE_VOID_BEFORE_KITCHEN]: cells(Y, Y, Y, Y, Y, L, N, N),
  [PERMISSION.SALE_VOID_AFTER_KITCHEN]: cells(Y, Y, Y, L, A, A, N, N),
  [PERMISSION.SALE_VOID_ACCOUNT]: cells(Y, Y, Y, A, A, N, N, N),
  [PERMISSION.SALE_DISCOUNT]: cells(Y, Y, L, L, L, N, N, N),
  [PERMISSION.SALE_COMP]: cells(Y, Y, L, A, A, N, N, N),
  [PERMISSION.SALE_CHANGE_PRICE]: cells(Y, Y, A, A, N, N, N, N),
  [PERMISSION.SALE_EDIT_PRINTED_CHECK]: cells(Y, Y, Y, Y, A, A, N, N),
  [PERMISSION.SALE_MOVE_ITEMS]: cells(Y, Y, Y, Y, Y, Y, N, N),
  [PERMISSION.SALE_TRANSFER_TABLE]: cells(Y, Y, Y, Y, A, A, N, N),
  [PERMISSION.SALE_VIEW_OTHER_CHECKS]: cells(Y, Y, Y, Y, Y, N, N, N),
  [PERMISSION.CASH_OPEN_SHIFT]: cells(Y, Y, Y, Y, Y, N, N, N),
  [PERMISSION.SALE_CHARGE]: cells(Y, Y, Y, Y, Y, N, N, N),
  [PERMISSION.CASH_VIEW_EXPECTED_TOTAL]: cells(Y, Y, Y, N, N, N, N, N),
  [PERMISSION.CASH_APPROVE_VARIANCE]: cells(Y, Y, L, L, N, N, N, N),
  [PERMISSION.CASH_OPEN_DRAWER]: cells(Y, Y, Y, A, A, N, N, N),
  [PERMISSION.CASH_MOVEMENT]: cells(Y, Y, L, L, A, N, N, N),
  [PERMISSION.CASH_PARTIAL_WITHDRAWAL]: cells(Y, Y, Y, Y, A, N, N, N),
  [PERMISSION.SALE_CHANGE_TENDER]: cells(Y, Y, A, A, N, N, N, N),
  [PERMISSION.SALE_REOPEN_PAID]: cells(Y, Y, A, N, N, N, N, N),
  [PERMISSION.SALE_REPRINT]: cells(Y, Y, Y, Y, L, N, N, N),
  [PERMISSION.SALE_CREDIT_NOTE]: cells(Y, Y, A, N, N, N, N, N),
  [PERMISSION.CASH_SETTLE_TIPS]: cells(Y, Y, Y, N, N, N, N, N),
  [PERMISSION.INVENTORY_RECORD_WASTE]: cells(Y, Y, Y, Y, N, N, L, L),
  [PERMISSION.INVENTORY_ADJUST]: cells(Y, Y, A, N, N, N, N, A),
  [PERMISSION.INVENTORY_COUNT]: cells(Y, Y, Y, N, N, N, Y, Y),
  [PERMISSION.INVENTORY_APPROVE_COUNT]: cells(Y, Y, L, N, N, N, N, N),
  [PERMISSION.INVENTORY_RECEIVE_PURCHASE]: cells(Y, Y, Y, N, N, N, Y, Y),
  [PERMISSION.INVENTORY_RECEIVE_TRANSFER]: cells(Y, Y, Y, N, N, N, A, A),
  [PERMISSION.INVENTORY_REQUEST_REPLENISHMENT]: cells(Y, Y, Y, Y, N, N, Y, Y),
  [PERMISSION.RECIPE_EDIT]: cells(Y, Y, N, N, N, N, N, N),
  [PERMISSION.INVENTORY_VIEW_COST]: cells(Y, Y, Y, N, N, N, N, N),
  [PERMISSION.INVENTORY_CONFIGURE_LEVELS]: cells(Y, Y, Y, N, N, N, L, L),
  [PERMISSION.IDENTITY_ASSIGN_ROLE]: cells(Y, Y, L, N, N, N, N, N),
  [PERMISSION.DEVICE_REGISTER]: cells(Y, Y, Y, N, N, N, N, N),
  [PERMISSION.ATTENDANCE_CORRECT]: cells(Y, Y, Y, N, N, N, N, N),
  [PERMISSION.RESERVATION_VERIFY_PAYMENT]: cells(Y, Y, Y, Y, Y, N, N, N),
  [PERMISSION.RESERVATION_APPROVE_REFUND]: cells(Y, Y, Y, A, N, N, N, N),
  [PERMISSION.PLATFORM_ACCEPT_ORDER]: cells(Y, Y, Y, Y, Y, N, N, N),
  [PERMISSION.PLATFORM_PAUSE]: cells(Y, Y, Y, Y, N, N, N, N),
  [PERMISSION.MENU_EDIT]: cells(Y, Y, L, N, N, N, N, N),
  [PERMISSION.REPORT_VIEW_SALES]: cells(Y, Y, Y, L, N, N, N, N),
  [PERMISSION.CUSTOMER_EXPORT]: cells(Y, A, N, N, N, N, N, N),
  [PERMISSION.AUDIT_VIEW]: cells(Y, Y, L, N, N, N, N, N),
};

const matrixChecked: Record<
  PermissionCode,
  Record<MatrixRole, Grant>
> = permissionMatrix;

for (const permission of Object.values(PERMISSION)) {
  for (const role of MATRIX_ROLES) {
    it(`given the default matrix, when ${role} attempts ${permission}, then the cell matches section 6`, () => {
      const expected = expectedMatrix[permission][role];

      const actual = matrixChecked[permission][role];

      expect(actual).toBe(expected);
    });
  }

  it(`given ${permission}, when its authorize pair is read, then yes and with_limit keep the cap`, () => {
    const paired = authorizePermission(permission);

    expect(paired).toBe(`${permission}.authorize`);
    for (const role of MATRIX_ROLES) {
      const grant = expectedMatrix[permission][role];
      const authorize = authorizeGrant(grant);

      expect(authorize).toBe(grant === Y || grant === L ? grant : GRANT.NO);
    }
  });
}

it("given section 4 roles outside the eight columns, when the catalog is read, then they stay prose-only", () => {
  const columns = [...MATRIX_ROLES];

  expect(proseRoles).toEqual([
    "host",
    "kitchenStation",
    "bartender",
    "purchasing",
    "delivery",
    "accountant",
    "auditor",
  ]);
  for (const role of proseRoles) {
    expect(columns).not.toContain(role);
  }
});

it("given the pilot, when bartender charging is read, then sale.charge exists and starts off", () => {
  const charge = permissionMatrix[PERMISSION.SALE_CHARGE];

  expect(charge).toBeDefined();
  expect(BARTENDER_CHARGE_DEFAULT).toBe(false);
});

it("given section 7, when default caps are read, then percent, COP, and counts match", () => {
  const caps: readonly (readonly [LimitCode, MatrixRole, number])[] = [
    [LIMIT.DISCOUNT_PERCENT, MATRIX_ROLE.CASHIER, 5],
    [LIMIT.DISCOUNT_PERCENT, MATRIX_ROLE.SHIFT_SUPERVISOR, 15],
    [LIMIT.DISCOUNT_PERCENT, MATRIX_ROLE.SITE_ADMINISTRATOR, 30],
    [LIMIT.VOID_COP, MATRIX_ROLE.SHIFT_SUPERVISOR, 50_000],
    [LIMIT.COMP_SHIFT_COP, MATRIX_ROLE.SITE_ADMINISTRATOR, 100_000],
    [LIMIT.VARIANCE_COP, MATRIX_ROLE.SHIFT_SUPERVISOR, 10_000],
    [LIMIT.VARIANCE_COP, MATRIX_ROLE.SITE_ADMINISTRATOR, 50_000],
    [LIMIT.CASH_OUTFLOW_COP, MATRIX_ROLE.SHIFT_SUPERVISOR, 50_000],
    [LIMIT.WASTE_COP, MATRIX_ROLE.KITCHEN_CHIEF, 30_000],
    [LIMIT.COUNT_ADJUSTMENT_COP, MATRIX_ROLE.SITE_ADMINISTRATOR, 1_000],
    [LIMIT.WAITER_VOID_COUNT, MATRIX_ROLE.WAITER, 3],
  ];

  expect(limitUnit[LIMIT.DISCOUNT_PERCENT]).toBe("percent");
  expect(limitUnit[LIMIT.VOID_COP]).toBe("cop");
  expect(limitUnit[LIMIT.COMP_SHIFT_COP]).toBe("cop");
  expect(limitUnit[LIMIT.VARIANCE_COP]).toBe("cop");
  expect(limitUnit[LIMIT.CASH_OUTFLOW_COP]).toBe("cop");
  expect(limitUnit[LIMIT.WASTE_COP]).toBe("cop");
  expect(limitUnit[LIMIT.COUNT_ADJUSTMENT_COP]).toBe("cop");
  expect(limitUnit[LIMIT.WAITER_VOID_COUNT]).toBe("count");
  for (const [limit, role, cap] of caps) {
    expect(defaultLimit(limit, role)).toBe(cap);
  }
  expect(defaultLimit(LIMIT.DISCOUNT_PERCENT, MATRIX_ROLE.WAITER)).toBeNull();
});
