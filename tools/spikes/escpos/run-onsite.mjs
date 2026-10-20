import { readFileSync } from "node:fs";

import { renderEscPos } from "#render-escpos";
import { sendBytes } from "#send-bytes";

const jobPath = process.argv[2];

if (typeof jobPath !== "string" || jobPath.startsWith("-")) {
  throw new Error(
    "Usage: node tools/spikes/escpos/run-onsite.mjs <job.json> [--host HOST] [--port PORT] [--path PATH]",
  );
}

const job = readJob(jobPath);
const options = readOptions(process.argv.slice(3));
const bytes = renderEscPos(job);

await sendBytes({
  transport: job.transport,
  bytes,
  host: options.host,
  port: options.port,
  path: options.path,
});

function readJob(filePath) {
  const job = JSON.parse(readFileSync(filePath, "utf8"));

  if (job === null || typeof job !== "object" || Array.isArray(job)) {
    throw new Error("Cloud job must be a JSON object");
  }

  if (job.paperMm !== 80 && job.paperMm !== 58) {
    throw new Error("paperMm must be 80 or 58");
  }

  if (
    !Array.isArray(job.lines) ||
    job.lines.some((line) => typeof line !== "string")
  ) {
    throw new Error("lines must be an array of strings");
  }

  if (job.kickDrawer !== true) {
    throw new Error("kickDrawer must be true");
  }

  if (job.transport !== "network" && job.transport !== "usb") {
    throw new Error('transport must be "network" or "usb"');
  }

  return {
    paperMm: job.paperMm,
    transport: job.transport,
    lines: job.lines,
    kickDrawer: true,
  };
}

function readOptions(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (value === undefined || value.startsWith("-")) {
      throw new Error(`Missing value for ${token}`);
    }

    if (token === "--host") {
      options.host = value;
    } else if (token === "--port") {
      options.port = value;
    } else if (token === "--path") {
      options.path = value;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }

    index += 1;
  }

  return options;
}
