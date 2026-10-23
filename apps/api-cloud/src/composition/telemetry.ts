import { RELEASE_DIGEST, scrubTelemetry } from "@blackhole/platform/domain";
import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/node";

export const SENTRY_PROJECT = "api-cloud" as const;

export interface TelemetryExporter {
  export(payload: string): void | Promise<void>;
}

export interface OtlpClientOptions {
  endpoint: string;
  project: typeof SENTRY_PROJECT;
  release: string;
}

export interface SentryClientOptions {
  dsn: string;
  project: typeof SENTRY_PROJECT;
  release: string;
  environment?: string;
}

export interface TelemetryClients {
  otlp?: (options: OtlpClientOptions) => TelemetryExporter;
  sentry?: (options: SentryClientOptions) => TelemetryExporter;
}

export interface ActiveTelemetry {
  export(payload: unknown): Promise<void>;
  runRequest<Result>(
    payload: unknown,
    request: () => Promise<Result>,
  ): Promise<Result>;
}

const tracesUrl = (endpoint: string): string => {
  const base = endpoint.replace(/\/$/, "");

  if (base.endsWith("/v1/traces")) {
    return base;
  }

  return `${base}/v1/traces`;
};

const defaultOtlpClient = (options: OtlpClientOptions): TelemetryExporter => {
  const sdk = new NodeSDK({
    autoDetectResources: false,
    instrumentations: [],
    logRecordProcessors: [],
    metricReaders: [],
    serviceName: options.project,
    traceExporter: new OTLPTraceExporter({ url: tracesUrl(options.endpoint) }),
  });
  sdk.start();
  const tracer = trace.getTracer(options.project);

  return {
    export(payload) {
      const span = tracer.startSpan("telemetry.export");
      span.setAttribute("telemetry.payload", payload);
      span.setAttribute(RELEASE_DIGEST, options.release);
      span.end();
    },
  };
};

const defaultSentryClient = (
  options: SentryClientOptions,
): TelemetryExporter => {
  Sentry.initWithoutDefaultIntegrations({
    dsn: options.dsn,
    release: options.release,
    environment: options.environment,
    defaultIntegrations: false,
    integrations: [],
    enableOpenTelemetrySetup: false,
    enableRuntimeChannelInjection: false,
    sendClientReports: false,
  });
  Sentry.setTag("project", options.project);

  return {
    export(payload) {
      Sentry.captureMessage(payload);
    },
  };
};

const openClient = <Options>(
  enabled: boolean,
  options: Options,
  factory: (options: Options) => TelemetryExporter,
): TelemetryExporter | undefined => {
  if (!enabled) {
    return undefined;
  }

  try {
    return factory(options);
  } catch {
    return undefined;
  }
};

export const startTelemetry = (
  env: NodeJS.ProcessEnv,
  clients: TelemetryClients = {},
): ActiveTelemetry => {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() ?? "";
  const dsn = env.SENTRY_DSN?.trim() ?? "";
  const environment = env.SENTRY_ENVIRONMENT?.trim() ?? "";
  const otlp = openClient(
    endpoint.length > 0,
    {
      endpoint,
      project: SENTRY_PROJECT,
      release: RELEASE_DIGEST,
    },
    clients.otlp ?? defaultOtlpClient,
  );
  const sentry = openClient(
    dsn.length > 0,
    {
      dsn,
      project: SENTRY_PROJECT,
      release: RELEASE_DIGEST,
      ...(environment.length > 0 ? { environment } : {}),
    },
    clients.sentry ?? defaultSentryClient,
  );
  const destinations = [otlp, sentry].filter(
    (client): client is TelemetryExporter => client !== undefined,
  );

  const exportSignal = async (payload: unknown): Promise<void> => {
    if (destinations.length === 0) {
      return;
    }

    const scrubbed = scrubTelemetry(payload);

    await Promise.all(
      destinations.map(async (destination) => {
        try {
          await destination.export(scrubbed);
        } catch {
          // A failed export must not fail the request.
        }
      }),
    );
  };

  return {
    export: exportSignal,
    async runRequest(payload, request) {
      const result = await request();
      await exportSignal(payload);
      return result;
    },
  };
};
