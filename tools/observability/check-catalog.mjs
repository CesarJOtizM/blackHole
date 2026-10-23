import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedInvoiceLabels = ["tenant_id", "venue_id", "tax_id", "status"];
const expectedStatuses = ["429", "rejected", "server_error"];
const expectedDigest = "service.version";
const expectedService = { name: "service.instances", counts: "target_info" };
const forbiddenWords = new Set(["device", "user", "order"]);
const requiredFields = [
  "authorization",
  "cookie",
  "password",
  "token",
  "secret",
  "name",
  "phone",
  "address",
  "identification",
];

const quoted = (body) =>
  [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

const sameMembers = (left, right) =>
  left.length === right.length && left.every((item) => right.includes(item));

const labelWords = (label) =>
  label
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0);

const forbiddenLabel = (label) =>
  labelWords(label).some((word) => forbiddenWords.has(word));

const block = (source, pattern) => source.match(pattern)?.[1] ?? null;

const arrayLocals = (header) => {
  const locals = new Map();

  for (const match of header.matchAll(
    /(?:^|\n)\s*([A-Za-z0-9_]+)\s*=\s*\[([^\]]*)\]/g,
  )) {
    locals.set(match[1], quoted(match[2]));
  }

  return locals;
};

const assignment = (slice, field) => {
  const local = slice.match(new RegExp(`\\b${field}\\s*=\\s*local\\.(\\w+)`));
  if (local) {
    return { kind: "local", name: local[1] };
  }

  const list = slice.match(new RegExp(`\\b${field}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (list) {
    return { kind: "list", value: quoted(list[1]) };
  }

  const text = slice.match(new RegExp(`\\b${field}\\s*=\\s*"([^"]*)"`));
  if (text) {
    return { kind: "text", value: text[1] };
  }

  return { kind: "missing" };
};

const asList = (found, locals) => {
  if (found.kind === "list") {
    return found.value;
  }

  if (found.kind === "local") {
    return locals.has(found.name) ? locals.get(found.name) : null;
  }

  return found.kind === "missing" ? [] : null;
};

const asText = (found) => (found.kind === "text" ? found.value : "");

const panelsOf = (grafana) => {
  const dashboardsAt = grafana.indexOf("dashboards =");
  const alarmsAt = grafana.indexOf("\n  alarms =");
  if (dashboardsAt === -1 || alarmsAt === -1) {
    return null;
  }

  const locals = arrayLocals(grafana.slice(0, dashboardsAt));
  const dashboards = grafana.slice(dashboardsAt, alarmsAt);
  const marks = [...dashboards.matchAll(/\bmetric\s*=\s*"([^"]+)"/g)];

  return marks.map((mark, index) => {
    const slice = dashboards.slice(
      mark.index,
      marks[index + 1]?.index ?? dashboards.length,
    );

    return {
      metric: mark[1],
      labels: asList(assignment(slice, "labels"), locals),
      statuses: asList(assignment(slice, "statuses"), locals),
      attributes: asList(assignment(slice, "attributes"), locals),
      counts: asText(assignment(slice, "counts")),
    };
  });
};

const metricMentions = (grafana) =>
  new Set(
    [...grafana.matchAll(/\bmetric\s*=\s*"([^"]*)"/g)]
      .map((match) => match[1])
      .filter((name) => name.length > 0),
  );

const pushList = (problems, label, values) => {
  if (values === null) {
    problems.push(label);
    return [];
  }

  return values;
};

// Collector patterns are RE2. A word boundary may stand in for the
// JavaScript lookbehind in telemetry-scrub.ts. The check covers the dropped
// fields and the 7-10 digit run, not the lookaround syntax.
const redactionProblems = (scrub, collector) => {
  const problems = [];
  const scrubBody = block(scrub, /SENSITIVE_WORDS = new Set\(\[([\s\S]*?)\]\)/);
  const dropBody = block(collector, /drop_keys\s*=\s*\[([\s\S]*?)\]/);
  const digitRun = collector.match(/digit_run\s*=\s*"([^"]*)"/);

  if (!scrubBody || !dropBody) {
    problems.push("collector redaction could not be compared");
    return problems;
  }

  const dropKeys = new Set(quoted(dropBody));
  const fields = new Set([...requiredFields, ...quoted(scrubBody)]);

  for (const field of fields) {
    if (!dropKeys.has(field)) {
      problems.push(`collector does not drop ${field}`);
    }
  }

  const collectorDigits = digitRun?.[1] ?? "";
  const coversDigitRun =
    scrub.includes("\\d{7,10}") && collectorDigits.includes("\\d{7,10}");

  if (!coversDigitRun) {
    problems.push("collector digit run does not cover 7-10 digits");
  }

  return problems;
};

export const catalogProblems = ({ catalog, scrub, grafana, collector }) => {
  const problems = [];
  const metricBody = block(
    catalog,
    /export const METRIC_NAME = \{([\s\S]*?)\}\s*as const;/,
  );
  const serviceBody = block(
    catalog,
    /export const SERVICE_INSTANCES = \{([\s\S]*?)\}\s*as const;/,
  );
  const invoiceBody = block(
    catalog,
    /export const INVOICE_LABELS = \[([\s\S]*?)\]\s*as const;/,
  );
  const statusBody = block(
    catalog,
    /export const FACTUS_RESPONSE_STATUS = \{([\s\S]*?)\}\s*as const;/,
  );
  const digest = block(catalog, /export const RELEASE_DIGEST = "([^"]+)";/);

  if (!metricBody || !serviceBody || !invoiceBody || !statusBody || !digest) {
    problems.push("metric catalog could not be read");
    return problems;
  }

  const service = {
    name: serviceBody.match(/name:\s*"([^"]+)"/)?.[1],
    counts: serviceBody.match(/counts:\s*"([^"]+)"/)?.[1],
  };
  const invoiceLabels = quoted(invoiceBody);
  const statuses = quoted(statusBody);
  const catalogNames = new Set([...quoted(metricBody), service.name]);

  if (!sameMembers(invoiceLabels, expectedInvoiceLabels)) {
    problems.push(
      "invoice labels must stay tenant_id, venue_id, tax_id, and status",
    );
  }

  if (digest !== expectedDigest) {
    problems.push("the release digest must be service.version");
  }

  if (!sameMembers(statuses, expectedStatuses)) {
    problems.push(
      "factus.responses statuses must stay 429, rejected, and server_error",
    );
  }

  if (
    service.name !== expectedService.name ||
    service.counts !== expectedService.counts
  ) {
    problems.push("service.instances must count target_info");
  }

  const panels = panelsOf(grafana);
  if (!panels) {
    problems.push("grafana catalog panels are missing");
    return problems;
  }

  for (const name of metricMentions(grafana)) {
    if (!catalogNames.has(name)) {
      problems.push(`metric ${name} is outside the catalog`);
    }
  }

  const panelNames = new Set(panels.map((panel) => panel.metric));
  for (const name of catalogNames) {
    if (!panelNames.has(name)) {
      problems.push(`catalog metric ${name} has no panel`);
    }
  }

  for (const panel of panels) {
    const labels = pushList(
      problems,
      `metric ${panel.metric} labels could not be read`,
      panel.labels,
    );
    const attributes = pushList(
      problems,
      `metric ${panel.metric} attributes could not be read`,
      panel.attributes,
    );
    const panelStatuses = pushList(
      problems,
      `metric ${panel.metric} statuses could not be read`,
      panel.statuses,
    );

    for (const label of [...labels, ...attributes]) {
      if (forbiddenLabel(label)) {
        problems.push(`metric ${panel.metric} uses forbidden label ${label}`);
      }
    }

    if (labels.includes(digest)) {
      problems.push(`metric ${panel.metric} uses ${digest} as a label`);
    }

    if (
      panel.metric.startsWith("http.server.") &&
      labels.includes("venue_id")
    ) {
      problems.push(`metric ${panel.metric} uses venue_id`);
    }

    if (panel.metric.startsWith("invoices.")) {
      for (const label of labels) {
        if (!invoiceLabels.includes(label)) {
          problems.push(`metric ${panel.metric} uses label ${label}`);
        }
      }
    }

    if (panel.metric === "factus.responses") {
      for (const status of statuses) {
        if (!panelStatuses.includes(status)) {
          problems.push(`factus.responses panel is missing status ${status}`);
        }
      }
    }

    if (
      panel.metric === expectedService.name &&
      panel.counts !== expectedService.counts
    ) {
      problems.push(`service.instances must count ${expectedService.counts}`);
    }

    if (panel.metric === "deployment.info" && !attributes.includes(digest)) {
      problems.push(`deployment.info must keep ${digest} as an attribute`);
    }
  }

  problems.push(...redactionProblems(scrub, collector));
  return problems;
};

const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const read = (relative) => {
  const file = path.join(root, ...relative.split("/"));
  if (!existsSync(file)) {
    console.error(`missing ${relative}`);
    process.exit(1);
  }

  return readFileSync(file, "utf8");
};

const problems = catalogProblems({
  catalog: read("contexts/platform/domain/metric-catalog.ts"),
  scrub: read("contexts/platform/domain/telemetry-scrub.ts"),
  grafana: read("infra/modules/common/grafana/main.tf"),
  collector: read("infra/modules/common/collector/main.tf"),
});

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("catalog panels, labels, and collector redaction match");
