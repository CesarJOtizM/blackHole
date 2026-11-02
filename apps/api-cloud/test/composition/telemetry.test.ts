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
import { METRIC_NAME, scrubTelemetry } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  type ActiveTelemetry,
  type ContinuedTrace,
  type OtlpClientOptions,
  type OtlpSignals,
  type SentryClientOptions,
  startTelemetry,
  type TelemetryClients,
} from "#src/composition/telemetry.js";

const otlpEndpoint = "http://127.0.0.1:9";
const sentryDsn = "https://public@sentry.example/1";

interface StoredSentryError {
  company: string;
  site: string;
  role: string;
  release: string;
}

const recordingClients = (): {
  clients: TelemetryClients;
  otlpCalls: OtlpClientOptions[];
  sentryCalls: SentryClientOptions[];
  otlpPayloads: string[];
  sentryPayloads: string[];
  sentryStored: StoredSentryError[];
} => {
  const otlpCalls: OtlpClientOptions[] = [];
  const sentryCalls: SentryClientOptions[] = [];
  const otlpPayloads: string[] = [];
  const sentryPayloads: string[] = [];
  const sentryStored: StoredSentryError[] = [];

  return {
    otlpCalls,
    sentryCalls,
    otlpPayloads,
    sentryPayloads,
    sentryStored,
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
          export(payload: string, scope?: StoredSentryError) {
            sentryPayloads.push(payload);

            if (scope) {
              sentryStored.push(scope);
            }
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

it("given company, site, role, and release on a cloud error, when api-cloud or the worker reports it, then the sentry double stores company, site, role, and release service.version", async () => {
  const cloud = recordingClients();
  const workerSink = recordingClients();
  const api = startTelemetry({ SENTRY_DSN: sentryDsn }, cloud.clients);
  const worker = startTelemetry({ SENTRY_DSN: sentryDsn }, workerSink.clients);
  const error = {
    company: "company-1",
    site: "site-1",
    role: "cashier",
    message: "customer phone 3001234567",
  };
  const stored = {
    company: "company-1",
    site: "site-1",
    role: "cashier",
    release: "service.version",
  };
  const projectAndRelease = {
    project: "api-cloud",
    release: "service.version",
  };

  await api.export(error);
  await worker.export(error);

  expect(cloud.sentryStored).toEqual([stored]);
  expect(workerSink.sentryStored).toEqual([stored]);
  expect(cloud.sentryStored[0]).not.toEqual(projectAndRelease);
  expect(workerSink.sentryStored[0]).not.toEqual(projectAndRelease);
  expect(cloud.sentryPayloads[0]).not.toContain("3001234567");
  expect(workerSink.sentryPayloads[0]).not.toContain("3001234567");
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

interface RecordedSpan {
  spanContext(): { traceId: string; spanId: string };
  parentSpanContext?: { spanId: string };
}

interface RecordedLog {
  spanContext?: { traceId?: string };
  attributes: Record<string, unknown>;
}

interface RecordedMetric {
  descriptor: { name: string };
  dataPoints: readonly { attributes: Record<string, unknown> }[];
}

interface RecordedResourceMetrics {
  scopeMetrics: readonly { metrics: readonly RecordedMetric[] }[];
}

const exportResult = { code: 0 };

const recordingSignals = (): {
  exporters: OtlpSignals;
  spans: RecordedSpan[];
  logs: RecordedLog[];
  metrics: RecordedResourceMetrics[];
  traceIds: () => string[];
  metricNames: () => string[];
} => {
  const spans: RecordedSpan[] = [];
  const logs: RecordedLog[] = [];
  const metrics: RecordedResourceMetrics[] = [];
  const metricTraceIds = (): string[] =>
    metrics.flatMap((resource) =>
      resource.scopeMetrics.flatMap((scope) =>
        scope.metrics.flatMap((metric) =>
          metric.dataPoints.flatMap((point) => {
            const traceId = point.attributes.trace_id;

            return typeof traceId === "string" ? [traceId] : [];
          }),
        ),
      ),
    );

  return {
    spans,
    logs,
    metrics,
    traceIds: () => [
      ...spans.map((span) => span.spanContext().traceId),
      ...logs.flatMap((log) => {
        const traceId = log.spanContext?.traceId;

        return typeof traceId === "string" ? [traceId] : [];
      }),
      ...metricTraceIds(),
    ],
    metricNames: () =>
      metrics.flatMap((resource) =>
        resource.scopeMetrics.flatMap((scope) =>
          scope.metrics.map((metric) => metric.descriptor.name),
        ),
      ),
    exporters: {
      traces: {
        export(finished, resultCallback) {
          spans.push(...finished);
          resultCallback(exportResult);
        },
        shutdown: () => Promise.resolve(),
        forceFlush: () => Promise.resolve(),
      },
      logs: {
        export(records, resultCallback) {
          logs.push(...records);
          resultCallback(exportResult);
        },
        shutdown: () => Promise.resolve(),
        forceFlush: () => Promise.resolve(),
      },
      metrics: {
        export(resource, resultCallback) {
          metrics.push(resource);
          resultCallback(exportResult);
        },
        shutdown: () => Promise.resolve(),
        forceFlush: () => Promise.resolve(),
      },
    },
  };
};

const stopTelemetry = async (
  telemetry: ActiveTelemetry | undefined,
): Promise<void> => {
  if (
    telemetry &&
    "shutdown" in telemetry &&
    typeof telemetry.shutdown === "function"
  ) {
    await telemetry.shutdown();
  }
};

it("given the worker continues a cloud request, when telemetry is exported, then logs, catalog metrics, and traces share one trace id", async () => {
  const cloud = recordingSignals();
  const workerSink = recordingSignals();
  const api = startTelemetry(
    { OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint },
    { signals: cloud.exporters },
  );
  let worker: ActiveTelemetry | undefined;

  try {
    await api.export({
      tenant: "tenant-1",
      site: "site-1",
      message: "invoice accepted",
    });
    const parent = cloud.spans[0]?.spanContext();
    const continued: ContinuedTrace | undefined = parent
      ? { traceId: parent.traceId, spanId: parent.spanId }
      : undefined;
    worker = startTelemetry(
      { OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint },
      { signals: workerSink.exporters },
      continued,
    );
    await worker.export({
      tenant: "tenant-1",
      site: "site-1",
      message: "invoice issued",
    });

    const traceIds = [...cloud.traceIds(), ...workerSink.traceIds()];
    const shared = traceIds[0];

    expect(traceIds).toHaveLength(6);
    expect(new Set(traceIds)).toEqual(new Set([shared]));
    expect(shared).toMatch(/^[0-9a-f]{32}$/);
    expect(cloud.logs).toHaveLength(1);
    expect(workerSink.logs).toHaveLength(1);
    for (const log of [...cloud.logs, ...workerSink.logs]) {
      expect(log.attributes.tenant).toBe("tenant-1");
      expect(log.attributes.site).toBe("site-1");
      expect(log.attributes.trace_id).toBe(shared);
      expect(log.spanContext?.traceId).toBe(shared);
    }
    expect(cloud.metricNames()).toContain(METRIC_NAME.HTTP_SERVER_REQUESTS);
    expect(workerSink.metricNames()).toContain(
      METRIC_NAME.HTTP_SERVER_REQUESTS,
    );
    expect(workerSink.spans[0]?.parentSpanContext?.spanId).toBe(parent?.spanId);
  } finally {
    await stopTelemetry(api);
    await stopTelemetry(worker);
  }
});
