import { expect, it } from "vitest";
import { FACTUS_MUNICIPALITIES } from "#adapters/factus/factus-municipalities.js";
import { FactusMunicipalityCatalog } from "#adapters/factus/factus-municipality-catalog.js";
import { municipalityCatalogContract } from "#application/ports/municipality-catalog.contract.js";

const BOGOTA = "11001";

municipalityCatalogContract(() => ({
  catalog: () => new FactusMunicipalityCatalog(),
  knownCode: () => BOGOTA,
}));

it("given the Factus municipality list, when it is loaded, then Bogota is present and the published table is complete", () => {
  expect(FACTUS_MUNICIPALITIES).toHaveLength(1122);
  expect(
    FACTUS_MUNICIPALITIES.some(
      (row) => row.code === BOGOTA && row.name === "Bogotá, D.c.",
    ),
  ).toBe(true);
});

it("given a DANE code with surrounding spaces, when the catalog is read, then the trimmed code is returned", async () => {
  const catalog = new FactusMunicipalityCatalog();

  expect(await catalog.find(" 11001 ")).toBe(BOGOTA);
});
