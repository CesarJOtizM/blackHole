const VENUE_MODE = {
  CLOUD: "cloud",
} as const;

const INVENTORY_LOCATION_KIND = {
  POINT: "point",
  WAREHOUSE: "warehouse",
} as const;

const ORGANIZATION_ID_PREFIX = "organization_";

const DRAWER = {
  PRESENT: "present",
  ABSENT: "absent",
} as const;

type VenueMode = (typeof VENUE_MODE)[keyof typeof VENUE_MODE];

type InventoryLocationKind =
  (typeof INVENTORY_LOCATION_KIND)[keyof typeof INVENTORY_LOCATION_KIND];

type Drawer = (typeof DRAWER)[keyof typeof DRAWER];

interface Taxpayer {
  id: string;
  nit: string;
  taxProfileId: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
  brandId: string;
  invoicingTaxpayerId: string;
  mode: VenueMode;
}

interface InventoryLocation {
  id: string;
  name: string;
  kind: InventoryLocationKind;
  venueId: string | null;
}

interface KitchenStation {
  id: string;
  venueId: string;
  name: string;
  printerId: string | null;
}

interface CashRegister {
  id: string;
  venueId: string;
  name: string;
  drawer: Drawer;
  printerId: string | null;
}

interface RegisterCompany {
  id: string;
  name: string;
}

interface AddTaxpayer {
  id: string;
  nit: string;
  taxProfileId: string;
}

interface AddBrand {
  id: string;
  name: string;
}

interface OpenVenue {
  id: string;
  name: string;
  brandId: string;
  taxpayerId: string;
  pointId: string;
}

interface AddPoint {
  id: string;
  venueId: string;
  name: string;
}

interface AssignInvoicingTaxpayer {
  venueId: string;
  taxpayerId: string;
}

interface AddKitchenStation {
  id: string;
  venueId: string;
  name: string;
  printerId?: string | null;
}

interface AddCashRegister {
  id: string;
  venueId: string;
  name: string;
  drawer?: Drawer;
  printerId?: string | null;
}

interface AddVenueItem {
  id: string;
  venueId: string;
  name: string;
}

interface RenameCashRegister {
  venueId: string;
  registerId: string;
  name: string;
}

interface AddGeneralWarehouse {
  id: string;
  name: string;
}

interface AssignStock {
  stationId: string;
  quantity: number;
}

export class DuplicateNit extends Error {
  constructor() {
    super("A taxpayer with this NIT already belongs to the company.");
    this.name = "DuplicateNit";
  }
}

export class DuplicateOrganizationId extends Error {
  constructor() {
    super("That organization identifier is already in use.");
    this.name = "DuplicateOrganizationId";
  }
}

export class InvalidOrganizationId extends Error {
  constructor() {
    super("An organization identifier must use the organization_ prefix.");
    this.name = "InvalidOrganizationId";
  }
}

export class InvoicingTaxpayerAlreadyAssigned extends Error {
  constructor() {
    super(
      "The venue already invoices through one taxpayer. Replace it explicitly.",
    );
    this.name = "InvoicingTaxpayerAlreadyAssigned";
  }
}

export class PointAlreadyOpen extends Error {
  constructor() {
    super("The venue already has its point location.");
    this.name = "PointAlreadyOpen";
  }
}

export class StockNotHeld extends Error {
  constructor() {
    super("A kitchen station routes items and does not hold stock.");
    this.name = "StockNotHeld";
  }
}

export class UnknownOrganizationReference extends Error {
  constructor() {
    super("The organization does not include that reference.");
    this.name = "UnknownOrganizationReference";
  }
}

function assertOrganizationId(id: string): void {
  if (
    !id.startsWith(ORGANIZATION_ID_PREFIX) ||
    id.length === ORGANIZATION_ID_PREFIX.length
  ) {
    throw new InvalidOrganizationId();
  }
}

export class Organization {
  readonly id: string;
  readonly name: string;

  private readonly takenIds = new Set<string>();
  private readonly taxpayerList: Taxpayer[] = [];
  private readonly brandList: Brand[] = [];
  private readonly venueList: Venue[] = [];
  private readonly locationList: InventoryLocation[] = [];
  private readonly stationList: KitchenStation[] = [];
  private readonly registerList: CashRegister[] = [];

  private constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.takenIds.add(id);
  }

  static registerCompany(input: RegisterCompany): Organization {
    assertOrganizationId(input.id);

    return new Organization(input.id, input.name);
  }

  get taxpayers(): readonly Taxpayer[] {
    return this.taxpayerList.map((taxpayer) => ({ ...taxpayer }));
  }

  get brands(): readonly Brand[] {
    return this.brandList.map((brand) => ({ ...brand }));
  }

  get venues(): readonly Venue[] {
    return this.venueList.map((venue) => ({ ...venue }));
  }

  get locations(): readonly InventoryLocation[] {
    return this.locationList.map((location) => ({ ...location }));
  }

  get kitchenStations(): readonly KitchenStation[] {
    return this.stationList.map((station) => ({ ...station }));
  }

  get cashRegisters(): readonly CashRegister[] {
    return this.registerList.map((register) => ({ ...register }));
  }

  addTaxpayer(input: AddTaxpayer): void {
    this.reserve(input.id);

    if (this.taxpayerList.some((taxpayer) => taxpayer.nit === input.nit)) {
      throw new DuplicateNit();
    }

    this.commit(input.id);
    this.taxpayerList.push({
      id: input.id,
      nit: input.nit,
      taxProfileId: input.taxProfileId,
    });
  }

  addBrand(input: AddBrand): void {
    this.reserve(input.id);
    this.commit(input.id);
    this.brandList.push({
      id: input.id,
      name: input.name,
    });
  }

  openVenue(input: OpenVenue): void {
    assertOrganizationId(input.brandId);
    assertOrganizationId(input.taxpayerId);
    this.reserve(input.id);
    this.reserve(input.pointId);
    this.brandById(input.brandId);
    this.taxpayerById(input.taxpayerId);

    if (input.id === input.pointId) {
      throw new DuplicateOrganizationId();
    }

    this.commit(input.id);
    this.commit(input.pointId);
    this.venueList.push({
      id: input.id,
      name: input.name,
      brandId: input.brandId,
      invoicingTaxpayerId: input.taxpayerId,
      mode: VENUE_MODE.CLOUD,
    });
    this.locationList.push({
      id: input.pointId,
      name: input.name,
      kind: INVENTORY_LOCATION_KIND.POINT,
      venueId: input.id,
    });
  }

  addPoint(input: AddPoint): void {
    assertOrganizationId(input.venueId);
    const venue = this.venueById(input.venueId);

    if (this.hasPoint(venue.id)) {
      throw new PointAlreadyOpen();
    }

    this.reserve(input.id);
    this.commit(input.id);
    this.locationList.push({
      id: input.id,
      name: input.name,
      kind: INVENTORY_LOCATION_KIND.POINT,
      venueId: venue.id,
    });
  }

  addInvoicingTaxpayer(input: AssignInvoicingTaxpayer): void {
    assertOrganizationId(input.venueId);
    assertOrganizationId(input.taxpayerId);
    const venue = this.venueById(input.venueId);
    this.taxpayerById(input.taxpayerId);

    if (venue.invoicingTaxpayerId !== "") {
      throw new InvoicingTaxpayerAlreadyAssigned();
    }

    venue.invoicingTaxpayerId = input.taxpayerId;
  }

  replaceInvoicingTaxpayer(input: AssignInvoicingTaxpayer): void {
    assertOrganizationId(input.venueId);
    assertOrganizationId(input.taxpayerId);
    const venue = this.venueById(input.venueId);
    this.taxpayerById(input.taxpayerId);
    venue.invoicingTaxpayerId = input.taxpayerId;
  }

  addKitchenStation(input: AddKitchenStation): void {
    assertOrganizationId(input.venueId);
    this.reserve(input.id);
    this.venueById(input.venueId);
    this.commit(input.id);
    this.stationList.push({
      id: input.id,
      venueId: input.venueId,
      name: input.name,
      printerId: input.printerId ?? null,
    });
  }

  addCashRegister(input: AddCashRegister): void {
    assertOrganizationId(input.venueId);
    this.reserve(input.id);
    this.venueById(input.venueId);
    this.commit(input.id);
    this.registerList.push({
      id: input.id,
      venueId: input.venueId,
      name: input.name,
      drawer: input.drawer ?? DRAWER.ABSENT,
      printerId: input.printerId ?? null,
    });
  }

  renameCashRegister(input: RenameCashRegister): void {
    assertOrganizationId(input.venueId);
    assertOrganizationId(input.registerId);
    const register = this.registerList.find(
      (item) => item.id === input.registerId && item.venueId === input.venueId,
    );

    if (!register) {
      throw new UnknownOrganizationReference();
    }

    register.name = input.name;
  }

  addSiteWarehouse(input: AddVenueItem): void {
    assertOrganizationId(input.venueId);
    this.reserve(input.id);
    this.venueById(input.venueId);
    this.commit(input.id);
    this.locationList.push({
      id: input.id,
      name: input.name,
      kind: INVENTORY_LOCATION_KIND.WAREHOUSE,
      venueId: input.venueId,
    });
  }

  addGeneralWarehouse(input: AddGeneralWarehouse): void {
    this.reserve(input.id);
    this.commit(input.id);
    this.locationList.push({
      id: input.id,
      name: input.name,
      kind: INVENTORY_LOCATION_KIND.WAREHOUSE,
      venueId: null,
    });
  }

  assignStock(_input: AssignStock): void {
    throw new StockNotHeld();
  }

  private reserve(id: string): void {
    assertOrganizationId(id);

    if (this.takenIds.has(id)) {
      throw new DuplicateOrganizationId();
    }
  }

  private commit(id: string): void {
    this.takenIds.add(id);
  }

  private taxpayerById(id: string): Taxpayer {
    const taxpayer = this.taxpayerList.find((item) => item.id === id);

    if (!taxpayer) {
      throw new UnknownOrganizationReference();
    }

    return taxpayer;
  }

  private brandById(id: string): Brand {
    const brand = this.brandList.find((item) => item.id === id);

    if (!brand) {
      throw new UnknownOrganizationReference();
    }

    return brand;
  }

  private venueById(id: string): Venue {
    const venue = this.venueList.find((item) => item.id === id);

    if (!venue) {
      throw new UnknownOrganizationReference();
    }

    return venue;
  }

  private hasPoint(venueId: string): boolean {
    return this.locationList.some(
      (location) =>
        location.venueId === venueId &&
        location.kind === INVENTORY_LOCATION_KIND.POINT,
    );
  }
}
