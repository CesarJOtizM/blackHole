import { expect, it } from "vitest";
import type {
  LinkSigner,
  SignedPortalLink,
} from "#application/ports/link-signer.js";
import type { EvaluatedPortalLink } from "#domain/portal-link.js";

export interface LinkSignerHarness {
  signer(): LinkSigner;
  link(): EvaluatedPortalLink;
}

export function linkSignerContract(
  open: () => LinkSignerHarness | Promise<LinkSignerHarness>,
): void {
  it("given a portal link, when it is signed and verified, then the same link comes back and a different token does not", async () => {
    const opened = await open();
    const link = opened.link();
    const signed: SignedPortalLink = await opened.signer().sign(link);

    expect(await opened.signer().verify(signed.token)).toEqual(link);
    expect(await opened.signer().verify(`${signed.token}.other`)).toBeNull();
  });
}
