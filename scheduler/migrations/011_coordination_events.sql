-- Durable Coordination Desk alerts. Private, opt-in delivery only.
-- One event per committed change. No direct outbound messaging from request handlers.
CREATE TABLE IF NOT EXISTS scheduler_coordination_events (
 id TEXT PRIMARY KEY,
 booking_id TEXT NOT NULL REFERENCES scheduler_bookings(id),
 event_type TEXT NOT NULL CHECK(event_type IN ('meeting_note_added','follow_up_created','follow_up_updated')),
 source_id TEXT NOT NULL,
 actor TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','delivered','retry','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT,
 delivered_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(event_type,source_id,payload_json)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_coordination_pending ON scheduler_coordination_events(state,next_attempt_at,created_at);
