-- STAGING ONLY: run after backup and before activating automatic booking.
-- Public intake must not write these tables without server-side validation.
CREATE TABLE IF NOT EXISTS booking_slots (
 slot_key TEXT PRIMARY KEY,
 central_date TEXT NOT NULL,
 central_start TEXT NOT NULL,
 format TEXT NOT NULL CHECK(format IN ('open_group','private_group','one_on_one')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','partial','canceled')),
 google_event_id TEXT NOT NULL DEFAULT '',
 meet_url TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS booking_attendees (
 booking_id TEXT PRIMARY KEY,
 slot_key TEXT NOT NULL REFERENCES booking_slots(slot_key),
 request_id TEXT NOT NULL UNIQUE REFERENCES appointments(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','partial','canceled')),
 email_delivery_id TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_booking_attendees_slot ON booking_attendees(slot_key,status);
