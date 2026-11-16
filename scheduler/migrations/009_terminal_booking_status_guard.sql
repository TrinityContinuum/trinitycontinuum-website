-- 009_terminal_booking_status_guard.sql
-- Additive protection: terminal bookings cannot be reactivated by a status UPDATE.
-- Apply only after 003 and 008; validate on staging before production.
CREATE TRIGGER IF NOT EXISTS scheduler_terminal_booking_status_guard
BEFORE UPDATE OF status ON scheduler_bookings
WHEN OLD.status IN ('cancelled','completed') AND NEW.status != OLD.status
BEGIN
 SELECT RAISE(ABORT,'booking_terminal_status_immutable');
END;
