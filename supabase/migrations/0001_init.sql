-- =============================================================================
-- Jarvis CRM — Phase B schema
--
-- NOT YET EXECUTED. This is the target shape for Ehan's Supabase project.
-- Run it only when we are ready to move off the local mock provider.
--
-- Design notes:
--   * All three members are equal. There are no roles and no admin — the
--     product only works if nobody can quietly edit the record.
--   * All three members can read everything. Full transparency is the product.
--   * Ownership and stage changes are audited, so nothing moves silently.
--   * `status` is separate from `stage` — a client can be at "proposal" and
--     still be permanently dead.
-- =============================================================================

create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------

create type client_stage     as enum ('lead','contacted','meeting','proposal','negotiation','won','lost');
create type client_status    as enum ('active','on_hold','won','lost_retryable','dead');
create type interaction_type as enum ('visit','call','whatsapp','email','meeting','proposal_sent','follow_up');
create type task_status      as enum ('open','done','dropped');
create type priority_level   as enum ('low','normal','high');
create type attendance_status as enum ('present','late','left_early','absent','off','approved_off');
create type day_decision     as enum ('field','meeting','on','off','holiday');

-- --------------------------------------------------------------------------
-- Members — exactly three rows
-- --------------------------------------------------------------------------

create table members (
  id             uuid primary key references auth.users(id) on delete cascade,
  slot           smallint not null unique check (slot between 1 and 3),
  name           text not null,
  name_ar        text not null default '',
  email          text not null unique,
  phone          text not null default '',
  color          text not null,
  planned_start  time not null default '09:00',
  planned_end    time not null default '14:00',
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Clients
-- --------------------------------------------------------------------------

create table clients (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  name_ar          text not null default '',
  company          text not null default '',
  city             text not null default '',
  industry         text not null default '',
  website          text not null default '',
  size_guess       text not null default '',

  stage            client_stage  not null default 'lead',
  status           client_status not null default 'active',

  owner_id         uuid not null references members(id),
  brought_by_id    uuid references members(id),

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
  revisit_after    date,

  -- Populated only when status = 'dead'. The check below makes the reason
  -- mandatory at the database level, not just in the UI.
  closed_reason    text not null default '',
  closed_at        timestamptz,
  closed_by_id     uuid references members(id),

  first_contact_at timestamptz,
  last_contact_at  timestamptz,

  created_by_id    uuid not null references members(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint dead_needs_a_reason
    check (status <> 'dead' or length(trim(closed_reason)) >= 10)
);

create index clients_owner_idx   on clients (owner_id);
create index clients_stage_idx   on clients (stage);
create index clients_status_idx  on clients (status);
create index clients_recent_idx  on clients (last_contact_at desc nulls last);
create index clients_name_trgm   on clients using gin (name gin_trgm_ops);
create index clients_company_trgm on clients using gin (company gin_trgm_ops);

-- Anyone else who has also dealt with this client.
create table client_collaborators (
  client_id uuid not null references clients(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (client_id, member_id)
);

-- --------------------------------------------------------------------------
-- Contacts
-- --------------------------------------------------------------------------

create table contacts (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references clients(id) on delete cascade,
  name              text not null,
  title             text not null default '',
  phone             text not null default '',
  whatsapp          text not null default '',
  email             text not null default '',
  is_primary        boolean not null default false,
  preferred_channel text not null default '',
  notes             text not null default ''
);

create index contacts_client_idx on contacts (client_id);
-- Last 9 digits, so +9665…, 05… and 5… all match each other.
create index contacts_phone_idx on contacts (right(regexp_replace(phone, '\D', '', 'g'), 9));

-- --------------------------------------------------------------------------
-- Interactions — the activity spine of the whole app
-- --------------------------------------------------------------------------

create table interactions (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references clients(id) on delete cascade,
  member_id    uuid not null references members(id),
  type         interaction_type not null,
  happened_at  timestamptz not null default now(),
  duration_min integer,
  summary      text not null,
  outcome      text not null default '',
  stage_before client_stage,
  stage_after  client_stage,
  created_at   timestamptz not null default now()
);

create index interactions_client_idx on interactions (client_id, happened_at desc);
create index interactions_member_idx on interactions (member_id, happened_at desc);

-- --------------------------------------------------------------------------
-- Tasks
-- --------------------------------------------------------------------------

create table tasks (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  client_id    uuid references clients(id) on delete cascade,
  assignee_id  uuid not null references members(id),
  due_at       timestamptz,
  status       task_status not null default 'open',
  priority     priority_level not null default 'normal',
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index tasks_assignee_idx on tasks (assignee_id, status, due_at);

-- --------------------------------------------------------------------------
-- Attendance — one row per member per working day
-- --------------------------------------------------------------------------

create table attendance (
  id             uuid primary key default uuid_generate_v4(),
  member_id      uuid not null references members(id) on delete cascade,
  date           date not null,
  check_in_at    timestamptz,
  check_out_at   timestamptz,
  planned_start  time not null default '09:00',
  planned_end    time not null default '14:00',
  status         attendance_status not null default 'absent',
  reason         text not null default '',
  minutes_worked integer not null default 0,
  unique (member_id, date)
);

create index attendance_date_idx on attendance (date);

-- --------------------------------------------------------------------------
-- Schedule — the Wed/Thu decision and any calendar overrides
-- --------------------------------------------------------------------------

create table schedule_days (
  id             uuid primary key default uuid_generate_v4(),
  date           date not null,
  -- null means the decision applies to the whole team
  member_id      uuid references members(id) on delete cascade,
  day_type       day_decision not null,
  decided_by_id  uuid references members(id),
  note           text not null default '',
  created_at     timestamptz not null default now(),
  unique (date, member_id)
);

-- --------------------------------------------------------------------------
-- Audit — so ownership and stage never move silently
-- --------------------------------------------------------------------------

create table audit_log (
  id        uuid primary key default uuid_generate_v4(),
  actor_id  uuid references members(id),
  entity    text not null,
  entity_id uuid not null,
  action    text not null,
  before    jsonb,
  after     jsonb,
  at        timestamptz not null default now()
);

create index audit_entity_idx on audit_log (entity_id, at desc);

-- --------------------------------------------------------------------------
-- Triggers
-- --------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger clients_touch
  before update on clients
  for each row execute function touch_updated_at();

create or replace function audit_client_change() returns trigger as $$
begin
  if new.stage is distinct from old.stage then
    insert into audit_log (actor_id, entity, entity_id, action, before, after)
    values (auth.uid(), 'client', new.id, 'stage_changed',
            to_jsonb(old.stage), to_jsonb(new.stage));
  end if;

  if new.owner_id is distinct from old.owner_id then
    insert into audit_log (actor_id, entity, entity_id, action, before, after)
    values (auth.uid(), 'client', new.id, 'owner_changed',
            to_jsonb(old.owner_id), to_jsonb(new.owner_id));
  end if;

  if new.status is distinct from old.status then
    insert into audit_log (actor_id, entity, entity_id, action, before, after)
    values (auth.uid(), 'client', new.id,
            case when new.status = 'dead' then 'marked_dead' else 'status_changed' end,
            to_jsonb(old.status), to_jsonb(new.status));
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger clients_audit
  after update on clients
  for each row execute function audit_client_change();

-- --------------------------------------------------------------------------
-- Row level security
--
-- Every member reads everything — that is the entire point of the product.
-- Writes are open to any member (we cover for each other) but audited.
-- Deletes are restricted to whoever created the record.
-- --------------------------------------------------------------------------

alter table members              enable row level security;
alter table clients              enable row level security;
alter table client_collaborators enable row level security;
alter table contacts             enable row level security;
alter table interactions         enable row level security;
alter table tasks                enable row level security;
alter table attendance           enable row level security;
alter table schedule_days        enable row level security;
alter table audit_log            enable row level security;

create or replace function is_team_member() returns boolean as $$
  select exists (select 1 from members where id = auth.uid() and active);
$$ language sql security definer stable;

create policy team_read   on members              for select using (is_team_member());
create policy team_read   on clients              for select using (is_team_member());
create policy team_read   on client_collaborators for select using (is_team_member());
create policy team_read   on contacts             for select using (is_team_member());
create policy team_read   on interactions         for select using (is_team_member());
create policy team_read   on tasks                for select using (is_team_member());
create policy team_read   on attendance           for select using (is_team_member());
create policy team_read   on schedule_days        for select using (is_team_member());
create policy team_read   on audit_log            for select using (is_team_member());

create policy team_write  on clients              for insert with check (is_team_member());
create policy team_update on clients              for update using (is_team_member());
create policy team_delete on clients              for delete using (created_by_id = auth.uid());

create policy team_write  on client_collaborators for insert with check (is_team_member());
create policy team_delete on client_collaborators for delete using (is_team_member());

create policy team_write  on contacts             for insert with check (is_team_member());
create policy team_update on contacts             for update using (is_team_member());
create policy team_delete on contacts             for delete using (is_team_member());

create policy team_write  on interactions         for insert with check (member_id = auth.uid());
create policy team_update on interactions         for update using (member_id = auth.uid());

create policy team_write  on tasks                for insert with check (is_team_member());
create policy team_update on tasks                for update using (is_team_member());
create policy team_delete on tasks                for delete using (is_team_member());

-- Attendance is the one place we do NOT let members edit each other:
-- you record your own hours.
create policy own_write   on attendance           for insert with check (member_id = auth.uid());
create policy own_update  on attendance           for update using (member_id = auth.uid());

create policy team_write  on schedule_days        for insert with check (is_team_member());
create policy team_update on schedule_days        for update using (is_team_member());

-- --------------------------------------------------------------------------
-- Views — keep the heavy arithmetic in Postgres, not in the browser
-- --------------------------------------------------------------------------

create or replace view v_client_overview as
select
  c.*,
  o.name as owner_name,
  o.slot as owner_slot,
  (select count(*) from interactions i where i.client_id = c.id) as interaction_count,
  (select i.summary from interactions i
    where i.client_id = c.id order by i.happened_at desc limit 1) as last_summary,
  extract(day from now() - c.last_contact_at)::int as days_since_contact
from clients c
join members o on o.id = c.owner_id;

create or replace view v_member_week_stats as
select
  m.id as member_id,
  date_trunc('week', i.happened_at + interval '1 day') - interval '1 day' as week_start,
  count(*)                                                    as interactions,
  count(distinct i.client_id)                                 as clients_touched,
  count(*) filter (where i.type = 'meeting')                  as meetings,
  count(*) filter (where i.type = 'visit')                    as visits,
  count(*) filter (where i.type = 'proposal_sent')            as proposals_sent
from members m
left join interactions i on i.member_id = m.id
group by m.id, week_start;
