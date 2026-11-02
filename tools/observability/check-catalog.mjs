import { existsSync, readdirSync, readFileSync } from "node:fs";
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

const matchingBrace = (source, openIndex) => {
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const alarmEntries = (grafana) => {
  const header = /\balarms\s*=\s*\{/.exec(grafana);
  if (!header) return null;
  const open = grafana.indexOf("{", header.index);
  const close = matchingBrace(grafana, open);
  if (close === -1) return null;
  const body = grafana.slice(open + 1, close);
  const entries = [];

  for (const match of body.matchAll(/(?:^|\n)\s*([A-Za-z0-9_]+)\s*=\s*\{/g)) {
    const brace = body.indexOf("{", match.index);
    const end = matchingBrace(body, brace);
    if (end === -1) return null;
    entries.push({
      name: match[1],
      body: body.slice(brace + 1, end),
    });
  }

  return entries;
};

const alarmActionProblems = (grafana) => {
  const problems = [];
  const entries = alarmEntries(grafana);
  if (!entries || entries.length === 0) {
    problems.push("grafana alarms could not be read");
    return problems;
  }

  for (const entry of entries) {
    const action = entry.body.match(/\baction\s*=\s*"([^"]*)"/);
    if (!action || action[1].trim().length === 0) {
      problems.push(`alarm ${entry.name} has no action`);
    }
  }

  const rule = /resource\s+"grafana_rule_group"\s+"blackhole"/.exec(grafana);
  if (!rule) {
    problems.push("grafana_rule_group.blackhole is missing");
    return problems;
  }

  const open = grafana.indexOf("{", rule.index);
  const close = matchingBrace(grafana, open);
  const resource = grafana.slice(open, close);
  const annotations = /annotations\s*=\s*\{/.exec(resource);
  const annOpen = annotations ? resource.indexOf("{", annotations.index) : -1;
  const annClose = annOpen === -1 ? -1 : matchingBrace(resource, annOpen);
  const annBody = annClose === -1 ? "" : resource.slice(annOpen + 1, annClose);
  const literal = annBody.match(/\baction\s*=\s*"([^"]*)"/);
  const reference = /\baction\s*=\s*[A-Za-z0-9_.]+/.test(annBody);
  const present = literal ? literal[1].trim().length > 0 : reference;
  if (!present) {
    problems.push("grafana_rule_group.blackhole annotations have no action");
  }

  return problems;
};

const environmentProblems = (root) => {
  const dir = path.join(root, "infra", "environments");
  if (!existsSync(dir)) return ["infra/environments is missing"];
  const problems = [];

  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name, "main.tf");
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    if (!/module\s+"collector"/.test(source)) continue;

    const header = /module\s+"grafana"\s*\{/.exec(source);
    if (!header) {
      problems.push(`${name} mounts the collector without module "grafana"`);
      continue;
    }

    const open = source.indexOf("{", header.index);
    const close = matchingBrace(source, open);
    const body = source.slice(open + 1, close);
    if (!/source\s*=\s*"\.\.\/\.\.\/modules\/common\/grafana"/.test(body)) {
      problems.push(
        `${name} grafana source must be ../../modules/common/grafana`,
      );
    }
    if (!/\bprometheus_datasource_uid\s*=/.test(body)) {
      problems.push(`${name} does not pass prometheus_datasource_uid`);
    }
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

const grafana = read("infra/modules/common/grafana/main.tf");
const problems = [
  ...catalogProblems({
    catalog: read("contexts/platform/domain/metric-catalog.ts"),
    scrub: read("contexts/platform/domain/telemetry-scrub.ts"),
    grafana,
    collector: read("infra/modules/common/collector/main.tf"),
  }),
  ...alarmActionProblems(grafana),
  ...environmentProblems(root),
];

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(
  "catalog panels, labels, collector redaction, alarm actions, and grafana modules match",
);
