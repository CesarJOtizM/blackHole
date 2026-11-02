import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const problems = [];

const fail = (message) => {
  problems.push(message);
};

const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8");

const stepBlock = (source, name) => {
  const start = source.indexOf(`- name: ${name}`);

  if (start < 0) {
    return "";
  }

  const next = source.indexOf("\n      - name:", start + 1);

  return source.slice(start, next === -1 ? undefined : next);
};

const variablesOf = (block) =>
  [...block.matchAll(/-var\s+"([^=]+)=([^"]*)"/g)].map((match) => ({
    name: match[1],
    value: match[2],
  }));

const onlyGitRef = (variables) =>
  variables.length > 0 &&
  variables.every((variable) => variable.name === "git_ref");

const runRestore = (args) => {
  const script = path.join(root, "tools/delivery/restore-dump.mjs");
  const runner = `
    import net from "node:net";
    const opened = (kind) => {
      console.error("network connection opened: " + kind);
      process.exit(2);
    };
    net.createConnection = () => opened("createConnection");
    net.Socket.prototype.connect = function connect() {
      opened("net.connect");
      return this;
    };
    globalThis.fetch = async () => opened("fetch");
    process.argv = [process.execPath, ${JSON.stringify(script)}, ${args
      .map((arg) => JSON.stringify(arg))
      .join(", ")}];
    await import(${JSON.stringify(pathToFileURL(script).href)});
  `;

  return spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", runner],
    { encoding: "utf8", cwd: root },
  );
};

const assertMissingDump = () => {
  const missing = runRestore([
    "--cloud",
    "gcp",
    "--dump",
    path.join(root, "missing-encrypted-dump.sql.enc"),
  ]);
  const output = `${missing.stdout ?? ""}\n${missing.stderr ?? ""}`;

  if (missing.status === 0) {
    fail("given a missing dump, when restore runs, then it must exit non-zero");
  }

  if (missing.status === 2 || output.includes("network connection opened")) {
    fail(
      "given a missing dump, when restore runs, then it must not open a network connection",
    );
  }

  if (!output.includes("gcp")) {
    fail(
      "given a missing dump, when restore runs, then it must name the target cloud",
    );
  }
};

const assertPresentDump = () => {
  const directory = mkdtempSync(path.join(tmpdir(), "blackhole-restore-"));
  const dump = path.join(directory, "backup.sql.enc");

  try {
    writeFileSync(dump, "encrypted-dump");
    const present = runRestore(["--cloud", "aws", "--dump", dump]);
    const output = `${present.stdout ?? ""}\n${present.stderr ?? ""}`;

    if (present.status !== 0 || !output.includes("aws")) {
      fail(
        "given a dump file, when restore runs, then it names aws and exits 0",
      );
    }

    if (output.includes("network connection opened")) {
      fail(
        "given a dump file, when restore runs, then it must not open a network connection",
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const assertRestoreScript = () => {
  let source = "";

  try {
    source = read("tools/delivery/restore-dump.mjs");
  } catch {
    fail("restore script is missing");
    return;
  }

  if (
    /\b(fetch|createConnection|child_process|execFile|spawn\(|curl |gcloud |terraform )/.test(
      source,
    ) ||
    /from "node:(net|http|https|dns)"/.test(source)
  ) {
    fail("restore script opens a network connection");
  }
};

const assertRehearsal = () => {
  const rehearsal = read(".github/workflows/rehearsal.yml");
  const restore = stepBlock(rehearsal, "Restore the encrypted dump");
  const alert = stepBlock(rehearsal, "Alert the team with the failing step");

  if (rehearsal.includes('echo "restore the latest encrypted dump')) {
    fail("rehearsal restore step still echoes the dump");
  }

  if (
    !restore.includes("node tools/delivery/restore-dump.mjs") ||
    !restore.includes("steps.target.outputs.cloud")
  ) {
    fail(
      "given a rehearsal, when the dump is restored, then the step calls the script and names the target cloud",
    );
  }

  if (
    !alert.includes("if: failure()") ||
    !alert.includes("failing step") ||
    !alert.includes("steps.restore.outcome") ||
    !alert.includes("Restore the encrypted dump")
  ) {
    fail(
      "given a failed rehearsal, when the job ends, then the alert names the failing step",
    );
  }

  if (
    rehearsal.includes("staging-azure") ||
    rehearsal.includes("production-azure") ||
    (/terraform apply/.test(rehearsal) && rehearsal.includes("azure"))
  ) {
    fail("rehearsal must stay on one of AWS or GCP");
  }
};

const assertDelivery = () => {
  const delivery = read(".github/workflows/delivery.yml");
  const production = delivery.slice(delivery.indexOf("\n  production:"));
  const shift = stepBlock(
    production,
    "Migrate production and shift part of the instances",
  );
  const finish = stepBlock(
    production,
    "Finish the rollout when 5xx and p95 hold",
  );
  const rollback = stepBlock(
    production,
    "Return to the previous digest without a database change",
  );
  const shiftVariables = variablesOf(shift);
  const finishVariables = variablesOf(finish);
  const partial = shiftVariables.find(
    (variable) =>
      variable.name !== "git_ref" &&
      Number.isFinite(Number(variable.value)) &&
      Number(variable.value) < 100,
  );

  if (onlyGitRef(shiftVariables) && onlyGitRef(finishVariables)) {
    fail("both production applies pass only git_ref");
  }

  if (!partial) {
    fail("first production apply is a full shift");
  }

  const finished = finishVariables.find(
    (variable) => variable.name === partial?.name,
  );

  if (!finished || Number(finished.value) !== 100) {
    fail(
      "given signals that hold, when the finish step runs, then it completes the shift",
    );
  }

  if (!finish.includes("steps.signals.outputs.worsened != 'true'")) {
    fail("finish step must run only when signals are not worsened");
  }

  if (!rollback.includes("steps.previous.outputs.digest")) {
    fail("rollback must return steps.previous.outputs.digest");
  }

  if (/migrat/i.test(rollback)) {
    fail("rollback must not run a migration");
  }

  if (
    production.includes("production-azure") ||
    /terraform apply[\s\S]*azure/.test(production)
  ) {
    fail("delivery must not apply Azure");
  }
};

const assertRolloutVariable = () => {
  for (const cloud of ["aws", "gcp", "azure"]) {
    const source = read(`infra/modules/${cloud}/service/main.tf`);

    if (
      !source.includes('variable "rollout_percent"') ||
      !source.includes("var.rollout_percent")
    ) {
      fail(`${cloud} service module must accept rollout_percent and use it`);
    }
  }

  const aws = read("infra/modules/aws/service/main.tf");

  if (!/desired_count\s+=\s+local\.min_instances/.test(aws)) {
    fail("API minimum must stay able to serve during the partial shift");
  }

  for (const cloud of ["aws", "gcp"]) {
    const source = read(`infra/environments/production-${cloud}/main.tf`);

    if (
      !source.includes('variable "rollout_percent"') ||
      !source.includes("rollout_percent    = var.rollout_percent")
    ) {
      fail(
        `production-${cloud} must pass rollout_percent into the service module`,
      );
    }
  }
};

assertRestoreScript();
assertMissingDump();
assertPresentDump();
assertRehearsal();
assertDelivery();
assertRolloutVariable();

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("rehearsal restore and partial rollout hold");
