import { expect, it } from "vitest";

import { StaleGeneration } from "#domain/index.js";
import { VenueOperation } from "#domain/venue-operation.js";

it("given a new venue with no node, when it opens in the cloud, then the mode and owner are cloud at generation 1", () => {
  const venueId = "venue-1";

  const operation = VenueOperation.openCloud(venueId);

  expect(operation.venueId).toBe(venueId);
  expect(operation.mode).toBe("cloud");
  expect(operation.operationOwner).toBe("cloud");
  expect(operation.generation).toBe(1);
});

it("given a cloud venue at the current generation, when a write uses that generation, then it is accepted and the generation stays unchanged", () => {
  const operation = VenueOperation.openCloud("venue-1");

  operation.acceptWrite(operation.generation);

  expect(operation.generation).toBe(1);
});

it("given a cloud venue at generation 1, when a write arrives with another generation, then it is rejected and the generation stays unchanged", () => {
  const operation = VenueOperation.openCloud("venue-1");

  const acceptStaleWrite = () => {
    operation.acceptWrite(2);
  };

  expect(acceptStaleWrite).toThrow(StaleGeneration);
  expect(operation.generation).toBe(1);
});
