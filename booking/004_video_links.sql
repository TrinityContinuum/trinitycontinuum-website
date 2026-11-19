-- Owner-controlled video meeting details, separate from legacy appointment intake.
CREATE TABLE IF NOT EXISTS booking_video_links (
 booking_id TEXT PRIMARY KEY REFERENCES automatic_bookings(id),
 meeting_url TEXT NOT NULL,
 instructions TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
