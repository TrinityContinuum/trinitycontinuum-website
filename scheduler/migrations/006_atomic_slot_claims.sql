-- Exclusive 15-minute occupancy cells, enforced by D1 unique key.
-- Reservation cells include buffer before and after a booking.
CREATE TABLE IF NOT EXISTS scheduler_slot_claims (
  cell_start_utc TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES scheduler_bookings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scheduler_slot_claim_booking ON scheduler_slot_claims(booking_id);
