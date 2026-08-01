-- ---------------------------------------------------------------------------
-- 0003 — you cannot take someone else's client without asking
--
-- Until now a company owned by one member could be picked up by another with
-- a single tap: the warning named the owner, then offered "add me as a
-- collaborator" and did it. That is a warning, not a rule, and the whole point
-- of this system is that two people never work the same door.
--
-- Now the second member asks, and the owner answers. Nothing changes hands
-- until they do.
-- ---------------------------------------------------------------------------

create table if not exists client_access_requests (
  id           text primary key,
  client_id    text not null references clients(id) on delete cascade,
  -- Who wants in.
  requester_id text not null references members(id) on delete cascade,
  -- Who has to say yes. Copied at request time so the row still reads
  -- correctly if the client changes hands later.
  owner_id     text not null references members(id) on delete cascade,
  reason       text not null default '',
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'declined')),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),

  -- One live request per person per client. Re-asking updates the same row
  -- instead of filling the owner's screen with copies.
  unique (client_id, requester_id)
);

create index if not exists car_owner_idx
  on client_access_requests (owner_id, status);
create index if not exists car_requester_idx
  on client_access_requests (requester_id, status);

-- Same posture as every other table: RLS on, no policies, so only the
-- server's service_role key can touch it.
alter table client_access_requests enable row level security;
