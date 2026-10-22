export interface SignatureInput {
  publicKey: string;
  payload: string;
  signature: string;
}

export abstract class SignatureVerifier {
  abstract verify(input: SignatureInput): Promise<boolean>;
}
