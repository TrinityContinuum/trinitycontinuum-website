CREATE TABLE IF NOT EXISTS appointments (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 organization TEXT NOT NULL,
 date1 TEXT NOT NULL,
 time1 TEXT NOT NULL,
 date2 TEXT NOT NULL,
 time2 TEXT NOT NULL,
 timezone TEXT NOT NULL,
 topic TEXT NOT NULL,
 notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending','sent','failed')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);
