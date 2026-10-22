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

export interface UserRecord {
  id: string;
  displayName: string;
  passwordHash: string;
  pinHash: string;
  factorHash: string | null;
  failedFactorAttempts: number;
  active: boolean;
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

  static restore(record: UserRecord): User {
    const user = new User(
      record.id,
      record.displayName,
      record.passwordHash,
      record.pinHash,
    );
    user.factorHash = record.factorHash;
    user.factorFailures = record.failedFactorAttempts;
    user.deactivated = !record.active;

    return user;
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

  toRecord(): UserRecord {
    return {
      id: this.id,
      displayName: this.displayName,
      passwordHash: this.passwordHash,
      pinHash: this.pinHash,
      factorHash: this.factorHash,
      failedFactorAttempts: this.factorFailures,
      active: this.active,
    };
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
