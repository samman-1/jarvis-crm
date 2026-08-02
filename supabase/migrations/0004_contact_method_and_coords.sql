-- ---------------------------------------------------------------------------
-- 0004 — how we reached them, and where they actually are
--
-- Two columns, both driven by the same complaint: the board tells you what
-- stage a company is at but not what you actually did, and the route can only
-- be drawn by handing the whole thing to Google.
--
--   contact_method  cold email / called / met in person / went, nobody there
--   lat, lng        filled in once per company, then reused, so a route can be
--                   drawn on our own map instead of an embedded one
-- ---------------------------------------------------------------------------

alter table clients
  add column if not exists contact_method text not null default '',
  add column if not exists lat            double precision,
  add column if not exists lng            double precision;

-- Cheap filter for "show me everyone I only emailed".
create index if not exists clients_contact_method_idx
  on clients (contact_method);
