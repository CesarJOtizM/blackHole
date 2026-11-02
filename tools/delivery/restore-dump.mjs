import { accessSync, constants } from "node:fs";

const readFlag = (name) => {
  const index = process.argv.indexOf(name);

  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }

  return process.argv[index + 1];
};

const cloud = readFlag("--cloud") ?? "";
const dump = readFlag("--dump") ?? "";

if (cloud !== "aws" && cloud !== "gcp") {
  console.error(
    `restore target cloud must be aws or gcp, received ${cloud || "none"}`,
  );
  process.exit(1);
}

let readable = dump.trim() !== "";

if (readable) {
  try {
    accessSync(dump, constants.R_OK);
  } catch {
    readable = false;
  }
}

if (!readable) {
  console.error(`encrypted dump is missing for ${cloud}`);
  process.exit(1);
}

console.log(`restore encrypted dump into ${cloud}`);
