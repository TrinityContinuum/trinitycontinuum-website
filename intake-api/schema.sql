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

CREATE TABLE IF NOT EXISTS inquiry_mail_jobs (
 id bigserial PRIMARY KEY,
 inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('notify','ack')),
 recipient text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','sent','failed')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz,
 last_error text,
 sent_at timestamptz,
 UNIQUE(inquiry_id,kind)
);
CREATE INDEX IF NOT EXISTS inquiry_mail_jobs_due_idx ON inquiry_mail_jobs(state,next_attempt_at);
REVOKE ALL ON inquiry_mail_jobs FROM PUBLIC;
