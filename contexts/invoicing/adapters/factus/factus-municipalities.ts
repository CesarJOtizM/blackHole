import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface FactusMunicipality {
  code: string;
  name: string;
  departmentCode: string;
  departmentName: string;
}

export class InvalidFactusMunicipalityList extends Error {
  constructor() {
    super("The Factus municipality list is not the published DANE table.");
    this.name = "InvalidFactusMunicipalityList";
  }
}

const MUNICIPALITY_CODE = /^\d{5}$/;
const DEPARTMENT_CODE = /^\d{2}$/;

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const readMunicipality = (value: unknown): FactusMunicipality | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const row = value as Record<string, unknown>;
  const code = text(row.code);
  const name = text(row.name);
  const departmentCode = text(row.departmentCode);
  const departmentName = text(row.departmentName);

  if (
    code === undefined ||
    name === undefined ||
    departmentCode === undefined ||
    departmentName === undefined ||
    !MUNICIPALITY_CODE.test(code) ||
    !DEPARTMENT_CODE.test(departmentCode) ||
    Object.keys(row).length !== 4
  ) {
    return undefined;
  }

  return { code, name, departmentCode, departmentName };
};

const readList = (value: unknown): readonly FactusMunicipality[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidFactusMunicipalityList();
  }

  const rows: FactusMunicipality[] = [];
  const codes = new Set<string>();

  for (const entry of value) {
    const row = readMunicipality(entry);

    if (row === undefined || codes.has(row.code)) {
      throw new InvalidFactusMunicipalityList();
    }

    codes.add(row.code);
    rows.push(row);
  }

  return rows;
};

const source = readFileSync(
  fileURLToPath(new URL("./municipalities.json", import.meta.url)),
  "utf8",
);

export const FACTUS_MUNICIPALITIES = readList(JSON.parse(source));
