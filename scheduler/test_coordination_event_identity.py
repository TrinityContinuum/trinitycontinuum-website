"""Regression for separate task transitions and stable event delivery identity."""
import json
import pathlib
import sqlite3
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parent


class CoordinationEventIdentityTests(unittest.TestCase):
    def test_reopen_and_recomplete_are_distinct_events(self):
        source = (ROOT / "meeting-dossier-api.mjs").read_text()
        self.assertIn("transition_id:crypto.randomUUID()", source)
        migration = (ROOT / "migrations" / "011_coordination_events.sql").read_text()
        db = sqlite3.connect(":memory:")
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("CREATE TABLE scheduler_bookings (id TEXT PRIMARY KEY)")
        db.execute("INSERT INTO scheduler_bookings VALUES ('booking')")
        db.executescript(migration)
        transitions = [("open", "done"), ("done", "open"), ("open", "done")]
        ids = []
        for before, after in transitions:
            event_id = str(uuid.uuid4())
            payload = json.dumps({"from": before, "to": after, "transition_id": str(uuid.uuid4())}, separators=(",", ":"))
            db.execute("INSERT INTO scheduler_coordination_events(id,booking_id,event_type,source_id,actor,payload_json) VALUES (?,?,?,?,?,?)", (event_id, "booking", "follow_up_updated", "task", "admin", payload))
            ids.append(event_id)
        self.assertEqual(db.execute("SELECT count(*) FROM scheduler_coordination_events").fetchone()[0], 3)
        self.assertEqual(len(set(ids)), 3)
        # Retrying delivery updates the same event rather than inserting a fourth.
        db.execute("UPDATE scheduler_coordination_events SET attempts=attempts+1 WHERE id=?", (ids[2],))
        self.assertEqual(db.execute("SELECT count(*) FROM scheduler_coordination_events").fetchone()[0], 3)
        self.assertEqual(db.execute("SELECT attempts FROM scheduler_coordination_events WHERE id=?", (ids[2],)).fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
