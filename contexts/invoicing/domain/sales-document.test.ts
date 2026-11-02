import { expect, it } from "vitest";

import {
  assertNitCheckDigit,
  createSalesDocument,
  InvalidNitCheckDigit,
  InvalidReferenceCode,
  SALES_DOCUMENT_STATUS,
} from "#domain/sales-document.js";

const CLOSURE_ID = "closure_front_1";
const OTHER_CLOSURE_ID = "closure_front_2";
const REFERENCE_CODE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const OTHER_REFERENCE_CODE = "01932f4a-7c3a-7b2d-9e1f-6a5b4c3d2e10";
const VERSION_4_REFERENCE = "01932f4a-7c3a-4b2d-8e1f-6a5b4c3d2e1f";
const TAXPAYER_EMAIL = "facturas@taxpayer.example";

it("given a closure has no sales document, when one is created, then it keeps that closure, a UUIDv7 reference, status generated, and the generic buyer", () => {
  const document = createSalesDocument({
    closureId: CLOSURE_ID,
    referenceCode: REFERENCE_CODE,
    taxpayerEmail: TAXPAYER_EMAIL,
  });

  expect(document).toEqual({
    closureId: CLOSURE_ID,
    referenceCode: REFERENCE_CODE,
    status: "generated",
    buyer: {
      documentType: "13",
      documentNumber: "222222222222",
      name: "Consumidor final",
      responsibility: "R-99-PN",
      email: TAXPAYER_EMAIL,
    },
  });
});

it("given a closure already has a sales document, when another is requested, then that document is returned", () => {
  const existing = createSalesDocument({
    closureId: CLOSURE_ID,
    referenceCode: REFERENCE_CODE,
    taxpayerEmail: TAXPAYER_EMAIL,
  });

  const repeated = createSalesDocument(
    {
      closureId: CLOSURE_ID,
      referenceCode: OTHER_REFERENCE_CODE,
      taxpayerEmail: "other@taxpayer.example",
    },
    [existing],
  );

  expect(repeated).toBe(existing);
  expect(repeated.referenceCode).toBe(REFERENCE_CODE);
  expect(repeated.buyer.email).toBe(TAXPAYER_EMAIL);
});

it("given two closures, when each requests a document, then each keeps its own reference", () => {
  const first = createSalesDocument({
    closureId: CLOSURE_ID,
    referenceCode: REFERENCE_CODE,
    taxpayerEmail: TAXPAYER_EMAIL,
  });

  const second = createSalesDocument(
    {
      closureId: OTHER_CLOSURE_ID,
      referenceCode: OTHER_REFERENCE_CODE,
      taxpayerEmail: TAXPAYER_EMAIL,
    },
    [first],
  );

  expect(second).not.toBe(first);
  expect(second.closureId).toBe(OTHER_CLOSURE_ID);
  expect(second.referenceCode).toBe(OTHER_REFERENCE_CODE);
});

it("given sales document statuses, when they are listed, then they are generated, sending, accepted, rejected, pending_issuance, and uncertain", () => {
  expect(Object.values(SALES_DOCUMENT_STATUS)).toEqual([
    "generated",
    "sending",
    "accepted",
    "rejected",
    "pending_issuance",
    "uncertain",
  ]);
});

it("given a reference that is not a UUIDv7, when a sales document is created, then the reference is rejected", () => {
  const create = () => {
    createSalesDocument({
      closureId: CLOSURE_ID,
      referenceCode: VERSION_4_REFERENCE,
      taxpayerEmail: TAXPAYER_EMAIL,
    });
  };

  expect(create).toThrow(InvalidReferenceCode);
});

it("given a NIT with a wrong modulus-11 check digit, when it is submitted, then the buyer is rejected", () => {
  const submit = () => {
    assertNitCheckDigit("890903938-7");
  };

  expect(submit).toThrow(InvalidNitCheckDigit);
});

it("given a NIT with a valid modulus-11 check digit, when it is submitted, then the digit is accepted", () => {
  expect(() => {
    assertNitCheckDigit("890903938-8");
  }).not.toThrow();
  expect(() => {
    assertNitCheckDigit("800197268-4");
  }).not.toThrow();
  expect(() => {
    assertNitCheckDigit("100000001-0");
  }).not.toThrow();
  expect(() => {
    assertNitCheckDigit("100000005-1");
  }).not.toThrow();
  expect(() => {
    assertNitCheckDigit("8909039388");
  }).not.toThrow();
});
