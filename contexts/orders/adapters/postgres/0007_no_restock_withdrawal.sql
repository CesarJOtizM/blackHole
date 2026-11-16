-- Withdrawal columns for not restocked today. No SQLite. No backfill.
-- orders_app is created in 0001_menu.sql.
-- not_delivered is not a kitchen rank. guest_told_actor_id stays empty
-- until the waiter confirms the guest was told.

ALTER TABLE order_lines DROP CONSTRAINT order_lines_state;

ALTER TABLE order_lines
  ADD COLUMN not_delivered_at text,
  ADD COLUMN guest_told_actor_id text,
  ADD CONSTRAINT order_lines_state CHECK (
    state IN (
      'held',
      'sent',
      'in_preparation',
      'ready',
      'delivered',
      'not_delivered'
    )
  ),
  ADD CONSTRAINT order_lines_not_delivered CHECK (
    (
      state = 'not_delivered'
      AND not_delivered_at IS NOT NULL
    )
    OR (
      state <> 'not_delivered'
      AND not_delivered_at IS NULL
      AND guest_told_actor_id IS NULL
    )
  );
