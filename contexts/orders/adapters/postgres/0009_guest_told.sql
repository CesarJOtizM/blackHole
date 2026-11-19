-- orders_app records who told the guest. The column already exists.
-- No backfill. No new role.

GRANT UPDATE (guest_told_actor_id) ON order_lines TO orders_app;
