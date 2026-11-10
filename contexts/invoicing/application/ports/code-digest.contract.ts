import { expect, it } from "vitest";

import type { CodeDigest } from "#application/ports/code-digest.js";

export interface CodeDigestSample {
  code: string;
  digest: string;
}

export interface CodeDigestHarness {
  digest(): CodeDigest;
  sample(): CodeDigestSample;
}

export function codeDigestContract(
  open: () => CodeDigestHarness | Promise<CodeDigestHarness>,
): void {
  it("given a code and its digest, when the digest is checked, then that code matches and a different code does not", async () => {
    const opened = await open();
    const sample = opened.sample();
    const digest = opened.digest();

    expect(digest.matches(sample.code, sample.digest)).toBe(true);
    expect(digest.matches("000000", sample.digest)).toBe(false);
  });
}
