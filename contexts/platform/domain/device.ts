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

export interface PublicDevice {
  id: string;
  venueId: string;
  kind: DeviceKind;
  stationId: string | null;
  publicKey: string;
  pinAttemptsLocked: boolean;
  pinFailures: number;
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

  get isPersonal(): boolean {
    return this.kind === DEVICE_KIND.PERSONAL;
  }

  get isFixedStation(): boolean {
    return this.kind === DEVICE_KIND.FIXED_STATION;
  }

  get pinAttemptsLocked(): boolean {
    return this.locked;
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

  toPublic(): PublicDevice {
    return {
      id: this.id,
      venueId: this.venueId,
      kind: this.kind,
      stationId: this.stationId,
      publicKey: this.publicKey,
      pinAttemptsLocked: this.locked,
      pinFailures: this.pinFailures,
    };
  }
}
