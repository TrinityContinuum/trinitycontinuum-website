-- Additive private meeting dossiers and follow-up tasks. Apply in staging first.
-- Notes are internal business records; never expose via public booking routes.
CREATE TABLE IF NOT EXISTS scheduler_meeting_notes (
 id TEXT PRIMARY KEY,
 booking_id TEXT NOT NULL REFERENCES scheduler_bookings(id),
 phase TEXT NOT NULL CHECK(phase IN ('preparation','meeting','follow_up')),
 body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 12000),
 author TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_scheduler_meeting_notes_booking ON scheduler_meeting_notes(booking_id,created_at);
CREATE TABLE IF NOT EXISTS scheduler_follow_up_tasks (
 id TEXT PRIMARY KEY,
 booking_id TEXT NOT NULL REFERENCES scheduler_bookings(id),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 240),
 details TEXT NOT NULL DEFAULT '',
 owner TEXT NOT NULL,
 due_at TEXT,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','done','cancelled')),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_scheduler_follow_up_due ON scheduler_follow_up_tasks(status,due_at);
CREATE INDEX IF NOT EXISTS idx_scheduler_follow_up_booking ON scheduler_follow_up_tasks(booking_id);
