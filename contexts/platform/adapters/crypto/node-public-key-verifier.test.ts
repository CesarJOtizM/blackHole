import { generateKeyPairSync, sign } from "node:crypto";
import { expect, it } from "vitest";

import { NodePublicKeyVerifier } from "#adapters/crypto/node-public-key-verifier.js";

it("given an ed25519 key, when the payload is signed, then the node verifier accepts that payload and rejects another", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const exported = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  const payload = JSON.stringify({
    deviceId: "device_phone_1",
    type: "authorizeOperation",
  });
  const signature = sign(null, Buffer.from(payload), privateKey).toString(
    "base64",
  );
  const verifier = new NodePublicKeyVerifier();

  const accepted = await verifier.verify({
    publicKey: exported,
    payload,
    signature,
  });
  const rejected = await verifier.verify({
    publicKey: exported,
    payload: `${payload}x`,
    signature,
  });

  expect(accepted).toBe(true);
  expect(rejected).toBe(false);
});
