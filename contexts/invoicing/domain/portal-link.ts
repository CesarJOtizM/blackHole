export const PORTAL_LINK_PURPOSE = {
  PRE_BILL: "pre_bill",
  INVOICE: "invoice",
} as const;

export type PortalLinkPurpose =
  (typeof PORTAL_LINK_PURPOSE)[keyof typeof PORTAL_LINK_PURPOSE];

export interface EvaluatedPortalLink {
  purpose: PortalLinkPurpose;
  tenantId: string;
  venueId: string;
  checkId: string;
  expiresAt: string;
}

export interface PortalAccount {
  tenantId: string;
  venueId: string;
  checkId: string;
}

export type PortalLinkDisclosure =
  | { outcome: "hidden" }
  | {
      outcome: "visible";
      purpose: PortalLinkPurpose;
      account: PortalAccount;
    };

const sameAccount = (
  link: EvaluatedPortalLink,
  account: PortalAccount,
): boolean =>
  link.tenantId === account.tenantId &&
  link.venueId === account.venueId &&
  link.checkId === account.checkId;

const expired = (expiresAt: string, at: string): boolean => {
  const expiry = Date.parse(expiresAt);
  const openedAt = Date.parse(at);

  return (
    !Number.isFinite(expiry) || !Number.isFinite(openedAt) || openedAt >= expiry
  );
};

export const revealPortalLink = (input: {
  link: EvaluatedPortalLink;
  account: PortalAccount;
  at: string;
}): PortalLinkDisclosure => {
  if (
    expired(input.link.expiresAt, input.at) ||
    !sameAccount(input.link, input.account)
  ) {
    return { outcome: "hidden" };
  }

  return {
    outcome: "visible",
    purpose: input.link.purpose,
    account: {
      tenantId: input.link.tenantId,
      venueId: input.link.venueId,
      checkId: input.link.checkId,
    },
  };
};
