import { expect, it } from "vitest";

import { FactusSimulator } from "#src/composition/factus-simulator.js";

it("given the simulator, when issue is called, then it returns 200", async () => {
  const factus = new FactusSimulator();

  const result = await factus.issue();

  expect(result).toEqual({ status: 200 });
});

it("given Factus limits the caller, when issue is called, then it returns 429 and retryAfterSeconds", async () => {
  const factus = new FactusSimulator([{ status: 429, retryAfterSeconds: 12 }]);

  const result = await factus.issue();

  expect(result).toEqual({ status: 429, retryAfterSeconds: 12 });
});
