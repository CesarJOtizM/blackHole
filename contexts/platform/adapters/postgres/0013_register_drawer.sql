ALTER TABLE cash_registers
  ADD COLUMN drawer text NOT NULL DEFAULT 'absent',
  ADD COLUMN printer_id text;

ALTER TABLE cash_registers
  ADD CONSTRAINT cash_registers_drawer
  CHECK (drawer IN ('present', 'absent'));

ALTER TABLE kitchen_stations
  ADD COLUMN printer_id text;
