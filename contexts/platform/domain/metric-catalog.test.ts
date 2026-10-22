import { expect, it } from "vitest";

import {
  reviewMetric as exportedReview,
  RELEASE_DIGEST,
  SERVICE_INSTANCES,
} from "#domain/index.js";
import {
  FACTUS_RESPONSE_STATUS,
  INVOICE_LABELS,
  METRIC_NAME,
  metricNames,
  reviewMetric,
} from "#domain/metric-catalog.js";

const invoiceLabels = ["tenant_id", "venue_id", "tax_id", "status"] as const;

for (const name of metricNames) {
  it(`given ${name}, when it is reviewed with its allowed labels, then it is accepted`, () => {
    const labels = name.startsWith("invoices.")
      ? invoiceLabels
      : name.startsWith("http.server.")
        ? ["tenant_id", "status"]
        : name === METRIC_NAME.FACTUS_RESPONSES
          ? ["tax_id", "status"]
          : [];
    const status =
      name === METRIC_NAME.FACTUS_RESPONSES
        ? FACTUS_RESPONSE_STATUS.TOO_MANY_REQUESTS
        : undefined;

    const decision = reviewMetric({ name, labels, status });

    expect(decision).toEqual({ outcome: "accepted" });
  });
}

it("given invoices.pending with tenant, venue, tax, and status, when it is reviewed, then it is accepted", () => {
  const decision = reviewMetric({
    name: METRIC_NAME.INVOICES_PENDING,
    labels: invoiceLabels,
  });

  expect(INVOICE_LABELS).toEqual(invoiceLabels);
  expect(decision).toEqual({ outcome: "accepted" });
});

it("given invoices.max_age_seconds labelled outside the invoice set, when it is reviewed, then it is rejected", () => {
  const decision = reviewMetric({
    name: METRIC_NAME.INVOICES_MAX_AGE_SECONDS,
    labels: ["tenant_id", "job_type"],
  });

  expect(decision).toEqual({ outcome: "rejected" });
});

it("given http.server.requests labelled by venue_id, when it is reviewed, then it is rejected", () => {
  const requests = reviewMetric({
    name: METRIC_NAME.HTTP_SERVER_REQUESTS,
    labels: ["venue_id"],
  });
  const duration = reviewMetric({
    name: METRIC_NAME.HTTP_SERVER_REQUEST_DURATION,
    labels: ["tenant_id", "venue_id"],
  });

  expect(requests).toEqual({ outcome: "rejected" });
  expect(duration).toEqual({ outcome: "rejected" });
});

it("given the release digest, when it is offered as a label, then it is rejected", () => {
  const decision = reviewMetric({
    name: METRIC_NAME.DEPLOYMENT_INFO,
    labels: [RELEASE_DIGEST],
  });

  expect(RELEASE_DIGEST).toBe("service.version");
  expect(decision).toEqual({ outcome: "rejected" });
});

for (const status of Object.values(FACTUS_RESPONSE_STATUS)) {
  it(`given factus.responses with status ${status}, when it is reviewed, then it is accepted`, () => {
    const decision = reviewMetric({
      name: METRIC_NAME.FACTUS_RESPONSES,
      labels: ["tax_id", "status"],
      status,
    });

    expect(decision).toEqual({ outcome: "accepted" });
  });
}

it("given factus.responses with a status outside 429, rejected, and server_error, when it is reviewed, then it is rejected", () => {
  const decision = reviewMetric({
    name: METRIC_NAME.FACTUS_RESPONSES,
    labels: ["tax_id", "status"],
    status: "200",
  });

  expect(decision).toEqual({ outcome: "rejected" });
});

for (const label of ["device_id", "user_id", "order_id"]) {
  it(`given a metric labelled by ${label}, when it is reviewed, then it is rejected`, () => {
    const decision = reviewMetric({
      name: METRIC_NAME.POSTGRES_CONNECTIONS_IN_USE,
      labels: [label],
    });

    expect(decision).toEqual({ outcome: "rejected" });
  });
}

for (const name of [
  "node.connected",
  "factus.wallet_balance",
  "platforms.orders",
  "service.instances",
]) {
  it(`given ${name}, when it is reviewed, then it is rejected`, () => {
    const decision = reviewMetric({ name, labels: [] });

    expect(decision).toEqual({ outcome: "rejected" });
  });
}

it("given service.instances, when the catalog is read, then it counts target_info", () => {
  expect(SERVICE_INSTANCES).toEqual({
    name: "service.instances",
    counts: "target_info",
  });
});

it("given the domain barrel, when reviewMetric is imported, then an off-catalog metric is rejected", () => {
  const decision = exportedReview({
    name: "order.total",
    labels: ["order_id"],
  });

  expect(decision).toEqual({ outcome: "rejected" });
});
