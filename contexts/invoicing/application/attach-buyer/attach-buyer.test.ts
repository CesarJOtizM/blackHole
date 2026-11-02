import { expect, it } from "vitest";
import {
  ATTACH_BUYER_RESULT,
  AttachBuyer,
} from "#application/attach-buyer/attach-buyer.js";
import { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import { InvalidNitCheckDigit } from "#domain/sales-document.js";

const TAXPAYER_EMAIL = "facturas@taxpayer.example";
const NIT_DOCUMENT_TYPE = "31";
const VALID_NIT = "890903938-8";
const INVALID_NIT = "890903938-7";
const LOOKED_UP_NAME = "ACME S.A.S.";
const LOOKED_UP_EMAIL = "facturas@acme.example";

const GENERIC_BUYER = {
  documentType: "13",
  documentNumber: "222222222222",
  name: "Consumidor final",
  responsibility: "R-99-PN",
  email: TAXPAYER_EMAIL,
};

interface FoundLookup {
  name: string;
  email: string;
}

class MemoryInvoicingProvider extends InvoicingProvider {
  readonly queries: Array<{ documentType: string; documentNumber: string }> =
    [];

  constructor(private readonly found: FoundLookup | null) {
    super();
  }

  override async validate(): Promise<void> {}

  override async lookupAcquirer(query: {
    documentType: string;
    documentNumber: string;
  }): Promise<
    { outcome: "found"; name: string; email: string } | { outcome: "empty" }
  > {
    this.queries.push(query);

    if (!this.found) {
      return { outcome: "empty" };
    }

    return {
      outcome: "found",
      name: this.found.name,
      email: this.found.email,
    };
  }
}

const harness = (found: FoundLookup | null) => {
  const provider = new MemoryInvoicingProvider(found);
  const attach = new AttachBuyer(provider);

  return { provider, attach };
};

it("given a cashier enters a valid NIT, when the lookup returns, then name and email are filled", async () => {
  const { provider, attach } = harness({
    name: LOOKED_UP_NAME,
    email: LOOKED_UP_EMAIL,
  });

  const result = await attach.execute({
    taxpayerEmail: TAXPAYER_EMAIL,
    documentType: NIT_DOCUMENT_TYPE,
    documentNumber: VALID_NIT,
  });

  expect(provider.queries).toEqual([
    { documentType: NIT_DOCUMENT_TYPE, documentNumber: VALID_NIT },
  ]);
  expect(result).toMatchObject({
    kind: ATTACH_BUYER_RESULT.IDENTIFIED,
    lookup: {
      name: LOOKED_UP_NAME,
      email: LOOKED_UP_EMAIL,
    },
  });
});

it("given no customer data, when the buyer is attached, then the buyer is the generic buyer", async () => {
  const { provider, attach } = harness({
    name: LOOKED_UP_NAME,
    email: LOOKED_UP_EMAIL,
  });

  const result = await attach.execute({
    taxpayerEmail: TAXPAYER_EMAIL,
  });

  expect(provider.queries).toEqual([]);
  expect(result).toEqual({
    kind: ATTACH_BUYER_RESULT.GENERIC,
    buyer: GENERIC_BUYER,
  });
});

it("given a valid NIT and an empty lookup, when the buyer is attached, then the buyer is the generic buyer", async () => {
  const { provider, attach } = harness(null);

  const result = await attach.execute({
    taxpayerEmail: TAXPAYER_EMAIL,
    documentType: NIT_DOCUMENT_TYPE,
    documentNumber: VALID_NIT,
  });

  expect(provider.queries).toEqual([
    { documentType: NIT_DOCUMENT_TYPE, documentNumber: VALID_NIT },
  ]);
  expect(result).toEqual({
    kind: ATTACH_BUYER_RESULT.GENERIC,
    buyer: GENERIC_BUYER,
  });
});

it("given a NIT with a wrong modulus-11 check digit, when the buyer is attached, then the attach is blocked", async () => {
  const { provider, attach } = harness({
    name: LOOKED_UP_NAME,
    email: LOOKED_UP_EMAIL,
  });

  const submit = attach.execute({
    taxpayerEmail: TAXPAYER_EMAIL,
    documentType: NIT_DOCUMENT_TYPE,
    documentNumber: INVALID_NIT,
  });

  await expect(submit).rejects.toBeInstanceOf(InvalidNitCheckDigit);
  expect(provider.queries).toEqual([]);
});

it("given a lookup returns an email, when the buyer is stored, then the stored buyer has no email column", async () => {
  const { attach } = harness({
    name: LOOKED_UP_NAME,
    email: LOOKED_UP_EMAIL,
  });

  const result = await attach.execute({
    taxpayerEmail: TAXPAYER_EMAIL,
    documentType: NIT_DOCUMENT_TYPE,
    documentNumber: VALID_NIT,
  });

  if (result.kind !== ATTACH_BUYER_RESULT.IDENTIFIED) {
    throw new Error("Expected an identified buyer.");
  }

  expect(result.buyer).toEqual({
    documentType: NIT_DOCUMENT_TYPE,
    documentNumber: VALID_NIT,
    name: LOOKED_UP_NAME,
  });
  expect(result.buyer).not.toHaveProperty("email");
  expect(result.lookup).toEqual({
    name: LOOKED_UP_NAME,
    email: LOOKED_UP_EMAIL,
  });
});
