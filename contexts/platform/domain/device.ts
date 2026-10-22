const DEVICE_KIND = {
  PERSONAL: "personal",
  FIXED_STATION: "fixed-station",
} as const;

const PIN_ATTEMPT_LIMIT = 5;

export type DeviceKind = (typeof DEVICE_KIND)[keyof typeof DEVICE_KIND];

interface RegisterPersonalDevice {
  id: string;
  venueId: string;
  publicKey: string;
}

interface RegisterFixedDevice {
  id: string;
  venueId: string;
  stationId: string;
  displayName: string;
  publicKey: string;
}

interface DeviceState {
  id: string;
  venueId: string;
  kind: DeviceKind;
  stationId: string | null;
  publicKey: string;
  displayName: string;
}

export interface DeviceRecord {
  id: string;
  venueId: string;
  kind: DeviceKind;
  stationId: string | null;
  publicKey: string;
  displayName: string;
  pinFailures: number;
  pinAttemptsLocked: boolean;
  revoked: boolean;
}

export interface PublicDevice {
  id: string;
  venueId: string;
  kind: DeviceKind;
  stationId: string | null;
  publicKey: string;
  pinAttemptsLocked: boolean;
  pinFailures: number;
  revoked: boolean;
}

export class Device {
  readonly id: string;
  readonly venueId: string;
  readonly kind: DeviceKind;
  readonly stationId: string | null;
  readonly publicKey: string;
  readonly displayName: string;
  private pinFailures = 0;
  private locked = false;
  private revokedAt = false;

  private constructor(input: DeviceState) {
    this.id = input.id;
    this.venueId = input.venueId;
    this.kind = input.kind;
    this.stationId = input.stationId;
    this.publicKey = input.publicKey;
    this.displayName = input.displayName;
  }

  static registerPersonal(input: RegisterPersonalDevice): Device {
    return new Device({
      id: input.id,
      venueId: input.venueId,
      kind: DEVICE_KIND.PERSONAL,
      stationId: null,
      publicKey: input.publicKey,
      displayName: "",
    });
  }

  static registerFixed(input: RegisterFixedDevice): Device {
    return new Device({
      id: input.id,
      venueId: input.venueId,
      kind: DEVICE_KIND.FIXED_STATION,
      stationId: input.stationId,
      publicKey: input.publicKey,
      displayName: input.displayName,
    });
  }

  static restore(record: DeviceRecord): Device {
    const device = new Device({
      id: record.id,
      venueId: record.venueId,
      kind: record.kind,
      stationId: record.stationId,
      publicKey: record.publicKey,
      displayName: record.displayName,
    });
    device.pinFailures = record.pinFailures;
    device.locked = record.pinAttemptsLocked;
    device.revokedAt = record.revoked;

    return device;
  }

  get isPersonal(): boolean {
    return this.kind === DEVICE_KIND.PERSONAL;
  }

  get isFixedStation(): boolean {
    return this.kind === DEVICE_KIND.FIXED_STATION;
  }

  get pinAttemptsLocked(): boolean {
    return this.locked;
  }

  get revoked(): boolean {
    return this.revokedAt;
  }

  revoke(): void {
    this.revokedAt = true;
  }

  recordFailedPin(): void {
    this.pinFailures += 1;

    if (this.pinFailures >= PIN_ATTEMPT_LIMIT) {
      this.locked = true;
    }
  }

  resetPinAttempts(): void {
    this.pinFailures = 0;
    this.locked = false;
  }

  toRecord(): DeviceRecord {
    return {
      id: this.id,
      venueId: this.venueId,
      kind: this.kind,
      stationId: this.stationId,
      publicKey: this.publicKey,
      displayName: this.displayName,
      pinFailures: this.pinFailures,
      pinAttemptsLocked: this.locked,
      revoked: this.revokedAt,
    };
  }

  toPublic(): PublicDevice {
    return {
      id: this.id,
      venueId: this.venueId,
      kind: this.kind,
      stationId: this.stationId,
      publicKey: this.publicKey,
      pinAttemptsLocked: this.locked,
      pinFailures: this.pinFailures,
      revoked: this.revokedAt,
    };
  }
}
