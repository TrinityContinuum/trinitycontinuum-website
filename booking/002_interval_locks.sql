-- Additive interval locks. Each 30-minute segment is exclusive across
-- both 30- and 60-minute meetings. The existing booking table is unchanged.
CREATE TABLE IF NOT EXISTS automatic_booking_slot_locks (
  slot_start TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES automatic_bookings(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS automatic_booking_slot_locks_booking_id
 ON automatic_booking_slot_locks(booking_id);
-- Release locks only after the calendar event is successfully cancelled or moved.
