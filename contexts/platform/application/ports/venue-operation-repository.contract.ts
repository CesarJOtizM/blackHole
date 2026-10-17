import { expect, it } from "vitest";

import { VenueOperation } from "../../domain/venue-operation.js";
import type {
  OperationalWrite,
  VenueOperationRepository,
} from "./venue-operation-repository.js";

export type VenueOperationRepositorySubject = VenueOperationRepository & {
  countByWriteId(writeId: string): Promise<number>;
};

export function venueOperationRepositoryContract(
  createRepository: () => VenueOperationRepositorySubject,
): void {
  it("given a cloud operation, when it is saved, then it can be read back", async () => {
    const repository = createRepository();
    const operation = VenueOperation.openCloud("venue-1");

    await repository.save(operation);

    const stored = await repository.findByVenueId(operation.venueId);
    expect(stored?.venueId).toBe(operation.venueId);
    expect(stored?.mode).toBe("cloud");
    expect(stored?.operationOwner).toBe("cloud");
    expect(stored?.generation).toBe(1);
  });

  it("given the same writeId, when the write is saved twice, then one write is stored", async () => {
    const repository = createRepository();
    const write: OperationalWrite = {
      writeId: "write-1",
      venueId: "venue-1",
      generation: 1,
    };

    await repository.saveWrite(write);
    await repository.saveWrite(write);

    expect(await repository.countByWriteId(write.writeId)).toBe(1);
  });

  it("given no saved operation, when findByVenueId runs, then the result is empty", async () => {
    const repository = createRepository();

    const stored = await repository.findByVenueId("venue-1");

    expect(stored).toBeNull();
  });
}
