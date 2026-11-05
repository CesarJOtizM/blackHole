// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const themeSource = readFileSync(
  new URL("../src/theme.css", import.meta.url),
  "utf8",
);

const requiredTokens = [
  "--color-surface",
  "--color-ink",
  "--color-ink-muted",
  "--color-border",
  "--color-action",
  "--color-danger",
  "--color-ready",
  "--color-table-free",
  "--color-table-occupied",
  "--color-table-check",
  "--color-table-clean",
  "--color-kitchen-surface",
  "--font-sans",
  "--font-display",
  "--text-body",
  "--text-title",
];

describe("theme tokens", () => {
  it("Given the Servicio theme, When read, Then every semantic token is declared in @theme", () => {
    const themeBlock = themeSource.slice(themeSource.indexOf("@theme"));

    for (const token of requiredTokens) {
      expect(themeBlock, token).toContain(`${token}:`);
    }
  });

  it("Given the Servicio theme, When read, Then it does not expose raw stone palette names", () => {
    expect(themeSource).not.toMatch(/stone-\d{2,3}/);
  });
});
