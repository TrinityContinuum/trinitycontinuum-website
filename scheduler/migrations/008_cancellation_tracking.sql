-- Cancellation transition state and notification tracking; staging first.
-- SQLite CHECK constraints require a table rebuild to add status values,
-- so use a separate durable cancellation ledger instead.
CREATE TABLE IF NOT EXISTS scheduler_cancellations (
 booking_id TEXT PRIMARY KEY REFERENCES scheduler_bookings(id),
 state TEXT NOT NULL CHECK(state IN ('processing','calendar_removed','completed','needs_reconciliation')),
 actor TEXT NOT NULL,
 expected_status TEXT NOT NULL,
 reopen_requested INTEGER NOT NULL CHECK(reopen_requested IN (0,1)),
 notification_state TEXT NOT NULL DEFAULT 'not_verified'
  CHECK(notification_state IN ('not_verified','requested','not_applicable','verified')),
 started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Block competing booking status updates once a cancellation claim exists.
-- This also forces a rollback if the booking changed between read and claim.
CREATE TRIGGER IF NOT EXISTS scheduler_cancellation_status_guard
BEFORE UPDATE OF status ON scheduler_bookings
WHEN EXISTS (
 SELECT 1 FROM scheduler_cancellations c
 WHERE c.booking_id=OLD.id
 AND c.state IN ('processing','calendar_removed','needs_reconciliation')
 AND (NEW.status!='cancelled' OR OLD.status!=c.expected_status)
)
BEGIN
 SELECT RAISE(ABORT,'booking_cancellation_in_progress_or_stale');
END;
