import { expect, it } from "vitest";

import {
  type BillingDataDraft,
  type BillingDataRecord,
  deleteBillingData,
  IncompleteBillingIdentity,
  MissingBillingEmail,
  MissingMunicipalityCode,
  recordBillingData,
} from "#domain/billing-data.js";
import {
  deleteBillingData as deleteBillingDataFromDomain,
  recordBillingData as recordBillingDataFromDomain,
} from "#domain/index.js";
import { InvalidNitCheckDigit } from "#domain/sales-document.js";

const RECORDED_AT = "2026-11-05T16:00:00.000Z";
const DELETED_AT = "2026-11-05T18:00:00.000Z";
const VALID_NIT = "890903938-8";
const INVALID_NIT = "890903938-7";
const NIT_DOCUMENT_TYPE = "31";
const ID_CARD_DOCUMENT_TYPE = "13";
const POLICY_VERSION = "2026-01";
const POLICY_LINK = "https://example.com/privacy";
const EMAIL = "buyer@example.com";
const MUNICIPALITY_CODE = "11001";
const UNKNOWN_MUNICIPALITY_CODE = "99999";

const draft = (
  overrides: Partial<BillingDataDraft> = {},
): BillingDataDraft => ({
  documentType: NIT_DOCUMENT_TYPE,
  documentNumber: VALID_NIT,
  personType: "natural",
  name: "Ada Lovelace",
  email: EMAIL,
  municipalityCode: MUNICIPALITY_CODE,
  consent: {
    accepted: true,
    policyVersion: POLICY_VERSION,
    policyLink: POLICY_LINK,
  },
  at: RECORDED_AT,
  ...overrides,
});

const requireRecord = (
  record: BillingDataRecord | undefined,
): BillingDataRecord => {
  if (record === undefined) {
    throw new Error("Expected a stored billing record.");
  }

  return record;
};

it("given a NIT with a wrong check digit, when billing data is recorded, then the digit is rejected", () => {
  const submit = () => {
    recordBillingData(
      draft({
        documentType: NIT_DOCUMENT_TYPE,
        documentNumber: INVALID_NIT,
      }),
    );
  };

  expect(submit).toThrow(InvalidNitCheckDigit);
});

it("given a document that is not a NIT, when billing data is recorded, then the NIT check digit is not applied", () => {
  const record = recordBillingData(
    draft({
      documentType: ID_CARD_DOCUMENT_TYPE,
      documentNumber: INVALID_NIT,
    }),
  );

  expect(record?.documentType).toBe(ID_CARD_DOCUMENT_TYPE);
  expect(record?.documentNumber).toBe(INVALID_NIT);
});

it("given valid billing data and accepted consent, when it is recorded, then the consent date, policy version, and link are stored", () => {
  const record = recordBillingData(draft());

  expect(record).toEqual({
    documentType: NIT_DOCUMENT_TYPE,
    documentNumber: VALID_NIT,
    personType: "natural",
    name: "Ada Lovelace",
    email: EMAIL,
    municipalityCode: MUNICIPALITY_CODE,
    consent: {
      acceptedAt: RECORDED_AT,
      policyVersion: POLICY_VERSION,
      policyLink: POLICY_LINK,
    },
    deletedAt: null,
    invoiceSnapshots: [],
  });
});

it("given valid data without an accepted policy, when it is submitted, then nothing is stored", () => {
  const withoutAcceptance = recordBillingData(
    draft({
      consent: {
        accepted: false,
        policyVersion: POLICY_VERSION,
        policyLink: POLICY_LINK,
      },
    }),
  );
  const withoutConsent = recordBillingData(draft({ consent: undefined }));
  const withoutVersion = recordBillingData(
    draft({
      consent: {
        accepted: true,
        policyVersion: " ",
        policyLink: POLICY_LINK,
      },
    }),
  );
  const withoutLink = recordBillingData(
    draft({
      consent: {
        accepted: true,
        policyVersion: POLICY_VERSION,
        policyLink: "",
      },
    }),
  );

  expect(withoutAcceptance).toBeUndefined();
  expect(withoutConsent).toBeUndefined();
  expect(withoutVersion).toBeUndefined();
  expect(withoutLink).toBeUndefined();
});

it("given billing data with a blank or missing email, when it is submitted, then recording fails", () => {
  expect(() => recordBillingData(draft({ email: " " }))).toThrow(
    MissingBillingEmail,
  );
  expect(() => recordBillingData(draft({ email: undefined }))).toThrow(
    MissingBillingEmail,
  );
});

it("given billing data without a DANE municipality code, when it is submitted, then recording fails", () => {
  expect(() => recordBillingData(draft({ municipalityCode: "" }))).toThrow(
    MissingMunicipalityCode,
  );
  expect(() =>
    recordBillingData(draft({ municipalityCode: undefined })),
  ).toThrow(MissingMunicipalityCode);
});

it("given an unknown DANE municipality code, when billing data is recorded, then the code is stored", () => {
  const record = recordBillingData(
    draft({ municipalityCode: UNKNOWN_MUNICIPALITY_CODE }),
  );

  expect(record?.municipalityCode).toBe(UNKNOWN_MUNICIPALITY_CODE);
});

it("given billing data without an id, person type, or name, when it is submitted, then recording fails", () => {
  expect(() => recordBillingData(draft({ documentType: "" }))).toThrow(
    IncompleteBillingIdentity,
  );
  expect(() => recordBillingData(draft({ documentNumber: undefined }))).toThrow(
    IncompleteBillingIdentity,
  );
  expect(() => recordBillingData(draft({ personType: " " }))).toThrow(
    IncompleteBillingIdentity,
  );
  expect(() => recordBillingData(draft({ name: "" }))).toThrow(
    IncompleteBillingIdentity,
  );
});

it("given a billing record with invoice snapshots, when it is deleted, then deleted_at is set and the snapshots stay", () => {
  const stored = requireRecord(recordBillingData(draft()));
  const snapshots = [{ number: "FV-100" }, { number: "FV-101" }];
  const withSnapshots: BillingDataRecord = {
    ...stored,
    invoiceSnapshots: snapshots,
  };

  const deleted = deleteBillingData({
    record: withSnapshots,
    at: DELETED_AT,
  });

  expect(deleted.deletedAt).toBe(DELETED_AT);
  expect(deleted.invoiceSnapshots).toEqual(snapshots);
  expect(withSnapshots.deletedAt).toBeNull();
  expect(withSnapshots.invoiceSnapshots).toEqual(snapshots);
  expect(deleted.consent).toEqual(stored.consent);
});

it("given the invoicing domain, when billing data is exported, then recording and deletion use those functions", () => {
  expect(recordBillingDataFromDomain).toBe(recordBillingData);
  expect(deleteBillingDataFromDomain).toBe(deleteBillingData);
});
