import { FACTUS_MUNICIPALITIES } from "#adapters/factus/factus-municipalities.js";
import { MunicipalityCatalog } from "#application/ports/municipality-catalog.js";

const codes = new Set(FACTUS_MUNICIPALITIES.map((row) => row.code));

export class FactusMunicipalityCatalog extends MunicipalityCatalog {
  override async find(code: string): Promise<string | null> {
    const trimmed = code.trim();

    return codes.has(trimmed) ? trimmed : null;
  }
}
