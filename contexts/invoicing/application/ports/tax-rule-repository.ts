import type {
  TaxChannel,
  TaxComponent,
  TaxRegime,
} from "#domain/calculate-taxes.js";

export type TaxMarker = "is_excluded" | "not_taxed";

export interface PublishedTaxRule {
  tenantId: string;
  id: string;
  version: number;
  name: string;
  taxClassification: string;
  regime?: TaxRegime;
  vatResponsible?: boolean;
  incResponsible?: boolean;
  franchise?: boolean;
  channel?: TaxChannel;
  validFrom: string;
  validTo?: string;
  taxes: readonly TaxComponent[];
  fixedCop?: number;
  marker?: TaxMarker;
  rutResponsibilities: readonly string[];
}

export abstract class TaxRuleRepository {
  abstract list(tenantId: string): Promise<readonly PublishedTaxRule[]>;

  abstract insert(rule: PublishedTaxRule): Promise<void>;
}
