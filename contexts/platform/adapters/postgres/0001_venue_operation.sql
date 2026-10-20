CREATE TABLE venue_operations (
  venue_id text PRIMARY KEY,
  mode text NOT NULL,
  operation_owner text NOT NULL,
  generation integer NOT NULL
);

CREATE TABLE operational_writes (
  write_id text PRIMARY KEY,
  venue_id text NOT NULL,
  generation integer NOT NULL
);
