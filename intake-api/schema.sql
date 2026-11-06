CREATE TABLE IF NOT EXISTS inquiries (
 id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
 category text NOT NULL CHECK (category IN ('A','B','C','D','E','F','G')),
 status text NOT NULL DEFAULT 'new', owner text, next_follow_up timestamptz,
 payload jsonb NOT NULL, email_state text NOT NULL DEFAULT 'pending',
 mail_attempts integer NOT NULL DEFAULT 0, last_mail_error text,
 notified_at timestamptz, acknowledged_at timestamptz
);
CREATE INDEX IF NOT EXISTS inquiries_created_idx ON inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status,category);
REVOKE ALL ON inquiries FROM PUBLIC;
