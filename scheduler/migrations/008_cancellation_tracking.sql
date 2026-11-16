-- Cancellation transition state and notification tracking; staging first.
-- SQLite CHECK constraints require a table rebuild to add status values,
-- so use a separate durable cancellation ledger instead.
CREATE TABLE IF NOT EXISTS scheduler_cancellations (
 booking_id TEXT PRIMARY KEY REFERENCES scheduler_bookings(id),
 state TEXT NOT NULL CHECK(state IN ('processing','calendar_removed','completed','needs_reconciliation')),
 actor TEXT NOT NULL,
 reopen_requested INTEGER NOT NULL CHECK(reopen_requested IN (0,1)),
 notification_state TEXT NOT NULL DEFAULT 'not_verified'
  CHECK(notification_state IN ('not_verified','requested','not_applicable','verified')),
 started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
