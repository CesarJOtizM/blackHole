import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import {
  DrizzlePrinterRepository,
  DrizzlePrintJobRepository,
  PRINT_JOB_DUPLICATE,
} from "#adapters/postgres/drizzle-print-job-repository.js";
import type {
  ConfiguredPrinter,
  PrintJob,
} from "#application/enqueue-print-job/enqueue-print-job.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0012_printing.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const COMMAND_ID = "command_print_invoice";
const PULSE = Uint8Array.of(0x1b, 0x70, 0x00, 0x19, 0xfa);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const open = async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);

  return client;
};

const waitingJob = (text: string, pulse: Uint8Array | null): PrintJob => ({
  id: "print_job_command_print_invoice",
  commandId: COMMAND_ID,
  printerId: "printer_register",
  document: "invoice",
  paper: "80",
  status: "waiting",
  kickDrawer: pulse !== null,
  columns: 48,
  text,
  pulse,
});

it("given a waiting job, when it is inserted, then findByCommand returns an equal copy without a tenant", async () => {
  const client = await open();
  const jobs = new DrizzlePrintJobRepository(client, TENANT_A);
  const pulse = Uint8Array.from(PULSE);
  const job = waitingJob("Invoice SETP990000001", pulse);

  await jobs.insert(job);
  job.text = "changed";
  pulse[0] = 0;

  const found = await jobs.findByCommand(COMMAND_ID);
  const stored = waitingJob("Invoice SETP990000001", Uint8Array.from(PULSE));

  expect(found).toEqual(stored);
  expect(found).not.toBe(job);
  expect(found).not.toHaveProperty("tenantId");
  expect(found?.pulse).not.toBe(pulse);

  if (found?.pulse === null || found?.pulse === undefined) {
    throw new Error("Expected the stored pulse.");
  }

  found.pulse[0] = 0;
  found.text = "changed again";

  expect(await jobs.findByCommand(COMMAND_ID)).toEqual(stored);
});

it("given a waiting job, when the same command is inserted again, then the second insert is rejected", async () => {
  const client = await open();
  const jobs = new DrizzlePrintJobRepository(client, TENANT_A);
  const job = waitingJob("Invoice SETP990000001", null);
  await jobs.insert(job);

  await expect(
    jobs.insert({
      ...job,
      id: "print_job_command_print_invoice_again",
      text: "a second copy",
    }),
  ).rejects.toThrow(PRINT_JOB_DUPLICATE);

  expect(await jobs.findByCommand(COMMAND_ID)).toEqual(job);
});

it("given a job stored for tenant A, when tenant B reads that command, then the other tenant stays hidden", async () => {
  const client = await open();
  const tenantA = new DrizzlePrintJobRepository(client, TENANT_A);
  const tenantB = new DrizzlePrintJobRepository(client, TENANT_B);
  const jobA = waitingJob("Invoice for tenant A", null);
  const jobB = waitingJob("Invoice for tenant B", null);

  await tenantA.insert(jobA);

  expect(await tenantB.findByCommand(COMMAND_ID)).toBeNull();

  await tenantB.insert(jobB);

  expect(await tenantA.findByCommand(COMMAND_ID)).toEqual(jobA);
  expect(await tenantB.findByCommand(COMMAND_ID)).toEqual(jobB);
  expect(jobA).not.toHaveProperty("tenantId");
  expect(jobB).not.toHaveProperty("tenantId");
});

it("given a printer saved for tenant A, when tenant B finds that printer, then each tenant keeps its own paper", async () => {
  const client = await open();
  const tenantA = new DrizzlePrinterRepository(client, TENANT_A);
  const tenantB = new DrizzlePrinterRepository(client, TENANT_B);
  const printerA: ConfiguredPrinter = {
    id: "printer_register",
    paper: "58",
  };
  const printerB: ConfiguredPrinter = {
    id: "printer_register",
    paper: "80",
  };

  await tenantA.save(printerA);

  expect(await tenantB.find(printerA.id)).toBeNull();

  await tenantB.save(printerB);

  expect(await tenantA.find(printerA.id)).toEqual(printerA);
  expect(await tenantB.find(printerB.id)).toEqual(printerB);
  expect(printerA).not.toHaveProperty("tenantId");
});

it("given printers and jobs for tenants A and B, when printing_app selects without a tenant filter, then only the current tenant returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO printers (tenant_id, id, paper) VALUES
      ('${TENANT_A}', 'printer_a', '58'),
      ('${TENANT_B}', 'printer_b', '80');
    INSERT INTO print_jobs (
      tenant_id, id, command_id, printer_id, document, paper, status,
      kick_drawer, columns, body, pulse
    ) VALUES
      (
        '${TENANT_A}', 'job_a', 'command_a', 'printer_a', 'invoice', '80',
        'waiting', true, 48, 'tenant A', NULL
      ),
      (
        '${TENANT_B}', 'job_b', 'command_b', 'printer_b', 'invoice', '58',
        'waiting', false, 32, 'tenant B', NULL
      )
  `);
  await client.exec("SET ROLE printing_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);

  const jobs = await client.query<{ command_id: string }>(
    "SELECT command_id FROM print_jobs",
  );
  const printers = await client.query<{ id: string }>(
    "SELECT id FROM printers",
  );

  expect(jobs.rows.map((row) => row.command_id)).toEqual(["command_a"]);
  expect(printers.rows.map((row) => row.id)).toEqual(["printer_a"]);
});

it("given the printing migration, when row security is read, then it is enabled and forced for printing_app", () => {
  const sql = migration.toLowerCase();

  expect(sql).toContain("create role printing_app");
  expect(sql).toContain("create table printers");
  expect(sql).toContain("create table print_jobs");
  expect(sql).toContain("primary key (tenant_id, id)");
  expect(sql).toContain(
    "constraint print_jobs_command unique (tenant_id, command_id)",
  );
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("force row level security");
  expect(sql).toContain("current_setting('app.tenant_id')");
  expect(sql).toContain(
    "grant select, insert on printers, print_jobs to printing_app",
  );
  expect(sql).not.toContain("sqlite");
});
