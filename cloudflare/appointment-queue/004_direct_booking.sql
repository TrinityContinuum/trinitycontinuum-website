-- Staged for trinity-appointments-db. Do not execute on production before approval and backup.
CREATE TABLE IF NOT EXISTS booking_policy (
 id INTEGER PRIMARY KEY CHECK (id=1),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 windows_json TEXT NOT NULL DEFAULT '[]',
 min_notice_hours INTEGER NOT NULL DEFAULT 24 CHECK(min_notice_hours BETWEEN 1 AND 720),
 max_days INTEGER NOT NULL DEFAULT 60 CHECK(max_days BETWEEN 1 AND 365),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO booking_policy (id,enabled,windows_json,min_notice_hours,max_days) VALUES (1,0,'[]',24,60);
CREATE TABLE IF NOT EXISTS appointment_bookings (
 id TEXT PRIMARY KEY,
 slot_start TEXT NOT NULL,
 slot_end TEXT NOT NULL,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 organization TEXT NOT NULL DEFAULT '',
 topic TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('processing','confirmed','needs_reconciliation','cancelled')),
 calendar_event_id TEXT NOT NULL DEFAULT '',
 meet_url TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_trinity_slot ON appointment_bookings(slot_start)
 WHERE state IN ('processing','confirmed','needs_reconciliation');
CREATE INDEX IF NOT EXISTS idx_booking_time ON appointment_bookings(slot_start,state);
