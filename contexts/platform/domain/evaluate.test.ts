import { expect, it } from "vitest";

import { evaluate } from "#domain/evaluate.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const SATURDAY = Date.UTC(2026, 9, 17, 15, 0, 0);
const SUNDAY = Date.UTC(2026, 9, 18, 15, 0, 0);
const SATURDAY_START = Date.UTC(2026, 9, 17, 0, 0, 0);
const SUNDAY_START = Date.UTC(2026, 9, 18, 0, 0, 0);

const site = (id: string, brandId: string | null = null) => ({
  kind: "site" as const,
  id,
  brandId,
});

const base = {
  value: null,
  customRoles: [],
  venueLimits: [],
  shiftTotals: { waiterVoidsBeforeKitchen: 0 },
  selfAuthorizationAttempt: false,
  shiftSelfAuthorization: false,
  authorizerAssignmentCount: 2,
  bartenderChargeEnabled: false,
};

it("given a cashier in site 1 and an administrator in site 2, when they view site 2 audit, then it is allowed and site 1 is denied", () => {
  const assignments = [
    {
      roleId: "cashier",
      scopeKind: "site" as const,
      scopeId: "organization_venue_1",
      validFrom: null,
      validUntil: null,
    },
    {
      roleId: "siteAdministrator",
      scopeKind: "site" as const,
      scopeId: "organization_venue_2",
      validFrom: null,
      validUntil: null,
    },
  ];

  const site2 = evaluate({
    ...base,
    permission: PERMISSION.AUDIT_VIEW,
    at: SATURDAY,
    target: site("organization_venue_2"),
    assignments,
  });
  const site1 = evaluate({
    ...base,
    permission: PERMISSION.AUDIT_VIEW,
    at: SATURDAY,
    target: site("organization_venue_1"),
    assignments,
  });

  expect(site2).toEqual({ outcome: "allowed", selfAuthorized: false });
  expect(site1).toEqual({ outcome: "denied", selfAuthorized: false });
});

it("given a replacement cashier valid only on Saturday, when they charge on Sunday, then it is denied", () => {
  const assignments = [
    {
      roleId: "cashier",
      scopeKind: "site" as const,
      scopeId: "organization_venue_1",
      validFrom: SATURDAY_START,
      validUntil: SUNDAY_START,
    },
  ];

  const result = evaluate({
    ...base,
    permission: PERMISSION.SALE_CHARGE,
    at: SUNDAY,
    target: site("organization_venue_1"),
    assignments,
  });

  expect(result).toEqual({ outcome: "denied", selfAuthorized: false });
});

it("given a cashier with a 5 percent discount cap, when they apply 10 percent, then authorization is required and the cap is returned", () => {
  const result = evaluate({
    ...base,
    permission: PERMISSION.SALE_DISCOUNT,
    at: SATURDAY,
    target: site("organization_venue_1"),
    value: 10,
    assignments: [
      {
        roleId: "cashier",
        scopeKind: "site",
        scopeId: "organization_venue_1",
        validFrom: null,
        validUntil: null,
      },
    ],
  });

  expect(result).toEqual({
    outcome: "requires_authorization",
    exceededLimit: { code: "discountPercent", cap: 5, unit: "percent" },
    selfAuthorized: false,
  });
});

it("given cashier and supervisor caps on one site, when 10 percent is applied, then the most permissive cap wins", () => {
  const result = evaluate({
    ...base,
    permission: PERMISSION.SALE_DISCOUNT,
    at: SATURDAY,
    target: site("organization_venue_1"),
    value: 10,
    assignments: [
      {
        roleId: "cashier",
        scopeKind: "site",
        scopeId: "organization_venue_1",
        validFrom: null,
        validUntil: null,
      },
      {
        roleId: "shiftSupervisor",
        scopeKind: "site",
        scopeId: "organization_venue_1",
        validFrom: null,
        validUntil: null,
      },
    ],
  });

  expect(result).toEqual({ outcome: "allowed", selfAuthorized: false });
});

it("given a company owner, when they charge at a site, then the company scope covers the site", () => {
  const result = evaluate({
    ...base,
    permission: PERMISSION.SALE_CHARGE,
    at: SATURDAY,
    target: site("organization_venue_1", "organization_brand_1"),
    assignments: [
      {
        roleId: "owner",
        scopeKind: "company",
        scopeId: "organization_company_1",
        validFrom: null,
        validUntil: null,
      },
    ],
  });

  expect(result).toEqual({ outcome: "allowed", selfAuthorized: false });
});

it("given a brand manager, when they act at a site of that brand, then the brand covers the site and not another brand", () => {
  const assignments = [
    {
      roleId: "generalManager",
      scopeKind: "brand" as const,
      scopeId: "organization_brand_1",
      validFrom: null,
      validUntil: null,
    },
  ];

  const covered = evaluate({
    ...base,
    permission: PERMISSION.SALE_CHARGE,
    at: SATURDAY,
    target: site("organization_venue_1", "organization_brand_1"),
    assignments,
  });
  const other = evaluate({
    ...base,
    permission: PERMISSION.SALE_CHARGE,
    at: SATURDAY,
    target: site("organization_venue_2", "organization_brand_2"),
    assignments,
  });

  expect(covered).toEqual({ outcome: "allowed", selfAuthorized: false });
  expect(other).toEqual({ outcome: "denied", selfAuthorized: false });
});

it("given self-authorization, when the shift flag or a second authorizer is missing, then it is denied without reading attendance", () => {
  const input = {
    ...base,
    permission: PERMISSION.SALE_VOID_AFTER_KITCHEN,
    at: SATURDAY,
    target: site("organization_venue_1"),
    value: 80_000,
    selfAuthorizationAttempt: true,
    assignments: [
      {
        roleId: "shiftSupervisor",
        scopeKind: "site" as const,
        scopeId: "organization_venue_1",
        validFrom: null,
        validUntil: null,
      },
    ],
  };

  const withoutFlag = evaluate({
    ...input,
    shiftSelfAuthorization: false,
    authorizerAssignmentCount: 1,
  });
  const withCompany = evaluate({
    ...input,
    shiftSelfAuthorization: true,
    authorizerAssignmentCount: 2,
  });
  const sole = evaluate({
    ...input,
    shiftSelfAuthorization: true,
    authorizerAssignmentCount: 1,
  });

  expect(withoutFlag).toEqual({ outcome: "denied", selfAuthorized: false });
  expect(withCompany).toEqual({ outcome: "denied", selfAuthorized: false });
  expect(sole).toEqual({ outcome: "allowed", selfAuthorized: true });
  expect(input).not.toHaveProperty("attendance");
});

it("given three waiter voids already in the shift, when another void is attempted, then the count cap requires authorization", () => {
  const over = evaluate({
    ...base,
    permission: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
    at: SATURDAY,
    target: site("organization_venue_1"),
    value: 1,
    shiftTotals: { waiterVoidsBeforeKitchen: 3 },
    assignments: [
      {
        roleId: "waiter",
        scopeKind: "site",
        scopeId: "organization_venue_1",
        validFrom: null,
        validUntil: null,
      },
    ],
  });
  const within = evaluate({
    ...base,
    permission: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
    at: SATURDAY,
    target: site("organization_venue_1"),
    value: 1,
    shiftTotals: { waiterVoidsBeforeKitchen: 2 },
    assignments: [
      {
        roleId: "waiter",
        scopeKind: "site",
        scopeId: "organization_venue_1",
        validFrom: null,
        validUntil: null,
      },
    ],
  });

  expect(over).toEqual({
    outcome: "requires_authorization",
    exceededLimit: { code: "waiterVoidCount", cap: 3, unit: "count" },
    selfAuthorized: false,
  });
  expect(within).toEqual({ outcome: "allowed", selfAuthorized: false });
});
