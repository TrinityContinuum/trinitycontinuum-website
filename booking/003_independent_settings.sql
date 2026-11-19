-- Trinity owns the authoritative schedule. Default remains disabled until deployment is verified.
CREATE TABLE IF NOT EXISTS appointment_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
