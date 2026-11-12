import { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import { type CashShift, ShiftAlreadyOpen } from "#domain/cash-shift.js";

const cloneField = (field: unknown): unknown =>
  field === undefined ? undefined : structuredClone(field);

const cloneShift = (shift: CashShift): CashShift => {
  const copy = Object.create(Object.getPrototypeOf(shift)) as CashShift;

  for (const key of Reflect.ownKeys(shift)) {
    if (typeof key !== "string") {
      continue;
    }

    (copy as unknown as Record<string, unknown>)[key] = cloneField(
      (shift as unknown as Record<string, unknown>)[key],
    );
  }

  return copy;
};

const registerKey = (
  tenantId: string,
  venueId: string,
  registerId: string,
): string => `${tenantId}\u0000${venueId}\u0000${registerId}`;

export class InMemoryCashRegisterRepository extends CashRegisterRepository {
  private readonly shifts = new Map<string, CashShift>();

  override async load(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<CashShift | null> {
    const shift = this.shifts.get(registerKey(tenantId, venueId, registerId));

    return shift === undefined ? null : cloneShift(shift);
  }

  override async save(
    tenantId: string,
    venueId: string,
    shift: CashShift,
  ): Promise<void> {
    const key = registerKey(tenantId, venueId, shift.registerId);

    if (this.shifts.has(key)) {
      throw new ShiftAlreadyOpen();
    }

    this.shifts.set(key, cloneShift(shift));
  }

  async listOpen(
    tenantId: string,
    venueId: string,
  ): Promise<readonly CashShift[]> {
    const prefix = `${tenantId}\u0000${venueId}\u0000`;

    return [...this.shifts.entries()]
      .filter(
        ([key, shift]) => key.startsWith(prefix) && shift.state === "open",
      )
      .map(([, shift]) => cloneShift(shift));
  }
}
