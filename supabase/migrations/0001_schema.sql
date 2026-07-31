-- =============================================================================
-- Jarvis CRM — database schema
--
-- Run this ONCE in the Supabase SQL Editor. It is safe to re-run: every
-- statement is guarded.
--
-- Two deliberate decisions:
--
--   1. This project does NOT use Supabase Auth. The app has its own three-tile
--      login with passwords held in Vercel's environment. Members are plain
--      rows keyed by m1 / m2 / m3, matching lib/config/members.ts.
--
--   2. Row Level Security is ON for every table with NO policies at all. That
--      is intentional: the public anon key can then read and write absolutely
--      nothing. All access goes through the app's own server using the
--      service_role key, which bypasses RLS. The browser never talks to this
--      database directly.
--
-- Column names are the snake_case of the app's field names, so one generic
-- converter maps rows to objects without a hand-written mapper per table.
-- =============================================================================

create extension if not exists pg_trgm;

-- --------------------------------------------------------------------------
-- Members — exactly three rows, seeded at the bottom
-- --------------------------------------------------------------------------
create table if not exists members (
  id            text primary key,
  slot          smallint not null unique check (slot between 1 and 3),
  name          text not null,
  name_ar       text not null default '',
  color         text not null default '#f36c34',
  initials      text not null default '',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Things a member can change about themselves.
create table if not exists member_profiles (
  member_id     text primary key references members(id) on delete cascade,
  photo         text not null default '',
  planned_start text not null default '09:00',
  planned_end   text not null default '14:00',
  phone         text not null default '',
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Clients
-- --------------------------------------------------------------------------
create table if not exists clients (
  id               text primary key,
  name             text not null,
  name_ar          text not null default '',
  company          text not null default '',
  city             text not null default '',
  address          text not null default '',
  industry         text not null default '',
  website          text not null default '',
  size_guess       text not null default '',

  stage            text not null default 'lead',
  status           text not null default 'active',

  owner_id         text not null references members(id),
  brought_by_id    text references members(id),
  collaborator_ids text[] not null default '{}',

  source           text not null default '',
  referred_by      text not null default '',

  deal_value_sar   numeric(12,2),
  cost_sar         numeric(12,2),

  what_happened    text not null default '',
  what_we_offered  text not null default '',
  objection        text not null default '',
  notes            text not null default '',
  -- Shown to every member before they go anywhere near this client.
  team_warning     text not null default '',

  next_action      text not null default '',
  next_action_at   timestamptz,
  revisit_after    timestamptz,

  -- Only meaningful when status is dead. The reason is required there, so
  -- nobody can quietly kill a company without telling the others why.
  closed_reason    text not null default '',
  closed_at        timestamptz,
  closed_by_id     text not null default '',

  first_contact_at timestamptz,
  last_contact_at  timestamptz,

  created_by_id    text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint dead_needs_a_reason
    check (status <> 'dead' or length(trim(closed_reason)) >= 5)
);

create index if not exists clients_owner_idx  on clients (owner_id);
create index if not exists clients_status_idx on clients (status);
create index if not exists clients_recent_idx on clients (last_contact_at desc nulls last);
create index if not exists clients_name_trgm  on clients using gin (name gin_trgm_ops);

-- --------------------------------------------------------------------------
-- Contacts, interactions, tasks
-- --------------------------------------------------------------------------
create table if not exists contacts (
  id                text primary key,
  client_id         text not null references clients(id) on delete cascade,
  name              text not null default '',
  title             text not null default '',
  phone             text not null default '',
  whatsapp          text not null default '',
  email             text not null default '',
  is_primary        boolean not null default false,
  notes             text not null default '',
  preferred_channel text not null default ''
);
create index if not exists contacts_client_idx on contacts (client_id);

create table if not exists interactions (
  id           text primary key,
  client_id    text not null references clients(id) on delete cascade,
  member_id    text not null references members(id),
  type         text not null,
  happened_at  timestamptz not null default now(),
  duration_min integer,
  summary      text not null default '',
  outcome      text not null default '',
  stage_before text,
  stage_after  text
);
create index if not exists interactions_client_idx on interactions (client_id, happened_at desc);
create index if not exists interactions_member_idx on interactions (member_id, happened_at desc);

create table if not exists tasks (
  id           text primary key,
  title        text not null,
  client_id    text references clients(id) on delete cascade,
  assignee_id  text not null references members(id),
  due_at       timestamptz,
  status       text not null default 'open',
  priority     text not null default 'normal',
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists tasks_assignee_idx on tasks (assignee_id, status);

-- --------------------------------------------------------------------------
-- Hours and the week's plan
-- --------------------------------------------------------------------------
create table if not exists attendance (
  id             text primary key,
  member_id      text not null references members(id) on delete cascade,
  date           date not null,
  check_in_at    timestamptz,
  check_out_at   timestamptz,
  planned_start  text not null default '09:00',
  planned_end    text not null default '14:00',
  status         text not null default 'absent',
  reason         text not null default '',
  minutes_worked integer not null default 0,
  unique (member_id, date)
);
create index if not exists attendance_date_idx on attendance (date);

create table if not exists schedule_days (
  id            text primary key,
  date          date not null,
  member_id     text references members(id) on delete cascade,
  day_type      text not null,
  decided_by_id text not null default '',
  note          text not null default ''
);
create index if not exists schedule_date_idx on schedule_days (date);

-- --------------------------------------------------------------------------
-- Reminders, chat, routes
-- --------------------------------------------------------------------------
create table if not exists reminders (
  id               text primary key,
  member_id        text not null references members(id) on delete cascade,
  title            text not null,
  note             text not null default '',
  due_date         date not null,
  warn_days_before integer not null default 2,
  client_id        text references clients(id) on delete cascade,
  done             boolean not null default false,
  completed_at     timestamptz,
  snoozed_until    date,
  shared_with      text[] not null default '{}',
  auto             boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists reminders_member_idx on reminders (member_id, due_date);

create table if not exists messages (
  id         text primary key,
  from_id    text not null references members(id) on delete cascade,
  -- null means the group thread with all three.
  to_id      text references members(id) on delete cascade,
  body       text not null,
  sent_at    timestamptz not null default now(),
  read_by    text[] not null default '{}',
  client_id  text references clients(id) on delete set null
);
create index if not exists messages_sent_idx on messages (sent_at);

create table if not exists routes (
  id         text primary key,
  member_id  text not null references members(id) on delete cascade,
  date       date not null,
  title      text not null default '',
  -- The ordered stops, each one clientId / addressOverride / note / done.
  stops      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists routes_member_idx on routes (member_id, date);

-- --------------------------------------------------------------------------
-- Audit — so ownership and stage never move silently
-- --------------------------------------------------------------------------
create table if not exists audit_log (
  id        text primary key,
  actor_id  text not null default '',
  entity    text not null default 'client',
  entity_id text not null,
  action    text not null,
  before    text not null default '',
  after     text not null default '',
  at        timestamptz not null default now()
);
create index if not exists audit_entity_idx on audit_log (entity_id, at desc);

-- --------------------------------------------------------------------------
-- Lock everything down.
--
-- RLS on with zero policies means the anon key — which is public, and sits in
-- a public repository — can do nothing at all. Only the server's service_role
-- key, which never leaves Vercel, can read or write.
-- --------------------------------------------------------------------------
alter table members         enable row level security;
alter table member_profiles enable row level security;
alter table clients         enable row level security;
alter table contacts        enable row level security;
alter table interactions    enable row level security;
alter table tasks           enable row level security;
alter table attendance      enable row level security;
alter table schedule_days   enable row level security;
alter table reminders       enable row level security;
alter table messages        enable row level security;
alter table routes          enable row level security;
alter table audit_log       enable row level security;

-- --------------------------------------------------------------------------
-- The three of us. Equal — no roles, no admin.
-- --------------------------------------------------------------------------
insert into members (id, slot, name, name_ar, color, initials) values
  ('m1', 1, 'Ehano',   'إيهانو', '#f36c34', 'EH'),
  ('m2', 2, 'Sammoni', 'سموني',  '#58a2e6', 'SA'),
  ('m3', 3, 'Aboodi',  'عبودي',  '#46bd82', 'AB')
on conflict (id) do update
  set name     = excluded.name,
      name_ar  = excluded.name_ar,
      color    = excluded.color,
      initials = excluded.initials;

insert into member_profiles (member_id) values ('m1'), ('m2'), ('m3')
on conflict (member_id) do nothing;
