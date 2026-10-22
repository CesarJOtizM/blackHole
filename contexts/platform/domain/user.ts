interface RegisterUser {
  id: string;
  displayName: string;
  passwordHash: string;
  pinHash: string;
}

export interface PublicUser {
  id: string;
  displayName: string;
  active: boolean;
  secondFactorEnrolled: boolean;
  failedFactorAttempts: number;
}

export class User {
  readonly id: string;
  readonly displayName: string;
  private readonly passwordHash: string;
  private readonly pinHash: string;
  private factorHash: string | null = null;
  private factorFailures = 0;
  private deactivated = false;

  private constructor(
    id: string,
    displayName: string,
    passwordHash: string,
    pinHash: string,
  ) {
    this.id = id;
    this.displayName = displayName;
    this.passwordHash = passwordHash;
    this.pinHash = pinHash;
  }

  static register(input: RegisterUser): User {
    return new User(
      input.id,
      input.displayName,
      input.passwordHash,
      input.pinHash,
    );
  }

  get active(): boolean {
    return !this.deactivated;
  }

  get secondFactorEnrolled(): boolean {
    return this.factorHash !== null;
  }

  get failedFactorAttempts(): number {
    return this.factorFailures;
  }

  enrollSecondFactor(factorHash: string): void {
    this.factorHash = factorHash;
  }

  deactivate(): void {
    this.deactivated = true;
  }

  matchesPassword(passwordHash: string): boolean {
    return this.passwordHash === passwordHash;
  }

  matchesPin(pinHash: string): boolean {
    return this.pinHash === pinHash;
  }

  matchesFactor(factorHash: string): boolean {
    return this.factorHash === factorHash;
  }

  recordFailedFactor(): void {
    this.factorFailures += 1;
  }

  toPublic(): PublicUser {
    return {
      id: this.id,
      displayName: this.displayName,
      active: this.active,
      secondFactorEnrolled: this.secondFactorEnrolled,
      failedFactorAttempts: this.failedFactorAttempts,
    };
  }
}
