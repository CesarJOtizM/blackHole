import { signFast } from "#adapters/memory/fast-identity-doubles.js";
import { SignatureVerifier } from "#application/ports/signature-verifier.js";

export class FastSignatureVerifier extends SignatureVerifier {
  override async verify(input: {
    publicKey: string;
    payload: string;
    signature: string;
  }): Promise<boolean> {
    return input.signature === signFast(input.publicKey, input.payload);
  }
}
