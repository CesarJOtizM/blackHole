import { expect, it } from "vitest";

import { scrubTelemetry as exportedScrub } from "#domain/index.js";
import { scrubTelemetry } from "#domain/telemetry-scrub.js";

it("given an error whose message contains a phone number, when it is scrubbed, then the number is removed", () => {
  const message = "customer phone 3001234567 failed the invoice";

  const scrubbed = scrubTelemetry(message);

  expect(scrubbed).toContain("failed the invoice");
  expect(scrubbed).not.toContain("3001234567");
});

it("given a phone written with a country code, when it is scrubbed, then the number is removed", () => {
  const message = "call +57 300 123 4567 tomorrow";

  const scrubbed = scrubTelemetry(message);

  expect(scrubbed).toContain("tomorrow");
  expect(scrubbed).not.toContain("300");
  expect(scrubbed).not.toContain("4567");
});

it("given a landline digit run, when it is scrubbed, then the number is removed", () => {
  const message = "branch line 6041234 is closed";

  const scrubbed = scrubTelemetry(message);

  expect(scrubbed).toContain("is closed");
  expect(scrubbed).not.toContain("6041234");
});

it("given a log line containing an identification number, when it is scrubbed, then the number is removed", () => {
  const dotted = scrubTelemetry("identification 1.234.567.890 on the ticket");
  const plain = scrubTelemetry("cedula 1234567890 on the ticket");

  expect(dotted).toContain("on the ticket");
  expect(dotted).not.toContain("1.234.567.890");
  expect(dotted).not.toMatch(/\d{7,10}/);
  expect(plain).not.toContain("1234567890");
});

it("given authorization, cookie, password, token, and secret fields, when they are scrubbed, then those values are absent", () => {
  const signal = {
    authorization: "Bearer opaque-token",
    cookie: "session=abc123session",
    password: "hunter2-plain",
    token: "tok-opaque-value",
    secret: "s3cr3t-value",
    message: "invoice queued",
  };

  const scrubbed = scrubTelemetry(signal);

  expect(typeof scrubbed).toBe("string");
  expect(scrubbed).toContain("invoice queued");
  expect(scrubbed).not.toContain("opaque-token");
  expect(scrubbed).not.toContain("abc123session");
  expect(scrubbed).not.toContain("hunter2-plain");
  expect(scrubbed).not.toContain("tok-opaque-value");
  expect(scrubbed).not.toContain("s3cr3t-value");
});

it("given name, phone, address, and identification fields, when they are scrubbed, then those values are absent", () => {
  const signal = {
    name: "Ada Lovelace",
    phone: "3015550101",
    address: "Calle 10 20-30 Bogota",
    identification: "1098765432",
    note: "status 429 stays",
  };

  const scrubbed = scrubTelemetry(signal);

  expect(scrubbed).toContain("status 429 stays");
  expect(scrubbed).not.toContain("Ada Lovelace");
  expect(scrubbed).not.toContain("3015550101");
  expect(scrubbed).not.toContain("Calle 10 20-30 Bogota");
  expect(scrubbed).not.toContain("1098765432");
});

it("given a nested secret and a header line, when they are scrubbed, then the secret values are absent", () => {
  const nested = scrubTelemetry({
    error: { password: "nested-secret", note: "kept" },
  });
  const header = scrubTelemetry("Authorization: Bearer opaque-token");

  expect(nested).toContain("kept");
  expect(nested).not.toContain("nested-secret");
  expect(header).not.toContain("opaque-token");
});

it("given the domain barrel, when scrubTelemetry is imported, then it removes a phone digit run", () => {
  const scrubbed = exportedScrub("phone 3001234567");

  expect(scrubbed).not.toContain("3001234567");
});
