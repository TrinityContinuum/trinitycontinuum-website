-- Trinity inquiry data is private. Never expose service-role credentials in a browser.
create table if not exists public.trinity_inquiries (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 reply_due_at timestamptz not null default (now() + interval '1 hour'),
 name text not null, organization text, email text not null,
 reason text not null, industry text, source text, campaign text,
 applications text[] not null default '{}', question_category text,
 city text, state text, country text, project text not null,
 questions text, timeline text, reply_method text,
 status text not null default 'queued' check (status in ('queued','draft_ready','sent','needs_review','failed','closed')),
 draft_subject text, draft_body text, sent_at timestamptz,
 last_error text, dedupe_key text unique,
 constraint trinity_email_size check (char_length(email) between 3 and 200),
 constraint trinity_project_size check (char_length(project) between 1 and 5000)
);
create index if not exists trinity_inquiries_due_idx on public.trinity_inquiries (status,reply_due_at);
create index if not exists trinity_inquiries_segments_idx on public.trinity_inquiries (industry,question_category,source);
alter table public.trinity_inquiries enable row level security;
revoke all on public.trinity_inquiries from anon, authenticated;
-- No public SELECT/INSERT/UPDATE policies. Only server-side privileged function can write.
