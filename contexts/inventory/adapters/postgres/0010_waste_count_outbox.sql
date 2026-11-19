-- Operational waste and count adjustments use the same outbox lane.
-- Sale consumption and reversal stay valid. No backfill.

ALTER TABLE stock_movement_outbox DROP CONSTRAINT stock_movement_outbox_role;

ALTER TABLE stock_movement_outbox
  ADD CONSTRAINT stock_movement_outbox_role CHECK (
    role IN (
      'consumption',
      'reversal',
      'operational_waste',
      'count_adjustment'
    )
  );
