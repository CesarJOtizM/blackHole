import { expect, it } from "vitest";

import { isReinvoiceWindowOpen as isReinvoiceWindowOpenFromDomain } from "#domain/index.js";
import { isReinvoiceWindowOpen } from "#domain/reinvoice-window.js";

const ISSUED_BEFORE_BOGOTA_MIDNIGHT = "2026-11-05T04:30:00.000Z";
const AT_AFTER_BOGOTA_MIDNIGHT = "2026-11-05T05:30:00.000Z";
const ISSUED_BOGOTA_DAY_START = "2026-11-05T05:30:00.000Z";
const AT_BOGOTA_DAY_END = "2026-11-06T04:30:00.000Z";
const ISSUED_BEFORE_BOGOTA_MONTH = "2026-11-01T04:30:00.000Z";
const AT_AFTER_BOGOTA_MONTH = "2026-11-01T05:30:00.000Z";
const AT_EARLIER_SAME_BOGOTA_DAY = "2026-11-05T05:00:00.000Z";

it("given 23:30 and 00:30 across a Bogota date that a UTC date would treat as one day, when the window is same_day, then it is closed", () => {
  const open = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BEFORE_BOGOTA_MIDNIGHT,
    at: AT_AFTER_BOGOTA_MIDNIGHT,
    mode: "same_day",
  });

  expect(open).toBe(false);
});

it("given those instants still fall in November in Bogota, when the window is same_month, then it is open", () => {
  const open = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BEFORE_BOGOTA_MIDNIGHT,
    at: AT_AFTER_BOGOTA_MIDNIGHT,
    mode: "same_month",
  });

  expect(open).toBe(true);
});

it("given 00:30 and 23:30 on one Bogota date that spans two UTC dates, when the window is same_day, then it is open", () => {
  const open = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BOGOTA_DAY_START,
    at: AT_BOGOTA_DAY_END,
    mode: "same_day",
  });

  expect(open).toBe(true);
});

it("given 23:30 on the last Bogota day of October and 00:30 on 1 November, when the window is same_month, then it is closed", () => {
  const open = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BEFORE_BOGOTA_MONTH,
    at: AT_AFTER_BOGOTA_MONTH,
    mode: "same_month",
  });

  expect(open).toBe(false);
});

it("given that Bogota month boundary, when the window is same_day, then it is closed", () => {
  const open = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BEFORE_BOGOTA_MONTH,
    at: AT_AFTER_BOGOTA_MONTH,
    mode: "same_day",
  });

  expect(open).toBe(false);
});

it("given a same Bogota day, when the window is off, then it is closed", () => {
  const open = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BOGOTA_DAY_START,
    at: AT_BOGOTA_DAY_END,
    mode: "off",
  });

  expect(open).toBe(false);
});

it("given no mode and one Bogota day, when the window is checked, then the same_day default is open", () => {
  const open = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BOGOTA_DAY_START,
    at: AT_BOGOTA_DAY_END,
  });

  expect(open).toBe(true);
});

it("given no mode and a Bogota date change inside November, when the window is checked, then the same_day default is closed", () => {
  const open = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BEFORE_BOGOTA_MIDNIGHT,
    at: AT_AFTER_BOGOTA_MIDNIGHT,
  });

  expect(open).toBe(false);
});

it("given a check earlier on the same Bogota date, when the window is same_day or same_month, then it is closed", () => {
  const sameDay = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BOGOTA_DAY_START,
    at: AT_EARLIER_SAME_BOGOTA_DAY,
    mode: "same_day",
  });
  const sameMonth = isReinvoiceWindowOpen({
    issuedAt: ISSUED_BOGOTA_DAY_START,
    at: AT_EARLIER_SAME_BOGOTA_DAY,
    mode: "same_month",
  });

  expect(sameDay).toBe(false);
  expect(sameMonth).toBe(false);
});

it("given the invoicing domain, when the reinvoice window is exported, then the open check is that function", () => {
  expect(isReinvoiceWindowOpenFromDomain).toBe(isReinvoiceWindowOpen);
});
