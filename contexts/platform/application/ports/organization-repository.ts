import type { Organization } from "#domain/organization.js";

const VENUE_MODE = {
  CLOUD: "cloud",
} as const;

const LOCATION_KIND = {
  POINT: "point",
  WAREHOUSE: "warehouse",
} as const;

const DRAWER = {
  PRESENT: "present",
  ABSENT: "absent",
} as const;

type VenueMode = (typeof VENUE_MODE)[keyof typeof VENUE_MODE];

type LocationKind = (typeof LOCATION_KIND)[keyof typeof LOCATION_KIND];

type Drawer = (typeof DRAWER)[keyof typeof DRAWER];

export interface OrganizationTaxpayer {
  id: string;
  nit: string;
  taxProfileId: string;
}

export interface OrganizationBrand {
  id: string;
  name: string;
}

export interface OrganizationVenue {
  id: string;
  name: string;
  brandId: string;
  invoicingTaxpayerId: string;
  mode: VenueMode;
}

export interface OrganizationLocation {
  id: string;
  name: string;
  kind: LocationKind;
  venueId: string | null;
}

export interface OrganizationKitchenStation {
  id: string;
  venueId: string;
  name: string;
  printerId: string | null;
}

export interface OrganizationCashRegister {
  id: string;
  venueId: string;
  name: string;
  drawer: Drawer;
  printerId: string | null;
}

export interface OrganizationSnapshot {
  id: string;
  name: string;
  taxpayers: readonly OrganizationTaxpayer[];
  brands: readonly OrganizationBrand[];
  venues: readonly OrganizationVenue[];
  locations: readonly OrganizationLocation[];
  kitchenStations: readonly OrganizationKitchenStation[];
  cashRegisters: readonly OrganizationCashRegister[];
}

export interface OrganizationChanged {
  actorId: string;
  before: OrganizationSnapshot;
  after: OrganizationSnapshot;
}

export abstract class OrganizationRepository {
  abstract load(tenantId: string): Promise<Organization | null>;

  abstract save(
    organization: Organization,
    event: OrganizationChanged,
  ): Promise<void>;
}
