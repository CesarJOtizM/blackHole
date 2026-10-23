import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

import { DeviceChain, MissingActor } from "#domain/audit.js";

const TENANT_ID = "organization_company_1";
const PHONE_ID = "device_phone_1";
const REGISTER_ID = "device_register_1";
const SITE_ID = "organization_venue_1";
const GENESIS = "0".repeat(64);

const draft = (actorId: string, digest: string, deviceId = PHONE_ID) => ({
  actorId,
  authorizerId: "user_supervisor" as string | null,
  deviceId,
  siteId: SITE_ID,
  action: "sale.void-account",
  entity: "check_1",
  before: { amount: 20_000 },
  after: { amount: 0 },
  reason: "customer left",
  occurredAt: 1_700_000_000_000,
  digest,
});

it("given an event without an actor, when it is appended, then it is rejected and the chain stays empty", () => {
  const chain = DeviceChain.open(TENANT_ID, PHONE_ID);

  const append = () => {
    chain.append(draft("  ", "ab".repeat(32)));
  };

  expect(append).toThrow(MissingActor);
  expect(chain.links).toEqual([]);
});

it("given three events from one device, when the chain is linked, then each previous hash matches the prior digest from a zero genesis", () => {
  const chain = DeviceChain.open(TENANT_ID, PHONE_ID);
  const first = "11".repeat(32);
  const second = "22".repeat(32);
  const third = "33".repeat(32);

  chain.append(draft("user_cashier", first));
  chain.append(draft("user_cashier", second));
  chain.append(draft("user_supervisor", third));

  expect(chain.links.map((link) => link.sequence)).toEqual([1, 2, 3]);
  expect(chain.links[0]?.previousHash).toBe(GENESIS);
  expect(chain.links[1]?.previousHash).toBe(first);
  expect(chain.links[2]?.previousHash).toBe(second);
  expect(chain.inspect((link) => link.digest)).toBeNull();
});

it("given events from two devices, when each chain is checked, then both stay valid independently", () => {
  const phone = DeviceChain.open(TENANT_ID, PHONE_ID);
  const register = DeviceChain.open(TENANT_ID, REGISTER_ID);
  const phoneFirst = "aa".repeat(32);
  const registerFirst = "bb".repeat(32);
  const phoneSecond = "cc".repeat(32);

  phone.append(draft("user_cashier", phoneFirst, PHONE_ID));
  register.append(draft("user_owner", registerFirst, REGISTER_ID));
  phone.append(draft("user_cashier", phoneSecond, PHONE_ID));

  expect(phone.links).toHaveLength(2);
  expect(register.links).toHaveLength(1);
  expect(phone.links[0]?.previousHash).toBe(GENESIS);
  expect(phone.links[1]?.previousHash).toBe(phoneFirst);
  expect(register.links[0]?.previousHash).toBe(GENESIS);
  expect(register.links[0]?.digest).not.toBe(phone.links[0]?.digest);
  expect(phone.inspect((link) => link.digest)).toBeNull();
  expect(register.inspect((link) => link.digest)).toBeNull();
});

it("given a stored digest that no longer matches, when the chain is checked, then the finding names the device and sequence", () => {
  const stored = DeviceChain.open(TENANT_ID, PHONE_ID).append(
    draft("user_cashier", "ab".repeat(32)),
  );
  const chain = DeviceChain.restore(TENANT_ID, PHONE_ID, [
    { ...stored, digest: "ff".repeat(32) },
  ]);

  const finding = chain.inspect((link) =>
    link.digest === "ff".repeat(32) ? "ab".repeat(32) : link.digest,
  );

  expect(finding).toEqual({
    kind: "altered",
    deviceId: PHONE_ID,
    sequence: 1,
  });
});

it("given a missing sequence, when the chain is checked, then the finding names the gap", () => {
  const first = DeviceChain.open(TENANT_ID, PHONE_ID).append(
    draft("user_cashier", "11".repeat(32)),
  );
  const third = {
    ...first,
    sequence: 3,
    previousHash: "22".repeat(32),
    digest: "33".repeat(32),
  };
  const chain = DeviceChain.restore(TENANT_ID, PHONE_ID, [first, third]);

  const finding = chain.inspect((link) => link.digest);

  expect(finding).toEqual({
    kind: "deleted",
    deviceId: PHONE_ID,
    sequence: 2,
  });
});

it("given the audit domain source, when it is read, then it does not import node:crypto", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./audit.ts", import.meta.url)),
    "utf8",
  );

  expect(source).not.toContain("node:crypto");
  expect(source).not.toContain("createHash");
});
