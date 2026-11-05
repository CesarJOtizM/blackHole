import { expect, it } from "vitest";

import { revealPortalLink as revealPortalLinkFromDomain } from "#domain/index.js";
import {
  type EvaluatedPortalLink,
  PORTAL_LINK_PURPOSE,
  revealPortalLink,
} from "#domain/portal-link.js";

const TENANT_ID = "tenant_north";
const OTHER_TENANT_ID = "tenant_south";
const VENUE_ID = "venue_center";
const OTHER_VENUE_ID = "venue_north";
const CHECK_ID = "check_12";
const OTHER_CHECK_ID = "check_99";
const OPENED_AT = "2026-11-05T16:00:00.000Z";
const EXPIRES_AT = "2026-11-06T16:00:00.000Z";

const evaluatedLink = (
  overrides: Partial<EvaluatedPortalLink> = {},
): EvaluatedPortalLink => ({
  purpose: PORTAL_LINK_PURPOSE.PRE_BILL,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  expiresAt: EXPIRES_AT,
  ...overrides,
});

it("given an expired portal link for this account, when it is opened, then nothing is shown", () => {
  const atExpiry = revealPortalLink({
    link: evaluatedLink(),
    account: {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
    },
    at: EXPIRES_AT,
  });

  const afterExpiry = revealPortalLink({
    link: evaluatedLink(),
    account: {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
    },
    at: "2026-11-06T16:00:00.001Z",
  });

  expect(atExpiry).toEqual({ outcome: "hidden" });
  expect(afterExpiry).toEqual({ outcome: "hidden" });
});

it("given a portal link for another account, when it is opened, then nothing is shown", () => {
  const anotherCheck = revealPortalLink({
    link: evaluatedLink(),
    account: {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: OTHER_CHECK_ID,
    },
    at: OPENED_AT,
  });

  const anotherVenue = revealPortalLink({
    link: evaluatedLink(),
    account: {
      tenantId: TENANT_ID,
      venueId: OTHER_VENUE_ID,
      checkId: CHECK_ID,
    },
    at: OPENED_AT,
  });

  const anotherTenant = revealPortalLink({
    link: evaluatedLink(),
    account: {
      tenantId: OTHER_TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
    },
    at: OPENED_AT,
  });

  expect(anotherCheck).toEqual({ outcome: "hidden" });
  expect(anotherVenue).toEqual({ outcome: "hidden" });
  expect(anotherTenant).toEqual({ outcome: "hidden" });
});

it("given a current portal link for this account, when it is opened, then only that account is shown", () => {
  const opened = revealPortalLink({
    link: evaluatedLink(),
    account: {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
    },
    at: OPENED_AT,
  });

  expect(opened).toEqual({
    outcome: "visible",
    purpose: PORTAL_LINK_PURPOSE.PRE_BILL,
    account: {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
    },
  });
});

it("given the invoicing domain, when portal link is exported, then opening a link uses that function", () => {
  expect(revealPortalLinkFromDomain).toBe(revealPortalLink);
});
