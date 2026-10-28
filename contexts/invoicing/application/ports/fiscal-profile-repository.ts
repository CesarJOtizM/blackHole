import type { TaxMarker } from "#application/ports/tax-rule-repository.js";
import type {
  TaxChannel,
  TaxComponent,
  TaxRegime,
} from "#domain/calculate-taxes.js";

export type PersonType = "natural" | "juridical";

export interface SiteMunicipality {
  siteId: string;
  municipality: string;
}

export interface FiscalProfileFields {
  personType: PersonType;
  regime: TaxRegime;
  vatResponsible: boolean;
  incResponsible: boolean;
  rutResponsibilities: readonly string[];
  franchise: boolean;
  municipalities: readonly SiteMunicipality[];
}

export interface FiscalTemplateRule {
  rowId: string;
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

export interface CopiedFiscalRule extends FiscalTemplateRule {
  templateRowId: string;
}

export interface FiscalTemplate {
  id: string;
  name: string;
  profile: FiscalProfileFields;
  rules: readonly FiscalTemplateRule[];
}

export interface AdoptedFiscalProfile {
  tenantId: string;
  taxpayerId: string;
  id: string;
  templateId: string;
  profile: FiscalProfileFields;
  rules: readonly CopiedFiscalRule[];
}

export abstract class FiscalProfileRepository {
  abstract insertTemplate(template: FiscalTemplate): Promise<void>;

  abstract findTemplate(name: string): Promise<FiscalTemplate | undefined>;

  abstract findAdopted(
    tenantId: string,
    profileId: string,
  ): Promise<AdoptedFiscalProfile | undefined>;

  abstract insertAdopted(profile: AdoptedFiscalProfile): Promise<void>;

  abstract saveAdopted(profile: AdoptedFiscalProfile): Promise<void>;
}
