export const METRIC_NAME = {
  INVOICES_PENDING: "invoices.pending",
  INVOICES_MAX_AGE_SECONDS: "invoices.max_age_seconds",
  FACTUS_REQUESTS: "factus.requests",
  FACTUS_RESPONSES: "factus.responses",
  HTTP_SERVER_REQUEST_DURATION: "http.server.request.duration",
  HTTP_SERVER_REQUESTS: "http.server.requests",
  POSTGRES_CONNECTIONS_IN_USE: "postgres.connections_in_use",
  PGBOSS_JOBS_WAITING: "pgboss.jobs_waiting",
  PGBOSS_OLDEST_JOB_SECONDS: "pgboss.oldest_job_seconds",
  PGBOSS_JOBS_FAILED: "pgboss.jobs_failed",
  DEPLOYMENT_INFO: "deployment.info",
} as const;

export const metricNames = Object.values(METRIC_NAME);

export const FACTUS_RESPONSE_STATUS = {
  TOO_MANY_REQUESTS: "429",
  REJECTED: "rejected",
  SERVER_ERROR: "server_error",
} as const;

export const INVOICE_LABELS = [
  "tenant_id",
  "venue_id",
  "tax_id",
  "status",
] as const;

export const RELEASE_DIGEST = "service.version";

export const SERVICE_INSTANCES = {
  name: "service.instances",
  counts: "target_info",
} as const;

export interface MetricProposal {
  name: string;
  labels: readonly string[];
  status?: string;
}

export type MetricReview = { outcome: "accepted" } | { outcome: "rejected" };

const accepted = { outcome: "accepted" } as const;
const rejected = { outcome: "rejected" } as const;

const allowedNames = new Set<string>(metricNames);
const invoiceMetrics = new Set<string>([
  METRIC_NAME.INVOICES_PENDING,
  METRIC_NAME.INVOICES_MAX_AGE_SECONDS,
]);
const invoiceLabelSet = new Set<string>(INVOICE_LABELS);
const httpMetrics = new Set<string>([
  METRIC_NAME.HTTP_SERVER_REQUEST_DURATION,
  METRIC_NAME.HTTP_SERVER_REQUESTS,
]);
const factusStatuses = new Set<string>(Object.values(FACTUS_RESPONSE_STATUS));
const forbiddenWords = new Set(["device", "user", "order"]);

const labelWords = (label: string): readonly string[] =>
  label
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0);

const hasForbiddenLabel = (labels: readonly string[]): boolean =>
  labels.some(
    (label) =>
      label === RELEASE_DIGEST ||
      labelWords(label).some((word) => forbiddenWords.has(word)),
  );

const invoiceLabelsRejected = (proposal: MetricProposal): boolean =>
  invoiceMetrics.has(proposal.name) &&
  proposal.labels.some((label) => !invoiceLabelSet.has(label));

const httpVenueRejected = (proposal: MetricProposal): boolean =>
  httpMetrics.has(proposal.name) && proposal.labels.includes("venue_id");

const factusStatusRejected = (proposal: MetricProposal): boolean =>
  proposal.name === METRIC_NAME.FACTUS_RESPONSES &&
  (proposal.status === undefined || !factusStatuses.has(proposal.status));

export const reviewMetric = (proposal: MetricProposal): MetricReview => {
  if (!allowedNames.has(proposal.name) || hasForbiddenLabel(proposal.labels)) {
    return rejected;
  }

  if (
    invoiceLabelsRejected(proposal) ||
    httpVenueRejected(proposal) ||
    factusStatusRejected(proposal)
  ) {
    return rejected;
  }

  return accepted;
};
