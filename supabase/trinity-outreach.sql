-- Apply only to a dedicated Trinity Supabase project after approval.
create extension if not exists pgcrypto;
create table if not exists public.trinity_contacts (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 email text not null, name text not null default '', organization text not null default '',
 industry text not null default '', region text not null default '', applications text[] not null default '{}',
 source text not null default '', source_details text not null default '',
 eligibility_confirmed boolean not null default false, eligible_at timestamptz,
 status text not null default 'new' check(status in ('new','eligible','contacted','replied','suppressed','bounced')),
 last_contacted_at timestamptz, notes text not null default '',
 unique(email), constraint trinity_contact_email_lower check(email=lower(email))
);
create table if not exists public.trinity_campaigns (
 id uuid primary key default gen_random_uuid(), code text not null unique, title text not null,
 sender_name text not null default 'Trinity Continuum AI Correspondent',
 sender_email text not null default '', daily_limit integer not null default 0 check(daily_limit between 0 and 300),
 hourly_limit integer not null default 0 check(hourly_limit between 0 and 100),
 enabled boolean not null default false, approved_by text, approved_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.trinity_suppressions (
 email text primary key, reason text not null, created_at timestamptz not null default now()
);
create table if not exists public.trinity_outbox (
 id uuid primary key default gen_random_uuid(), contact_id uuid not null references public.trinity_contacts(id),
 campaign_id uuid not null references public.trinity_campaigns(id),
 subject text not null, body text not null, status text not null default 'draft'
 check(status in ('draft','approved','sending','sent','failed','cancelled','needs_review')),
 due_at timestamptz, claimed_at timestamptz, sent_at timestamptz,
 provider_message_id text, error text, attempts integer not null default 0,
 created_at timestamptz not null default now(),
 unique(contact_id,campaign_id)
);
create table if not exists public.trinity_mail_events (
 id uuid primary key default gen_random_uuid(), outbox_id uuid references public.trinity_outbox(id),
 contact_id uuid references public.trinity_contacts(id), event_type text not null,
 provider_event_id text unique, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.trinity_mail_threads (
 id uuid primary key default gen_random_uuid(), contact_id uuid references public.trinity_contacts(id),
 inquiry_id uuid, message_id text unique, in_reply_to text, direction text not null
 check(direction in ('inbound','outbound')), subject text not null default '',
 body text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.trinity_outreach_audit (
 id bigint generated always as identity primary key, action text not null,
 actor text not null default 'system', details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.trinity_contacts enable row level security;
alter table public.trinity_campaigns enable row level security;
alter table public.trinity_suppressions enable row level security;
alter table public.trinity_outbox enable row level security;
alter table public.trinity_mail_events enable row level security;
alter table public.trinity_mail_threads enable row level security;
alter table public.trinity_outreach_audit enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- One database transaction reserves campaign quota before selecting rows.
-- Every campaign row is locked to serialize concurrent scheduler calls.
create or replace function public.trinity_claim_outbox(p_limit integer default 10)
returns setof public.trinity_outbox language plpgsql security invoker as $$
declare campaign_row public.trinity_campaigns%rowtype;
begin
 for campaign_row in
  select * from public.trinity_campaigns where enabled and approved_at is not null
  order by id for update
 loop
  return query
  with picked as (
   select o.id from public.trinity_outbox o
   join public.trinity_contacts t on t.id=o.contact_id
   where o.campaign_id=campaign_row.id and o.status='approved' and o.due_at<=now()
   and t.eligibility_confirmed and t.status='eligible'
   and not exists(select 1 from public.trinity_suppressions s where lower(s.email)=lower(t.email))
   and not exists(select 1 from public.trinity_outbox x where x.contact_id=t.id and x.status in ('sent','sending'))
   and (select count(*) from public.trinity_outbox x where x.status in ('sent','sending') and coalesce(x.claimed_at,x.sent_at)>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') < 300
   order by o.due_at for update of o skip locked
   limit least(
    greatest(p_limit,0),
    greatest(0,300-(select count(*) from public.trinity_outbox x where x.status in ('sent','sending') and coalesce(x.claimed_at,x.sent_at)>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))::integer,
    greatest(0,campaign_row.daily_limit-(
     select count(*) from public.trinity_outbox x where x.campaign_id=campaign_row.id
      and x.status in ('sent','sending') and coalesce(x.claimed_at,x.sent_at)>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
    ))::integer,
    greatest(0,campaign_row.hourly_limit-(
     select count(*) from public.trinity_outbox x where x.campaign_id=campaign_row.id
      and x.status in ('sent','sending') and coalesce(x.claimed_at,x.sent_at)>=now()-interval '1 hour'
    ))::integer
   )
  )
  update public.trinity_outbox o set status='sending',claimed_at=now(),attempts=attempts+1
  from picked where o.id=picked.id returning o.*;
 end loop;
end $$;
revoke execute on function public.trinity_claim_outbox(integer) from public,anon,authenticated;
