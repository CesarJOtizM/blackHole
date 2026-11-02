import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MONTH = 30 * 24 * 60 * 60;
const TEN_MINUTES = 10 * 60;
const FIVE_MINUTES = 5 * 60;

const vector = (samples) => ({ samples });

const labelKey = (labels) =>
  Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join(",");

const matchesPattern = (pattern, value) =>
  new RegExp(`^(?:${pattern})$`).test(value);

const labelsMatch = (labels, matchers) =>
  matchers.every((matcher) => {
    const has = Object.hasOwn(labels, matcher.name);
    const value = has ? labels[matcher.name] : "";
    if (matcher.op === "=") return has && value === matcher.value;
    if (matcher.op === "!=") return !has || value !== matcher.value;
    if (matcher.op === "=~") return has && matchesPattern(matcher.value, value);
    if (matcher.op === "!~") {
      return !has || !matchesPattern(matcher.value, value);
    }
    return false;
  });

const matching = (selector, series) =>
  series.filter(
    (item) =>
      item.metric === selector.metric &&
      labelsMatch(item.labels, selector.matchers),
  );

const newestPoint = (points) =>
  points.reduce((best, point) =>
    point.ageSeconds < best.ageSeconds ? point : best,
  );

const oldestPoint = (points) =>
  points.reduce((best, point) =>
    point.ageSeconds > best.ageSeconds ? point : best,
  );

const instant = (selector, series) =>
  vector(
    matching(selector, series)
      .filter((item) => item.points.length > 0)
      .map((item) => ({
        labels: item.labels,
        value: newestPoint(item.points).value,
      })),
  );

const increase = (selector, series) => {
  const samples = [];
  for (const item of matching(selector, series)) {
    const points = item.points.filter(
      (point) => point.ageSeconds <= selector.range,
    );
    if (points.length < 2) continue;
    samples.push({
      labels: item.labels,
      value: newestPoint(points).value - oldestPoint(points).value,
    });
  }
  return vector(samples);
};

const absentOverTime = (selector, series) => {
  const present = matching(selector, series).some((item) =>
    item.points.some((point) => point.ageSeconds <= selector.range),
  );
  if (present) return vector([]);
  return vector([{ labels: {}, value: 1 }]);
};

const aggregate = (kind, by, input) => {
  const groups = new Map();
  for (const sample of input.samples) {
    const labels = {};
    for (const key of by) {
      if (sample.labels[key] !== undefined) labels[key] = sample.labels[key];
    }
    const id = labelKey(labels);
    const found = groups.get(id);
    if (!found) {
      groups.set(id, { labels, value: sample.value });
      continue;
    }
    found.value =
      kind === "max"
        ? Math.max(found.value, sample.value)
        : found.value + sample.value;
  }
  return vector([...groups.values()]);
};

const divide = (left, right) => {
  if (left.samples.length === 0 || right.samples.length === 0)
    return vector([]);
  if (left.samples.length !== 1 || right.samples.length !== 1) {
    throw new Error("division expects one series on each side");
  }
  if (right.samples[0].value === 0) return vector([]);
  return vector([
    {
      labels: {},
      value: left.samples[0].value / right.samples[0].value,
    },
  ]);
};

const compareNumber = (left, op, right) => {
  if (op === ">") return left > right;
  if (op === ">=") return left >= right;
  if (op === "<") return left < right;
  if (op === "<=") return left <= right;
  if (op === "==") return left === right;
  return left !== right;
};

const compare = (input, op, threshold, asBool) => {
  const next = [];
  for (const sample of input.samples) {
    const matched = compareNumber(sample.value, op, threshold);
    if (asBool) {
      next.push({ labels: sample.labels, value: matched ? 1 : 0 });
    } else if (matched) {
      next.push(sample);
    }
  }
  return vector(next);
};

// PromQL `or` keeps the left series when labels match, even if its value is 0.
const unionOr = (left, right) => {
  const samples = [...left.samples];
  const seen = new Set(samples.map((sample) => labelKey(sample.labels)));
  for (const sample of right.samples) {
    if (!seen.has(labelKey(sample.labels))) samples.push(sample);
  }
  return vector(samples);
};

const fires = (result) => result.samples.some((sample) => sample.value > 0);

class Parser {
  constructor(input, series) {
    this.input = input;
    this.series = series;
    this.i = 0;
  }

  fail(message) {
    throw new Error(
      `${message} near "${this.input.slice(this.i, this.i + 24)}"`,
    );
  }

  skip() {
    while (this.i < this.input.length && /\s/.test(this.input[this.i]))
      this.i += 1;
  }

  peekChar() {
    this.skip();
    return this.input[this.i] ?? "";
  }

  done() {
    this.skip();
    return this.i >= this.input.length;
  }

  expect(token) {
    this.skip();
    if (!this.input.startsWith(token, this.i)) this.fail(`expected ${token}`);
    this.i += token.length;
  }

  eat(token) {
    this.skip();
    if (!this.input.startsWith(token, this.i)) return false;
    this.i += token.length;
    return true;
  }

  startsWord(word) {
    this.skip();
    if (!this.input.startsWith(word, this.i)) return false;
    const after = this.input[this.i + word.length] ?? "";
    return !/[A-Za-z0-9_]/.test(after);
  }

  eatWord(word) {
    if (!this.startsWord(word)) return false;
    this.i += word.length;
    return true;
  }

  ident() {
    this.skip();
    const match = /^[A-Za-z_:][A-Za-z0-9_:]*/.exec(this.input.slice(this.i));
    if (!match) this.fail("expected identifier");
    this.i += match[0].length;
    return match[0];
  }

  number() {
    this.skip();
    const match = /^\d+(?:\.\d+)?/.exec(this.input.slice(this.i));
    if (!match) this.fail("expected number");
    this.i += match[0].length;
    return Number(match[0]);
  }

  string() {
    this.skip();
    if (this.input[this.i] !== '"') this.fail("expected string");
    this.i += 1;
    let value = "";
    while (this.i < this.input.length) {
      const char = this.input[this.i];
      if (char === "\\") {
        value += this.input[this.i + 1] ?? "";
        this.i += 2;
        continue;
      }
      if (char === '"') {
        this.i += 1;
        return value;
      }
      value += char;
      this.i += 1;
    }
    this.fail("unterminated string");
  }

  matcherOp() {
    this.skip();
    for (const op of ["!~", "=~", "!=", "="]) {
      if (this.input.startsWith(op, this.i)) {
        this.i += op.length;
        return op;
      }
    }
    this.fail("expected matcher");
  }

  matchers() {
    this.expect("{");
    const matchers = [];
    if (this.peekChar() !== "}") {
      do {
        const name = this.ident();
        const op = this.matcherOp();
        matchers.push({ name, op, value: this.string() });
      } while (this.eat(","));
    }
    this.expect("}");
    return matchers;
  }

  range() {
    this.expect("[");
    const amount = this.number();
    this.skip();
    const unit = this.input[this.i];
    const scale = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
    if (!scale) this.fail("expected duration unit");
    this.i += 1;
    this.expect("]");
    return amount * scale;
  }

  selector() {
    const metric = this.ident();
    const matchers = this.peekChar() === "{" ? this.matchers() : [];
    const range = this.peekChar() === "[" ? this.range() : null;
    return { metric, matchers, range };
  }

  cmpOp() {
    this.skip();
    for (const op of [">=", "<=", "==", "!=", ">", "<"]) {
      if (this.input.startsWith(op, this.i)) {
        this.i += op.length;
        return op;
      }
    }
    return null;
  }

  orExpr() {
    let left = this.cmpExpr();
    while (this.eatWord("or")) left = unionOr(left, this.cmpExpr());
    return left;
  }

  cmpExpr() {
    const left = this.mulExpr();
    const op = this.cmpOp();
    if (!op) return left;
    const asBool = this.eatWord("bool");
    const right = this.mulExpr();
    if (right.samples.length !== 1) this.fail("comparison expects a number");
    return compare(left, op, right.samples[0].value, asBool);
  }

  mulExpr() {
    let left = this.primary();
    while (this.eat("/")) left = divide(left, this.primary());
    return left;
  }

  primary() {
    if (this.eat("(")) {
      const value = this.orExpr();
      this.expect(")");
      return value;
    }
    if (/^\d/.test(this.peekChar())) {
      return vector([{ labels: {}, value: this.number() }]);
    }
    const name = this.ident();
    if (name === "absent_over_time") return this.absent();
    if (this.startsWord("by") || this.peekChar() === "(")
      return this.call(name);
    return instant(
      {
        metric: name,
        matchers: this.peekChar() === "{" ? this.matchers() : [],
      },
      this.series,
    );
  }

  absent() {
    this.expect("(");
    const selector = this.selector();
    this.expect(")");
    if (selector.range === null) this.fail("absent_over_time needs a range");
    return absentOverTime(selector, this.series);
  }

  call(name) {
    const by = [];
    if (this.eatWord("by")) {
      this.expect("(");
      do {
        by.push(this.ident());
      } while (this.eat(","));
      this.expect(")");
    }
    this.expect("(");
    if (name === "increase") {
      const selector = this.selector();
      this.expect(")");
      if (selector.range === null) this.fail("increase needs a range");
      return increase(selector, this.series);
    }
    const arg = this.orExpr();
    this.expect(")");
    if (name === "sum" || name === "max") return aggregate(name, by, arg);
    this.fail(`unsupported ${name}`);
  }
}

const evaluate = (expr, series) => {
  const parser = new Parser(expr, series);
  const value = parser.orExpr();
  if (!parser.done()) parser.fail("unexpected input");
  return value;
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

const alarmExpressions = (grafana) => {
  const header = /\balarms\s*=\s*\{/.exec(grafana);
  if (!header) return null;
  const open = grafana.indexOf("{", header.index);
  const close = matchingBrace(grafana, open);
  if (close === -1) return null;
  const body = grafana.slice(open + 1, close);
  const exprs = new Map();
  for (const match of body.matchAll(/(?:^|\n)\s*([A-Za-z0-9_]+)\s*=\s*\{/g)) {
    const brace = body.indexOf("{", match.index);
    const end = matchingBrace(body, brace);
    if (end === -1) return null;
    const entry = body.slice(brace + 1, end);
    const expr = entry.match(/\bexpr\s*=\s*"((?:\\.|[^"\\])*)"/);
    if (!expr) continue;
    exprs.set(match[1], expr[1].replaceAll('\\"', '"'));
  }
  return exprs;
};

const counter = (metric, labels, amount, windowSeconds, newestAge) => ({
  metric,
  labels,
  points: [
    { ageSeconds: windowSeconds, value: 0 },
    { ageSeconds: newestAge, value: amount },
  ],
});

const gauge = (metric, labels, value) => ({
  metric,
  labels,
  points: [{ ageSeconds: 0, value }],
});

const http = (status, amount, newestAge) =>
  counter("http_server_requests_total", { status }, amount, MONTH, newestAge);

const rejected = (taxId, amount) =>
  counter(
    "factus_responses_total",
    { status: "rejected", tax_id: taxId },
    amount,
    TEN_MINUTES,
    30,
  );

const scenarios = [
  {
    alarm: "availability",
    series: [http("200", 994, 30), http("500", 6, 30)],
    fires: true,
    detail: "under 99.5% this month",
  },
  {
    alarm: "availability",
    series: [http("200", 1000, FIVE_MINUTES + 60)],
    fires: true,
    detail: "silent 5 minutes",
  },
  {
    alarm: "availability",
    series: [http("200", 995, 30), http("500", 5, 30)],
    fires: false,
    detail: "99.5% this month with recent traffic",
  },
  {
    alarm: "invoice_age",
    series: [
      gauge(
        "invoices_max_age_seconds",
        { status: "pending_issuance" },
        31 * 60,
      ),
    ],
    fires: true,
    detail: "an invoice pending 31 minutes",
  },
  {
    alarm: "invoice_age",
    series: [
      gauge(
        "invoices_max_age_seconds",
        { status: "pending_issuance" },
        30 * 60,
      ),
    ],
    fires: false,
    detail: "an invoice pending 30 minutes",
  },
  {
    alarm: "rejections",
    series: [rejected("9001", 4), rejected("9002", 1)],
    fires: true,
    detail: "over 3 rejections in 10 minutes for one tax id",
  },
  {
    alarm: "rejections",
    series: [rejected("9001", 3)],
    fires: false,
    detail: "3 rejections in 10 minutes for one tax id",
  },
  {
    alarm: "rejections",
    series: [rejected("9001", 2), rejected("9002", 2)],
    fires: false,
    detail: "4 rejections split across two tax ids",
  },
  {
    alarm: "first_production_sentry_issue",
    series: [
      gauge(
        "sentry_issues",
        { environment: "production", first_seen: "true" },
        4,
      ),
    ],
    fires: true,
    detail: "an error never seen in production",
  },
  {
    alarm: "first_production_sentry_issue",
    series: [
      gauge(
        "sentry_issues",
        { environment: "production", first_seen: "false" },
        4,
      ),
    ],
    fires: false,
    detail: "a repeated production error",
  },
  {
    alarm: "first_production_sentry_issue",
    series: [
      gauge("sentry_issues", { environment: "staging", first_seen: "true" }, 4),
    ],
    fires: false,
    detail: "an error never seen outside production",
  },
];

const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const grafanaPath = path.join(
  root,
  "infra",
  "modules",
  "common",
  "grafana",
  "main.tf",
);
if (!existsSync(grafanaPath)) {
  console.error("missing infra/modules/common/grafana/main.tf");
  process.exit(1);
}

const exprs = alarmExpressions(readFileSync(grafanaPath, "utf8"));
const problems = [];
if (!exprs) {
  problems.push("grafana alarms could not be read");
} else {
  for (const name of [
    "availability",
    "invoice_age",
    "rejections",
    "first_production_sentry_issue",
  ]) {
    if (!exprs.has(name)) problems.push(`alarm ${name} is missing`);
  }

  for (const scenario of scenarios) {
    const expr = exprs.get(scenario.alarm);
    if (!expr) continue;
    try {
      const fired = fires(evaluate(expr, scenario.series));
      if (fired === scenario.fires) continue;
      problems.push(
        scenario.fires
          ? `${scenario.alarm} did not fire for ${scenario.detail}`
          : `${scenario.alarm} fired for ${scenario.detail}`,
      );
    } catch (error) {
      problems.push(
        `${scenario.alarm} could not be evaluated for ${scenario.detail}: ${error.message}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(
  "availability, invoice age, rejections, and first production alarms fire",
);
