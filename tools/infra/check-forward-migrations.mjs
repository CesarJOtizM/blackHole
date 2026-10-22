import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const migrations = path.join(
  root,
  "contexts",
  "platform",
  "adapters",
  "postgres",
);
const required = ["0001_venue_operation.sql", "0002_organization.sql"];

export const migrationProblems = (files) => {
  const problems = [];

  for (const name of required) {
    if (!files.some((file) => file.name === name)) {
      problems.push(`missing migration ${name}`);
    }
  }

  for (const file of files) {
    if (/\bdrop\b/i.test(file.source) || /\brename\b/i.test(file.source)) {
      problems.push(`${file.name} contains DROP or RENAME`);
    }
  }

  return problems;
};

const files = readdirSync(migrations)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => ({
    name,
    source: readFileSync(path.join(migrations, name), "utf8"),
  }));

if (process.argv.includes("--self-check")) {
  const rejected = migrationProblems([
    {
      name: "0001_venue_operation.sql",
      source: "CREATE TABLE venue_operations ();",
    },
    { name: "0002_organization.sql", source: "CREATE TABLE organizations ();" },
    {
      name: "0009_bad.sql",
      source: "ALTER TABLE organizations DROP COLUMN name;",
    },
  ]);

  if (!rejected.some((line) => line.includes("0009_bad.sql"))) {
    console.error("self-check did not reject DROP");
    process.exit(1);
  }

  if (!existsSync(path.join(migrations, required[0]))) {
    console.error("0001 is missing");
    process.exit(1);
  }
}

const problems = migrationProblems(files);

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("migrations stay forward-only and keep 0001 and 0002");
