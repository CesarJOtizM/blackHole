import { describe, expect, it } from "vitest";
import { formatCop, parseCop } from "#src/catalog/source/money.js";

describe("formatCop", () => {
  it("Given 44000 pesos, When formatted, Then it shows the Colombian grouping", () => {
    expect(formatCop(44000)).toBe("$44.000");
  });
});

describe("parseCop", () => {
  it("Given a formatted price, When parsed, Then only the digits remain", () => {
    expect(parseCop("$44.000")).toBe(44000);
  });

  it("Given an empty field, When parsed, Then there is no amount", () => {
    expect(parseCop("")).toBeNull();
  });
});
