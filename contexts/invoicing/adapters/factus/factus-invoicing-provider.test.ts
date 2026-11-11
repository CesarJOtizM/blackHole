import { Secrets } from "@blackhole/platform/application/entry-port";
import { afterEach, expect, it, vi } from "vitest";

import {
  FACTUS_SECRET,
  FactusInvoicingProvider,
  FactusValidationFailed,
} from "#adapters/factus/factus-invoicing-provider.js";
import {
  ACQUIRER_LOOKUP,
  AcquirerLookupFailed,
  CreditNoteValidationFailed,
  InvoicePdfDownloadFailed,
  REFERENCE_LOOKUP,
  ReferenceQueryFailed,
} from "#application/ports/invoicing-provider.js";

const BASE_URL = "https://recorded.example.test";
const REFERENCE_CODE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const ORIGINAL_REFERENCE_CODE = "01932f4a-7c3a-7b2d-9e1f-6a5b4c3d2e10";
const ACCESS_TOKEN = "recorded-access-token";
const CLIENT_ID = "recorded-client";
const BILL_NUMBER = "SETP990000550";
const CUFE = "cufe-recorded";
const QR = "qr-recorded";
const ACQUIRER_NAME = "Comprador registrado";
const ACQUIRER_EMAIL = "buyer@example.test";
const PDF_BYTES = Uint8Array.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
]);
const PDF_BASE64 = Buffer.from(PDF_BYTES).toString("base64");

interface RecordedHttp {
  url: string;
  method: string;
  authorization: string | null;
  contentType: string | null;
  body: string | null;
}

class HostSecrets extends Secrets {
  constructor(private readonly stored: Readonly<Record<string, string>>) {
    super();
  }

  override read(name: string): Promise<string> {
    const value = this.stored[name];

    if (value === undefined) {
      return Promise.reject(new Error(`Unknown secret: ${name}`));
    }

    return Promise.resolve(value);
  }
}

const restoreEnv = (name: string, previous: string | undefined): void => {
  if (previous === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previous;
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const tokenResponse = (): Response =>
  jsonResponse(200, {
    token_type: "Bearer",
    expires_in: 600,
    access_token: ACCESS_TOKEN,
    refresh_token: "recorded-refresh-token",
  });

const provider = (): FactusInvoicingProvider =>
  new FactusInvoicingProvider(
    new HostSecrets({
      [FACTUS_SECRET.BASE_URL]: BASE_URL,
      [FACTUS_SECRET.CLIENT_ID]: CLIENT_ID,
      [FACTUS_SECRET.CLIENT_SECRET]: "recorded-secret",
      [FACTUS_SECRET.USERNAME]: "recorded-user",
      [FACTUS_SECRET.PASSWORD]: "recorded-password",
    }),
  );

const installFetch = (...responses: Response[]): RecordedHttp[] => {
  const recorded: RecordedHttp[] = [];

  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const headers = new Headers(init?.headers);
    recorded.push({
      url: String(input),
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      contentType: headers.get("content-type"),
      body: typeof init?.body === "string" ? init.body : null,
    });

    const response = responses[recorded.length - 1];

    if (response === undefined) {
      return Promise.reject(new Error("No recorded HTTP response."));
    }

    return Promise.resolve(response);
  });

  return recorded;
};

const withHostSecrets = async (
  act: (factus: FactusInvoicingProvider) => Promise<void>,
): Promise<void> => {
  const previousBase = process.env.FACTUS_BASE_URL;
  const previousClient = process.env.FACTUS_CLIENT_ID;
  process.env.FACTUS_BASE_URL = "https://environment.invalid";
  process.env.FACTUS_CLIENT_ID = "environment-client";

  try {
    await act(provider());
  } finally {
    restoreEnv("FACTUS_BASE_URL", previousBase);
    restoreEnv("FACTUS_CLIENT_ID", previousClient);
  }
};

const expectTokenRequest = (recorded: RecordedHttp): void => {
  expect(recorded.url).toBe(`${BASE_URL}/oauth/token`);
  expect(recorded.method).toBe("POST");
  expect(recorded.contentType).toBe("application/x-www-form-urlencoded");
  expect(recorded.url).not.toContain("environment.invalid");

  const form = new URLSearchParams(recorded.body ?? "");
  expect(form.get("grant_type")).toBe("password");
  expect(form.get("client_id")).toBe(CLIENT_ID);
  expect(form.get("client_secret")).toBe("recorded-secret");
  expect(form.get("username")).toBe("recorded-user");
  expect(form.get("password")).toBe("recorded-password");
  expect(form.get("client_id")).not.toBe("environment-client");
};

const expectBearer = (recorded: RecordedHttp): void => {
  expect(recorded.authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
};

afterEach(() => {
  vi.restoreAllMocks();
});

it("given secrets from the host, when a bill is validated, then Factus receives the reference as JSON", async () => {
  const recorded = installFetch(
    tokenResponse(),
    jsonResponse(201, {
      status: "Created",
      data: { is_validated: true, number: BILL_NUMBER, cufe: CUFE, qr: QR },
    }),
  );

  let issued: unknown = null;

  await withHostSecrets(async (factus) => {
    issued = await factus.validate({ referenceCode: REFERENCE_CODE });
  });

  expectTokenRequest(recorded[0] as RecordedHttp);
  expect(recorded[1]).toMatchObject({
    url: `${BASE_URL}/v2/bills/validate`,
    method: "POST",
    contentType: "application/json",
  });
  expectBearer(recorded[1] as RecordedHttp);
  expect(JSON.parse(recorded[1]?.body ?? "")).toEqual({
    document: "01",
    reference_code: REFERENCE_CODE,
  });
  expect(recorded[1]?.body).not.toContain("referenceCode");
  expect(issued).toEqual({
    number: BILL_NUMBER,
    cufe: CUFE,
    qr: QR,
  });
});

it("given Factus rejects the bill, when it is validated, then validation fails", async () => {
  installFetch(tokenResponse(), jsonResponse(422, { status: "Unprocessable" }));

  await expect(
    withHostSecrets(async (factus) => {
      await factus.validate({ referenceCode: REFERENCE_CODE });
    }),
  ).rejects.toBeInstanceOf(FactusValidationFailed);
});

it("given Factus validated the reference, when it is queried, then the number and CUFE come from the JSON", async () => {
  const recorded = installFetch(
    tokenResponse(),
    jsonResponse(200, {
      status: "OK",
      data: {
        data: [
          {
            status: 1,
            number: BILL_NUMBER,
            cufe: CUFE,
            reference_code: REFERENCE_CODE,
          },
        ],
      },
    }),
  );

  let lookup: Awaited<
    ReturnType<FactusInvoicingProvider["findByReference"]>
  > | null = null;

  await withHostSecrets(async (factus) => {
    lookup = await factus.findByReference(REFERENCE_CODE);
  });

  expect(recorded[1]?.url).toBe(
    `${BASE_URL}/v2/bills?filter[reference_code]=${REFERENCE_CODE}`,
  );
  expect(recorded[1]?.method).toBe("GET");
  expectBearer(recorded[1] as RecordedHttp);
  expect(lookup).toEqual({
    outcome: REFERENCE_LOOKUP.VALIDATED,
    number: BILL_NUMBER,
    cufe: CUFE,
  });
});

it("given a pending Factus bill, when the reference is queried, then the lookup is pending", async () => {
  installFetch(
    tokenResponse(),
    jsonResponse(200, {
      status: "OK",
      data: { data: [{ status: 0, reference_code: REFERENCE_CODE }] },
    }),
  );

  let lookup: Awaited<
    ReturnType<FactusInvoicingProvider["findByReference"]>
  > | null = null;

  await withHostSecrets(async (factus) => {
    lookup = await factus.findByReference(REFERENCE_CODE);
  });

  expect(lookup).toEqual({ outcome: REFERENCE_LOOKUP.PENDING });
});

it("given Factus has no bill for the reference, when it is queried, then the lookup is missing", async () => {
  installFetch(
    tokenResponse(),
    jsonResponse(200, { status: "OK", data: { data: [] } }),
  );

  let lookup: Awaited<
    ReturnType<FactusInvoicingProvider["findByReference"]>
  > | null = null;

  await withHostSecrets(async (factus) => {
    lookup = await factus.findByReference(REFERENCE_CODE);
  });

  expect(lookup).toEqual({ outcome: REFERENCE_LOOKUP.MISSING });
});

it("given Factus returned a DIAN rejection, when the reference is queried, then the lookup is rejected", async () => {
  installFetch(
    tokenResponse(),
    jsonResponse(200, {
      status: "OK",
      data: {
        data: [
          {
            status: 0,
            is_validated: false,
            errors: { FAJ44b: "Rechazo de la DIAN" },
          },
        ],
      },
    }),
  );

  let lookup: Awaited<
    ReturnType<FactusInvoicingProvider["findByReference"]>
  > | null = null;

  await withHostSecrets(async (factus) => {
    lookup = await factus.findByReference(REFERENCE_CODE);
  });

  expect(lookup).toEqual({ outcome: REFERENCE_LOOKUP.REJECTED });
});

it("given Factus returned nothing, when the reference is queried, then the lookup is empty", async () => {
  installFetch(
    tokenResponse(),
    jsonResponse(200, { status: "OK", data: null }),
  );

  let lookup: Awaited<
    ReturnType<FactusInvoicingProvider["findByReference"]>
  > | null = null;

  await withHostSecrets(async (factus) => {
    lookup = await factus.findByReference(REFERENCE_CODE);
  });

  expect(lookup).toEqual({ outcome: REFERENCE_LOOKUP.EMPTY });
});

it("given the reference query fails, when it is attempted, then the query fails", async () => {
  installFetch(tokenResponse(), jsonResponse(500, { status: "Error" }));

  await expect(
    withHostSecrets(async (factus) => {
      await factus.findByReference(REFERENCE_CODE);
    }),
  ).rejects.toBeInstanceOf(ReferenceQueryFailed);
});

it("given a pending attempt, when it is deleted, then Factus receives that reference", async () => {
  const recorded = installFetch(
    tokenResponse(),
    jsonResponse(200, { status: "OK" }),
  );

  await withHostSecrets((factus) => factus.deleteAttempt(REFERENCE_CODE));

  expect(recorded[1]).toMatchObject({
    url: `${BASE_URL}/v2/bills/destroy/reference/${REFERENCE_CODE}`,
    method: "DELETE",
  });
  expectBearer(recorded[1] as RecordedHttp);
});

it("given the delete fails, when the attempt is removed, then the query fails", async () => {
  installFetch(tokenResponse(), jsonResponse(500, { status: "Error" }));

  await expect(
    withHostSecrets((factus) => factus.deleteAttempt(REFERENCE_CODE)),
  ).rejects.toBeInstanceOf(ReferenceQueryFailed);
});

it("given an identification, when the acquirer is looked up, then name and email come from the JSON", async () => {
  const recorded = installFetch(
    tokenResponse(),
    jsonResponse(200, {
      status: "OK",
      message: "Solicitud exitosa",
      data: { name: ACQUIRER_NAME, email: ACQUIRER_EMAIL },
    }),
  );

  let lookup: Awaited<
    ReturnType<FactusInvoicingProvider["lookupAcquirer"]>
  > | null = null;

  await withHostSecrets(async (factus) => {
    lookup = await factus.lookupAcquirer({
      documentType: "31",
      documentNumber: "900123456",
    });
  });

  expect(recorded[1]?.url).toBe(
    `${BASE_URL}/v2/dian/acquirer?identification_document_code=31&identification_number=900123456`,
  );
  expect(recorded[1]?.method).toBe("GET");
  expect(recorded).toHaveLength(2);
  expect(recorded.some((call) => call.url.includes("/v2/bills/validate"))).toBe(
    false,
  );
  expect(recorded[1]?.url).not.toContain("documentType");
  expectBearer(recorded[1] as RecordedHttp);
  expect(lookup).toEqual({
    outcome: ACQUIRER_LOOKUP.FOUND,
    name: ACQUIRER_NAME,
    email: ACQUIRER_EMAIL,
  });
});

it("given Factus has no acquirer, when the lookup returns, then the lookup is empty", async () => {
  installFetch(
    tokenResponse(),
    jsonResponse(200, { status: "OK", data: null }),
  );

  let lookup: Awaited<
    ReturnType<FactusInvoicingProvider["lookupAcquirer"]>
  > | null = null;

  await withHostSecrets(async (factus) => {
    lookup = await factus.lookupAcquirer({
      documentType: "13",
      documentNumber: "1234567890",
    });
  });

  expect(lookup).toEqual({ outcome: ACQUIRER_LOOKUP.EMPTY });
});

it("given the acquirer lookup fails, when it is attempted, then the lookup fails", async () => {
  installFetch(tokenResponse(), jsonResponse(500, { status: "Error" }));

  await expect(
    withHostSecrets(async (factus) => {
      await factus.lookupAcquirer({
        documentType: "13",
        documentNumber: "1234567890",
      });
    }),
  ).rejects.toBeInstanceOf(AcquirerLookupFailed);
});

it("given a credit note, when it is validated, then Factus JSON cites the original bill", async () => {
  const recorded = installFetch(
    tokenResponse(),
    jsonResponse(201, { status: "Created", data: { is_validated: true } }),
  );

  await withHostSecrets((factus) =>
    factus.validateCreditNote({
      referenceCode: REFERENCE_CODE,
      originalReferenceCode: ORIGINAL_REFERENCE_CODE,
    }),
  );

  expect(recorded[1]).toMatchObject({
    url: `${BASE_URL}/v2/credit-notes/validate`,
    method: "POST",
    contentType: "application/json",
  });
  expectBearer(recorded[1] as RecordedHttp);
  expect(JSON.parse(recorded[1]?.body ?? "")).toEqual({
    reference_code: REFERENCE_CODE,
    correction_concept_code: "2",
    customization_id: "20",
    bill_number: ORIGINAL_REFERENCE_CODE,
  });
  expect(recorded[1]?.body).not.toContain("originalReferenceCode");
});

it("given the credit note is refused, when it is validated, then validation fails", async () => {
  installFetch(tokenResponse(), jsonResponse(422, { status: "Unprocessable" }));

  await expect(
    withHostSecrets((factus) =>
      factus.validateCreditNote({
        referenceCode: REFERENCE_CODE,
        originalReferenceCode: ORIGINAL_REFERENCE_CODE,
      }),
    ),
  ).rejects.toBeInstanceOf(CreditNoteValidationFailed);
});

it("given an accepted bill number, when the PDF is downloaded, then Factus receives a GET and the bytes are the decoded PDF", async () => {
  const recorded = installFetch(
    tokenResponse(),
    jsonResponse(200, {
      status: "OK",
      message: "Solicitud exitosa",
      data: {
        file_name: `${BILL_NUMBER}.pdf`,
        pdf_base_64_encoded: PDF_BASE64,
      },
    }),
  );

  let bytes: Uint8Array | null = null;

  await withHostSecrets(async (factus) => {
    bytes = await factus.downloadPdf(BILL_NUMBER);
  });

  expect(recorded[1]).toMatchObject({
    url: `${BASE_URL}/v2/bills/${BILL_NUMBER}/download-pdf`,
    method: "GET",
  });
  expect(recorded[1]?.body).toBeNull();
  expect(recorded.some((call) => call.url.includes("/v2/bills/validate"))).toBe(
    false,
  );
  expectBearer(recorded[1] as RecordedHttp);
  expect(bytes).toEqual(PDF_BYTES);
});

it("given the PDF download fails, when it is attempted, then the download fails", async () => {
  const recorded = installFetch(
    tokenResponse(),
    jsonResponse(500, { status: "Error" }),
  );

  await expect(
    withHostSecrets(async (factus) => {
      await factus.downloadPdf(BILL_NUMBER);
    }),
  ).rejects.toBeInstanceOf(InvoicePdfDownloadFailed);

  expect(recorded[1]).toMatchObject({
    url: `${BASE_URL}/v2/bills/${BILL_NUMBER}/download-pdf`,
    method: "GET",
  });
  expect(recorded.some((call) => call.url.includes("/v2/bills/validate"))).toBe(
    false,
  );
});

it("given Factus omits the PDF bytes, when the download returns, then the download fails", async () => {
  const recorded = installFetch(
    tokenResponse(),
    jsonResponse(200, {
      status: "OK",
      data: { file_name: `${BILL_NUMBER}.pdf` },
    }),
  );

  await expect(
    withHostSecrets(async (factus) => {
      await factus.downloadPdf(BILL_NUMBER);
    }),
  ).rejects.toBeInstanceOf(InvoicePdfDownloadFailed);

  expect(recorded[1]).toMatchObject({
    url: `${BASE_URL}/v2/bills/${BILL_NUMBER}/download-pdf`,
    method: "GET",
  });
});
