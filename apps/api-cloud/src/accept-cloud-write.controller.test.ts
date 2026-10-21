import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { expect, it } from "vitest";

import { createApplication } from "#src/create-application.js";

const venueId = "venue-1";
const writeId = "6f1e1b5a-7c3d-4e2f-9a1b-2c3d4e5f6071";

it("given a new venue, when a write is posted with the current generation, then the cloud accepts and stores it", async () => {
  const venueOperations = new InMemoryVenueOperationRepository();
  const application = await createApplication({
    venueOperations,
    organizations: new InMemoryOrganizationRepository(),
  });

  try {
    const response = await application.inject({
      method: "POST",
      url: `/venues/${venueId}/writes`,
      payload: {
        writeId,
        generation: 1,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      venueId,
      writeId,
      mode: "cloud",
      operationOwner: "cloud",
      generation: 1,
    });
    expect(await venueOperations.findByVenueId(venueId)).not.toBeNull();
    expect(await venueOperations.countByWriteId(writeId)).toBe(1);
  } finally {
    await application.close();
  }
});

it("given a write with an invalid body, when it is posted, then the response is 400 and memory is unchanged", async () => {
  const venueOperations = new InMemoryVenueOperationRepository();
  const application = await createApplication({
    venueOperations,
    organizations: new InMemoryOrganizationRepository(),
  });
  const invalidWriteId = "not-a-uuid";

  try {
    const response = await application.inject({
      method: "POST",
      url: `/venues/${venueId}/writes`,
      payload: {
        writeId: invalidWriteId,
        generation: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(await venueOperations.findByVenueId(venueId)).toBeNull();
    expect(await venueOperations.countByWriteId(invalidWriteId)).toBe(0);
  } finally {
    await application.close();
  }
});

it("given a write whose generation is not a positive integer, when it is posted, then the response is 400 and memory is unchanged", async () => {
  const venueOperations = new InMemoryVenueOperationRepository();
  const application = await createApplication({
    venueOperations,
    organizations: new InMemoryOrganizationRepository(),
  });

  try {
    const response = await application.inject({
      method: "POST",
      url: `/venues/${venueId}/writes`,
      payload: {
        writeId,
        generation: 0,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(await venueOperations.findByVenueId(venueId)).toBeNull();
    expect(await venueOperations.countByWriteId(writeId)).toBe(0);
  } finally {
    await application.close();
  }
});

it("given a cloud venue, when a stale generation is posted, then the response is 409 and nothing is stored", async () => {
  const venueOperations = new InMemoryVenueOperationRepository();
  const application = await createApplication({
    venueOperations,
    organizations: new InMemoryOrganizationRepository(),
  });
  const staleWriteId = "6f1e1b5a-7c3d-4e2f-9a1b-2c3d4e5f6072";

  try {
    const response = await application.inject({
      method: "POST",
      url: `/venues/${venueId}/writes`,
      payload: {
        writeId: staleWriteId,
        generation: 2,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "StaleGeneration" });
    expect(await venueOperations.findByVenueId(venueId)).toBeNull();
    expect(await venueOperations.countByWriteId(staleWriteId)).toBe(0);
  } finally {
    await application.close();
  }
});

it("given an accepted write, when the same writeId is posted again, then the response is 200 and it is stored once", async () => {
  const venueOperations = new InMemoryVenueOperationRepository();
  const application = await createApplication({
    venueOperations,
    organizations: new InMemoryOrganizationRepository(),
  });
  const payload = {
    writeId,
    generation: 1,
  };

  try {
    const first = await application.inject({
      method: "POST",
      url: `/venues/${venueId}/writes`,
      payload,
    });
    const second = await application.inject({
      method: "POST",
      url: `/venues/${venueId}/writes`,
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({
      venueId,
      writeId,
      mode: "cloud",
      operationOwner: "cloud",
      generation: 1,
    });
    expect(await venueOperations.countByWriteId(writeId)).toBe(1);
  } finally {
    await application.close();
  }
});
