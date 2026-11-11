export abstract class CodeDigest {
  abstract matches(code: string, digest: string): boolean;
}
