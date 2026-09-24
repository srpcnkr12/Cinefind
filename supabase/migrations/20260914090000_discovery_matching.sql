-- Faz 5: Keşfet ve eşleşme (PRD bölüm 7, 9.5, 9.6, 19).
-- Ödeme/entitlement altyapısı henüz yok (Faz 8) — premium-kapılı davranışlar burada
-- sabit "ücretsiz" olarak stub'lanır; bkz. docs/adr/0008-premium-gates-stubbed.md.

-- ============================================================================
-- profiles: saat dilimi (günlük limit sıfırlama için, PRD 8.1)
-- ============================================================================
alter table profiles add column timezone text not null default 'Europe/Istanbul';

-- Onboarding tamamlanınca kullanıcı varsayılan olarak keşfedilebilir olur
-- (ayarlardan kapatma Faz 9'un işi).
create or replace function update_onboarding_step(new_step text)
returns void
language sql
security invoker
as $$
  update profiles set
    onboarding_step = new_step,
    discoverable = case when new_step = 'completed' then true else discoverable end
  where id = auth.uid();
$$;

-- ============================================================================
-- Kuyruk adı PRD 7.6 ile hizalanıyor: taste_recompute_queue -> compat_recompute_queue
-- ============================================================================
alter table taste_recompute_queue rename to compat_recompute_queue;

create or replace function enqueue_compat_recompute(p_user_id uuid)
returns void
language sql
security invoker
as $$
  insert into compat_recompute_queue (user_id, queued_at)
  values (p_user_id, now())
  on conflict (user_id) do update set queued_at = excluded.queued_at;
$$;

drop function enqueue_taste_recompute(uuid);

-- Faz 4 RPC'lerini yeni kuyruk fonksiyonuna işaret edecek şekilde yeniden tanımla.
create or replace function upsert_user_film(
  p_film_id uuid, p_status text, p_rating numeric default null, p_liked boolean default null
)
returns void
language plpgsql
security invoker
as $$
begin
  insert into user_films (user_id, film_id, status, rating, liked, updated_at)
  values (auth.uid(), p_film_id, p_status, p_rating, p_liked, now())
  on conflict (user_id, film_id)
  do update set status = excluded.status, rating = excluded.rating, liked = excluded.liked, updated_at = now();
  perform enqueue_compat_recompute(auth.uid());
end;
$$;

create or replace function add_diary_entry(
  p_film_id uuid, p_watched_on date, p_rating numeric default null, p_is_rewatch boolean default false,
  p_venue text default null, p_note text default null, p_contains_spoiler boolean default false
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  insert into diary_entries (user_id, film_id, watched_on, rating, is_rewatch, venue, note, contains_spoiler)
  values (auth.uid(), p_film_id, p_watched_on, p_rating, p_is_rewatch, p_venue, p_note, p_contains_spoiler)
  returning id into v_id;

  insert into user_films (user_id, film_id, status, rating, first_watched_on, watch_count, updated_at)
  values (auth.uid(), p_film_id, 'watched', p_rating, p_watched_on, 1, now())
  on conflict (user_id, film_id)
  do update set
    status = 'watched',
    rating = coalesce(excluded.rating, user_films.rating),
    first_watched_on = least(coalesce(user_films.first_watched_on, excluded.first_watched_on), excluded.first_watched_on),
    watch_count = user_films.watch_count + 1,
    updated_at = now();

  perform enqueue_compat_recompute(auth.uid());
  return v_id;
end;
$$;

create or replace function set_top_four(film_ids uuid[])
returns void
language plpgsql
security invoker
as $$
begin
  if array_length(film_ids, 1) is not null and array_length(film_ids, 1) > 4 then
    raise exception 'Kadrajım en fazla 4 film içerebilir';
  end if;

  update user_films set top_four_position = null where user_id = auth.uid() and top_four_position is not null;

  for i in 1..coalesce(array_length(film_ids, 1), 0) loop
    insert into user_films (user_id, film_id, top_four_position, liked)
    values (auth.uid(), film_ids[i], i, true)
    on conflict (user_id, film_id)
    do update set top_four_position = excluded.top_four_position, liked = true, updated_at = now();
  end loop;

  perform enqueue_compat_recompute(auth.uid());
end;
$$;

create or replace function submit_taste_reactions(reactions jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  r jsonb;
begin
  for r in select * from jsonb_array_elements(reactions) loop
    insert into user_films (user_id, film_id, status, liked, rating)
    values (
      auth.uid(), (r ->> 'filmId')::uuid, 'watched',
      case r ->> 'reaction' when 'liked' then true when 'disliked' then false else null end,
      case r ->> 'reaction' when 'liked' then 4.5 when 'ok' then 3 when 'disliked' then 1.5 else null end
    )
    on conflict (user_id, film_id)
    do update set status = excluded.status, liked = excluded.liked, rating = excluded.rating, updated_at = now();
  end loop;
  perform enqueue_compat_recompute(auth.uid());
end;
$$;

-- ============================================================================
-- blocks, reports (PRD 9.6, 14.1)
-- ============================================================================
create table blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table blocks enable row level security;
create policy "blocks_owner_select" on blocks for select using (auth.uid() = blocker_id);
create policy "blocks_owner_insert" on blocks for insert with check (auth.uid() = blocker_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'photo', 'post', 'comment', 'message', 'line')),
  target_id uuid not null,
  reason text not null check (
    reason in ('fake_profile', 'underage', 'harassment', 'hate', 'sexual_content', 'spam', 'scam', 'spoiler_abuse', 'other')
  ),
  details text,
  status text not null default 'open' check (status in ('open', 'in_review', 'actioned', 'dismissed')),
  assigned_to uuid,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table reports enable row level security;
create policy "reports_owner_select" on reports for select using (auth.uid() = reporter_id);
create policy "reports_owner_insert" on reports for insert with check (auth.uid() = reporter_id);

-- İki yönlü engelleme artık onaylı fotoğraf politikasına da yansır.
drop policy "profile_photos_approved_public_select" on profile_photos;
create policy "profile_photos_approved_public_select" on profile_photos for select using (
  moderation_status = 'approved'
  and not exists (
    select 1 from blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = profile_photos.user_id)
       or (b.blocker_id = profile_photos.user_id and b.blocked_id = auth.uid())
  )
);

-- ============================================================================
-- swipes, matches, compatibility_scores, taste_vectors (PRD 9.5)
-- ============================================================================
create table swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references profiles (id) on delete cascade,
  target_id uuid not null references profiles (id) on delete cascade,
  action text not null check (action in ('like', 'pass', 'superlike')),
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  unique (swiper_id, target_id)
);

alter table swipes enable row level security;
create policy "swipes_owner_all" on swipes for all using (auth.uid() = swiper_id);
create index swipes_target_action_idx on swipes (target_id, action);

create table matches (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references profiles (id) on delete cascade,
  user_high uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unmatched_at timestamptz,
  unmatched_by uuid,
  compat_raw numeric,
  reasons jsonb not null default '[]',
  constraint matches_user_order check (user_low < user_high),
  unique (user_low, user_high)
);

alter table matches enable row level security;
create policy "matches_member_select" on matches for select using (auth.uid() = user_low or auth.uid() = user_high);
-- Yazma yalnızca SECURITY DEFINER `swipe()`/`block_user()` içinden — istemciye insert/update politikası yok.

create table compatibility_scores (
  user_low uuid not null references profiles (id) on delete cascade,
  user_high uuid not null references profiles (id) on delete cascade,
  raw_score numeric not null,
  components jsonb not null default '{}',
  reasons jsonb not null default '[]',
  computed_at timestamptz not null default now(),
  primary key (user_low, user_high),
  constraint compatibility_scores_user_order check (user_low < user_high)
);

alter table compatibility_scores enable row level security;
-- İstemciye tamamen kapalı: yalnızca `compute-compat` (service_role) yazar,
-- `get_discovery_deck`/`swipe` (SECURITY DEFINER, tablo sahibi) okur.

create table taste_vectors (
  user_id uuid primary key references profiles (id) on delete cascade,
  genre_vector real[] not null default '{}',
  decade_vector real[] not null default '{}',
  country_vector real[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table taste_vectors enable row level security;
-- İstemciye kapalı (yalnızca `compute-compat` service_role ile yazar/okur).

create table daily_usage (
  user_id uuid not null references profiles (id) on delete cascade,
  day date not null,
  swipes_used int not null default 0,
  superlikes_used int not null default 0,
  rewinds_used int not null default 0,
  primary key (user_id, day)
);

alter table daily_usage enable row level security;
create policy "daily_usage_owner_all" on daily_usage for all using (auth.uid() = user_id);

create table profile_impressions (
  viewed_id uuid not null references profiles (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (viewed_id, day)
);

alter table profile_impressions enable row level security;
-- İstemciye kapalı; yalnızca `get_discovery_deck` (SECURITY DEFINER) günceller.

-- ============================================================================
-- conversations / conversation_members — Faz 6'nın ihtiyacı için minimal
-- açılıyor (bkz. docs/adr/0010-conversations-pulled-forward.md). `messages` ve
-- gerçek zamanlı abonelik Faz 6'da eklenecek.
-- ============================================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches (id) on delete cascade,
  kind text not null default 'match' check (kind in ('match', 'super_message')),
  status text not null default 'active' check (status in ('active', 'pending', 'closed')),
  created_at timestamptz not null default now()
);

alter table conversations enable row level security;

create table conversation_members (
  conversation_id uuid not null references conversations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  last_read_message_id uuid,
  muted_until timestamptz,
  primary key (conversation_id, user_id)
);

alter table conversation_members enable row level security;

create policy "conversations_member_select" on conversations for select using (
  exists (select 1 from conversation_members cm where cm.conversation_id = conversations.id and cm.user_id = auth.uid())
);
create policy "conversation_members_participant_select" on conversation_members for select using (
  conversation_id in (select cm2.conversation_id from conversation_members cm2 where cm2.user_id = auth.uid())
);

-- ============================================================================
-- app_config (PRD 9.6) — ücretsiz limitler burada, kodda sabit değil.
-- ============================================================================
create table app_config (
  key text primary key,
  value jsonb not null
);

alter table app_config enable row level security;
create policy "app_config_public_select" on app_config for select using (true);

insert into app_config (key, value) values
  ('free_daily_swipes', '25'),
  ('free_daily_superlikes', '1'),
  ('max_daily_impressions', '3')
on conflict (key) do nothing;

-- ============================================================================
-- film_stats.idf bakımı (PRD 7.2) — gece cron yerine bu fazda elle/dev'de
-- çağrılan bir bakım fonksiyonu; gerçek cron Faz 5 sonrası bir cilalama.
-- ============================================================================
create or replace function refresh_film_idf()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active numeric;
begin
  select greatest(count(*), 1)::numeric into v_active from profiles where onboarding_step = 'completed';

  update film_stats fs set
    watched_count = w.wc,
    idf = ln(1 + v_active / (1 + w.wc))
  from (select film_id, count(*) as wc from user_films where status = 'watched' group by film_id) w
  where fs.film_id = w.film_id;

  update film_stats fs set watched_count = 0, idf = ln(1 + v_active)
  where not exists (select 1 from user_films uf where uf.film_id = fs.film_id and uf.status = 'watched');
end;
$$;

grant execute on function refresh_film_idf() to service_role;

-- ============================================================================
-- get_discovery_deck — aday üretimi + önbellekten skor + kalibrasyon + sıralama
-- (PRD 7.4, 7.5). Skoru önbellekte olmayan adaylar bu istekte nötr (0.5) skorla
-- gösterilir; `compute-compat` Edge Function'ı ayrıca (elle/cron) çağırmak bir
-- sonraki istekte gerçek skoru getirir (bkz. plan gerekçe #6).
-- ============================================================================
create or replace function get_discovery_deck(p_cursor int default 0, p_limit int default 20)
returns table (
  user_id uuid,
  display_name text,
  age int,
  city text,
  intents text[],
  photo_path text,
  top_four_film_ids uuid[],
  distance_bucket text,
  compat_percent int,
  reasons jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_my_age int;
  v_my_gender text;
  v_my_interested_in text[];
  v_my_intents text[];
  v_my_age_min int;
  v_my_age_max int;
  v_my_max_distance_km int;
  v_my_geog extensions.geography;
  v_max_impressions int;
  v_explore_n int;
begin
  select extract(year from age(pr.birthdate))::int, pr.gender, pr.interested_in, pr.intents, pr.age_min, pr.age_max, pr.max_distance_km
    into v_my_age, v_my_gender, v_my_interested_in, v_my_intents, v_my_age_min, v_my_age_max, v_my_max_distance_km
  from profiles pr where pr.id = v_me;

  select pl.geog into v_my_geog from profile_locations pl where pl.user_id = v_me;
  select (ac.value #>> '{}')::int into v_max_impressions from app_config ac where ac.key = 'max_daily_impressions';
  v_explore_n := greatest(1, p_limit / 10);

  if v_my_geog is null then
    return;
  end if;

  drop table if exists tmp_deck;
  create temporary table tmp_deck on commit drop as
  with candidates as (
    select
      p.id,
      p.display_name,
      extract(year from age(p.birthdate))::int as age,
      p.city,
      p.intents,
      p.bio,
      p.last_active_at,
      extensions.st_distance(v_my_geog, pl.geog) / 1000.0 as distance_km,
      (select count(*) from profile_photos pp where pp.user_id = p.id) as photo_count,
      (select count(*) from profile_prompts pr where pr.user_id = p.id) as prompt_count,
      (select count(*) from user_films uf where uf.user_id = p.id and uf.status = 'watched') as watched_count,
      (select array_agg(uf.film_id order by uf.top_four_position)
         from user_films uf where uf.user_id = p.id and uf.top_four_position is not null) as top_four_ids,
      (select pp2.storage_path from profile_photos pp2
         where pp2.user_id = p.id and pp2.moderation_status = 'approved'
         order by pp2.position limit 1) as photo_path
    from profiles p
    join profile_locations pl on pl.user_id = p.id
    where p.id != v_me
      and p.discoverable = true
      and p.deleted_at is null
      and p.last_active_at is not null
      and p.last_active_at > now() - interval '30 days'
      and p.birthdate is not null
      and extract(year from age(p.birthdate))::int between v_my_age_min and v_my_age_max
      and v_my_age between p.age_min and p.age_max
      and p.gender = any(v_my_interested_in)
      and v_my_gender = any(p.interested_in)
      and p.intents && v_my_intents
      and extensions.st_dwithin(v_my_geog, pl.geog, least(v_my_max_distance_km, p.max_distance_km) * 1000)
      and not exists (select 1 from swipes s where s.swiper_id = v_me and s.target_id = p.id)
      and not exists (
        select 1 from blocks b where (b.blocker_id = v_me and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = v_me)
      )
      and exists (select 1 from profile_photos pp3 where pp3.user_id = p.id and pp3.moderation_status = 'approved')
      and coalesce((select ci.count from profile_impressions ci where ci.viewed_id = p.id and ci.day = current_date), 0) < coalesce(v_max_impressions, 3)
    limit 500
  ),
  scored as (
    select
      c.*,
      coalesce(cs.raw_score, 0.5) as raw_score,
      coalesce(cs.reasons, '[]'::jsonb) as reasons,
      exists (
        select 1 from swipes ls where ls.swiper_id = c.id and ls.target_id = v_me
          and ls.action in ('like', 'superlike') and ls.undone_at is null
      ) as liked_me,
      greatest(0, 1 - extract(epoch from (now() - c.last_active_at)) / (30 * 86400.0)) as activity_recency,
      least(1.0, (
        (least(c.photo_count, 6) / 6.0) * 0.4 +
        (case when coalesce(c.bio, '') != '' then 0.2 else 0 end) +
        (least(c.prompt_count, 3) / 3.0) * 0.2 +
        (least(c.watched_count, 20) / 20.0) * 0.2
      )) as profile_quality
    from candidates c
    left join compatibility_scores cs
      on cs.user_low = least(v_me, c.id) and cs.user_high = greatest(v_me, c.id)
  ),
  calibrated as (
    select
      s.*,
      percent_rank() over (order by s.raw_score) as pctile,
      (0.60 * s.raw_score + 0.15 * s.activity_recency + 0.10 * s.profile_quality + 0.10 * (case when s.liked_me then 1 else 0 end)) as final_score
    from scored s
  ),
  main_slice as (
    select *, 'main'::text as bucket from calibrated order by final_score desc limit greatest(p_limit - v_explore_n, 0)
  ),
  explore_slice as (
    select *, 'explore'::text as bucket from calibrated
    where id not in (select id from main_slice) and raw_score >= 0.4
    order by random() limit v_explore_n
  )
  select * from main_slice
  union all
  select * from explore_slice;

  insert into profile_impressions (viewed_id, day, count)
  select id, current_date, 1 from tmp_deck
  on conflict (viewed_id, day) do update set count = profile_impressions.count + 1;

  return query
  select
    d.id,
    d.display_name,
    d.age,
    d.city,
    d.intents,
    d.photo_path,
    d.top_four_ids,
    case
      when d.distance_km < 1 then '<1'
      when d.distance_km < 5 then '1-5'
      when d.distance_km < 10 then '5-10'
      when d.distance_km < 25 then '10-25'
      else '25+'
    end,
    greatest(50, least(99, round(50 + d.pctile * 49)::int)),
    d.reasons
  from tmp_deck d
  order by d.bucket = 'main' desc, d.final_score desc
  limit p_limit offset p_cursor;
end;
$$;

grant execute on function get_discovery_deck(int, int) to authenticated;

-- ============================================================================
-- swipe — eşzamanlı karşılıklı beğenide tek eşleşme (advisory lock ile).
-- ============================================================================
create or replace function swipe(p_target_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_today date;
  v_tz text;
  v_limit int;
  v_superlike_limit int;
  v_used int;
  v_superlikes_used int;
  v_low uuid;
  v_high uuid;
  v_mutual boolean := false;
  v_match_id uuid;
  v_conversation_id uuid;
  v_compat numeric;
  v_reasons jsonb;
begin
  if p_action not in ('like', 'pass', 'superlike') then
    raise exception 'invalid_action';
  end if;

  select coalesce(timezone, 'UTC') into v_tz from profiles where id = v_me;
  v_today := (now() at time zone v_tz)::date;

  select (value #>> '{}')::int into v_limit from app_config where key = 'free_daily_swipes';
  select (value #>> '{}')::int into v_superlike_limit from app_config where key = 'free_daily_superlikes';

  insert into daily_usage (user_id, day) values (v_me, v_today) on conflict (user_id, day) do nothing;

  select swipes_used, superlikes_used into v_used, v_superlikes_used
  from daily_usage where user_id = v_me and day = v_today for update;

  if v_used >= coalesce(v_limit, 25) then
    raise exception 'daily_limit_reached';
  end if;
  if p_action = 'superlike' and v_superlikes_used >= coalesce(v_superlike_limit, 1) then
    raise exception 'daily_superlike_limit_reached';
  end if;

  insert into swipes (swiper_id, target_id, action) values (v_me, p_target_id, p_action)
  on conflict (swiper_id, target_id) do update set action = excluded.action, created_at = now(), undone_at = null;

  update daily_usage set
    swipes_used = swipes_used + 1,
    superlikes_used = superlikes_used + (case when p_action = 'superlike' then 1 else 0 end)
  where user_id = v_me and day = v_today;

  if p_action in ('like', 'superlike') then
    v_low := least(v_me, p_target_id);
    v_high := greatest(v_me, p_target_id);
    -- Aynı çift için eşzamanlı swipe() çağrılarını serileştirir; karşılıklı
    -- beğenide "hiç kimse eşleşme oluşturmadı" yarışını engeller.
    perform pg_advisory_xact_lock(hashtextextended(v_low::text || ':' || v_high::text, 0));

    if exists (
      select 1 from swipes where swiper_id = p_target_id and target_id = v_me
        and action in ('like', 'superlike') and undone_at is null
    ) then
      v_mutual := true;

      select raw_score, reasons into v_compat, v_reasons
      from compatibility_scores where user_low = v_low and user_high = v_high;

      insert into matches (user_low, user_high, compat_raw, reasons)
      values (v_low, v_high, v_compat, coalesce(v_reasons, '[]'::jsonb))
      on conflict (user_low, user_high) do update set compat_raw = excluded.compat_raw
      returning id into v_match_id;

      insert into conversations (match_id, kind, status) values (v_match_id, 'match', 'active')
      returning id into v_conversation_id;

      insert into conversation_members (conversation_id, user_id) values
        (v_conversation_id, v_low), (v_conversation_id, v_high)
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end if;

  return jsonb_build_object('matched', v_mutual, 'match_id', v_match_id);
end;
$$;

grant execute on function swipe(uuid, text) to authenticated;

-- ============================================================================
-- undo_last_swipe — premium henüz yok, her zaman engellenir (bkz. ADR-0008).
-- ============================================================================
create or replace function undo_last_swipe()
returns void
language plpgsql
security invoker
as $$
begin
  raise exception 'premium_required';
end;
$$;

grant execute on function undo_last_swipe() to authenticated;

-- ============================================================================
-- get_likes_received — her zaman bulanık + sayı (bkz. ADR-0008).
-- ============================================================================
create or replace function get_likes_received()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_total int;
begin
  select count(*) into v_total from swipes s
  where s.target_id = v_me and s.action in ('like', 'superlike') and s.undone_at is null
    and not exists (
      select 1 from matches m where m.user_low = least(v_me, s.swiper_id) and m.user_high = greatest(v_me, s.swiper_id)
    )
    and not exists (
      select 1 from blocks b where (b.blocker_id = v_me and b.blocked_id = s.swiper_id) or (b.blocker_id = s.swiper_id and b.blocked_id = v_me)
    );

  return jsonb_build_object('total_count', v_total);
end;
$$;

grant execute on function get_likes_received() to authenticated;

-- ============================================================================
-- block_user / report_content
-- ============================================================================
create or replace function block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_low uuid := least(v_me, p_user_id);
  v_high uuid := greatest(v_me, p_user_id);
begin
  insert into blocks (blocker_id, blocked_id) values (v_me, p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  update matches set unmatched_at = now(), unmatched_by = v_me
  where user_low = v_low and user_high = v_high and unmatched_at is null;

  update conversations c set status = 'closed'
  from matches m
  where c.match_id = m.id and m.user_low = v_low and m.user_high = v_high;

  delete from swipes where (swiper_id = v_me and target_id = p_user_id) or (swiper_id = p_user_id and target_id = v_me);
end;
$$;

grant execute on function block_user(uuid) to authenticated;

create or replace function report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text default null)
returns uuid
language sql
security invoker
as $$
  insert into reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, p_details)
  returning id;
$$;

grant execute on function report_content(text, uuid, text, text) to authenticated;

-- ============================================================================
-- Eşleşilen kişinin temel profilini görebilme (eşleşme anı ekranı, sohbet için
-- gerekli — Faz 3'ün yalnızca-sahibi politikası bunu kapsamıyordu).
-- ============================================================================
create policy "profiles_matched_select" on profiles for select using (
  exists (
    select 1 from matches m
    where m.unmatched_at is null
      and ((m.user_low = auth.uid() and m.user_high = profiles.id)
        or (m.user_high = auth.uid() and m.user_low = profiles.id))
  )
);
