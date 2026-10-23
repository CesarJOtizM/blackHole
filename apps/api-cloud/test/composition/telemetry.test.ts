import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { scrubTelemetry } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  type OtlpClientOptions,
  type SentryClientOptions,
  startTelemetry,
  type TelemetryClients,
} from "#src/composition/telemetry.js";

const otlpEndpoint = "http://127.0.0.1:9";
const sentryDsn = "https://public@sentry.example/1";

const recordingClients = (): {
  clients: TelemetryClients;
  otlpCalls: OtlpClientOptions[];
  sentryCalls: SentryClientOptions[];
  otlpPayloads: string[];
  sentryPayloads: string[];
} => {
  const otlpCalls: OtlpClientOptions[] = [];
  const sentryCalls: SentryClientOptions[] = [];
  const otlpPayloads: string[] = [];
  const sentryPayloads: string[] = [];

  return {
    otlpCalls,
    sentryCalls,
    otlpPayloads,
    sentryPayloads,
    clients: {
      otlp(options) {
        otlpCalls.push(options);

        return {
          export(payload) {
            otlpPayloads.push(payload);
          },
        };
      },
      sentry(options) {
        sentryCalls.push(options);

        return {
          export(payload) {
            sentryPayloads.push(payload);
          },
        };
      },
    },
  };
};

it("given empty export destinations, when telemetry starts, then neither client is constructed", async () => {
  const recorded = recordingClients();

  const missing = startTelemetry({}, recorded.clients);
  const blank = startTelemetry(
    {
      OTEL_EXPORTER_OTLP_ENDPOINT: "  ",
      SENTRY_DSN: "",
    },
    recorded.clients,
  );

  await missing.export({ message: "customer phone 3001234567" });
  await blank.export({ authorization: "Bearer secret-token" });

  expect(recorded.otlpCalls).toEqual([]);
  expect(recorded.sentryCalls).toEqual([]);
  expect(recorded.otlpPayloads).toEqual([]);
  expect(recorded.sentryPayloads).toEqual([]);
});

it("given only an otlp endpoint, when telemetry starts, then sentry stays unconstructed", () => {
  const recorded = recordingClients();

  startTelemetry(
    {
      OTEL_EXPORTER_OTLP_ENDPOINT: `  ${otlpEndpoint}  `,
      SENTRY_DSN: "",
    },
    recorded.clients,
  );

  expect(recorded.otlpCalls).toEqual([
    {
      endpoint: otlpEndpoint,
      project: "api-cloud",
      release: "service.version",
    },
  ]);
  expect(recorded.sentryCalls).toEqual([]);
});

it("given only a sentry dsn, when telemetry starts, then otlp stays unconstructed and the release is service.version", () => {
  const recorded = recordingClients();

  startTelemetry(
    {
      OTEL_EXPORTER_OTLP_ENDPOINT: "",
      SENTRY_DSN: `  ${sentryDsn}  `,
    },
    recorded.clients,
  );

  expect(recorded.sentryCalls).toEqual([
    {
      dsn: sentryDsn,
      project: "api-cloud",
      release: "service.version",
    },
  ]);
  expect(recorded.otlpCalls).toEqual([]);
});

it("given SENTRY_ENVIRONMENT, when telemetry starts, then sentry receives that environment", () => {
  const recorded = recordingClients();

  startTelemetry(
    {
      SENTRY_DSN: sentryDsn,
      SENTRY_ENVIRONMENT: " staging ",
    },
    recorded.clients,
  );

  expect(recorded.sentryCalls).toEqual([
    {
      dsn: sentryDsn,
      project: "api-cloud",
      release: "service.version",
      environment: "staging",
    },
  ]);
});

it("given a phone and a bearer token, when the payload is exported, then both destinations receive it scrubbed", async () => {
  const recorded = recordingClients();
  const telemetry = startTelemetry(
    {
      OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint,
      SENTRY_DSN: sentryDsn,
    },
    recorded.clients,
  );
  const payload = {
    authorization: "Bearer secret-token",
    message: "customer phone 3001234567",
  };

  await telemetry.export(payload);

  const scrubbed = scrubTelemetry(payload);
  expect(recorded.otlpPayloads).toEqual([scrubbed]);
  expect(recorded.sentryPayloads).toEqual([scrubbed]);
  expect(scrubbed).not.toContain("secret-token");
  expect(scrubbed).not.toContain("3001234567");
});

it("given a throwing exporter, when a request exports telemetry and health is read, then the request succeeds and health stays ok", async () => {
  const seen: string[] = [];
  const clients: TelemetryClients = {
    otlp: () => ({
      export(payload) {
        seen.push(payload);
        throw new Error("otlp export failed");
      },
    }),
    sentry: () => ({
      export(payload) {
        seen.push(payload);
        return Promise.reject(new Error("sentry export failed"));
      },
    }),
  };
  const telemetry = startTelemetry(
    {
      OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint,
      SENTRY_DSN: sentryDsn,
    },
    clients,
  );
  const identities = new InMemoryIdentityRepository();
  const clock = new FakeClock(0);
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords: new FastPasswordHasher(),
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  try {
    const body = await telemetry.runRequest(
      {
        authorization: "Bearer secret-token",
        message: "customer phone 3001234567",
      },
      async () => ({ accepted: true }),
    );
    const response = await application.inject({
      method: "GET",
      url: "/health",
    });

    expect(body).toEqual({ accepted: true });
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toContain("secret-token");
    expect(seen[1]).not.toContain("3001234567");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});
