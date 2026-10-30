import { expect, it, vi } from "vitest";

import { ManualCardTerminal } from "#adapters/manual-terminal/manual-card-terminal.js";
import { CardTerminal } from "#application/ports/card-terminal.js";

it("given a card slip, when the cashier records it on the manual terminal, then the capture keeps terminal, approval, brand, and last 4", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const terminal = new ManualCardTerminal();
  const slip = {
    terminal: "terminal_front",
    approvalNumber: "482191",
    brand: "visa",
    last4: "4242",
  };

  const captured = await terminal.capture(slip);

  expect(terminal).toBeInstanceOf(CardTerminal);
  expect(captured).toEqual(slip);
  expect(captured).not.toBe(slip);
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
