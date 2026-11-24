-- Additive migration; existing bookings, policies and slot locks are preserved.
CREATE TABLE IF NOT EXISTS booking_sessions_v2(
 slot_start TEXT PRIMARY KEY,
 slot_end TEXT NOT NULL,
 host_booking_id TEXT NOT NULL UNIQUE REFERENCES automatic_bookings(id),
 format TEXT NOT NULL CHECK(format IN ('one_on_one','private_group','open_group')),
 guest_capacity INTEGER NOT NULL CHECK(guest_capacity BETWEEN 1 AND 499)
);
CREATE TABLE IF NOT EXISTS booking_session_members_v2(
 booking_id TEXT PRIMARY KEY REFERENCES automatic_bookings(id),
 slot_start TEXT NOT NULL REFERENCES booking_sessions_v2(slot_start),
 email TEXT NOT NULL COLLATE NOCASE,
 seats INTEGER NOT NULL CHECK(seats BETWEEN 1 AND 499),
 UNIQUE(slot_start,email)
);
CREATE TRIGGER IF NOT EXISTS booking_session_capacity_v2
BEFORE INSERT ON booking_session_members_v2
BEGIN
 SELECT CASE WHEN NOT EXISTS(
   SELECT 1 FROM booking_sessions_v2 s JOIN automatic_bookings h ON h.id=s.host_booking_id
   WHERE s.slot_start=NEW.slot_start
   AND (s.host_booking_id=NEW.booking_id OR (s.format='open_group' AND h.status='confirmed' AND h.calendar_sync_status='synced'))
   AND (s.format<>'one_on_one' OR NEW.seats=1)
   AND NEW.seats+COALESCE((SELECT SUM(m.seats) FROM booking_session_members_v2 m WHERE m.slot_start=s.slot_start),0)<=s.guest_capacity
 ) THEN RAISE(ABORT,'Session unavailable or capacity exceeded') END;
END;
