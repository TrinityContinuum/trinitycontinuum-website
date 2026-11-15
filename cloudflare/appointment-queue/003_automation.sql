-- Execute against trinity-appointments-db BEFORE deploying automated confirmations.
-- One delivery record per appointment prevents accidental duplicate invitations.
CREATE TABLE IF NOT EXISTS appointment_delivery (
 request_id TEXT PRIMARY KEY REFERENCES appointments(id),
 choice TEXT NOT NULL CHECK(choice IN ('first','second','alternate','decline')),
 state TEXT NOT NULL CHECK(state IN ('processing','sent','partial','failed_preflight')),
 calendar_event_id TEXT NOT NULL DEFAULT '',
 email_provider_id TEXT NOT NULL DEFAULT '',
 error_stage TEXT NOT NULL DEFAULT '',
 started_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appointment_delivery_state ON appointment_delivery(state);
