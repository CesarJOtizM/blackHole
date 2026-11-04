export interface OpenShiftQuery {
  tenantId: string;
  venueId: string;
  shiftId: string;
}

export abstract class OpenShiftReader {
  abstract isOpen(query: OpenShiftQuery): Promise<boolean>;
}
