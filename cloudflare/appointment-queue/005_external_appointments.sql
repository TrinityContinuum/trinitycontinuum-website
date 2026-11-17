-- Migration 005: external/legacy Trinity appointments only; no Calendar inserts or emails.
-- Apply on approved private Cloudflare D1 after backup, owner verification and access review.
CREATE TABLE IF NOT EXISTS appointment_external (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_utc TEXT NOT NULL,
  end_utc TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  status TEXT NOT NULL CHECK(status IN ('invited','accepted','completed','cancelled','tentative')),
  platform TEXT NOT NULL DEFAULT '',
  join_url TEXT NOT NULL DEFAULT '',
  attendees TEXT NOT NULL DEFAULT '',
  organizer TEXT NOT NULL DEFAULT '',
  source_key TEXT NOT NULL UNIQUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_external_start ON appointment_external(start_utc);
