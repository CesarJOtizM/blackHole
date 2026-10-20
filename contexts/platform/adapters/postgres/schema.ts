import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const venueOperations = pgTable("venue_operations", {
  venueId: text("venue_id").primaryKey(),
  mode: text("mode").notNull(),
  operationOwner: text("operation_owner").notNull(),
  generation: integer("generation").notNull(),
});

export const operationalWrites = pgTable("operational_writes", {
  writeId: text("write_id").primaryKey(),
  venueId: text("venue_id").notNull(),
  generation: integer("generation").notNull(),
});
