"""Isolated SQLite regression checks for the scheduler cancellation migration.

Run: python3 -m unittest scheduler/test_cancellation_sqlite.py
No external services or production database are used.
"""
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parent / "migrations"

class CancellationMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("CREATE TABLE appointments(id TEXT PRIMARY KEY)")
        for name in ("003_scheduler.sql", "006_atomic_slot_claims.sql",
                     "007_explicit_open_slots.sql", "008_cancellation_tracking.sql",
                     "009_terminal_booking_status_guard.sql"):
            self.db.executescript((ROOT / name).read_text(encoding="utf-8"))
        self.db.execute(
            """INSERT INTO scheduler_bookings
            (id,idempotency_key,requester_name,requester_email,start_utc,end_utc,mode,status)
            VALUES('book-1','key-1','Test','test@example.invalid',
            '2026-11-20T15:00:00Z','2026-11-20T15:30:00Z','instant','reserved')"""
        )
    def tearDown(self):
        self.db.close()
    def claim(self):
        self.db.execute(
            """INSERT INTO scheduler_cancellations
            (booking_id,state,actor,expected_status,reopen_requested)
            VALUES('book-1','processing','jack','reserved',1)"""
        )
    def test_competing_cancellation_claim_is_rejected(self):
        self.claim()
        with self.assertRaises(sqlite3.IntegrityError):
            self.claim()
    def test_competing_status_change_is_rejected(self):
        self.claim()
        with self.assertRaisesRegex(sqlite3.IntegrityError, "booking_cancellation_in_progress_or_stale"):
            self.db.execute("UPDATE scheduler_bookings SET status='completed' WHERE id='book-1'")
        self.assertEqual(self.db.execute("SELECT status FROM scheduler_bookings").fetchone()[0], "reserved")
    def test_intended_cancellation_is_permitted(self):
        self.claim()
        self.db.execute("UPDATE scheduler_bookings SET status='cancelled' WHERE id='book-1'")
        self.assertEqual(self.db.execute("SELECT status FROM scheduler_bookings").fetchone()[0], "cancelled")
    def test_stale_expected_status_blocks_cancellation(self):
        self.db.execute("UPDATE scheduler_bookings SET status='calendar_created' WHERE id='book-1'")
        self.claim()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE scheduler_bookings SET status='cancelled' WHERE id='book-1'")
    def test_claim_rejects_unrecognized_actorless_record(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO scheduler_cancellations
                (booking_id,state,actor,expected_status,reopen_requested)
                VALUES('book-1','processing',NULL,'reserved',1)"""
            )
    def test_cancelled_booking_cannot_be_reactivated(self):
        self.claim()
        self.db.execute("UPDATE scheduler_bookings SET status='cancelled' WHERE id='book-1'")
        self.db.execute("UPDATE scheduler_cancellations SET state='completed' WHERE booking_id='book-1'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "booking_terminal_status_immutable"):
            self.db.execute("UPDATE scheduler_bookings SET status='reserved' WHERE id='book-1'")
        self.assertEqual(self.db.execute("SELECT status FROM scheduler_bookings WHERE id='book-1'").fetchone()[0], "cancelled")

    def test_completed_booking_cannot_be_reactivated(self):
        self.db.execute("UPDATE scheduler_bookings SET status='completed' WHERE id='book-1'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "booking_terminal_status_immutable"):
            self.db.execute("UPDATE scheduler_bookings SET status='calendar_created' WHERE id='book-1'")

    def test_terminal_booking_nonstatus_update_is_allowed(self):
        self.claim()
        self.db.execute("UPDATE scheduler_bookings SET status='cancelled' WHERE id='book-1'")
        self.db.execute("UPDATE scheduler_bookings SET updated_at='2026-11-21T00:00:00Z' WHERE id='book-1'")
        self.assertEqual(self.db.execute("SELECT status FROM scheduler_bookings").fetchone()[0], "cancelled")

    def test_terminal_status_cannot_be_reactivated_without_cancellation_ledger(self):
        self.db.execute("UPDATE scheduler_bookings SET status='cancelled' WHERE id='book-1'")
        with self.assertRaisesRegex(sqlite3.IntegrityError, "booking_terminal_status_immutable"):
            self.db.execute("UPDATE scheduler_bookings SET status='approval_pending' WHERE id='book-1'")

    def test_repeated_cancelled_status_update_is_allowed(self):
        self.db.execute("UPDATE scheduler_bookings SET status='cancelled' WHERE id='book-1'")
        self.db.execute("UPDATE scheduler_bookings SET status='cancelled' WHERE id='book-1'")
        self.assertEqual(self.db.execute("SELECT status FROM scheduler_bookings").fetchone()[0], "cancelled")

    def test_terminal_guard_rolls_back_multirow_status_update(self):
        self.db.execute("UPDATE scheduler_bookings SET status='cancelled' WHERE id='book-1'")
        self.db.execute(
            """INSERT INTO scheduler_bookings
            (id,idempotency_key,requester_name,requester_email,start_utc,end_utc,mode,status)
            VALUES('book-2','key-2','Test','test2@example.invalid',
            '2026-11-21T15:00:00Z','2026-11-21T15:30:00Z','instant','reserved')"""
        )
        with self.assertRaisesRegex(sqlite3.IntegrityError, "booking_terminal_status_immutable"):
            self.db.execute("UPDATE scheduler_bookings SET status='reserved'")
        statuses = dict(self.db.execute("SELECT id,status FROM scheduler_bookings"))
        self.assertEqual(statuses, {'book-1':'cancelled','book-2':'reserved'})

    def test_explicit_window_can_remain_closed(self):
        self.db.execute(
            """INSERT INTO scheduler_open_slots(id,start_utc,end_utc,enabled,created_by)
            VALUES('slot-1','2026-11-20T15:00:00Z','2026-11-20T15:30:00Z',0,'jack')"""
        )
        match=self.db.execute(
            """SELECT id FROM scheduler_open_slots
            WHERE enabled=1 AND start_utc<=? AND end_utc>=? LIMIT 1""",
            ('2026-11-20T15:00:00Z','2026-11-20T15:30:00Z')
        ).fetchone()
        self.assertIsNone(match)

if __name__ == "__main__":
    unittest.main()
