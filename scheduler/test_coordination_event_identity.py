"""Regression for separate task transitions and stable event delivery identity."""
import json
import pathlib
import sqlite3
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parent


class CoordinationEventIdentityTests(unittest.TestCase):
    def test_stale_task_update_creates_no_audit_or_event(self):
        source = (ROOT / "meeting-dossier-api.mjs").read_text()
        self.assertIn("WHERE changes()=1", source)
        db = sqlite3.connect(":memory:")
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("CREATE TABLE scheduler_bookings(id TEXT PRIMARY KEY)")
        db.execute("INSERT INTO scheduler_bookings VALUES('booking')")
        db.execute("CREATE TABLE scheduler_follow_up_tasks(id TEXT PRIMARY KEY, status TEXT NOT NULL)")
        db.execute("INSERT INTO scheduler_follow_up_tasks VALUES('task','done')")
        db.execute("CREATE TABLE scheduler_audit(id INTEGER PRIMARY KEY, entity_type TEXT, entity_id TEXT, action TEXT, actor TEXT, detail_json TEXT)")
        db.executescript((ROOT / "migrations" / "011_coordination_events.sql").read_text())
        # The caller previously read 'open', but another worker already marked 'done'.
        with db:
            db.execute("UPDATE scheduler_follow_up_tasks SET status=? WHERE id=? AND status=?", ('done','task','open'))
            db.execute("INSERT INTO scheduler_audit(entity_type,entity_id,action,actor,detail_json) SELECT 'scheduler_follow_up','task','status_change','admin','{}' WHERE changes()=1")
            db.execute("INSERT INTO scheduler_coordination_events(id,booking_id,event_type,source_id,actor,payload_json) SELECT ?,?,'follow_up_updated','task','admin',? WHERE changes()=1", (str(uuid.uuid4()),'booking','{}'))
        self.assertEqual(db.execute("SELECT count(*) FROM scheduler_audit").fetchone()[0], 0)
        self.assertEqual(db.execute("SELECT count(*) FROM scheduler_coordination_events").fetchone()[0], 0)
        # A valid compare-and-swap produces one audit and one event.
        with db:
            db.execute("UPDATE scheduler_follow_up_tasks SET status=? WHERE id=? AND status=?", ('open','task','done'))
            db.execute("INSERT INTO scheduler_audit(entity_type,entity_id,action,actor,detail_json) SELECT 'scheduler_follow_up','task','status_change','admin','{}' WHERE changes()=1")
            db.execute("INSERT INTO scheduler_coordination_events(id,booking_id,event_type,source_id,actor,payload_json) SELECT ?,?,'follow_up_updated','task','admin',? WHERE changes()=1", (str(uuid.uuid4()),'booking','{\"transition_id\":\"one\"}'))
        self.assertEqual(db.execute("SELECT count(*) FROM scheduler_audit").fetchone()[0], 1)
        self.assertEqual(db.execute("SELECT count(*) FROM scheduler_coordination_events").fetchone()[0], 1)

    def test_reopen_and_recomplete_are_distinct_events(self):
        source = (ROOT / "meeting-dossier-api.mjs").read_text()
        self.assertIn("transition_id:transitionId", source)\n        self.assertIn("const transitionId=crypto.randomUUID()", source)
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
