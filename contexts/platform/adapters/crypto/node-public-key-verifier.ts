import { createPublicKey, verify } from "node:crypto";

import { SignatureVerifier } from "#application/ports/signature-verifier.js";

export class NodePublicKeyVerifier extends SignatureVerifier {
  override async verify(input: {
    publicKey: string;
    payload: string;
    signature: string;
  }): Promise<boolean> {
    try {
      const key = createPublicKey({
        key: Buffer.from(input.publicKey, "base64"),
        format: "der",
        type: "spki",
      });

      return verify(
        null,
        Buffer.from(input.payload),
        key,
        Buffer.from(input.signature, "base64"),
      );
    } catch {
      return false;
    }
  }
}
