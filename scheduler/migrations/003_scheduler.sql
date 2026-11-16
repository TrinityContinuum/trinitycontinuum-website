-- 003_scheduler.sql
-- Additive Cloudflare D1 schema. Does not modify existing appointments or appointment_decisions.
-- Review and back up production D1 before applying. Run first against staging.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scheduler_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_by TEXT
);
-- Store validated seven-day windows and timezone as JSON settings, not user-controlled SQL.

CREATE TABLE IF NOT EXISTS scheduler_date_overrides (
  local_date TEXT PRIMARY KEY,
  windows_json TEXT NOT NULL,
  reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS scheduling_opportunities (
  id TEXT PRIMARY KEY,
  organization TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'interested'
    CHECK(status IN ('interested','awaiting_our_response','awaiting_their_response','scheduling','scheduled','completed','declined','cancelled')),
  next_action TEXT,
  next_action_at TEXT,
  owner TEXT,
  source_reference TEXT,
  notes TEXT,
  linked_request_id TEXT REFERENCES appointments(id),
  linked_booking_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_scheduling_opportunities_status ON scheduling_opportunities(status,next_action_at);

CREATE TABLE IF NOT EXISTS scheduler_bookings (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  organization TEXT,
  topic TEXT,
  start_utc TEXT NOT NULL,
  end_utc TEXT NOT NULL,
  owner_timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  mode TEXT NOT NULL CHECK(mode IN ('early_approval','instant','late_approval','manual')),
  status TEXT NOT NULL DEFAULT 'approval_pending'
    CHECK(status IN ('approval_pending','reserved','calendar_created','confirmation_sent','cancelled','failed_recovery','completed')),
  google_event_id TEXT UNIQUE,
  google_meet_url TEXT,
  confirmation_provider_id TEXT,
  linked_request_id TEXT REFERENCES appointments(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(end_utc > start_utc)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_bookings_interval ON scheduler_bookings(start_utc,end_utc,status);

-- Unique start instants are a secondary safeguard, not sufficient to prevent
-- overlapping intervals of different lengths. Booking transactions must also
-- serialize overlap checks before committing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduler_active_start
ON scheduler_bookings(start_utc)
WHERE status IN ('reserved','calendar_created','confirmation_sent');

CREATE TABLE IF NOT EXISTS scheduler_outbox (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES scheduler_bookings(id),
  message_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','sending','sent','retry','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_scheduler_outbox_pending ON scheduler_outbox(state,next_attempt_at);

CREATE TABLE IF NOT EXISTS scheduler_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  detail_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_scheduler_audit_entity ON scheduler_audit(entity_type,entity_id,occurred_at);
