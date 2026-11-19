-- Additive migration for automatic appointments. Does not alter legacy request records.
-- All timestamps are UTC ISO-8601; slot_key identifies a single offered appointment slot.
CREATE TABLE IF NOT EXISTS automatic_bookings (
  id TEXT PRIMARY KEY,
  slot_key TEXT NOT NULL,
  visitor_name TEXT NOT NULL,
  visitor_email TEXT NOT NULL,
  visitor_organization TEXT,
  topic TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled','reschedule_proposed','rescheduled')),
  calendar_event_id TEXT,
  calendar_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(calendar_sync_status IN ('pending','synced','failed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- Only one active reservation can own a slot. Cancelled/rescheduled slots may be reused.
CREATE UNIQUE INDEX IF NOT EXISTS automatic_bookings_active_slot
ON automatic_bookings(slot_key)
WHERE status IN ('confirmed','reschedule_proposed');
CREATE INDEX IF NOT EXISTS automatic_bookings_email_idx ON automatic_bookings(visitor_email);
CREATE TABLE IF NOT EXISTS booking_actions (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES automatic_bookings(id),
  actor TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('booked','cancelled','reschedule_proposed','rescheduled','rebook_invited','calendar_sync_failed','calendar_synced')),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS booking_actions_booking_idx ON booking_actions(booking_id,created_at);
CREATE TABLE IF NOT EXISTS booking_notifications (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES automatic_bookings(id),
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(booking_id,kind,recipient)
);
