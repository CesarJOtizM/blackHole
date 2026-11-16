export const MATRIX_ROLE = {
  OWNER: "owner",
  GENERAL_MANAGER: "generalManager",
  SITE_ADMINISTRATOR: "siteAdministrator",
  SHIFT_SUPERVISOR: "shiftSupervisor",
  CASHIER: "cashier",
  WAITER: "waiter",
  KITCHEN_CHIEF: "kitchenChief",
  WAREHOUSE_KEEPER: "warehouseKeeper",
} as const;

export const MATRIX_ROLES = [
  MATRIX_ROLE.OWNER,
  MATRIX_ROLE.GENERAL_MANAGER,
  MATRIX_ROLE.SITE_ADMINISTRATOR,
  MATRIX_ROLE.SHIFT_SUPERVISOR,
  MATRIX_ROLE.CASHIER,
  MATRIX_ROLE.WAITER,
  MATRIX_ROLE.KITCHEN_CHIEF,
  MATRIX_ROLE.WAREHOUSE_KEEPER,
] as const;

export type MatrixRole = (typeof MATRIX_ROLE)[keyof typeof MATRIX_ROLE];

export const GRANT = {
  YES: "yes",
  WITH_LIMIT: "with_limit",
  WITH_AUTHORIZATION: "with_authorization",
  NO: "no",
} as const;

export type Grant = (typeof GRANT)[keyof typeof GRANT];

export const PERMISSION = {
  SALE_OPEN_TABLE: "sale.open-table",
  SALE_VOID_BEFORE_KITCHEN: "sale.void-before-kitchen",
  SALE_VOID_AFTER_KITCHEN: "sale.void-after-kitchen",
  SALE_VOID_ACCOUNT: "sale.void-account",
  SALE_DISCOUNT: "sale.discount",
  SALE_COMP: "sale.comp",
  SALE_CHANGE_PRICE: "sale.change-price",
  SALE_EDIT_PRINTED_CHECK: "sale.edit-printed-check",
  SALE_MOVE_ITEMS: "sale.move-items",
  SALE_TRANSFER_TABLE: "sale.transfer-table",
  SALE_VIEW_OTHER_CHECKS: "sale.view-other-checks",
  CASH_OPEN_SHIFT: "cash.open-shift",
  SALE_CHARGE: "sale.charge",
  CASH_VIEW_EXPECTED_TOTAL: "cash.view-expected-total",
  CASH_APPROVE_VARIANCE: "cash.approve-variance",
  CASH_OPEN_DRAWER: "cash.open-drawer",
  CASH_MOVEMENT: "cash.movement",
  CASH_PARTIAL_WITHDRAWAL: "cash.partial-withdrawal",
  SALE_CHANGE_TENDER: "sale.change-tender",
  SALE_REOPEN_PAID: "sale.reopen-paid",
  SALE_REPRINT: "sale.reprint",
  SALE_CREDIT_NOTE: "sale.credit-note",
  CASH_SETTLE_TIPS: "cash.settle-tips",
  INVENTORY_RECORD_WASTE: "inventory.record-waste",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_COUNT: "inventory.count",
  INVENTORY_APPROVE_COUNT: "inventory.approve-count",
  INVENTORY_RECEIVE_PURCHASE: "inventory.receive-purchase",
  INVENTORY_RECEIVE_TRANSFER: "inventory.receive-transfer",
  INVENTORY_REQUEST_REPLENISHMENT: "inventory.request-replenishment",
  INVENTORY_CONFIRM_NO_RESTOCK: "inventory.confirm-no-restock",
  INVENTORY_REMOVE_NO_RESTOCK: "inventory.remove-no-restock",
  RECIPE_EDIT: "recipe.edit",
  INVENTORY_VIEW_COST: "inventory.view-cost",
  INVENTORY_CONFIGURE_LEVELS: "inventory.configure-levels",
  IDENTITY_ASSIGN_ROLE: "identity.assign-role",
  DEVICE_REGISTER: "device.register",
  ATTENDANCE_CORRECT: "attendance.correct",
  RESERVATION_VERIFY_PAYMENT: "reservation.verify-payment",
  RESERVATION_APPROVE_REFUND: "reservation.approve-refund",
  PLATFORM_ACCEPT_ORDER: "platform.accept-order",
  PLATFORM_PAUSE: "platform.pause",
  MENU_EDIT: "menu.edit",
  REPORT_VIEW_SALES: "report.view-sales",
  CUSTOMER_EXPORT: "customer.export",
  AUDIT_VIEW: "audit.view",
  TAX_CONFIGURE: "tax.configure",
  ORGANIZATION_STRUCTURE: "organization.structure",
  INVENTORY_RECORD_PRODUCTION: "inventory.record-production",
} as const;

export type PermissionCode = (typeof PERMISSION)[keyof typeof PERMISSION];

export const LIMIT = {
  DISCOUNT_PERCENT: "discountPercent",
  VOID_COP: "voidCop",
  COMP_SHIFT_COP: "compShiftCop",
  VARIANCE_COP: "varianceCop",
  CASH_OUTFLOW_COP: "cashOutflowCop",
  WASTE_COP: "wasteCop",
  COUNT_ADJUSTMENT_COP: "countAdjustmentCop",
  WAITER_VOID_COUNT: "waiterVoidCount",
} as const;

export type LimitCode = (typeof LIMIT)[keyof typeof LIMIT];

export const LIMIT_UNIT = {
  PERCENT: "percent",
  COP: "cop",
  COUNT: "count",
} as const;

export type LimitUnit = (typeof LIMIT_UNIT)[keyof typeof LIMIT_UNIT];

export const SCOPE_KIND = {
  COMPANY: "company",
  BRAND: "brand",
  SITE: "site",
  WAREHOUSE: "warehouse",
  TAXPAYER: "taxpayer",
} as const;

export type ScopeKind = (typeof SCOPE_KIND)[keyof typeof SCOPE_KIND];

export const proseRoles = [
  "host",
  "kitchenStation",
  "bartender",
  "purchasing",
  "delivery",
  "accountant",
  "auditor",
] as const;

export const BARTENDER_CHARGE_DEFAULT = false;

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

export const permissionMatrix = {
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
  [PERMISSION.INVENTORY_CONFIRM_NO_RESTOCK]: cells(Y, Y, Y, N, N, N, Y, N),
  [PERMISSION.INVENTORY_REMOVE_NO_RESTOCK]: cells(Y, Y, Y, N, N, N, Y, N),
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
  [PERMISSION.TAX_CONFIGURE]: cells(Y, N, N, N, N, N, N, N),
  [PERMISSION.ORGANIZATION_STRUCTURE]: cells(Y, N, N, N, N, N, N, N),
  [PERMISSION.INVENTORY_RECORD_PRODUCTION]: cells(Y, Y, Y, N, N, N, Y, Y),
} as const satisfies Record<PermissionCode, Record<MatrixRole, Grant>>;

const DEFAULT_CAPS: Record<LimitCode, Partial<Record<MatrixRole, number>>> = {
  [LIMIT.DISCOUNT_PERCENT]: {
    [MATRIX_ROLE.CASHIER]: 5,
    [MATRIX_ROLE.SHIFT_SUPERVISOR]: 15,
    [MATRIX_ROLE.SITE_ADMINISTRATOR]: 30,
  },
  [LIMIT.VOID_COP]: {
    [MATRIX_ROLE.SHIFT_SUPERVISOR]: 50_000,
  },
  [LIMIT.COMP_SHIFT_COP]: {
    [MATRIX_ROLE.SITE_ADMINISTRATOR]: 100_000,
  },
  [LIMIT.VARIANCE_COP]: {
    [MATRIX_ROLE.SHIFT_SUPERVISOR]: 10_000,
    [MATRIX_ROLE.SITE_ADMINISTRATOR]: 50_000,
  },
  [LIMIT.CASH_OUTFLOW_COP]: {
    [MATRIX_ROLE.SHIFT_SUPERVISOR]: 50_000,
  },
  [LIMIT.WASTE_COP]: {
    [MATRIX_ROLE.KITCHEN_CHIEF]: 30_000,
  },
  [LIMIT.COUNT_ADJUSTMENT_COP]: {
    [MATRIX_ROLE.SITE_ADMINISTRATOR]: 1_000,
  },
  [LIMIT.WAITER_VOID_COUNT]: {
    [MATRIX_ROLE.WAITER]: 3,
  },
};

export const limitUnit: Record<LimitCode, LimitUnit> = {
  [LIMIT.DISCOUNT_PERCENT]: LIMIT_UNIT.PERCENT,
  [LIMIT.VOID_COP]: LIMIT_UNIT.COP,
  [LIMIT.COMP_SHIFT_COP]: LIMIT_UNIT.COP,
  [LIMIT.VARIANCE_COP]: LIMIT_UNIT.COP,
  [LIMIT.CASH_OUTFLOW_COP]: LIMIT_UNIT.COP,
  [LIMIT.WASTE_COP]: LIMIT_UNIT.COP,
  [LIMIT.COUNT_ADJUSTMENT_COP]: LIMIT_UNIT.COP,
  [LIMIT.WAITER_VOID_COUNT]: LIMIT_UNIT.COUNT,
};

export const permissionLimit: Partial<Record<PermissionCode, LimitCode>> = {
  [PERMISSION.SALE_DISCOUNT]: LIMIT.DISCOUNT_PERCENT,
  [PERMISSION.SALE_VOID_AFTER_KITCHEN]: LIMIT.VOID_COP,
  [PERMISSION.SALE_VOID_BEFORE_KITCHEN]: LIMIT.WAITER_VOID_COUNT,
  [PERMISSION.SALE_COMP]: LIMIT.COMP_SHIFT_COP,
  [PERMISSION.CASH_APPROVE_VARIANCE]: LIMIT.VARIANCE_COP,
  [PERMISSION.CASH_MOVEMENT]: LIMIT.CASH_OUTFLOW_COP,
  [PERMISSION.INVENTORY_RECORD_WASTE]: LIMIT.WASTE_COP,
  [PERMISSION.INVENTORY_APPROVE_COUNT]: LIMIT.COUNT_ADJUSTMENT_COP,
};

const GRANT_RANK: Record<Grant, number> = {
  [GRANT.NO]: 0,
  [GRANT.WITH_AUTHORIZATION]: 1,
  [GRANT.WITH_LIMIT]: 2,
  [GRANT.YES]: 3,
};

export const authorizePermission = (permission: PermissionCode): string =>
  `${permission}.authorize`;

export const authorizeGrant = (grant: Grant): Grant =>
  grant === GRANT.YES || grant === GRANT.WITH_LIMIT ? grant : GRANT.NO;

export const defaultLimit = (
  limit: LimitCode,
  role: MatrixRole,
): number | null => DEFAULT_CAPS[limit][role] ?? null;

export const isMatrixRole = (roleId: string): roleId is MatrixRole =>
  MATRIX_ROLES.some((role) => role === roleId);

export const grantRank = (grant: Grant): number => GRANT_RANK[grant];

export const permissionCodes = Object.values(PERMISSION);
