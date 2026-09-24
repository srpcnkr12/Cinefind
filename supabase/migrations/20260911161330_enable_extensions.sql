-- Faz 0: temel uzantılar. İş mantığı (tablolar, RLS) Faz 1+'da eklenir.
-- Bkz. PRD bölüm 8.1, 19 (Faz 0 kabul kriterleri).

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron with schema extensions;
