import {
  METRIC_NAME,
  RELEASE_DIGEST,
  scrubTelemetry,
} from "@blackhole/platform/domain";
import {
  isSpanContextValid,
  ROOT_CONTEXT,
  TraceFlags,
  trace,
} from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  LoggerProvider,
  type LogRecordExporter,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  type PushMetricExporter,
} from "@opentelemetry/sdk-metrics";
import {
  SimpleSpanProcessor,
  type SpanExporter,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import * as Sentry from "@sentry/node";

export const SENTRY_PROJECT = "api-cloud" as const;

const LOG_FIELD = {
  TENANT: "tenant",
  SITE: "site",
  TRACE_ID: "trace_id",
} as const;

const ERROR_FIELD = {
  COMPANY: "company",
  SITE: "site",
  ROLE: "role",
} as const;

const SENTRY_TAG = {
  PROJECT: "project",
  COMPANY: "company",
  SITE: "site",
  ROLE: "role",
} as const;

const SPAN_NAME = {
  API: "api-cloud.request",
  WORKER: "worker.request",
} as const;

const SIGNAL_PATH = {
  TRACES: "/v1/traces",
  LOGS: "/v1/logs",
  METRICS: "/v1/metrics",
} as const;

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

export interface SentryErrorScope {
  company: string;
  site: string;
  role: string;
  release: string;
}

export interface TelemetryExporter {
  export(payload: string, scope?: SentryErrorScope): void | Promise<void>;
  shutdown?(): Promise<void>;
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

export interface ContinuedTrace {
  traceId: string;
  spanId: string;
}

export interface SpanSignal {
  spanContext(): { traceId: string; spanId: string };
  parentSpanContext?: { spanId: string };
}

export interface LogSignal {
  spanContext?: { traceId?: string };
  attributes: Record<string, unknown>;
}

export interface MetricDataPoint {
  attributes: Record<string, unknown>;
}

export interface MetricSignal {
  descriptor: { name: string };
  dataPoints: readonly MetricDataPoint[];
}

export interface MetricScopeSignal {
  metrics: readonly MetricSignal[];
}

export interface ResourceMetricSignal {
  scopeMetrics: readonly MetricScopeSignal[];
}

export interface ExportResult {
  code: number;
}

export interface TraceSignalExporter {
  export(
    spans: readonly SpanSignal[],
    resultCallback: (result: ExportResult) => void,
  ): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

export interface LogSignalExporter {
  export(
    records: readonly LogSignal[],
    resultCallback: (result: ExportResult) => void,
  ): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

export interface MetricSignalExporter {
  export(
    metrics: ResourceMetricSignal,
    resultCallback: (result: ExportResult) => void,
  ): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

export interface OtlpSignals {
  traces: TraceSignalExporter;
  logs: LogSignalExporter;
  metrics: MetricSignalExporter;
}

export interface TelemetryClients {
  otlp?: (options: OtlpClientOptions) => TelemetryExporter;
  sentry?: (options: SentryClientOptions) => TelemetryExporter;
  signals?: OtlpSignals;
}

export interface ActiveTelemetry {
  export(payload: unknown): Promise<void>;
  runRequest<Result>(
    payload: unknown,
    request: () => Promise<Result>,
  ): Promise<Result>;
  shutdown(): Promise<void>;
}

const signalUrl = (
  endpoint: string,
  path: (typeof SIGNAL_PATH)[keyof typeof SIGNAL_PATH],
): string => {
  const base = endpoint.replace(/\/$/, "");

  if (base.endsWith(path)) {
    return base;
  }

  const root = base.replace(/\/v1\/(?:traces|logs|metrics)$/, "");

  return `${root}${path}`;
};

const textField = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];

  return typeof value === "string" ? value : "";
};

const readRecord = (payload: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(payload);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return undefined;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const readScope = (payload: string): { tenant: string; site: string } => {
  const record = readRecord(payload);

  if (!record) {
    return { tenant: "", site: "" };
  }

  return {
    tenant: textField(record, LOG_FIELD.TENANT),
    site: textField(record, LOG_FIELD.SITE),
  };
};

const readErrorScope = (payload: string): SentryErrorScope => {
  const record = readRecord(payload);

  return {
    company: record ? textField(record, ERROR_FIELD.COMPANY) : "",
    site: record ? textField(record, ERROR_FIELD.SITE) : "",
    role: record ? textField(record, ERROR_FIELD.ROLE) : "",
    release: RELEASE_DIGEST,
  };
};

export const continuedTraceFromEnv = (
  env: NodeJS.ProcessEnv,
): ContinuedTrace | undefined => {
  const header = env.TRACEPARENT?.trim().toLowerCase() ?? "";
  const match = TRACEPARENT.exec(header);
  const traceId = match?.[1];
  const spanId = match?.[2];

  if (!traceId || !spanId) {
    return undefined;
  }

  return { traceId, spanId };
};

const parentOf = (continued: ContinuedTrace | undefined) => {
  if (!continued) {
    return ROOT_CONTEXT;
  }

  const spanContext = {
    traceId: continued.traceId,
    spanId: continued.spanId,
    traceFlags: TraceFlags.SAMPLED,
    isRemote: true,
  };

  if (!isSpanContextValid(spanContext)) {
    return ROOT_CONTEXT;
  }

  return trace.setSpanContext(ROOT_CONTEXT, spanContext);
};

const traceExporterFor = (
  endpoint: string,
  signals: OtlpSignals | undefined,
): SpanExporter => {
  if (signals) {
    return signals.traces as unknown as SpanExporter;
  }

  return new OTLPTraceExporter({
    url: signalUrl(endpoint, SIGNAL_PATH.TRACES),
  });
};

const logExporterFor = (
  endpoint: string,
  signals: OtlpSignals | undefined,
): LogRecordExporter => {
  if (signals) {
    return signals.logs as unknown as LogRecordExporter;
  }

  return new OTLPLogExporter({
    url: signalUrl(endpoint, SIGNAL_PATH.LOGS),
  });
};

const metricExporterFor = (
  endpoint: string,
  signals: OtlpSignals | undefined,
): PushMetricExporter => {
  if (signals) {
    return signals.metrics as unknown as PushMetricExporter;
  }

  return new OTLPMetricExporter({
    url: signalUrl(endpoint, SIGNAL_PATH.METRICS),
  });
};

const defaultOtlpClient = (
  options: OtlpClientOptions,
  signals: OtlpSignals | undefined,
  continuedTrace: ContinuedTrace | undefined,
): TelemetryExporter => {
  const tracerProvider = new TracerProvider({
    spanProcessors: [
      new SimpleSpanProcessor({
        exporter: traceExporterFor(options.endpoint, signals),
      }),
    ],
  });
  const loggerProvider = new LoggerProvider({
    processors: [
      new SimpleLogRecordProcessor({
        exporter: logExporterFor(options.endpoint, signals),
      }),
    ],
  });
  const meterProvider = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporterFor(options.endpoint, signals),
        exportIntervalMillis: 60_000,
      }),
    ],
  });
  const tracer = tracerProvider.getTracer(options.project);
  const logger = loggerProvider.getLogger(options.project);
  const requests = meterProvider
    .getMeter(options.project)
    .createCounter(METRIC_NAME.HTTP_SERVER_REQUESTS);

  return {
    async export(payload) {
      try {
        const parent = parentOf(continuedTrace);
        const span = tracer.startSpan(
          continuedTrace ? SPAN_NAME.WORKER : SPAN_NAME.API,
          {},
          parent,
        );
        const active = trace.setSpan(parent, span);
        const spanContext = span.spanContext();
        const scope = readScope(payload);

        span.setAttribute("telemetry.payload", payload);
        span.setAttribute(RELEASE_DIGEST, options.release);
        span.setAttribute(LOG_FIELD.TENANT, scope.tenant);
        span.setAttribute(LOG_FIELD.SITE, scope.site);
        logger.emit({
          context: active,
          body: payload,
          attributes: {
            [LOG_FIELD.TENANT]: scope.tenant,
            [LOG_FIELD.SITE]: scope.site,
            [LOG_FIELD.TRACE_ID]: spanContext.traceId,
          },
        });
        requests.add(1, { [LOG_FIELD.TRACE_ID]: spanContext.traceId });
        span.end();
        await tracerProvider.forceFlush();
        await loggerProvider.forceFlush();
        await meterProvider.forceFlush();
      } catch {
        // A failed export must not fail the request.
      }
    },
    async shutdown() {
      await meterProvider.shutdown().catch(() => undefined);
      await loggerProvider.shutdown().catch(() => undefined);
      await tracerProvider.shutdown().catch(() => undefined);
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
  Sentry.setTag(SENTRY_TAG.PROJECT, options.project);

  return {
    export(payload, report) {
      Sentry.withScope((scope) => {
        scope.setTag(SENTRY_TAG.PROJECT, options.project);
        scope.setTag(SENTRY_TAG.COMPANY, report?.company ?? "");
        scope.setTag(SENTRY_TAG.SITE, report?.site ?? "");
        scope.setTag(SENTRY_TAG.ROLE, report?.role ?? "");
        Sentry.captureMessage(payload);
      });
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

const rememberShutdown = (
  closers: Array<() => Promise<void>>,
  exporter: TelemetryExporter | undefined,
): void => {
  if (!exporter?.shutdown) {
    return;
  }

  const shutdown = exporter.shutdown.bind(exporter);
  closers.push(async () => {
    try {
      await shutdown();
    } catch {
      // A failed export must not fail the request.
    }
  });
};

export const startTelemetry = (
  env: NodeJS.ProcessEnv,
  clients: TelemetryClients = {},
  continuedTrace?: ContinuedTrace,
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
    clients.otlp ??
      ((options) =>
        defaultOtlpClient(options, clients.signals, continuedTrace)),
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
  const closers: Array<() => Promise<void>> = [];
  rememberShutdown(closers, otlp);
  rememberShutdown(closers, sentry);

  const exportSignal = async (payload: unknown): Promise<void> => {
    if (destinations.length === 0) {
      return;
    }

    const scrubbed = scrubTelemetry(payload);
    const report = readErrorScope(scrubbed);

    await Promise.all(
      destinations.map(async (destination) => {
        try {
          await destination.export(scrubbed, report);
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
    async shutdown() {
      await Promise.all(closers.map((close) => close()));
    },
  };
};
