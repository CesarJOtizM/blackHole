import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core";

import type { PaperWidth, PrintDocument } from "#domain/render.js";

export const printers = pgTable(
  "printers",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    paper: text("paper").$type<PaperWidth>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);

export const printJobs = pgTable(
  "print_jobs",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    commandId: text("command_id").notNull(),
    printerId: text("printer_id").notNull(),
    document: text("document").$type<PrintDocument>().notNull(),
    paper: text("paper").$type<PaperWidth>().notNull(),
    status: text("status").$type<"waiting" | "printed" | "failed">().notNull(),
    kickDrawer: boolean("kick_drawer").notNull(),
    columns: integer("columns").notNull(),
    body: text("body").notNull(),
    pulse: jsonb("pulse").$type<number[] | null>(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    unique("print_jobs_command").on(table.tenantId, table.commandId),
  ],
);
