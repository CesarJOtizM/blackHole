import { expect, it } from "vitest";

import type { MunicipalityCatalog } from "#application/ports/municipality-catalog.js";

export interface MunicipalityCatalogHarness {
  catalog(): MunicipalityCatalog;
  knownCode(): string;
}

export function municipalityCatalogContract(
  open: () => MunicipalityCatalogHarness | Promise<MunicipalityCatalogHarness>,
): void {
  it("given a known DANE code and an unknown code, when the catalog is read, then the known code is returned and the unknown code is absent", async () => {
    const opened = await open();
    const catalog = opened.catalog();
    const knownCode = opened.knownCode();

    expect(await catalog.find(knownCode)).toBe(knownCode);
    expect(await catalog.find("99999")).toBeNull();
  });
}
