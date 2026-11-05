import { expect, it } from "vitest";

import {
  maskEmail as maskEmailFromDomain,
  maskName as maskNameFromDomain,
} from "#domain/index.js";
import { maskEmail, maskName } from "#domain/masking.js";

it("given a two-word name, when it is masked, then each word keeps its first character and three asterisks", () => {
  expect(maskName("Juan Perez")).toBe("J*** P***");
});

it("given a one-word name, when it is masked, then it keeps its first character and three asterisks", () => {
  expect(maskName("Juan")).toBe("J***");
});

it("given the same spelling in another case, when it is masked, then the kept character stays as written", () => {
  expect(maskName("juan")).toBe("j***");
  expect(maskName("Juan")).toBe("J***");
});

it("given a name whose remainder would leak its length, when it is masked, then the rest is dropped and the star count stays three", () => {
  const short = maskName("Al");
  const long = maskName("Alexander Bonaparte");

  expect(short).toBe("A***");
  expect(long).toBe("A*** B***");
  expect(long).not.toContain("lexander");
  expect(long).not.toContain("onaparte");

  for (const word of long.split(" ")) {
    expect(word).toHaveLength(4);
    expect(word.endsWith("***")).toBe(true);
  }
});

it("given a mailbox, when it is masked, then the local part keeps its first character, three asterisks, and the domain", () => {
  expect(maskEmail("juan@gmail.com")).toBe("j***@gmail.com");
});

it("given a mailbox with a one-character local part, when it is masked, then that character and the domain remain", () => {
  expect(maskEmail("j@gmail.com")).toBe("j***@gmail.com");
});

it("given a mailbox whose local remainder would leak, when it is masked, then the local rest is dropped and the domain stays", () => {
  const short = maskEmail("ab@gmail.com");
  const long = maskEmail("juanperez@gmail.com");

  expect(short).toBe("a***@gmail.com");
  expect(long).toBe("j***@gmail.com");
  expect(long).not.toContain("uanperez");
  expect(long.startsWith("j***@")).toBe(true);
});

it("given the invoicing domain, when masking is exported, then masking a name and an email uses those functions", () => {
  expect(maskNameFromDomain).toBe(maskName);
  expect(maskEmailFromDomain).toBe(maskEmail);
});
