import { expect, it } from "vitest";

import { InMemoryVenueOperationRepository } from "#adapters/memory/in-memory-venue-operation-repository.js";
import { AcceptCloudWrite } from "#application/accept-cloud-write/accept-cloud-write.js";
import { StaleGeneration } from "#domain/index.js";

it("given a new venue with no node, when an operational write is accepted, then memory stores that write", async () => {
  const repository = new InMemoryVenueOperationRepository();
  const acceptCloudWrite = new AcceptCloudWrite(repository);
  const command = {
    venueId: "venue-1",
    writeId: "write-1",
    generation: 1,
  };

  const result = await acceptCloudWrite.execute(command);

  expect(result).toEqual({
    venueId: command.venueId,
    writeId: command.writeId,
    mode: "cloud",
    operationOwner: "cloud",
    generation: 1,
  });
  const stored = await repository.findByVenueId(command.venueId);
  expect(stored?.venueId).toBe(command.venueId);
  expect(stored?.mode).toBe("cloud");
  expect(stored?.operationOwner).toBe("cloud");
  expect(stored?.generation).toBe(1);
  expect(await repository.countByWriteId(command.writeId)).toBe(1);
});

it("given a cloud venue, when a write arrives with a stale generation, then nothing is stored", async () => {
  const repository = new InMemoryVenueOperationRepository();
  const acceptCloudWrite = new AcceptCloudWrite(repository);
  const command = {
    venueId: "venue-1",
    writeId: "write-1",
    generation: 2,
  };

  const accepted = acceptCloudWrite.execute(command);

  await expect(accepted).rejects.toThrow(StaleGeneration);
  expect(await repository.findByVenueId(command.venueId)).toBeNull();
  expect(await repository.countByWriteId(command.writeId)).toBe(0);
});

it("given an accepted write, when the same writeId is accepted again, then it is stored once", async () => {
  const repository = new InMemoryVenueOperationRepository();
  const acceptCloudWrite = new AcceptCloudWrite(repository);
  const command = {
    venueId: "venue-1",
    writeId: "write-1",
    generation: 1,
  };

  await acceptCloudWrite.execute(command);
  await acceptCloudWrite.execute(command);

  expect(await repository.countByWriteId(command.writeId)).toBe(1);
});

it("given the application entry port, when it is imported, then it exposes AcceptCloudWrite and StaleGeneration", async () => {
  const entry = await import("#application/entry-port.js");

  expect(entry.AcceptCloudWrite).toBe(AcceptCloudWrite);
  expect(entry.StaleGeneration).toBe(StaleGeneration);
});
