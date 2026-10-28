import { expect, it } from "vitest";

import { InMemoryPrinter } from "#adapters/memory/in-memory-printer.js";

const TICKET = "Grill\ntable_5\nJalapeño";

it("given a UTF-8 ticket, when it is printed, then the text is recorded", async () => {
  const printer = new InMemoryPrinter();

  await printer.print({ text: TICKET });

  const recorded = printer.printed[0] ?? "";
  const codes = [...recorded].map((character) => character.codePointAt(0));
  expect(printer.printed).toEqual([TICKET]);
  expect(codes).not.toContain(0x1b);
  expect(codes).not.toContain(0x1d);
});

it("given a printer set to fail, when a ticket is printed, then the print fails and nothing is recorded", async () => {
  const printer = new InMemoryPrinter();
  printer.fail = true;

  await expect(printer.print({ text: TICKET })).rejects.toThrow(
    "The printer is offline.",
  );
  expect(printer.printed).toEqual([]);
});
