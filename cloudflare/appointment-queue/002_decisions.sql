CREATE TABLE IF NOT EXISTS appointment_decisions (
 request_id TEXT PRIMARY KEY REFERENCES appointments(id),
 choice TEXT NOT NULL CHECK(choice IN ('first','second','alternate','decline')),
 approved_by TEXT NOT NULL,
 decided_at TEXT NOT NULL DEFAULT (datetime('now')),
 notification_state TEXT NOT NULL DEFAULT 'not_sent' CHECK(notification_state IN ('not_sent','sent','failed')),
 notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_decisions_date ON appointment_decisions(decided_at);
