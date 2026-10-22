export class PinConfirmationRejected extends Error {
  constructor() {
    super("The PIN was rejected.");
    this.name = "PinConfirmationRejected";
  }
}

export class PinConfirmationLocked extends Error {
  constructor() {
    super("The PIN is locked after five failures.");
    this.name = "PinConfirmationLocked";
  }
}

export interface PinConfirmation {
  tenantId: string;
  userId: string;
  pin: string;
  sessionId: string;
}

export abstract class PinVerifier {
  abstract confirm(input: PinConfirmation): Promise<void>;
}
