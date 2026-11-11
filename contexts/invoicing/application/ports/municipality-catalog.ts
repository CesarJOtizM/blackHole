export abstract class MunicipalityCatalog {
  abstract find(code: string): Promise<string | null>;
}
