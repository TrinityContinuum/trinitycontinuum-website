-- Explicit Jack-approved public booking windows. No windows = no instant booking.
CREATE TABLE IF NOT EXISTS scheduler_open_slots (
 id TEXT PRIMARY KEY,
 start_utc TEXT NOT NULL,
 end_utc TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 created_by TEXT NOT NULL DEFAULT 'administrator',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK(end_utc > start_utc)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_open_slots_range ON scheduler_open_slots(enabled,start_utc,end_utc);
