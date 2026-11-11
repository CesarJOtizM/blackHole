import type { EvaluatedPortalLink } from "#domain/portal-link.js";

export interface SignedPortalLink {
  token: string;
}

export abstract class LinkSigner {
  abstract sign(link: EvaluatedPortalLink): Promise<SignedPortalLink>;

  abstract verify(token: string): Promise<EvaluatedPortalLink | null>;
}
