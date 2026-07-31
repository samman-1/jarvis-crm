-- ---------------------------------------------------------------------------
-- 0002 — each member owns their own password
--
-- Until now the three passwords lived only in Vercel's environment variables,
-- which meant whoever set up the deployment could read all three and nobody
-- else could change theirs. This column holds a scrypt hash written by
-- /api/auth/password, which nobody can read back into a usable password.
--
-- The environment variables stay as the fallback for anyone who has not set
-- their own yet, so running this changes nothing until someone uses the form
-- in Settings.
-- ---------------------------------------------------------------------------

alter table member_profiles
  add column if not exists password_hash text not null default '';

-- Row level security is already on for this table with no policies, so the
-- anon key cannot read the hash. Only the service_role key on the server can.
