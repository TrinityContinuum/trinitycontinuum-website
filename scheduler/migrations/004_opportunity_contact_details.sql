-- Apply after 003_scheduler.sql. Additive contact-directory extension.
ALTER TABLE scheduling_opportunities ADD COLUMN phone TEXT;
ALTER TABLE scheduling_opportunities ADD COLUMN location TEXT;
ALTER TABLE scheduling_opportunities ADD COLUMN website TEXT;
ALTER TABLE scheduling_opportunities ADD COLUMN contact_title TEXT;
ALTER TABLE scheduling_opportunities ADD COLUMN proposed_times TEXT;
ALTER TABLE scheduling_opportunities ADD COLUMN last_contact_at TEXT;
